import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const baseURL = process.env.GAME_URL || 'http://127.0.0.1:5173';
const artifactDir = process.env.ARTIFACT_DIR || 'artifacts';
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const report = { testedAt: new Date().toISOString(), baseURL, checks: [], errors };
const check = (name, detail) => { report.checks.push({ name, detail }); console.log(`PASS ${name}`, detail ?? ''); };
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const screen = async name => page.screenshot({ path: join(artifactDir, `${name}.png`) });
const verifyPortrait = async name => {
  assert.match(await page.locator('#dialogue .speaker').textContent(), new RegExp(name));
  const portrait = page.locator('#dialogue .speaker-portrait');
  await portrait.waitFor({ state: 'visible' });
  await portrait.evaluate(image => image.decode());
  assert.equal(await portrait.evaluate(image => image.naturalWidth), 256);
};
const select = async action => {
  await page.locator(`#dialogue [data-action="${action}"]`).click();
  await page.waitForTimeout(120);
};
const close = async () => { if (await page.locator('#dialogue').isVisible()) await page.locator('.dialogue-close').click(); };
const sceneAction = id => page.locator(`[data-scene-action="${id}"]`);
const sceneEntrance = { clock: 'clock', greenhouse: 'greenhouse', platform: 'station' };
const enter = async id => {
  await page.locator(`.world-label[data-id="${id}"]`).click();
  await page.locator(`#scene-stage[data-scene-id="${sceneEntrance[id]}"]`).waitFor({ timeout: 25000 });
};
const leave = async () => { if (await page.locator('#scene-stage').isVisible()) await page.click('#scene-exit'); };
const visit = async id => {
  await leave();
  if (sceneEntrance[id]) { await enter(id); await sceneAction(id).click(); }
  else await page.locator(`.world-label[data-id="${id}"]`).click();
  await page.waitForFunction(() => !!window.__game.getDialogue(), null, { timeout: 25000 });
  return page.evaluate(() => window.__game.getDialogue());
};
const assertLayout = async () => {
  const failures = await page.evaluate(() => {
    const width = innerWidth, height = innerHeight;
    return [...document.querySelectorAll('#dialogue button,.modal:not([hidden]) button,.modal:not([hidden]) select,.modal:not([hidden]) input,.hud button,.game-footer button,.camera-tools button,#scene-stage button')]
      .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
      .filter(element => { const r = element.getBoundingClientRect(); return r.x < -1 || r.y < -1 || r.right > width + 1 || r.bottom > height + 1; })
      .map(element => element.textContent.trim() || element.getAttribute('aria-label'));
  });
  assert.deepEqual(failures, []);
};

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game?.getWorld()?.frames > 10);
  await screen('intro-desktop');
  await page.click('#start-button');
  await verifyPortrait('沈伯');
  await page.locator('#scene-backdrop').evaluate(image => image.decode());
  await page.locator('.scene-cast').evaluate(image => image.decode());
  await screen('portrait-desktop');
  await select('begin');
  await verifyPortrait('许渡');
  assert.equal(await page.locator('#scene-stage').getAttribute('data-player-speaking'), 'true');
  await page.locator('.scene-cast').evaluate(image => image.decode());
  assert.match(await page.locator('.scene-cast').getAttribute('src'), /\/xu[.-]/);
  await select('close');
  assert(!(await page.locator('#scene-stage').isVisible()));
  assert(await page.evaluate(() => document.activeElement.matches('[data-id="keeper"], #journal-button')));
  check('Prologue cuts to Xu Du and returns focus to the map');
  await assertLayout();
  const first = await page.evaluate(() => window.__game.getWorld());
  await page.waitForFunction(frames => window.__game.getWorld().frames > frames + 5, first.frames, { timeout: 8000 });
  const next = await page.evaluate(() => window.__game.getWorld());
  assert(next.frames > first.frames + 5);
  assert(next.drawCalls < 250);
  check('Animated nonblank 2.5D scene', { drawCalls: next.drawCalls, triangles: next.triangles });
  await screen('gameplay-desktop');
  const buffer = await page.locator('canvas').screenshot();
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  for (let i = 0; i < png.data.length; i += 4 * 43) colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
  assert(colors.size > 70);
  check('Canvas pixel diversity', colors.size);

  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(450); await page.keyboard.up('ArrowRight');
  const moved = await page.evaluate(() => window.__game.getWorld());
  assert(Math.hypot(moved.player.x - next.player.x, moved.player.z - next.player.z) > .2);
  check('Keyboard moves the character');
  await page.click('#zoom-in');
  await page.waitForFunction(() => window.__game.getWorld().renderZoom > 1.15);
  assert((await page.evaluate(() => window.__game.getWorld())).zoom > 1);
  for (let n = 0; n < 3; n++) await page.click('#zoom-in');
  assert.equal((await page.evaluate(() => window.__game.getWorld())).zoom, 1.8);
  assert(await page.locator('#zoom-in').isDisabled());
  await page.click('#zoom-out');
  await page.click('#zoom-reset');
  await page.waitForFunction(() => window.__game.getWorld().renderZoom < 1.01);
  assert(await page.locator('#zoom-out').isDisabled());
  check('Camera zoom follows the character and returns to the overview');
  await page.click('#settings-button');
  await page.selectOption('#quality-setting', 'low');
  await page.check('#motion-setting'); await page.check('#text-setting');
  await page.locator('#volume-setting').evaluate(input => { input.value = '31'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal((await page.evaluate(() => window.__game.getWorld())).quality, 'low');
  assert.equal((await page.evaluate(() => window.__game.getWorld())).reducedMotion, true);
  await page.setViewportSize({ width: 320, height: 640 });
  await assertLayout(); await screen('settings-small-mobile');
  await page.setViewportSize({ width: 1440, height: 960 });
  const backupEvent = page.waitForEvent('download');
  await page.click('#backup-save');
  const backup = await backupEvent, backupStream = await backup.createReadStream();
  let backupText = ''; for await (const chunk of backupStream) backupText += chunk.toString('utf8');
  assert.equal(JSON.parse(backupText).game, 'the-last-post');
  const beforeImport = await page.evaluate(() => window.__game.getState());
  const newerBackup = JSON.parse(backupText); newerBackup.save.phase = 'echo';
  await page.evaluate(() => {
    window.originalFileText = File.prototype.text;
    File.prototype.text = async function () {
      const content = await window.originalFileText.call(this);
      if (this.name === 'older.json') await new Promise(resolve => setTimeout(resolve, 500));
      return content;
    };
  });
  await page.locator('#save-file').setInputFiles({ name: 'older.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.locator('#save-file').setInputFiles({ name: 'newer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(newerBackup)) });
  await page.waitForSelector('#confirm-restore'); await page.waitForTimeout(650);
  await page.click('#confirm-restore');
  assert.equal((await page.evaluate(() => window.__game.getState())).phase, 'echo', 'only the last selected backup can restore progress');
  await page.evaluate(() => { File.prototype.text = window.originalFileText; delete window.originalFileText; });
  await page.click('#settings-button');
  await page.locator('#save-file').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.waitForSelector('#confirm-restore');
  await page.locator('#save-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.waitForFunction(() => !document.querySelector('#confirm-restore'));
  check('Last selected backup wins; invalid replacement removes the old confirmation');
  await page.locator('#save-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.waitForSelector('#confirm-restore');
  assert.equal((await page.evaluate(() => window.__game.getState())).phase, 'echo', 'import preview never replaces progress before confirmation');
  await page.click('#confirm-restore');
  assert.deepEqual(await page.evaluate(() => window.__game.getState()), beforeImport);
  await page.reload({ waitUntil: 'networkidle' }); await page.click('#continue-button');
  await page.click('#settings-button');
  assert.equal(await page.inputValue('#quality-setting'), 'low');
  assert.equal(await page.inputValue('#volume-setting'), '31');
  assert.equal(await page.isChecked('#motion-setting'), true); assert.equal(await page.isChecked('#text-setting'), true);
  await page.uncheck('#motion-setting'); await page.uncheck('#text-setting');
  await page.locator('#settings [data-close]').click();
  check('Reading, motion, volume and quality preferences persist; backup previews and restores');
  const checkScene = async (room, castId, person) => {
    assert.equal(await page.locator('#scene-stage').getAttribute('data-scene-id'), room);
    await page.locator('#scene-backdrop').evaluate(image => image.decode());
    await page.locator('.scene-cast').evaluate(image => image.decode());
    assert(await page.locator('#scene-backdrop').evaluate(image => image.naturalWidth >= 1200));
    assert(await page.locator('.scene-cast').evaluate(image => image.naturalWidth > 250));
    assert.equal(await page.locator('#world').evaluate(world => world.inert), true);
    assert.equal((await page.evaluate(() => window.__game.getWorld())).paused, true);
    await assertLayout();
    await page.mouse.move(0, 0);
    await screen(`scene-${room}`);
    await sceneAction(castId).click();
    await verifyPortrait(person);
    assert.equal(await page.locator('#scene-stage').evaluate(stage => stage.inert), true);
    await close();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.sceneAction), castId);
    if (room === 'clock' || room === 'greenhouse') {
      const backdrop = page.locator('#scene-backdrop');
      const present = await backdrop.getAttribute('src');
      await page.keyboard.press('q');
      await backdrop.evaluate(image => image.decode());
      assert.notEqual(await backdrop.getAttribute('src'), present);
      await page.keyboard.press('q');
      await backdrop.evaluate(image => image.decode());
      assert.equal(await backdrop.getAttribute('src'), present);
    }
  };
  await visit('keeper'); await close();
  await checkScene('postoffice', 'keeper', '沈伯');
  await page.keyboard.press('Escape');
  assert(!(await page.locator('#scene-stage').isVisible()));
  assert.equal((await page.evaluate(() => window.__game.getWorld())).paused, false);
  assert(await page.evaluate(() => document.activeElement.matches('[data-id="keeper"], #journal-button')));
  await enter('clock'); await checkScene('clock', 'cao', '曹遥'); await leave();
  await enter('greenhouse'); await checkScene('greenhouse', 'ye', '叶青'); await leave();
  await enter('platform'); await checkScene('station', 'lan', '阿岚');
  assert(await sceneAction('present-stamp').isVisible());
  assert(!(await sceneAction('echo-stamp').isVisible()));
  const board = page.locator('.station-board--mounted');
  const boardPosition = () => board.evaluate(element => {
    const sign = element.getBoundingClientRect();
    const painting = document.getElementById('scene-backdrop').getBoundingClientRect();
    return {x: sign.left + sign.width / 2 - painting.left, y: sign.top + sign.height / 2 - painting.top};
  });
  const presentSign = await boardPosition();
  const presentInk = await board.screenshot();
  await sceneAction('present-stamp').focus();
  await page.keyboard.press('q');
  assert(await sceneAction('echo-stamp').isVisible());
  assert(!(await sceneAction('present-stamp').isVisible()));
  assert.equal(await page.evaluate(() => document.activeElement.dataset.sceneAction), 'echo-stamp');
  const echoSign = await boardPosition();
  assert.ok(Math.abs(presentSign.x - echoSign.x) < 3 && Math.abs(presentSign.y - echoSign.y) < 3,
    'both documents hang on the same station board: ' + JSON.stringify({presentSign, echoSign}));
  assert.ok(!presentInk.equals(await board.screenshot()), 'switching time visibly changes the mounted document');
  await sceneAction('lan').click();
  assert.match(await page.locator('.dialogue-text').textContent(), /站牌/);
  await close(); await page.click('#phase-button'); await leave();
  check('Four independent illustrated rooms support cast conversations, phase-specific investigation and return navigation');
  await visit('keeper'); await page.keyboard.press('j');
  await page.click('#tab-deliveries'); await page.click('[data-track="greenhouse"]');
  await page.waitForFunction(() => !window.__game.getDialogue() && !window.__game.getWorld().paused && window.__game.getWorld().pathLength > 0);
  assert.equal((await page.evaluate(() => window.__game.getState())).activeMission, 'greenhouse');
  check('Journal navigation during dialogue closes it and starts walking to the selected delivery');
  await visit('clock');
  await select('resolve:clock');
  assert.match(await page.locator('.dialogue-text').textContent(), /家书/);
  await close();
  check('Puzzle cannot resolve before its clue');
  await visit('letter'); await select('read:clock'); await select('close');
  await visit('clock');
  await page.click('.hint-button');
  assert.equal(await page.locator('.hint-pages article').count(), 1);
  await page.click('#next-hint'); await page.click('#next-hint');
  assert.equal(await page.locator('.hint-pages article').count(), 3);
  assert.match(await page.locator('.hint-pages article').last().textContent(), /离港 3 次，熄灯 2 次，归家 0 次/);
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'ARTICLE');
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.querySelector('#hints').contains(document.activeElement)), 'Tab from the last hint stays in the modal');
  await page.locator('#hints [data-close]').click();
  check('Three-stage hints preserve the active puzzle and use its current values');
  for (const [index, count] of [[0, 3], [1, 2]]) for (let n = 0; n < count; n++) await page.click(`#dial-${index}`);
  await screen('clock-puzzle');
  await select('resolve:clock'); await verifyPortrait('曹遥'); await select('decision:clock:truth'); await close();
  assert.equal((await page.evaluate(() => window.__game.getState())).solved.clock, true);
  check('Clock clue, mechanism and human decision');

  await visit('seed-note'); await select('read:greenhouse'); await close();
  await page.click('#phase-button');
  assert.equal((await page.evaluate(() => window.__game.getState())).phase, 'echo');
  await leave();
  await page.waitForFunction(() => !window.__game.getWorld().phaseTransitioning);
  await screen('echo-desktop');
  await visit('greenhouse');
  assert.equal(await page.locator('#dial-0 .compass-arrow svg.lucide-arrow-up').count(), 1);
  for (const [index, count] of [[0, 1], [1, 2], [2, 3]]) for (let n = 0; n < count; n++) await page.click(`#dial-${index}`);
  assert.equal(await page.locator('.light-route path.lit').count(), 4);
  await screen('greenhouse-light-route');
  await select('resolve:greenhouse'); await verifyPortrait('叶青'); await select('decision:greenhouse:share'); await close();
  check('Echo-only greenhouse puzzle and choice');

  await leave(); await enter('platform');
  const documentFace = page.locator('#dialogue .station-board--closeup');
  await sceneAction('echo-stamp').click();
  assert.match(await documentFace.innerText(), /南岸/);
  await screen('station-timetable');
  await select('stamp:echo'); await close();
  await page.click('#phase-button');
  await sceneAction('present-stamp').click();
  assert.match(await documentFace.innerText(), /北站/);
  await select('stamp:present'); await close();
  await sceneAction('platform').click(); await select('resolve:platform');
  for (const fragment of ['north', 'delayed']) await select(`sequence:platform:${fragment}`);
  const partialFeedback = await page.locator('.dialogue-text').innerText();
  for (const fragment of ['pier', 'reunion']) await select(`sequence:platform:${fragment}`);
  assert.equal(await page.locator('.address-slots .filled').count(), 4);
  assert.equal(await page.locator('#dialogue [data-action^="decision:platform:"]').count(), 0);
  await close();
  await sceneAction('present-stamp').click();
  assert.match(await documentFace.innerText(), /北站/);
  await close();
  await sceneAction('platform').click(); await select('resolve:platform');
  await select('sequence:platform:reset');
  for (const fragment of ['north', 'closed']) await select(`sequence:platform:${fragment}`);
  assert.equal(await page.locator('.dialogue-text').innerText(), partialFeedback, 'partial entries are not graded');
  for (const fragment of ['south', 'reunion']) await select(`sequence:platform:${fragment}`);
  await verifyPortrait('阿岚');
  await select('decision:platform:farewell'); await close();
  check('Two dated station documents support inspecting, correcting and delivering a forwarding address');
  check('All five illustrated character portraits display and decode');
  await page.click('#journal-button');
  await page.click('#tab-clues');
  assert((await page.locator('.journal-entry').count()) >= 7);
  await page.click('#tab-receipts');
  assert.equal(await page.locator('.receipt-entry').count(), 3);
  assert.equal(await page.locator('.receipt-entry .keepsake').count(), 3);
  await page.click('#tab-deliveries'); assert.equal(await page.locator('.mission-row.delivered').count(), 3);
  await page.click('#tab-clues');
  await screen('journal-desktop');
  await page.locator('#journal [data-close]').click();
  const beforeReload = await page.evaluate(() => window.__game.getState());
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#continue-button');
  assert.deepEqual(await page.evaluate(() => window.__game.getState()), beforeReload);
  check('Save and continue restore all deliveries and choices');

  for (const ending of ['release', 'preserve', 'carry']) {
    await visit('final'); await select(`ending:${ending}`);
    assert.equal((await page.evaluate(() => window.__game.getState())).ending, ending);
    assert.equal(await page.locator('.reflections p').count(), 3);
    await screen(`ending-${ending}`);
    if (ending === 'release') {
      const downloading = page.waitForEvent('download');
      await page.click('#export-button');
      const download = await downloading;
      assert.equal(download.suggestedFilename(), '余信-投递手记.txt');
      const stream = await download.createReadStream();
      let text = '';
      for await (const chunk of stream) text += chunk.toString('utf8');
      assert.match(text, /余信/);
      assert.match(text, /AI 辅助制作/);
      check('Ending text export downloads the actual story and disclosure');
      const postcardEvent = page.waitForEvent('download'); await page.click('#postcard-button');
      const postcard = await postcardEvent, postcardStream = await postcard.createReadStream(), chunks = [];
      for await (const chunk of postcardStream) chunks.push(chunk);
      const postcardBuffer = Buffer.concat(chunks);
      const postcardImage = PNG.sync.read(postcardBuffer);
      assert.equal(postcardImage.width, 1280); assert.equal(postcardImage.height, 900);
      const colors = new Set();
      for (let y = 60; y < 700; y += 8) for (let x = 48; x < 590; x += 8) {
        const index = (y * postcardImage.width + x) * 4;
        colors.add(`${postcardImage.data[index] >> 4},${postcardImage.data[index + 1] >> 4},${postcardImage.data[index + 2] >> 4}`);
      }
      assert(colors.size > 40, 'postcard includes the rendered harbor illustration');
      await writeFile(join(artifactDir, 'postcard.png'), postcardBuffer);
      check('Personal ending postcard exports a valid illustrated PNG');
    }
    if (ending === 'carry') {
      await page.setViewportSize({ width: 844, height: 390 });
      const top = await page.locator('#ending-title').evaluate(element => element.getBoundingClientRect().top);
      assert(top >= 0, 'landscape ending title remains reachable');
      await page.locator('#export-button').scrollIntoViewIfNeeded();
      await screen('ending-landscape');
      check('Landscape ending title and actions reachable by scrolling');
    }
    await page.click('#revisit-button');
    await page.setViewportSize({ width: 1440, height: 960 });
  }
  check('All three endings reached through actual UI and walking');
  await page.click('#pause-button');
  const pauseBefore = await page.evaluate(() => window.__game.getWorld().player);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft');
  assert.deepEqual(await page.evaluate(() => window.__game.getWorld().player), pauseBefore);
  await page.click('#resume-button');
  check('Pause prevents movement');

  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(400);
    await assertLayout();
    const debug = await page.evaluate(() => window.__game.getWorld());
    const clipped = Object.values(debug.anchors).filter(a => a.screen.x < 0 || a.screen.x > viewport.width || a.screen.y < 100 || a.screen.y > viewport.height - 110);
    assert.equal(clipped.length, 0, `Scene interaction points clipped: ${clipped.map(a => a.name)}`);
    assert(debug.framing.left >= 0 && debug.framing.right <= viewport.width, 'island geometry fits horizontally');
    assert(debug.framing.top >= 0 && debug.framing.bottom <= viewport.height, 'island geometry fits vertically');
    await screen(`gameplay-${viewport.width}x${viewport.height}`);
    check(`Viewport ${viewport.width}x${viewport.height} controls and scene fit`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#journal-button'); await assertLayout(); await screen('journal-mobile'); await page.locator('#journal [data-close]').click();
  await enter('clock'); await assertLayout();
  const objectiveOverlap = await page.evaluate(() => {
    const footer = document.querySelector('.delivery-status').getBoundingClientRect();
    return [...document.querySelectorAll('.scene-action:not([hidden])')].some(button => {
      const { left, right, top, bottom } = button.getBoundingClientRect();
      return left < footer.right && right > footer.left && top < footer.bottom && bottom > footer.top;
    });
  });
  assert.equal(objectiveOverlap, false);
  await screen('scene-mobile');
  await sceneAction('clock').click(); await assertLayout(); await screen('dialogue-mobile'); await close();
  await page.click('#audio-button');
  assert.equal(await page.locator('#audio-button').getAttribute('aria-label'), '关闭声音');
  await page.click('#audio-button');
  check('Audio toggle resumes and suspends sound');
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await touch.newPage();
  await mobile.goto(baseURL, { waitUntil: 'networkidle' });
  await mobile.locator('#start-button').tap();
  await mobile.locator('[data-action="begin"]').tap();
  await mobile.locator('[data-action="close"]').tap();
  await mobile.locator('.world-label[data-id="letter"]').tap();
  await mobile.locator('[data-action="read:clock"]').waitFor({ timeout: 25000 });
  await mobile.locator('[data-action="read:clock"]').tap();
  assert((await mobile.evaluate(() => window.__game.getState())).clues.includes('clock'));
  await mobile.locator('.dialogue-close').tap();
  await mobile.getByRole('button', { name: '与曹遥交谈' }).tap();
  assert.equal(await mobile.locator('.speaker').textContent(), '曹遥');
  await mobile.screenshot({ path: join(artifactDir, 'touch-clue.png') });
  await touch.close();
  check('Touch input walks to a clue and reads it on a mobile browser');
  assert.deepEqual(errors, []);
  check('No browser runtime or console errors');
} catch (error) {
  report.failure = error.stack;
  await screen('failure');
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(artifactDir, 'e2e-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
