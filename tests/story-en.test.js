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
          for (const id of ['clock', 'greenhouse', 'platform']) assertEnglish(interact(state, id));
          assertEnglish(choose(state, 'ending:' + ending));
          assertEnglish(getJournal(state));
        }
      }
    }
  }
  assert.equal(translateStory('untranslated-id'), 'untranslated-id');
  assert.equal(translateStory('尚无对应的文本。'), '尚无对应的文本。');
});
