import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, normalizeSave, getChapter, getObjective, getJournal, getPuzzle,
  interact, choose, setPhase, adjustDial, adjustMirror, getEnding,
} from '../src/story.js';

function begin() {
  const state = createState();
  choose(state, 'begin');
  return state;
}

function prepareClock(state) {
  setPhase(state, 'present');
  choose(state, 'read:clock');
  [3, 1, 2].forEach((count, index) => {
    for (let i = 0; i < count; i++) adjustDial(state, index);
  });
}

function prepareGreenhouse(state) {
  setPhase(state, 'echo');
  choose(state, 'read:greenhouse');
  [1, 2, 3].forEach((count, index) => {
    for (let i = 0; i < count; i++) adjustMirror(state, index);
  });
}

function preparePlatform(state) {
  setPhase(state, 'present');
  choose(state, 'stamp:present');
  setPhase(state, 'echo');
  choose(state, 'stamp:echo');
}

function finish(decisions = { clock: 'truth', greenhouse: 'share', platform: 'wait' }) {
  const state = begin();
  prepareClock(state);
  choose(state, `decision:clock:${decisions.clock}`);
  prepareGreenhouse(state);
  choose(state, `decision:greenhouse:${decisions.greenhouse}`);
  preparePlatform(state);
  choose(state, `decision:platform:${decisions.platform}`);
  return state;
}

test('interactions are read-only, including clue and collectible inspection', () => {
  const state = begin();
  const before = structuredClone(state);
  for (const id of ['keeper', 'letter', 'seed-note', 'clock', 'greenhouse', 'platform', 'present-stamp', 'echo-stamp', 'final']) interact(state, id);
  assert.deepEqual(state, before);
});

test('intro gates puzzle progress and narrative choices', () => {
  const state = createState();
  adjustDial(state, 0);
  choose(state, 'read:clock');
  choose(state, 'decision:clock:truth');
  choose(state, 'ending:release');
  assert.deepEqual(state.dials, [0, 0, 0]);
  assert.deepEqual(state.clues, []);
  assert.equal(state.ending, null);
  assert.equal(state.solved.clock, false);
  assert.match(interact(state, 'keeper').title, /今夜/);
});

test('clock needs its clue, the exact order and present time', () => {
  const state = begin();
  state.dials = [3, 1, 2];
  assert.equal(getPuzzle(state, 'clock').ready, false);
  choose(state, 'resolve:clock');
  assert.equal(state.solved.clock, false);
  choose(state, 'read:clock');
  setPhase(state, 'echo');
  assert.equal(getPuzzle(state, 'clock').ready, false);
  choose(state, 'decision:clock:truth');
  assert.equal(state.solved.clock, false);
  setPhase(state, 'present');
  assert.equal(getPuzzle(state, 'clock').ready, true);
  assert.equal(choose(state, 'resolve:clock').speaker, '曹遥');
  assert.equal(state.solved.clock, false);
  choose(state, 'decision:clock:truth');
  assert.equal(state.solved.clock, true);
});

test('mirror puzzle is gated to echo and retains values between phases', () => {
  const state = begin();
  choose(state, 'read:greenhouse');
  adjustMirror(state, 0);
  assert.deepEqual(state.mirrors, [0, 0, 0]);
  prepareGreenhouse(state);
  assert.equal(getPuzzle(state, 'greenhouse').ready, true);
  setPhase(state, 'present');
  assert.equal(getPuzzle(state, 'greenhouse').ready, false);
  setPhase(state, 'echo');
  choose(state, 'decision:greenhouse:plant');
  assert.equal(state.solved.greenhouse, true);
});

test('collecting a stamp in the wrong phase cannot bypass the two-time puzzle', () => {
  const state = begin();
  choose(state, 'stamp:echo');
  assert.deepEqual(state.stamps, { present: false, echo: false });
  choose(state, 'stamp:present');
  choose(state, 'decision:platform:wait');
  assert.equal(state.solved.platform, false);
  setPhase(state, 'echo');
  choose(state, 'stamp:present');
  choose(state, 'stamp:echo');
  assert.equal(getPuzzle(state, 'platform').ready, true);
  assert.equal(choose(state, 'resolve:platform').speaker, '阿岚');
  choose(state, 'decision:platform:wait');
  assert.equal(state.solved.platform, true);
});

