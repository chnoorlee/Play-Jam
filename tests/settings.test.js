import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, normalizeSettings, encodeBackup, decodeBackup } from '../src/settings.js';
import { createState, choose } from '../src/story.js';

test('device and motion preferences supply defaults; persisted settings are validated', () => {
  const defaults = defaultSettings({ narrow: true, reducedMotion: true });
  assert.deepEqual(normalizeSettings(null, defaults), defaults);
  assert.deepEqual(normalizeSettings({ quality: 'ultra', volume: Infinity, reducedMotion: 'false', largeText: 1 }, defaults), defaults);
  assert.deepEqual(normalizeSettings({ quality: 'high', volume: 2, reducedMotion: false, largeText: true }, defaults), { language: 'zh-CN', quality: 'high', volume: 1, reducedMotion: false, largeText: true });
  assert.equal(normalizeSettings({ language: 'en' }).language, 'en');
  assert.equal(normalizeSettings({ language: 'unknown' }).language, 'zh-CN');
  assert.equal(normalizeSettings({ volume: -2 }).volume, 0);
});

test('backup round trip retains an incomplete linked puzzle and address assembly', () => {
  const state = createState(); choose(state, 'begin'); choose(state, 'read:clock');
  state.dials = [2, 3, 1]; state.stamps = { present: true, echo: true }; state.platformOrder = ['north', 'closed'];
  assert.deepEqual(decodeBackup(encodeBackup(state)), state);
});

test('backup import rejects unrelated, unsupported, malformed and oversized files', () => {
  for (const text of ['null', '{}', '[]', '{', 'x'.repeat(200001), JSON.stringify({ game: 'other', format: 1, save: { version: 1, started: true } }), JSON.stringify({ game: 'the-last-post', format: 2, save: { version: 1, started: true } }), encodeBackup(createState())]) {
    assert.throws(() => decodeBackup(text));
  }
});

test('backup import normalizes malicious puzzle fields and never injects arbitrary state keys', () => {
  const raw = { game: 'the-last-post', format: 1, save: { version: 1, started: true, dials: [99, -1, '3'], phase: 'untrusted', ending: 'release', arbitrary: 'bad' } };
  const state = decodeBackup(JSON.stringify(raw));
  assert.deepEqual(state.dials, [0, 0, 0]); assert.equal(state.phase, 'present'); assert.equal(state.ending, null); assert.equal(state.arbitrary, undefined);
});
