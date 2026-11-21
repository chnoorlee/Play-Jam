import { createIcons, Mail, BookOpen, Volume2, VolumeX, Pause, Play, Eclipse, ArrowLeftRight, ArrowUpRight, ArrowRight, MessageCircle, X, RotateCw, Check, Flower2, Clock3, TrainFront, Feather, Download } from 'lucide';
import { createWorld } from './world.js';
import { createState, normalizeSave, getChapter, getObjective, getJournal, interact, choose, setPhase, adjustDial, adjustMirror, getPuzzle, getEnding } from './story.js';
import { createAudio } from './audio.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const icons = { Mail, BookOpen, Volume2, VolumeX, Pause, Play, Eclipse, ArrowLeftRight, ArrowUpRight, ArrowRight, MessageCircle, X, RotateCw, Check, Flower2, Clock3, TrainFront, Feather, Download };
const icon = name => `<i data-lucide="${name}"></i>`;
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
const SAVE_KEY = 'the-last-post.save.v1';
let state = createState(), dialogue = null, near = null, activeModal = null, introVisible = true, world;
let saveAvailable = false, storageWarning = false, toastTimer, lastFocus;
const audio = createAudio();
try {
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  state = normalizeSave(raw);
  saveAvailable = state.started;
} catch { storageWarning = true; }

function toast(text) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3400);
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  catch { if (!storageWarning) { storageWarning = true; toast('当前浏览器无法保存进度，本次旅程仍可继续。'); } }
}

function pauseWorld() {
  const paused = introVisible || !!dialogue || !!activeModal || !!state.ending || document.hidden;
  world?.setPaused(paused);
  document.body.classList.toggle('intro-open', introVisible);
  document.body.classList.toggle('dialogue-open', !!dialogue);
  document.body.classList.toggle('modal-open', !!activeModal);
}

function update() {
  $('#chapter-text').textContent = getChapter(state);
  $('#objective').textContent = getObjective(state);
  $('#phase-label').textContent = state.phase === 'echo' ? '回声' : '此刻';
  $('#phase-button').classList.toggle('echo', state.phase === 'echo');
  $('#phase-button').setAttribute('aria-label', state.phase === 'echo' ? '切换至此刻' : '切换至回声');
  document.body.classList.toggle('echo-mode', state.phase === 'echo');
  $('#stamps').innerHTML = [['clock', 'clock-3', '归期'], ['greenhouse', 'flower-2', '春天'], ['platform', 'train-front', '重逢']].map(([id, glyph, title]) => `<span class="stamp ${state.solved[id] ? 'done' : ''}">${icon(state.solved[id] ? 'check' : glyph)}<span>${title}</span></span>`).join('');
  $('#stamps').setAttribute('aria-label', `已投递 ${Object.values(state.solved).filter(Boolean).length} / 3 封信`);
  world?.setPhase(state.phase);
  world?.setProgress(state);
  audio.setPhase(state.phase);
  refreshIcons();
  pauseWorld();
}

function displayDialogue(value) {
  dialogue = value;
  $('#dialogue').hidden = !value;
  if (!value) { pauseWorld(); return; }
  if (value.ending) { dialogue = null; $('#dialogue').hidden = true; showEnding(); return; }
  $('#dialogue').innerHTML = `<div class="dialogue-header"><span class="speaker">${escape(value.speaker)}</span><button class="dialogue-close" aria-label="收起对话">${icon('x')}</button></div><h2>${escape(value.title)}</h2><p class="dialogue-text">${escape(value.text)}</p><div id="puzzle-slot"></div><div class="dialogue-choices">${value.choices.map(choice => `<button class="choice-button" data-action="${escape(choice.action)}"><span>${escape(choice.label)}</span>${icon('arrow-right')}</button>`).join('')}</div>`;
  $('.dialogue-close').addEventListener('click', () => displayDialogue(null));
  $('#dialogue').querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => act(button.dataset.action)));
  if (value.puzzle) renderPuzzle(value.puzzle);
  refreshIcons();
  pauseWorld();
  requestAnimationFrame(() => $('#dialogue .dial-button, #dialogue .choice-button')?.focus({ preventScroll: true }));
}

function renderPuzzle(id) {
  const puzzle = getPuzzle(state, id);
  $('#puzzle-slot').innerHTML = `<div class="puzzle-controls">${puzzle.labels.map((label, i) => `<div class="dial-control"><label for="dial-${i}">${escape(label)}</label><button id="dial-${i}" class="dial-button" data-index="${i}" aria-label="${escape(label)}：${escape(puzzle.options[puzzle.values[i]])}，转动">${escape(puzzle.options[puzzle.values[i]])}${icon('rotate-cw')}</button></div>`).join('')}</div><p class="puzzle-note">${escape(puzzle.clue)}</p>`;
  $('#puzzle-slot').querySelectorAll('.dial-button').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.index);
    if (id === 'clock') adjustDial(state, index); else adjustMirror(state, index);
    audio.chime(); save(); renderPuzzle(id); refreshIcons();
    $(`#dial-${index}`)?.focus({ preventScroll: true });
  }));
}

