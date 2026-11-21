import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const errors = [], requests = [];
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
  await page.click('[data-action="begin"]');
  await page.click('[data-action="close"]');
  await page.click('#phase-button');
  assert.equal(await page.locator('#phase-label').textContent(), '回声');
  const png = PNG.sync.read(await page.locator('canvas').screenshot());
  const colors = new Set();
  for (let i = 0; i < png.data.length; i += 172) colors.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
  assert(colors.size > 70);
  await page.click('#journal-button');
  assert(await page.locator('#journal').isVisible());
  assert(requests.every(request => new URL(request).hostname === '127.0.0.1'));
  assert.deepEqual(errors, []);
  Object.assign(report, { passed: true, noDevelopmentBridge: true, localResourcesOnly: true, canvasColors: colors.size });
  console.log('PASS production build loads, renders, starts, switches time, opens journal, and requests only local resources');
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await browser?.close();
  const exited = once(child, 'exit');
  child.kill();
  await exited;
  await writeFile('artifacts/production-smoke.json', JSON.stringify(report, null, 2));
}
