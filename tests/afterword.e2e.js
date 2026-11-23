import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

function fullMapLayout({viewport, view, report}) {
  const pan = document.querySelector('.voyage-pan');
  const frame = pan.getBoundingClientRect();
  const image = pan.querySelector('.voyage-plate > img').getBoundingClientRect();
  const pins = [...pan.querySelectorAll('.voyage-pin')].map(pin => pin.getBoundingClientRect());
  const contained = box => box.width > 0 && box.height > 0 && box.left >= frame.left - 1 &&
    box.right <= frame.right + 1 && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1;
  const viewportReady = Math.abs(visualViewport.width - viewport.width) <= 1 &&
    Math.abs(visualViewport.height - viewport.height) <= 1;
  const fits = viewportReady && pan.scrollWidth <= pan.clientWidth + 1 && contained(image) &&
    pins.length === (view === 'overview' ? 3 : 0) && pins.every(contained);
  if (!report) return fits;
  return {
    fits, view, viewport, visual: [visualViewport.width, visualViewport.height],
    inner: [innerWidth, innerHeight], body: document.body.getBoundingClientRect().toJSON(),
    frame: frame.toJSON(), image: image.toJSON(), pins: pins.map(pin => pin.toJSON()),
    scrollWidth: pan.scrollWidth, clientWidth: pan.clientWidth,
    coarse: matchMedia('(pointer: coarse)').matches, landscape: matchMedia('(orientation: landscape)').matches,
    landscapeRule: matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 650px)').matches,
    grid: getComputedStyle(pan.closest('.voyage')).gridTemplate, panDisplay: getComputedStyle(pan).display,
  };
}

async function assertFullMap(page, view = 'overview') {
  const expected = {viewport: page.viewportSize(), view};
  try {
    await page.waitForFunction(fullMapLayout, expected, {polling: 'raf', timeout: 10000});
  } catch (error) {
    const geometry = await page.evaluate(fullMapLayout, {...expected, report: true});
    throw new Error('Full map failed to settle at requested viewport: ' + JSON.stringify(geometry), {cause: error});
  }
  const geometry = await page.evaluate(fullMapLayout, {...expected, report: true});
  assert.ok(geometry.fits, 'Full map failed final geometry check: ' + JSON.stringify(geometry));
}

async function assertVisibleEffect(page, effectName) {
  const effect = page.locator('[data-voyage-effect="' + effectName + '"]');
  await effect.waitFor({state: 'visible'});
  const boatWidths = await effect.locator('image').evaluateAll(images => Promise.all(images.map(async node => {
    const bitmap = new Image();
    bitmap.src = node.href.baseVal;
    await bitmap.decode();
    return bitmap.naturalWidth;
  })));
  if (effectName !== 'window') {
    assert.ok(boatWidths.length > 0 && boatWidths.every(width => width > 100), effectName + ' must load a painted ferry');
  }
  const frame = page.locator('.voyage-pan');
  const withEffect = PNG.sync.read(await frame.screenshot({animations: 'disabled'}));
  const without = PNG.sync.read(await frame.screenshot({
    animations: 'disabled', style: '[data-voyage-effect] { visibility: hidden !important; }',
  }));
  assert.equal(withEffect.width, without.width);
  assert.equal(withEffect.height, without.height);
  let changed = 0;
  for (let i = 0; i < withEffect.data.length; i += 4) {
    const difference = Math.abs(withEffect.data[i] - without.data[i]) +
      Math.abs(withEffect.data[i + 1] - without.data[i + 1]) +
      Math.abs(withEffect.data[i + 2] - without.data[i + 2]);
    if (difference > 45) changed++;
  }
  assert.ok(changed > 50, effectName + ' must materially change the painted landscape; pixels: ' + changed);
}

