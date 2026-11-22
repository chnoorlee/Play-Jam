import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

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
    const context = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1366, height: 768}, hasTouch: mobile, isMobile: mobile});
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
    assert.equal(await action('port', 'saltworks').isDisabled(), true);
    for (const [id, recipient] of [['marsh', mobile ? 'crew' : 'passengers'], ['saltworks', mobile ? 'families' : 'workers'], ['observatory', mobile ? 'window' : 'platform']]) {
      await operate('port', id);
      await page.locator('.voyage-landscape img').evaluate(img => img.decode());
      assert.ok(await page.locator('.voyage-landscape img').evaluate(img => img.naturalWidth > 600));
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
      if (process.env.ARTIFACT_DIR) {
        await page.screenshot({path: join(process.env.ARTIFACT_DIR, id + (mobile ? '-mobile.png' : '-desktop.png'))});
      }
      await visitSpot(2); await operate('check'); assert.ok(await page.locator('.voyage-feedback').isVisible());
      await visitSpot(0);
      await page.keyboard.press('Tab');
      assert.ok(await page.locator('.voyage-choices button:first-child').evaluate(node => node === document.activeElement));
      if (id !== 'observatory') assert.ok(await page.locator('.voyage-trace').isVisible());
      await visitSpot(1);
      if (id === 'observatory') assert.ok(await page.locator('.voyage-trace').isVisible());
      await visitSpot(2);
      if (id === 'marsh') {
        await operate('piece', 'inner'); await operate('check');
        assert.ok(await page.locator('.voyage-feedback').isVisible());
        await solve(['outer'], recipient);
      } else if (id === 'saltworks') await solve(['2', '5'], recipient);
      else {
        await operate('piece', 'short'); await operate('piece', 'long');
        await page.reload(); await page.locator('#continue-button').click();
        assert.equal(await page.locator('#voyage').getAttribute('data-port'), id);
        assert.match(await page.locator('.voyage-instrument').innerText(), /●\s+━\s+□/);
        await operate('language');
        assert.equal(await page.locator('#voyage').getAttribute('lang'), mobile ? 'en' : 'zh-CN');
        await solve(['short'], recipient);
      }
      assert.ok(await page.locator('.voyage-receipt').isVisible());
    }
    await operate('port', 'marsh');
    await visitSpot(2);
    assert.ok(await page.locator('.voyage-receipt').isVisible());
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