function act(action) {
  const before = Object.values(state.solved).filter(Boolean).length;
  const beforeJournal = getJournal(state).length;
  const result = choose(state, action);
  save(); update();
  if (Object.values(state.solved).filter(Boolean).length > before) { audio.delivery(); toast('一封信，终于抵达。'); }
  if (getJournal(state).length > beforeJournal) $('#journal-dot').hidden = false;
  displayDialogue(result);
}

function onInteract(id) {
  if (introVisible || activeModal || dialogue || state.ending) return;
  audio.chime();
  displayDialogue(interact(state, id));
}

function closeModal() {
  if (!activeModal) return;
  $(`#${activeModal}`).hidden = true;
  $('#modal-backdrop').hidden = true;
  activeModal = null;
  pauseWorld();
  lastFocus?.focus({ preventScroll: true });
}

function openModal(id) {
  if (introVisible || state.ending) return;
  if (activeModal === id) { closeModal(); return; }
  if (activeModal) closeModal();
  lastFocus = document.activeElement;
  activeModal = id;
  $(`#${id}`).hidden = false;
  $('#modal-backdrop').hidden = false;
  pauseWorld();
  refreshIcons();
  requestAnimationFrame(() => $(`#${id} button`)?.focus({ preventScroll: true }));
}

function showJournal() {
  const entries = getJournal(state);
  $('#journal').innerHTML = `<div class="modal-title"><h2 id="journal-title">投递手记</h2><button class="icon-button" data-close aria-label="关闭信笺簿">${icon('x')}</button></div><p class="journal-subtitle">许渡的旧邮包 · 白沙邮局</p>${entries.map(entry => `<article class="journal-entry"><h3>${escape(entry.title)}</h3><p>${escape(entry.body)}</p></article>`).join('')}`;
  $('#journal [data-close]').addEventListener('click', closeModal);
  $('#journal-dot').hidden = true;
  openModal('journal');
}

function showPause(confirm = false) {
  $('#pause').innerHTML = `<div class="modal-title"><h2 id="pause-title">${confirm ? '重新启程？' : '潮水稍候'}</h2><button class="icon-button" data-close aria-label="继续游戏">${icon('x')}</button></div><p class="pause-meta">${confirm ? '这一夜的投递记录将被清空。' : `${escape(getChapter(state))}<br>${storageWarning ? '本次旅程暂未保存。' : '投递记录已自动保存于此浏览器。'}`}</p><button class="primary-button" id="resume-button"><span>${confirm ? '保留这段旅程' : '继续投递'}</span>${icon('play')}</button><div class="pause-warning"><button class="text-button danger-button" id="restart-button">${confirm ? '清空记录，重新开始' : '重新开始'} ${icon('rotate-cw')}</button></div>`;
  $('#pause [data-close]').addEventListener('click', closeModal);
  $('#resume-button').addEventListener('click', closeModal);
  $('#restart-button').addEventListener('click', () => confirm ? restart() : showPause(true));
  if (activeModal === 'pause') { refreshIcons(); return; }
  openModal('pause');
}

function restart() {
  closeModal();
  state = createState();
  dialogue = null; $('#dialogue').hidden = true; $('#ending').hidden = true;
  save(); update();
  displayDialogue(interact(state, 'keeper'));
}