const server = process.env.GAME_URL ? null : spawn(process.execPath, ['server.mjs'], {env: {...process.env, PORT: '0'}, windowsHide: true});
let browser;
try {
  let url = process.env.GAME_URL;
  if (server) {
    const [output] = await once(server.stdout, 'data');
    url = output.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  }
  if (process.env.ARTIFACT_DIR) await mkdir(process.env.ARTIFACT_DIR, {recursive: true});
  browser = await chromium.launch();
  for (const mobile of [false, true]) {
    const context = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1366, height: 768}, hasTouch: mobile, isMobile: mobile, reducedMotion: mobile ? 'reduce' : 'no-preference'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.evaluate(({ mobile }) => {
      localStorage.setItem('the-last-post.save.v1', JSON.stringify({
        version: 1, started: true, solved: {clock: true, greenhouse: true, platform: true},
        decisions: mobile ? {clock: 'forgive', greenhouse: 'plant', platform: 'farewell'} : {clock: 'truth', greenhouse: 'share', platform: 'wait'},
        ending: mobile ? 'preserve' : 'carry',
      }));
      localStorage.setItem('the-last-post.settings.v1', JSON.stringify({language: mobile ? 'zh-CN' : 'en', quality: 'low'}));
    }, { mobile });
    await page.reload();
    await page.locator('#continue-button').click();
    await page.locator('#start-voyage').click();
    const action = (key, value) => page.locator('#voyage [data-voyage-action="' + key + '"]' + (value === undefined ? '' : '[data-value="' + value + '"]'));
    const operate = (key, value) => action(key, value).first().click();
    const visitSpot = i => {
      const pin = page.locator('.voyage-pin[data-value="' + i + '"]');
      return mobile ? pin.tap() : pin.click();
    };
    const solve = async (pieces, recipient) => {
      for (const piece of pieces) await operate('piece', piece);
      await operate('check'); await operate('deliver', recipient);
    };
    const saveShot = async name => {
      if (process.env.ARTIFACT_DIR) {
        await page.screenshot({path: join(process.env.ARTIFACT_DIR, name + (mobile ? '-mobile.png' : '-desktop.png'))});
      }
    };
    const readMarsh = () => page.evaluate(() => JSON.parse(localStorage.getItem('the-last-post.save.v1')).voyage.stops.marsh);
    assert.equal(await action('port', 'saltworks').isDisabled(), true);
    for (const [id, recipient] of [['marsh', mobile ? 'crew' : 'passengers'], ['saltworks', mobile ? 'families' : 'workers'], ['observatory', mobile ? 'window' : 'platform']]) {
      await operate('port', id);
      const art = page.locator('.voyage-plate > img').first();
      await art.evaluate(img => img.decode());
      assert.ok(await art.evaluate(img => img.naturalWidth > 600));
      if (mobile) {
        await assertFullMap(page);
        if (id === 'marsh') {
          for (const viewport of [{width: 625, height: 900}, {width: 844, height: 390}]) {
            await page.setViewportSize(viewport);
            await assertFullMap(page);
          }
          await page.setViewportSize({width: 390, height: 844});
          await assertFullMap(page);
        }
      }
      const alignment = await page.locator('.voyage-landscape').evaluate(map => {
        const img = map.querySelector('img');
        const bounds = img.getBoundingClientRect();
        return Math.abs(bounds.width / bounds.height - img.naturalWidth / img.naturalHeight) < 0.01 &&
          [...map.querySelectorAll('.voyage-pin')].every(pin => {
            const box = pin.getBoundingClientRect();
            const cx = (box.x + box.width / 2 - bounds.x) / bounds.width;
            const cy = (box.y + box.height / 2 - bounds.y) / bounds.height;
            return Math.abs(cx * 100 - parseFloat(pin.style.left)) < 0.1 && Math.abs(cy * 100 - parseFloat(pin.style.top)) < 0.1;
          });
      });
      assert.ok(alignment, 'hotspot targets align with the original uncropped illustration coordinates');
      await saveShot(id);
      if (id === 'marsh') await assertVisibleEffect(page, 'moored');
      await visitSpot(2); await operate('check'); assert.ok(await page.locator('.voyage-feedback').isVisible());
      await visitSpot(0);
      await page.keyboard.press('Tab');
      assert.ok(await page.locator('.voyage-choices button:first-child').evaluate(node => node === document.activeElement));
      if (id !== 'observatory') assert.ok(await page.locator('.voyage-trace').isVisible());
      if (mobile) {
        assert.ok(await page.locator('.voyage-pan').evaluate(pan => pan.scrollWidth > pan.clientWidth + 30), 'landmark opens in closer view');
        await operate('overview');
        await assertFullMap(page);
      }
      await visitSpot(1);
      if (id === 'marsh') {
        await operate('tide-notch', '1');
        assert.deepEqual((await readMarsh()).tideReadings, []);
        await operate('tide-notch', '3');
        assert.deepEqual((await readMarsh()).tideReadings, ['dawn']);
        await page.reload();
        await page.locator('#continue-button').click();
        await page.locator('.tide-gauge').waitFor();
        assert.deepEqual((await readMarsh()).tideReadings, ['dawn']);
        assert.ok(!(await readMarsh()).seen.includes(1));
        await visitSpot(2);
        await operate('piece', 'outer'); await operate('check');
        assert.ok(await page.locator('.voyage-feedback').isVisible());
        assert.ok(!(await readMarsh()).solved, 'one waterline cannot clear the ferry');
        await visitSpot(1);
        await operate('tide-period', 'now');
        await saveShot('tide-gauge');
        await operate('tide-notch', '2');
        assert.deepEqual((await readMarsh()).tideReadings, ['dawn', 'now']);
        assert.ok((await readMarsh()).seen.includes(1));
      }
      if (id === 'observatory') assert.ok(await page.locator('.voyage-trace').isVisible());
      await visitSpot(2);
      if (id === 'marsh') {
        await operate('piece', 'inner'); await operate('check');
        assert.ok(await page.locator('.voyage-feedback').isVisible());
        await operate('piece', 'outer'); await operate('check');
        await page.locator('[data-voyage-effect="sailing"]').waitFor();
        if (mobile) await assertFullMap(page, 'outcome');
        await operate('deliver', recipient);
      } else if (id === 'saltworks') await solve(['2', '5'], recipient);
      else {
        await operate('piece', 'short'); await operate('piece', 'long');
        await page.reload(); await page.locator('#continue-button').click();
        assert.equal(await page.locator('#voyage').getAttribute('data-port'), id);
        assert.match(await page.locator('.voyage-instrument').innerText(), /●\s+━\s+□/);
        await operate('language');
        assert.equal(await page.locator('#voyage').getAttribute('lang'), mobile ? 'en' : 'zh-CN');
        await operate('piece', 'short'); await operate('check');
        const signal = page.locator('[data-voyage-effect="signal"]');
        await signal.waitFor({state: 'visible'});
        assert.notEqual(await signal.getAttribute('aria-label'), null);
        if (mobile) assert.equal(await signal.evaluate(node => node.getAnimations({subtree:true}).length), 0);
        await operate('deliver', recipient);
        if (mobile) await assertFullMap(page, 'outcome');
        await assertVisibleEffect(page, recipient);
        await saveShot('signal-' + recipient);
      }
      assert.ok(await page.locator('.voyage-receipt').isVisible());
    }
    await operate('overview');
    if (mobile) await assertFullMap(page);
    await visitSpot(2);
    await page.reload(); await page.locator('#continue-button').click();
    assert.ok(await page.locator('.voyage-receipt').isVisible());
    const restored = page.locator('[data-voyage-effect="' + (mobile ? 'window' : 'platform') + '"]');
    assert.ok(await restored.isVisible(), 'reopening the receipt retains the chosen lighting');
    assert.equal(await restored.getAttribute('data-animate'), null);
    await operate('port', 'marsh');
    await visitSpot(2);
    assert.ok(await page.locator('.voyage-receipt').isVisible());
    await assertVisibleEffect(page, 'sailing');
    const download = page.waitForEvent('download');
    await operate('backup');
    const stream = await (await download).createReadStream(), chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks)).save.voyage.stops.observatory.delivered, mobile ? 'window' : 'platform');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#ending').isVisible());
    assert.deepEqual(errors, []);
    await context.close();
    console.log('South Bank route passed at ' + (mobile ? '390×844' : '1366×768'));
  }
} finally {
  await browser?.close();
  server?.kill();
}
