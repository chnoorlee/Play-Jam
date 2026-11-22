import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, normalizeSave, getChapter, getObjective, getJournal, getPuzzle,
  interact, choose, setPhase, adjustDial, adjustMirror, getEnding, getHint, getReceipts,
} from '../src/story.js';

function begin() {
  const state = createState();
  choose(state, 'begin');
  return state;
}

function prepareClock(state) {
  setPhase(state, 'present');
  choose(state, 'read:clock');
  [3, 2, 0].forEach((count, index) => {
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
  for (const fragment of ['north', 'closed', 'south', 'reunion']) choose(state, `sequence:platform:${fragment}`);
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
  assert.equal(getPuzzle(state, 'platform').ready, false);
  assert.equal(choose(state, 'resolve:platform').assembly, 'platform');
  for (const fragment of ['north', 'closed', 'south', 'reunion']) choose(state, `sequence:platform:${fragment}`);
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

test('invalid and out-of-bounds puzzle values are ignored and coupled rotations wrap', () => {
  const state = begin();
  for (const index of [-1, 3, 1.5, NaN, '0']) adjustDial(state, index);
  assert.deepEqual(state.dials, [0, 0, 0]);
  for (let i = 0; i < 4; i++) adjustDial(state, 0);
  assert.deepEqual(state.dials, [0, 0, 0]);
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
  assert.match(getObjective(state), /钟楼、温室、旧站台/);
  choose(state, 'read:clock');
  assert.match(getJournal(state).find(entry => entry.title.includes('家书')).body, /III/);
  assert.equal(getJournal(state).some(entry => entry.title.includes('已投递')), false);
  assert.match(getObjective(finish()), /决定/);
});

test('clock is a coupled mechanism: upstream turns affect only the immediate next wheel', () => {
  const state = begin();
  adjustDial(state, 0);
  assert.deepEqual(state.dials, [1, 1, 0]);
  adjustDial(state, 1);
  assert.deepEqual(state.dials, [1, 2, 1]);
  adjustDial(state, 2);
  assert.deepEqual(state.dials, [1, 2, 2]);
  const wrong = begin();
  choose(wrong, 'read:clock');
  [3, 1, 2].forEach((count, index) => {
    for (let i = 0; i < count; i++) adjustDial(wrong, index);
  });
  assert.deepEqual(wrong.dials, [3, 0, 3]);
  assert.equal(getPuzzle(wrong, 'clock').ready, false, 'copying the target as independent button counts cannot solve coupled wheels');
});

test('every one of the 64 clock configurations is reachable using the actual controls', () => {
  const queue = [[0, 0, 0]];
  const seen = new Set(['0,0,0']);
  for (let head = 0; head < queue.length; head++) {
    for (let index = 0; index < 3; index++) {
      const state = begin();
      state.dials = [...queue[head]];
      adjustDial(state, index);
      const key = state.dials.join(',');
      if (!seen.has(key)) { seen.add(key); queue.push(state.dials); }
    }
  }
  assert.equal(seen.size, 64, 'the gearing must not make any legal target impossible');
});

test('third-tier clock hints solve the current configuration, with no state mutation', () => {
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
    const state = begin();
    choose(state, 'read:clock');
    state.dials = [a, b, c];
    const before = structuredClone(state);
    const hint = getHint(state, 'clock', 3);
    assert.deepEqual(state, before);
    const counts = [...hint.matchAll(/(?:离港|熄灯|归家) (\d) 次/g)].map(match => Number(match[1]));
    assert.equal(counts.length, 3);
    counts.forEach((count, index) => {
      for (let i = 0; i < count; i++) adjustDial(state, index);
    });
    assert.equal(getPuzzle(state, 'clock').ready, true, `hint should solve starting state ${a},${b},${c}`);
  }
});

test('greenhouse connections reflect continuous light propagation, not isolated correct mirrors', () => {
  const state = begin();
  setPhase(state, 'echo');
  state.mirrors = [0, 2, 3];
  let puzzle = getPuzzle(state, 'greenhouse');
  assert.deepEqual(puzzle.connections, [false, false, false]);
  assert.equal(puzzle.matched, 0);
  assert.match(puzzle.feedback, /第一面/);
  state.mirrors = [1, 0, 3];
  puzzle = getPuzzle(state, 'greenhouse');
  assert.deepEqual(puzzle.connections, [true, false, false]);
  assert.equal(puzzle.matched, 1);
  assert.equal(puzzle.segments.filter(segment => segment.active).length, 2);
  state.mirrors = [1, 2, 0];
  assert.deepEqual(getPuzzle(state, 'greenhouse').connections, [true, true, false]);
  state.mirrors = [1, 2, 3];
  puzzle = getPuzzle(state, 'greenhouse');
  assert.equal(puzzle.matched, 3);
  assert.equal(puzzle.ready, false, 'light alone does not replace reading the letter');
  choose(state, 'read:greenhouse');
  assert.equal(getPuzzle(state, 'greenhouse').ready, true);
  assert.match(puzzle.feedback, /抵达种壳/);
});

test('platform reconstruction rejects wrong order, ignores duplicates and permits recovery', () => {
  const state = begin();
  choose(state, 'stamp:present');
  setPhase(state, 'echo');
  choose(state, 'stamp:echo');
  choose(state, 'sequence:platform:south');
  choose(state, 'sequence:platform:south');
  assert.deepEqual(state.platformOrder, ['south']);
  for (const fragment of ['north', 'closed', 'reunion']) choose(state, `sequence:platform:${fragment}`);
  assert.equal(getPuzzle(state, 'platform').ready, false);
  assert.equal(choose(state, 'resolve:platform').title, '地址读反了');
  choose(state, 'decision:platform:wait');
  assert.equal(state.solved.platform, false);
  choose(state, 'sequence:platform:reset');
  assert.deepEqual(state.platformOrder, []);
  for (const fragment of ['north', 'closed', 'south', 'reunion']) choose(state, `sequence:platform:${fragment}`);
  choose(state, 'decision:platform:wait');
  assert.equal(state.solved.platform, true);
});

test('selecting the first stamp piece at every step cannot solve the forwarding slip', () => {
  const state = begin();
  choose(state, 'stamp:present');
  setPhase(state, 'echo');
  choose(state, 'stamp:echo');
  let desk = choose(state, 'resolve:platform');
  const tray = desk.choices.map(choice => choice.action);
  for (let step = 0; step < 4; step++) desk = choose(state, desk.choices[0].action);
  assert.equal(desk.title, '地址读反了');
  assert.equal(getPuzzle(state, 'platform').ready, false);
  assert.deepEqual(choose(state, 'sequence:platform:reset').choices.map(choice => choice.action), tray);
});

test('the mirror solution agrees with the light diagram and is revealed in stages', () => {
  const state = begin();
  setPhase(state, 'echo');
  choose(state, 'read:greenhouse');
  const puzzle = getPuzzle(state, 'greenhouse');
  const mirrors = puzzle.nodes.slice(1, -1);
  const directions = mirrors.map((from, index) => {
    const to = puzzle.nodes[index + 2];
    if (to.y !== from.y) return to.y > from.y ? '南' : '北';
    return to.x > from.x ? '东' : '西';
  });
  assert.deepEqual(puzzle.target.map(value => puzzle.options[value]), directions);
  assert.doesNotMatch(puzzle.clue + getHint(state, 'greenhouse', 1), /朝东|向东|朝南|向南|朝西|向西/);
  assert.match(getHint(state, 'greenhouse', 2), /第一面应当向东/);
  assert.match(getHint(state, 'greenhouse', 3), /晨光 1 次、午光 2 次、暮光 3 次/);
});

test('both memories surface once at delivery and stay in the journal in every mission order', () => {
  const ids = ['clock', 'greenhouse', 'platform'];
  const prepare = { clock: prepareClock, greenhouse: prepareGreenhouse, platform: preparePlatform };
  const decisions = { clock: 'truth', greenhouse: 'plant', platform: 'wait' };
  const titles = ['许渡手记 · 柜台上的画', '许渡手记 · 轮到我送'];
  for (const first of ids) for (const second of ids.filter(id => id !== first)) {
    const order = [first, second, ids.find(id => id !== first && id !== second)];
    const state = begin();
    for (const [index, id] of order.entries()) {
      prepare[id](state);
      const reply = choose(state, `decision:${id}:${decisions[id]}`);
      if (index < 2) assert.ok(reply.text.includes(titles[index]));
      else assert.doesNotMatch(reply.text, /许渡手记/);
      assert.doesNotMatch(interact(state, id).text, /许渡手记/);
      const journal = getJournal(normalizeSave(structuredClone(state)));
      assert.deepEqual(journal.filter(entry => entry.title.startsWith('许渡手记')).map(entry => entry.title), titles.slice(0, index + 1));
    }
    assert.match(interact(state, 'final').text, /旧画/);
  }
});

test('all hint tiers are readonly, progressively specific and invalid ids are harmless', () => {
  const state = begin();
  const before = structuredClone(state);
  for (const id of ['clock', 'greenhouse', 'platform']) {
    const hints = [1, 2, 3].map(level => getHint(state, id, level));
    assert.equal(new Set(hints).size, 3);
    hints.forEach(hint => assert.equal(typeof hint, 'string'));
  }
  assert.equal(getHint(state, 'unsupported', 1), '');
  assert.equal(getHint(state, 'clock', Infinity), getHint(state, 'clock', 1));
  assert.deepEqual(state, before);
});

test('objectives follow the player-selected thread rather than always demanding clock first', () => {
  const state = begin();
  choose(state, 'read:greenhouse');
  assert.equal(state.activeMission, 'greenhouse');
  assert.match(getObjective(state), /温室/);
  assert.doesNotMatch(getObjective(state), /钟楼/);
  choose(state, 'stamp:present');
  assert.equal(state.activeMission, 'platform');
  assert.match(getObjective(state), /邮戳/);
  const loaded = normalizeSave(structuredClone(state));
  assert.equal(loaded.activeMission, 'platform');
  preparePlatform(state);
  choose(state, 'decision:platform:wait');
  assert.equal(state.activeMission, null);
  assert.match(getObjective(state), /钟楼、温室/);
});

test('receipts appear only after decisions, reflect each branch and retain delivery order', () => {
  const state = begin();
  preparePlatform(state);
  assert.deepEqual(getReceipts(state), []);
  const response = choose(state, 'decision:platform:farewell');
  assert.equal(response.receipt, 'platform');
  assert.match(response.text, /旧车票/);
  assert.equal(getReceipts(state)[0].recipient, '阿岚');
  prepareGreenhouse(state);
  choose(state, 'decision:greenhouse:plant');
  prepareClock(state);
  choose(state, 'decision:clock:forgive');
  assert.deepEqual(getReceipts(state).map(receipt => receipt.id), ['platform', 'greenhouse', 'clock']);
  assert.match(getReceipts(state)[1].body, /窗台/);
  choose(state, 'ending:carry');
  assert.deepEqual(getEnding(state).receipts, getReceipts(state));
  assert.equal(getEnding(state).keepsakes.length, 3);
  const first = getReceipts(state);
  first[0].body = 'changed externally';
  assert.notEqual(getReceipts(state)[0].body, 'changed externally');
});

test('legacy v1 completed saves migrate without replaying the new mechanisms', () => {
  const legacy = {
    version: 1, started: true, phase: 'echo',
    solved: { clock: true, greenhouse: true, platform: true },
    decisions: { clock: 'truth', greenhouse: 'share', platform: 'wait' },
    clues: ['clock', 'greenhouse'], dials: [3, 1, 2], mirrors: [1, 2, 3],
    stamps: { present: true, echo: true }, ending: 'preserve',
  };
  const loaded = normalizeSave(legacy);
  assert.deepEqual(loaded.solved, legacy.solved);
  assert.deepEqual(loaded.decisions, legacy.decisions);
  assert.deepEqual(loaded.platformOrder, ['north', 'closed', 'south', 'reunion']);
  assert.equal(loaded.ending, 'preserve');
  assert.equal(getReceipts(loaded).length, 3);
  assert.deepEqual(normalizeSave(structuredClone(loaded)), loaded);
});

test('partial new saves retain reconstruction and discard invalid duplicate progress', () => {
  const loaded = normalizeSave({
    version: 1, started: true, phase: 'echo',
    stamps: { present: true, echo: true },
    platformOrder: ['south', 'south', 'invalid', 'north'],
    activeMission: 'platform', deliveryOrder: ['clock', 'clock', 'hacked'],
  });
  assert.deepEqual(loaded.platformOrder, ['south', 'north']);
  assert.deepEqual(loaded.deliveryOrder, []);
  assert.match(choose(loaded, 'resolve:platform').text, /次序/);
  choose(loaded, 'sequence:platform:reset');
  for (const fragment of ['north', 'closed', 'south', 'reunion']) choose(loaded, `sequence:platform:${fragment}`);
  choose(loaded, 'decision:platform:wait');
  assert.equal(loaded.solved.platform, true);
});
