import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustDial, adjustMirror, choose, createState, getHint, getJournal, getObjective, getPuzzle, interact, normalizeSave } from '../src/story.js';
import { translateStory } from '../src/story-en.js';

function assertEnglish(value) {
  if (typeof value === 'string') {
    assert.doesNotMatch(translateStory(value), /\p{Script=Han}/u, value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(assertEnglish);
  }
}

test('English clock and mirror hints solve the puzzle from every possible starting position', () => {
  for (const id of ['clock', 'greenhouse']) {
    for (let position = 0; position < 64; position++) {
      const state = createState();
      choose(state, 'begin');
      state[id === 'clock' ? 'dials' : 'mirrors'] = [position % 4, Math.floor(position / 4) % 4, Math.floor(position / 16)];
      assertEnglish(getHint(state, id, 3));
      state.phase = id === 'clock' ? 'present' : 'echo';
      choose(state, 'read:' + id);
      const hint = translateStory(getHint(state, id, 3));
      assertEnglish(getPuzzle(state, id));
      const turns = Array.from(hint.matchAll(/×(\d+)/g), match => Number(match[1]));
      if (!getPuzzle(state, id).ready) assert.equal(turns.length, 3, hint);
      for (const [index, count] of turns.entries()) {
        for (let i = 0; i < count; i++) (id === 'clock' ? adjustDial : adjustMirror)(state, index);
      }
      assert.equal(getPuzzle(state, id).ready, true, hint);
    }
  }
});

test('English covers missing stamps, partially or incorrectly assembled addresses, and the journal', () => {
  const state = createState();
  choose(state, 'begin');
  assertEnglish(getObjective(state));
  for (const phase of ['present', 'echo']) {
    state.phase = phase;
    assertEnglish(interact(state, 'platform'));
    assertEnglish(getHint(state, 'platform', 3));
    assertEnglish(choose(state, 'stamp:' + phase));
    assertEnglish(getJournal(state));
  }
  assertEnglish(interact(state, 'platform'));
  for (const token of ['closed', 'north', 'south', 'reunion', 'reset', 'north', 'closed', 'south', 'reunion']) {
    assertEnglish(choose(state, 'sequence:platform:' + token));
    assertEnglish(getHint(state, 'platform', 3));
  }
});

test('every combination of player decisions keeps its English replies and ending reflections', () => {
  for (const clock of ['truth', 'forgive']) {
    for (const greenhouse of ['share', 'plant']) {
      for (const platform of ['wait', 'farewell']) {
        for (const ending of ['release', 'preserve', 'carry']) {
          const state = normalizeSave({ ...createState(), solved: { clock: true, greenhouse: true, platform: true }, decisions: { clock, greenhouse, platform } });
          for (const id of ['clock', 'greenhouse', 'platform', 'cao', 'ye', 'lan', 'final']) assertEnglish(interact(state, id));
          assertEnglish(choose(state, 'ending:' + ending));
          assertEnglish(getJournal(state));
        }
      }
    }
  }
  assert.equal(translateStory('untranslated-id'), 'untranslated-id');
  assert.equal(translateStory('尚无对应的文本。'), '尚无对应的文本。');
});

test('each recipient has two distinct localized conversations after delivery', () => {
  for (const [mission, npc, options] of [
    ['clock', 'cao', ['truth', 'forgive']],
    ['greenhouse', 'ye', ['plant', 'share']],
    ['platform', 'lan', ['wait', 'farewell']],
  ]) {
    const conversations = options.map(decision => {
      const state = normalizeSave({ ...createState(), solved: { [mission]: true }, decisions: { [mission]: decision } });
      const conversation = interact(state, npc);
      assertEnglish(conversation);
      return translateStory(conversation.text);
    });
    assert.notEqual(conversations[0], conversations[1]);
  }
});

test('English localizes both mailbag discoveries in the delivered receipt and journal', () => {
  const state = createState();
  choose(state, 'begin');
  for (const [id, field, action] of [
    ['clock', 'dials', 'truth'], ['greenhouse', 'mirrors', 'plant'],
  ]) {
    const puzzle = getPuzzle(state, id);
    state.phase = puzzle.phase;
    state[field] = [...puzzle.target];
    assertEnglish(choose(state, 'read:' + id));
    assertEnglish(interact(state, id === 'clock' ? 'letter' : 'seed-note'));
    assertEnglish(getHint(state, id, 2));
    const receipt = choose(state, 'decision:' + id + ':' + action);
    assertEnglish(receipt);
    assert.match(translateStory(receipt.text), /Xu Du's Journal/);
    assertEnglish(getJournal(state));
  }
});
test('discovery hints in both languages reveal only the next available field step', () => {
  const state = createState();
  choose(state, 'begin');
  for (const id of ['clock', 'greenhouse', 'platform']) {
    for (const phase of ['present', 'echo']) {
      state.phase = phase;
      for (const tier of [1, 2, 3]) {
        const hint = getHint(state, id, tier);
        assert.doesNotMatch(hint, /III|应当向东|次、|北站|南岸/);
        assertEnglish(hint);
      }
    }
  }
  choose(state, 'read:clock');
  assert.match(getHint(state, 'clock', 3), /此刻/);
  state.phase = 'present'; choose(state, 'read:greenhouse');
  assert.match(getHint(state, 'greenhouse', 2), /回声/);
  choose(state, 'stamp:present');
  for (const tier of [1, 2, 3]) {
    assert.match(getHint(state, 'platform', tier), /长椅/);
    assertEnglish(getHint(state, 'platform', tier));
  }
});
