import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

async function startServer() {
  const processHandle = spawn(process.execPath, ['server.mjs'], {
    env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    processHandle.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
    processHandle.once('error', reject);
    processHandle.once('exit', code => reject(new Error('Game server exited with code ' + code)));
  });
  return { url, processHandle };
}

async function englishOnly(page, selector) {
  const leaks = await page.locator(selector).evaluate(root => {
    const untranslated = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === 1 && node.matches('[translate="no"], [hidden]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = root;
    do {
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (!element.getClientRects().length) continue;
      const values = node.nodeType === 3 ? [node.nodeValue]
        : ['aria-label', 'alt', 'title', 'data-tooltip'].map(key => element.getAttribute(key) || '');
      untranslated.push(...values.filter(value => /\p{Script=Han}/u.test(value)));
    } while ((node = walker.nextNode()));
    return untranslated;
  });
  assert.deepEqual(leaks, [], 'English text and accessibility on ' + selector);
}

async function download(page, selector) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const file = await pending;
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return { name: file.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

async function play(page, url, mobile) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const use = action => page.locator('#dialogue [data-action="' + action + '"]').click();
  const closeDialog = () => page.locator('.dialogue-close').click();
  const switchDialogue = () => page.locator('#dialogue [data-switch-language]').click();
  const sceneAction = id => page.locator('[data-scene-action="' + id + '"]').click();
  const enter = async (entrance, scene) => {
    if (await page.locator('#scene-stage').isVisible()) await page.locator('#scene-exit').click();
    await page.locator('.world-label[data-id="' + entrance + '"]').click();
    await page.locator('#scene-stage[data-scene-id="' + scene + '"]').waitFor({ timeout: 60000 });
  };
  const setLang = async (selector, language) => {
    await page.locator(selector).selectOption(language);
    assert.equal(await page.locator('html').getAttribute('lang'), language);
  };

  assert.equal((await page.goto(url, { waitUntil: 'networkidle' })).status(), 200);
  assert.equal(await page.locator('#start-button').innerText(), '开始投递');
  await setLang('#intro-language', 'en');
  assert.equal(await page.title(), 'The Last Post');
  assert.match(await page.locator('.intro-story').innerText(), /three letters/i);
  await englishOnly(page, '#intro');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#intro-language').inputValue(), 'en');
  await page.getByRole('button', { name: 'Begin deliveries' }).click();
  await englishOnly(page, '#dialogue');
  const opening = await page.locator('.dialogue-text').innerText();
  assert.match(opening, /evacuation boat/i);
  await switchDialogue();
  assert.match(await page.locator('.dialogue-text').innerText(), /撤离/);
  await switchDialogue();
  assert.equal(await page.locator('.dialogue-text').innerText(), opening);
  await use('begin');
  assert.equal(await page.locator('#dialogue .speaker').innerText(), 'Xu Du');
  await use('close');
  await englishOnly(page, '.hud');
  await englishOnly(page, '.game-footer');
  await englishOnly(page, '#world');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await englishOnly(page, '#settings');
  await setLang('#language-setting', 'zh-CN');
  assert.match(await page.locator('#settings-title').innerText(), /灯下/);
  await setLang('#language-setting', 'en');
  await page.locator('#quality-setting').selectOption('low');
  await page.locator('#settings [data-close]').click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Continue your journey' }).click();
  if (mobile) {
    await page.getByRole('button', { name: 'Letter journal', exact: true }).tap();
    await englishOnly(page, '#journal');
    await page.locator('#tab-deliveries').tap();
    await englishOnly(page, '#journal');
    const layout = await page.locator('#journal').evaluate(modal => {
      const rect = modal.getBoundingClientRect();
      return { fitsWidth: rect.left >= -1 && rect.right <= innerWidth + 1, overflow: modal.scrollWidth > modal.clientWidth + 1 };
    });
    assert.deepEqual(layout, { fitsWidth: true, overflow: false });
    await page.locator('#journal [data-close]').tap();
    await enter('platform', 'station');
    for (const viewport of [page.viewportSize(), {width: 667, height: 375}]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(({width, height}) =>
        Math.abs(visualViewport.width - width) <= 1 && Math.abs(visualViewport.height - height) <= 1, viewport);
      for (const [phase, evidence] of [['present', /North Station/i], ['echo', /South Bank/i]]) {
        if (await page.locator('#scene-stage').getAttribute('data-scene-phase') !== phase) await page.locator('#phase-button').tap();
        const board = await page.locator('.station-board--mounted').boundingBox();
        await page.touchscreen.tap(board.x + board.width / 2, board.y + board.height / 2);
        const face = page.locator('#dialogue .station-board--closeup[data-phase="' + phase + '"]');
        await face.waitFor({state: 'visible', timeout: 10000});
        assert.match(await face.innerText(), evidence);
        await englishOnly(page, '#dialogue');
        await face.scrollIntoViewIfNeeded();
        const fits = await face.evaluate(doc => {
          const box = doc.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.left >= -1 && box.right <= innerWidth + 1 &&
            box.top >= -1 && box.bottom <= innerHeight + 1 && doc.scrollWidth <= doc.clientWidth + 1;
        });
        assert.ok(fits, phase + ' station document fits ' + JSON.stringify(viewport));
        await closeDialog();
      }
    }
    assert.deepEqual(pageErrors, []);
    return;
  }

  await enter('clock', 'clock');
  await englishOnly(page, '#scene-stage');
  await sceneAction('letter');
  await use('read:clock');
  await use('close');
  await sceneAction('clock');
  await page.locator('#dial-0').click();
  const dials = () => page.locator('.dial-button > span').allTextContents();
  const dialBefore = await dials();
  assert.deepEqual(dialBefore, ['I', 'I', '○']);
  await switchDialogue();
  assert.match(await page.locator('#dial-0').getAttribute('aria-label'), /离港/);
  assert.deepEqual(await dials(), dialBefore);
  await switchDialogue();
  assert.match(await page.locator('#dial-0').getAttribute('aria-label'), /Departure/);
  assert.deepEqual(await dials(), dialBefore);
  await englishOnly(page, '#dialogue');
  await page.locator('.hint-button').click();
  await page.locator('#next-hint').click();
  await page.locator('#next-hint').click();
  await englishOnly(page, '#hints');
  assert.match(await page.locator('.hint-pages article').last().innerText(), /Departure ×2, Lights Out ×2, Homecoming ×0/);
  await page.locator('#hints [data-close]').click();
  for (const index of [0, 0, 1, 1]) await page.locator('#dial-' + index).click();
  await use('resolve:clock');
  await use('decision:clock:truth');
  await englishOnly(page, '#dialogue');
  await closeDialog();

  await enter('greenhouse', 'greenhouse');
  await sceneAction('seed-note');
  await use('read:greenhouse');
  await use('close');
  await page.locator('#phase-button').click();
  await sceneAction('greenhouse');
  for (const index of [0, 1, 1, 2, 2, 2]) await page.locator('#dial-' + index).click();
  await englishOnly(page, '#dialogue');
  await use('resolve:greenhouse');
  await use('decision:greenhouse:share');
  await closeDialog();
  await enter('platform', 'station');
  await englishOnly(page, '#scene-stage');
  await sceneAction('echo-stamp');
  const face = page.locator('#dialogue .station-board--closeup');
  assert.match(await face.innerText(), /South Bank/i);
  await switchDialogue();
  assert.match(await face.innerText(), /南岸/);
  await switchDialogue();
  await englishOnly(page, '#dialogue');
  await use('stamp:echo');
  await closeDialog();
  await page.locator('#phase-button').click();
  await sceneAction('present-stamp');
  assert.match(await face.innerText(), /North Station/i);
  await englishOnly(page, '#dialogue');
  await use('stamp:present');
  await closeDialog();
  await sceneAction('platform');
  await englishOnly(page, '#dialogue');
  await use('resolve:platform');
  for (const fragment of ['north', 'closed', 'south', 'reunion']) await use('sequence:platform:' + fragment);
  await use('decision:platform:farewell');
  await closeDialog();
  await page.locator('#journal-button').click();
  for (const tab of ['deliveries', 'clues', 'receipts']) {
    await page.locator('#tab-' + tab).click();
    await englishOnly(page, '#journal');
  }
  assert.equal(await page.locator('.receipt-entry').count(), 3);
  await page.locator('#journal [data-close]').click();
  await page.locator('#scene-exit').click();
  for (const [id, ordinal] of [['release', 'I'], ['preserve', 'II'], ['carry', 'III']]) {
    await page.locator('.world-label[data-id="final"]').click();
    await use('ending:' + id);
    await englishOnly(page, '#ending');
    assert.match(await page.locator('.ending-subtitle').innerText(), new RegExp('Ending ' + ordinal + ' '));
    assert.equal(await page.locator('.reflections p').count(), 3);
    if (id === 'release') {
      const english = await download(page, '#export-button');
      assert.match(english.name, /^[\x20-\x7e]+\.txt$/);
      const letter = english.bytes.toString('utf8');
      assert.match(letter, /Cao Yao/);
      assert.match(letter, /AI/);
      assert.doesNotMatch(letter, /\p{Script=Han}/u);
      const postcard = await download(page, '#postcard-button');
      assert.match(postcard.name, /^[\x20-\x7e]+\.png$/);
      const { width, height } = PNG.sync.read(postcard.bytes);
      assert.deepEqual([width, height], [1280, 900]);
      await page.locator('#ending [data-switch-language]').click();
      assert.match(await page.locator('.ending-subtitle').innerText(), /结局一/);
      const chinese = await download(page, '#export-button');
      assert.match(chinese.name, /投递手记/);
      assert.match(chinese.bytes.toString('utf8'), /曹遥/);
      await page.locator('#ending [data-switch-language]').click();
    }
    await page.locator('#revisit-button').click();
    if (await page.locator('#scene-stage').isVisible()) await page.locator('#scene-exit').click();
  }
  assert.deepEqual(pageErrors, []);
}

const local = process.env.GAME_URL ? null : await startServer();
let browser;
try {
  const url = process.env.GAME_URL || local.url;
  browser = await chromium.launch({ headless: true });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1180, height: 800 },
      hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce',
    });
    try { await play(await context.newPage(), url, mobile); }
    finally { await context.close(); }
    console.log('PASS bilingual ' + (mobile ? 'touchscreen' : 'desktop') + ' journey at ' + url);
  }
} finally {
  await browser?.close();
  if (local && local.processHandle.exitCode === null) {
    const exited = once(local.processHandle, 'exit');
    local.processHandle.kill();
    await exited;
  }
}
