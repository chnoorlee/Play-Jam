import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, normalizeSave } from '../src/story.js';
import { encodeBackup, decodeBackup } from '../src/settings.js';
import { createVoyage, visit, inspect, recordTide, changeDraft, checkDraft, deliver, normalizeVoyage } from '../src/afterword-state.js';

function oldEnding() {
  const state = createState();
  delete state.voyage;
  return { ...state, started: true, solved: {clock: true, greenhouse: true, platform: true}, decisions: {clock: 'truth', greenhouse: 'share', platform: 'wait'}, ending: 'preserve' };
}

test('legacy ending opens the first stop and a missing clue prevents delivery', () => {
  const state = normalizeSave(oldEnding());
  assert.equal(state.ending, 'preserve');
  const {voyage} = state;
  assert.deepEqual(voyage, createVoyage());
  assert.equal(visit(voyage, 'observatory'), false);
  changeDraft(voyage, 'outer');
  inspect(voyage, 0);
  assert.equal(checkDraft(voyage), 'missing');
  deliver(voyage, 'crew');
  assert.equal(voyage.stops.marsh.delivered, null);
});

test('three distinct mechanisms, retry, delivery, revisit and backup recovery', () => {
  const state = normalizeSave(oldEnding());
  let voyage = state.voyage;
  voyage.active = true;
  inspect(voyage, 0); inspect(voyage, 1);
  recordTide(voyage, 'dawn', 3); recordTide(voyage, 'now', 2);
  inspect(voyage, 2);
  changeDraft(voyage, 'inner'); assert.equal(checkDraft(voyage), 'wrong');
  changeDraft(voyage, 'outer'); assert.equal(checkDraft(voyage), 'ready');
  deliver(voyage, 'crew'); deliver(voyage, 'passengers');
  assert.equal(voyage.stops.marsh.delivered, 'crew');
  assert.equal(visit(voyage, 'saltworks'), true);
  inspect(voyage, 0); inspect(voyage, 1); inspect(voyage, 2);
  changeDraft(voyage, '3'); changeDraft(voyage, '5');
  assert.equal(checkDraft(voyage), 'wrong');
  changeDraft(voyage, '3'); changeDraft(voyage, '2');
  assert.equal(checkDraft(voyage), 'ready'); deliver(voyage, 'families');
  assert.equal(visit(voyage, 'observatory'), true);
  inspect(voyage, 0); inspect(voyage, 1); inspect(voyage, 2);
  changeDraft(voyage, 'short'); changeDraft(voyage, 'long');
  const imported = decodeBackup(encodeBackup(state));
  assert.deepEqual(imported.voyage, voyage);
  voyage = imported.voyage;
  changeDraft(voyage, 'short'); changeDraft(voyage, 'long');
  assert.equal(checkDraft(voyage), 'ready'); deliver(voyage, 'window');
  assert.equal(visit(voyage, 'marsh'), true);
  assert.equal(voyage.stops.marsh.delivered, 'crew');
  assert.equal(voyage.stops.observatory.delivered, 'window');
});

test('both tide records are observed on site and a partial observation survives a backup', () => {
  const state = normalizeSave(oldEnding());
  const { voyage } = state;
  inspect(voyage, 0);
  assert.equal(recordTide(voyage, 'now', 2), 'wrong');
  inspect(voyage, 1);
  assert.equal(recordTide(voyage, 'now', 3), 'wrong');
  assert.deepEqual(voyage.stops.marsh.tideReadings, []);
  assert.equal(recordTide(voyage, 'now', 2), 'recorded');
  assert.equal(recordTide(voyage, 'now', 2), 'recorded');
  changeDraft(voyage, 'outer');
  assert.equal(checkDraft(voyage), 'missing');
  const restored = decodeBackup(encodeBackup(state)).voyage;
  assert.deepEqual(restored.stops.marsh.tideReadings, ['now']);
  assert.equal(recordTide(restored, 'dawn', 3), 'recorded');
  assert.equal(checkDraft(restored), 'ready');
});

test('a pre-gauge ferry save keeps its old observations and route unlocks', () => {
  const stops = {marsh: {seen: [0, 1], draft: ['outer'], solved: true, delivered: 'passengers'}};
  const saved = normalizeVoyage({active: true, port: 'saltworks', stops});
  assert.equal(saved.port, 'saltworks');
  assert.equal(saved.stops.marsh.delivered, 'passengers');
  assert.deepEqual(saved.stops.marsh.tideReadings, ['dawn', 'now']);
  const inconsistent = normalizeVoyage({port: 'saltworks', stops: {marsh: {...stops.marsh, tideReadings: ['now', 'now', 'tide']}}});
  assert.equal(inconsistent.port, 'marsh');
  assert.deepEqual(inconsistent.stops.marsh.seen, [0]);
});

test('corrupt and premature saves cannot skip locked destinations', () => {
  const bad = { active: true, port: 'observatory', stops: { marsh: {seen: [0, 1], draft: ['inner'], solved: true, delivered: 'crew'}, observatory: {delivered: 'window'} } };
  const cleaned = normalizeVoyage(bad);
  assert.equal(cleaned.port, 'marsh');
  assert.equal(cleaned.stops.marsh.solved, false);
  assert.equal(cleaned.stops.observatory.delivered, null);
  assert.deepEqual(normalizeSave({ ...createState(), voyage: bad }).voyage, createVoyage());
});