function showEnding() {
  const ending = getEnding(state);
  if (!ending) return;
  $('#ending').hidden = false;
  $('#ending').innerHTML = `<div class="ending-content"><p class="ending-kicker">THE LAST POST · 余信</p><h2 id="ending-title">${escape(ending.title)}</h2><p class="ending-subtitle">${escape(ending.subtitle)}</p><p class="ending-story">${escape(ending.text)}</p><div class="reflections">${ending.reflections.map(text => `<p>${escape(text)}</p>`).join('')}</div><div class="ending-actions"><button id="revisit-button" class="primary-button"><span>回到最后一夜</span>${icon('rotate-cw')}</button><button id="export-button" class="text-button" aria-label="导出投递手记">${icon('download')} 留下这封信</button></div><p class="ending-footnote">原创故事与程序化美术 · AI 辅助制作<br>谨以此夜，献给所有迟到的告别。</p></div>`;
  $('#revisit-button').addEventListener('click', () => { state.ending = null; $('#ending').hidden = true; save(); update(); toast('灯还亮着，最后的决定仍在等你。'); });
  $('#export-button').addEventListener('click', () => {
    const content = `余信 · ${ending.subtitle}\n${ending.title}\n\n${ending.text}\n\n${ending.reflections.join('\n')}\n\n原创叙事游戏《余信 / The Last Post》· AI 辅助制作`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '余信-投递手记.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  refreshIcons(); pauseWorld();
  requestAnimationFrame(() => $('#revisit-button').focus({ preventScroll: true }));
}

async function startGame(continuing) {
  if (!world) { toast('邮局还在点灯，请稍候。'); return; }
  if (!continuing) state = createState();
  introVisible = false;
  $('#intro').hidden = true;
  update();
  if (continuing && state.ending) showEnding();
  else if (!state.started) displayDialogue(interact(state, 'keeper'));
  else toast('旧邮包还在，旅程接着走。');
}

$('#start-button').addEventListener('click', () => {
  if (saveAvailable) {
    $('#start-button').querySelector('span').textContent = '确认开启新旅程';
    if (!$('#start-button').dataset.confirmed) { $('#start-button').dataset.confirmed = 'true'; return; }
  }
  void startGame(false);
});
$('#continue-button').hidden = !saveAvailable;
$('#continue-button').addEventListener('click', () => void startGame(true));
$('#journal-button').addEventListener('click', showJournal);
$('#pause-button').addEventListener('click', () => showPause());
$('#modal-backdrop').addEventListener('click', closeModal);
$('#interact-button').addEventListener('click', () => near && onInteract(near));
$('#phase-button').addEventListener('click', togglePhase);
function togglePhase() {
  if (introVisible || dialogue || activeModal || state.ending) return;
  setPhase(state, state.phase === 'present' ? 'echo' : 'present');
  save(); update(); audio.chime();
  toast(state.phase === 'echo' ? '那些没有说完的话，还留在回声里。' : '潮水还未抵达。你回到了此刻。');
}
$('#audio-button').addEventListener('click', async () => {
  $('#audio-button').disabled = true;
  try {
    const enabled = await audio.toggle();
    $('#audio-button').innerHTML = icon(enabled ? 'volume-2' : 'volume-x');
    $('#audio-button').setAttribute('aria-label', enabled ? '关闭声音' : '开启声音'); refreshIcons();
  } catch { toast('声音暂时无法开启。'); }
  finally { $('#audio-button').disabled = false; }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    const container = activeModal ? $(`#${activeModal}`) : dialogue ? $('#dialogue') : state.ending ? $('#ending') : introVisible ? $('#intro') : null;
    if (container) {
      const focusable = [...container.querySelectorAll('button:not(:disabled),a[href]')].filter(item => !item.hidden);
      if (focusable.length && (event.shiftKey ? document.activeElement === focusable[0] : document.activeElement === focusable.at(-1))) {
        event.preventDefault(); (event.shiftKey ? focusable.at(-1) : focusable[0]).focus();
      }
    }
  }
  if (event.key === 'Escape') {
    if (activeModal) closeModal();
    else if (dialogue) displayDialogue(null);
    else if (!introVisible && !state.ending) showPause();
  }
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA/.test(event.target.tagName)) return;
  if (event.key.toLowerCase() === 'q') togglePhase();
  if (event.key.toLowerCase() === 'j' && !introVisible && !state.ending) showJournal();
});
document.addEventListener('visibilitychange', pauseWorld);

try {
  world = createWorld($('#world'), {
    onInteract,
    onNear(anchor) {
      const id = typeof anchor === 'string' ? anchor : anchor?.id;
      near = id;
      $('#interact-button').hidden = !id;
      const names = { keeper: '与沈伯交谈', letter: '拾起家书', clock: '查看钟楼', 'seed-note': '翻开种植手记', greenhouse: '查看温室', platform: '打开站台信箱', 'present-stamp': '拾起半枚邮戳', 'echo-stamp': '拾起半枚邮戳', final: '查看邮局的灯' };
      $('#interact-button span').textContent = names[id] || '查看';
    },
    onMove() {},
  });
  update();
} catch (error) {
  console.error(error);
  $('#load-error').hidden = false;
  $('#load-error').textContent = '邮局没能点亮。请使用支持 WebGL 的现代浏览器，并开启硬件加速后重新打开。';
}

// Development-only bridge lets end-to-end tests observe and use the real movement system.
if (import.meta.env.DEV) window.__game = {
  getState: () => structuredClone(state),
  getWorld: () => world?.getDebug(),
  moveTo: id => world?.moveTo(id),
  getDialogue: () => dialogue ? structuredClone(dialogue) : null,
};
refreshIcons(); pauseWorld();
