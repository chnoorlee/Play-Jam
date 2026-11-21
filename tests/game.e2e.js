import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const baseURL = process.env.GAME_URL || 'http://127.0.0.1:5173';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const report = { testedAt: new Date().toISOString(), baseURL, checks: [], errors };
const check = (name, detail) => { report.checks.push({ name, detail }); console.log(`PASS ${name}`, detail ?? ''); };
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const screen = async name => page.screenshot({ path: `artifacts/${name}.png` });
const select = async action => {
  await page.locator(`#dialogue [data-action="${action}"]`).click();
  await page.waitForTimeout(120);
};
const close = async () => { if (await page.locator('#dialogue').isVisible()) await page.locator('.dialogue-close').click(); };
const visit = async id => {
  await page.locator(`.world-label[data-id="${id}"]`).click();
  await page.waitForFunction(() => !!window.__game.getDialogue(), null, { timeout: 25000 });
  return page.evaluate(() => window.__game.getDialogue());
};
const assertLayout = async () => {
  const failures = await page.evaluate(() => {
    const width = innerWidth, height = innerHeight;
    return [...document.querySelectorAll('#dialogue button,#journal button,.hud button,.game-footer button')]
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
  await select('begin'); await select('close');
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
  await visit('clock');
  await select('resolve:clock');
  assert.match(await page.locator('.dialogue-text').textContent(), /家书/);
  await close();
  check('Puzzle cannot resolve before its clue');
  await visit('letter'); await select('read:clock'); await select('close');
  await visit('clock');
  for (const [index, count] of [[0, 3], [1, 1], [2, 2]]) for (let n = 0; n < count; n++) await page.click(`#dial-${index}`);
  await screen('clock-puzzle');
  await select('resolve:clock'); await select('decision:clock:truth'); await close();
  assert.equal((await page.evaluate(() => window.__game.getState())).solved.clock, true);
  check('Clock clue, mechanism and human decision');

  await visit('seed-note'); await select('read:greenhouse'); await close();
  await page.click('#phase-button');
  assert.equal((await page.evaluate(() => window.__game.getState())).phase, 'echo');
  await screen('echo-desktop');
  await visit('greenhouse');
  for (const [index, count] of [[0, 1], [1, 2], [2, 3]]) for (let n = 0; n < count; n++) await page.click(`#dial-${index}`);
  await select('resolve:greenhouse'); await select('decision:greenhouse:share'); await close();
  check('Echo-only greenhouse puzzle and choice');

  await visit('echo-stamp'); await select('stamp:echo'); await close();
  await page.click('#phase-button');
  await visit('present-stamp'); await select('stamp:present'); await close();
  await visit('platform'); await select('resolve:platform'); await select('decision:platform:farewell'); await close();
  check('Both time layers navigable and station letter deliverable');
  await page.click('#journal-button');
  assert((await page.locator('.journal-entry').count()) >= 7);
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

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1920, height: 1080 }]) {
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
  await visit('clock'); await assertLayout(); await screen('dialogue-mobile'); await close();
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
  await mobile.screenshot({ path: 'artifacts/touch-clue.png' });
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
  await writeFile('artifacts/e2e-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