test('missions can be completed in a different order without a softlock', () => {
  const state = begin();
  preparePlatform(state);
  choose(state, 'decision:platform:farewell');
  prepareGreenhouse(state);
  choose(state, 'decision:greenhouse:share');
  prepareClock(state);
  choose(state, 'decision:clock:forgive');
  assert.equal(interact(state, 'final').choices.length, 4);
  choose(state, 'ending:carry');
  assert.equal(getEnding(state).id, 'carry');
});

test('solving the mechanism alone does not deliver a letter; decision commits it', () => {
  const state = begin();
  prepareClock(state);
  choose(state, 'resolve:clock');
  assert.equal(state.solved.clock, false);
  assert.equal(state.decisions.clock, undefined);
  choose(state, 'decision:clock:forgive');
  assert.equal(state.solved.clock, true);
  choose(state, 'decision:clock:truth');
  assert.equal(state.decisions.clock, 'forgive');
});

test('invalid and out-of-bounds puzzle values are ignored and rotations wrap', () => {
  const state = begin();
  for (const index of [-1, 3, 1.5, NaN, '0']) adjustDial(state, index);
  assert.deepEqual(state.dials, [0, 0, 0]);
  for (let i = 0; i < 4; i++) adjustDial(state, 0);
  assert.equal(state.dials[0], 0);
  setPhase(state, 'invalid');
  assert.equal(state.phase, 'present');
});

test('no ending can be selected before all three deliveries', () => {
  const state = begin();
  for (const ending of ['release', 'preserve', 'carry']) {
    choose(state, `ending:${ending}`);
    assert.equal(state.ending, null);
  }
  assert.equal(getEnding(state), null);
});

for (const ending of ['release', 'preserve', 'carry']) {
  test(`${ending} produces a complete, distinct ending and survives a save round trip`, () => {
    const state = finish();
    const response = choose(state, `ending:${ending}`);
    assert.equal(response.ending, true);
    assert.equal(getEnding(state).id, ending);
    assert.equal(getEnding(state).reflections.length, 3);
    const loaded = normalizeSave(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(loaded, state);
    const before = structuredClone(state);
    choose(state, 'ending:carry');
    adjustDial(state, 0);
    setPhase(state, 'present');
    assert.deepEqual(state, before);
  });
}

test('personal decisions change all three ending reflections', () => {
  const first = finish();
  const second = finish({ clock: 'forgive', greenhouse: 'plant', platform: 'farewell' });
  choose(first, 'ending:release');
  choose(second, 'ending:release');
  const a = getEnding(first);
  const b = getEnding(second);
  a.reflections.forEach((reflection, i) => assert.notEqual(reflection, b.reflections[i]));
});

test('malformed saves recover to a playable state without trusting unsupported fields', () => {
  for (const raw of [null, false, 'text', [], { version: 999 }]) assert.deepEqual(normalizeSave(raw), createState());
  const loaded = normalizeSave({
    version: 1, started: 'true', phase: 'bad', dials: [Infinity, -1, '2'], mirrors: [3],
    stamps: { present: 1, echo: true }, clues: ['clock', 'clock', '__proto__'],
    solved: { clock: true, greenhouse: true, platform: false },
    decisions: { clock: 'hacked', greenhouse: 'share' }, ending: 'carry', extra: 'discard',
  });
  assert.equal(loaded.started, true);
  assert.equal(loaded.solved.clock, false);
  assert.equal(loaded.solved.greenhouse, true);
  assert.deepEqual(loaded.dials, [0, 0, 0]);
  assert.deepEqual(loaded.mirrors, [1, 2, 3]);
  assert.deepEqual(loaded.clues, ['clock', 'greenhouse']);
  assert.equal(loaded.ending, null);
  assert.equal(Object.hasOwn(loaded, 'extra'), false);
});

test('save recovery keeps unfinished puzzle and collectible progress', () => {
  const state = begin();
  choose(state, 'read:clock');
  adjustDial(state, 0);
  choose(state, 'stamp:present');
  setPhase(state, 'echo');
  assert.deepEqual(normalizeSave(structuredClone(state)), state);
});

test('journal and objective provide relevant clues rather than inventing progress', () => {
  const state = createState();
  assert.match(getChapter(state), /序章/);
  assert.equal(getJournal(state).length, 1);
  choose(state, 'begin');
  assert.match(getObjective(state), /家书/);
  choose(state, 'read:clock');
  assert.match(getJournal(state).find(entry => entry.title.includes('家书')).body, /III/);
  assert.equal(getJournal(state).some(entry => entry.title.includes('已投递')), false);
  assert.match(getObjective(finish()), /决定/);
});
