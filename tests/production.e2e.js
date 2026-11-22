import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const errors = [], requests = [];
const artifactDir = process.env.ARTIFACT_DIR || 'artifacts';
const report = { testedAt: new Date().toISOString(), errors, requests };
try {
  const url = await new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', data => {
      output += data;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
    child.on('error', reject);
    child.on('exit', code => reject(new Error(`Server exited with ${code}`)));
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => !!document.querySelector('canvas'));
  assert.equal(await page.evaluate(() => typeof window.__game), 'undefined');
  await page.click('#start-button');
  assert.equal(await page.locator('#scene-stage').getAttribute('data-scene-id'), 'postoffice');
  for (const selector of ['#scene-backdrop', '.scene-cast']) {
    await page.locator(selector).evaluate(image => image.decode());
    const resource = await page.request.get(await page.locator(selector).evaluate(image => image.currentSrc));
    assert.equal(resource.status(), 200);
    assert.equal(resource.headers()['content-type'], 'image/webp');
  }
  const portrait = page.locator('.speaker-portrait');
  await portrait.evaluate(image => image.decode());
  const imageURL = await portrait.evaluate(image => image.currentSrc);
  const imageResponse = await page.request.get(imageURL);
  assert.equal(imageResponse.status(), 200);
  assert.equal(imageResponse.headers()['content-type'], 'image/webp');
  await page.click('[data-action="begin"]');
  await page.click('[data-action="close"]');
  assert(!(await page.locator('#scene-stage').isVisible()));
  await page.click('#phase-button');
  assert.equal(await page.locator('#phase-label').textContent(), '回声');
  const png = PNG.sync.read(await page.locator('canvas').screenshot());
  const colors = new Set();
  for (let i = 0; i < png.data.length; i += 172) colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
  assert(colors.size > 70);
  await page.locator('.world-label[data-id="clock"]').click();
  await page.locator('#scene-stage[data-scene-id="clock"]').waitFor({ timeout: 25000 });
  await page.getByRole('button', { name: '与曹遥交谈' }).click();
  assert.equal(await page.locator('#dialogue .speaker').textContent(), '曹遥');
  await page.locator('.dialogue-close').click();
  await page.click('#scene-exit');
  await page.click('#journal-button');
  assert(await page.locator('#journal').isVisible());
  assert(requests.every(request => new URL(request).hostname === '127.0.0.1'));
  assert.deepEqual(errors, []);
  Object.assign(report, { passed: true, noDevelopmentBridge: true, localResourcesOnly: true, canvasColors: colors.size, playableRooms: ['postoffice', 'clock'] });
  console.log('PASS production build loads illustrated rooms, switches time, supports cast dialogue and return navigation, and requests only local resources');
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await browser?.close();
  const exited = once(child, 'exit');
  child.kill();
  await exited;
  await mkdir(artifactDir, { recursive: true });
  await writeFile(join(artifactDir, 'production-smoke.json'), JSON.stringify(report, null, 2));
}
