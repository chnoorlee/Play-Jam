import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('portable server serves the built game and rejects requests outside dist', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const html = await response.text();
    const script = html.match(/src="([^"]+\.js)"/);
    assert(script, 'built HTML references a JavaScript bundle');
    const asset = await fetch(new URL(script[1], `${url}/`));
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(`${url}/missing.txt`)).status, 404);
    assert.equal((await fetch(`${url}/%2e%2e%2fpackage.json`)).status, 403);
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});
