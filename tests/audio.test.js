import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';

test('overlapping audio toggles serialize resume and suspend without losing timers', async () => {
  const original = { window: globalThis.window, document: globalThis.document, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  let releaseResume;
  const operations = [], intervals = new Set();
  const node = () => ({ connect() { return this; }, disconnect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  class MockAudioContext {
    currentTime = 0;
    destination = {};
    createGain() { return node(); }
    createOscillator() { return { ...node(), frequency: { value: 0 }, start() {}, stop() {} }; }
    resume() { operations.push('resume'); return new Promise(resolve => { releaseResume = resolve; }); }
    async suspend() { operations.push('suspend'); }
    async close() {}
  }
  globalThis.window = { AudioContext: MockAudioContext };
  globalThis.document = { hidden: false };
  globalThis.setInterval = () => { const id = Symbol(); intervals.add(id); return id; };
  globalThis.clearInterval = id => intervals.delete(id);
  try {
    const audio = createAudio();
    const enable = audio.toggle(), disable = audio.toggle();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(operations, ['resume']);
    assert.equal(intervals.size, 0);
    releaseResume();
    assert.equal(await enable, true);
    assert.equal(await disable, false);
    assert.deepEqual(operations, ['resume', 'suspend']);
    assert.equal(intervals.size, 0);
    const reenable = audio.toggle();
    await new Promise(resolve => setImmediate(resolve));
    releaseResume();
    await reenable;
    assert.equal(intervals.size, 1);
    audio.dispose();
    assert.equal(intervals.size, 0);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
