import { createIcons, Mail, BookOpen, Volume2, VolumeX, Pause, Play, Eclipse, ArrowLeftRight, ArrowUpRight, ArrowRight, MessageCircle, X, RotateCw, Check, Flower2, Clock3, TrainFront, Feather, Download, Settings2, ZoomIn, ZoomOut, Scan, Lightbulb, Upload, ChevronRight, ArrowDown } from 'lucide';
import { createWorld } from './world.js';
import { createState, normalizeSave, getChapter, getObjective, getJournal, getHint, getReceipts, interact, choose, setPhase, adjustDial, adjustMirror, getPuzzle, getEnding } from './story.js';
import { createAudio } from './audio.js';
import { defaultSettings, normalizeSettings, encodeBackup, decodeBackup } from './settings.js';
import harborCover from './art/harbor-cover.webp';
import shenPortrait from './art/portraits/shen.webp';
import caoPortrait from './art/portraits/cao.webp';
import yePortrait from './art/portraits/ye.webp';
import lanPortrait from './art/portraits/lan.webp';
import './style.css';
import './art/portraits.css';

const $ = selector => document.querySelector(selector);
const icons = { Mail, BookOpen, Volume2, VolumeX, Pause, Play, Eclipse, ArrowLeftRight, ArrowUpRight, ArrowRight, MessageCircle, X, RotateCw, Check, Flower2, Clock3, TrainFront, Feather, Download, Settings2, ZoomIn, ZoomOut, Scan, Lightbulb, Upload, ChevronRight, ArrowDown };
const icon = name => `<i data-lucide="${name}"></i>`;
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true' } });
const SAVE_KEY = 'the-last-post.save.v1';
const SETTINGS_KEY = 'the-last-post.settings.v1';
const portraits = new Map([['沈伯', shenPortrait], ['曹遥', caoPortrait], ['叶青', yePortrait], ['阿岚', lanPortrait]]);
const missions = { clock: { title: '归期', place: '钟楼', glyph: 'clock-3' }, greenhouse: { title: '春天', place: '温室', glyph: 'flower-2' }, platform: { title: '重逢', place: '旧站台', glyph: 'train-front' } };
let state = createState(), dialogue = null, near = null, activeModal = null, introVisible = true, world;
let saveAvailable = false, storageWarning = false, toastTimer, lastFocus;
let zoom = 1, journalTab = 'clues', importRevision = 0;
const hintLevels = { clock: 1, greenhouse: 1, platform: 1 };
const defaults = defaultSettings({ narrow: innerWidth < 600 || navigator.hardwareConcurrency <= 4, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
let settings = defaults;
const audio = createAudio();
try {
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  state = normalizeSave(raw);
  saveAvailable = state.started;
} catch { storageWarning = true; }
try { settings = normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)), defaults); } catch { /* Defaults remain usable when browser storage is unavailable. */ }

function applySettings() {
  world?.setQuality(settings.quality);
  world?.setReducedMotion(settings.reducedMotion);
  audio.setVolume(settings.volume);
  document.body.classList.toggle('large-text', settings.largeText);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
}

function storeSettings() {
  applySettings();
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { toast('浏览器未能保存设置，本次调整仍然有效。'); }
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  const portrait = portraits.get(value.speaker.split(' · ')[0]);
  const portraitImage = portrait ? `<img class="speaker-portrait" src="${escape(portrait)}" width="48" height="48" alt="" decoding="async">` : '';
  $('#dialogue').innerHTML = `<div class="dialogue-header"><div class="speaker-identity">${portraitImage}<span class="speaker">${value.receipt ? icon('mail') : ''}${escape(value.speaker)}</span></div><button class="dialogue-close" aria-label="收起对话">${icon('x')}</button></div><h2>${escape(value.title)}</h2><p class="dialogue-text">${escape(value.text)}</p><div id="puzzle-slot"></div><div class="dialogue-choices">${value.choices.map(choice => `<button class="choice-button" data-action="${escape(choice.action)}"><span>${escape(choice.label)}</span>${icon('arrow-right')}</button>`).join('')}</div>`;
  $('.dialogue-close').addEventListener('click', () => displayDialogue(null));
  $('#dialogue').querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => act(button.dataset.action)));
  if (value.puzzle) renderPuzzle(value.puzzle);
  if (value.assembly) renderAssembly();
  if (value.receipt) {
    const receipt = getReceipts(state).find(item => item.id === value.receipt);
    $('#puzzle-slot').innerHTML = `<div class="keepsake">${icon(missions[value.receipt].glyph)}<div><small>邮包里的纪念物</small><strong>${escape(receipt.keepsake)}</strong></div><span class="receipt-seal">已送达</span></div>`;
  }
  refreshIcons();
  pauseWorld();
  requestAnimationFrame(() => $('#dialogue .dial-button, #dialogue .choice-button')?.focus({ preventScroll: true }));
}

function renderPuzzle(id) {
  const puzzle = getPuzzle(state, id);
  const route = id === 'greenhouse' ? `<div class="light-route" role="img" aria-label="${escape(puzzle.feedback)}"><svg viewBox="0 0 360 110" aria-hidden="true">${puzzle.segments.map(segment => {
    const from = puzzle.nodes.find(node => node.id === segment.from), to = puzzle.nodes.find(node => node.id === segment.to);
    return `<path class="${segment.active ? 'lit' : ''}" d="M${30 + from.x * 100},${20 + from.y * 35} L${30 + to.x * 100},${20 + to.y * 35}"/>`;
  }).join('')}${puzzle.nodes.map((node, i) => `<circle cx="${30 + node.x * 100}" cy="${20 + node.y * 35}" r="7" class="${i === 0 || i === 1 || puzzle.connections[i - 2] ? 'lit' : ''}"/><text x="${30 + node.x * 100}" y="${39 + node.y * 35}" text-anchor="middle">${escape(node.label)}</text>`).join('')}</svg></div>` : '<div class="clock-coupling" aria-hidden="true"><span>I</span><span>II</span><span>III</span></div>';
  $('#puzzle-slot').innerHTML = `<div class="puzzle-surface ${id === 'greenhouse' ? 'mirror-puzzle' : 'clock-puzzle'}">${route}<div class="puzzle-controls">${puzzle.labels.map((label, i) => `<div class="dial-control"><label for="dial-${i}">${escape(label)}</label><button id="dial-${i}" class="dial-button" data-index="${i}" aria-label="${escape(label)}：${escape(puzzle.options[puzzle.values[i]])}，转动"><span ${id === 'greenhouse' ? `class="compass-arrow" style="--direction:${puzzle.values[i] * 90}deg"` : ''}>${id === 'greenhouse' ? icon('arrow-down') : escape(puzzle.options[puzzle.values[i]])}</span>${id === 'greenhouse' ? `<b>${escape(puzzle.options[puzzle.values[i]])}</b>` : ''}${icon('rotate-cw')}</button></div>`).join('')}</div><p class="puzzle-feedback" role="status">${escape(puzzle.feedback)}</p></div><div class="puzzle-bottom"><p class="puzzle-note">${escape(puzzle.clue)}</p><button class="icon-button hint-button" aria-label="查看${missions[id].place}线索" data-tooltip="线索">${icon('lightbulb')}</button></div>`;
  $('#puzzle-slot .hint-button').addEventListener('click', () => showHints(id));
  $('#puzzle-slot').querySelectorAll('.dial-button').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.index);
    if (id === 'clock') adjustDial(state, index); else adjustMirror(state, index);
    audio.chime(); save(); renderPuzzle(id); refreshIcons();
    $(`#dial-${index}`)?.focus({ preventScroll: true });
  }));
}

function renderAssembly() {
  const puzzle = getPuzzle(state, 'platform');
  $('#puzzle-slot').innerHTML = `<div class="address-slots" aria-label="转寄地址">${Array.from({ length: 4 }, (_, i) => `<span class="${puzzle.sequence[i] ? 'filled' : ''}"><small>${['旧站', '缘由', '新址', '约定'][i]}</small><strong>${escape(puzzle.fragments[puzzle.sequence[i]] || '·')}</strong></span>`).join('')}</div><button class="text-button assembly-hint">${icon('lightbulb')} 转寄台的线索</button>`;
  $('.assembly-hint').addEventListener('click', () => showHints('platform'));
}

function act(action) {
  const before = Object.values(state.solved).filter(Boolean).length;
  const beforeJournal = getJournal(state).length;
  const result = choose(state, action);
  save(); update();
  if (Object.values(state.solved).filter(Boolean).length > before) {
    const id = action.split(':')[1];
    audio.delivery(); world?.celebrate(id);
    toast(`${getReceipts(state).find(receipt => receipt.id === id)?.recipient || '收件人'}的回信，已经放进邮包。`);
  }
  if (getJournal(state).length > beforeJournal) $('#journal-dot').hidden = false;
  displayDialogue(result);
}

function onInteract(id) {
  if (introVisible || activeModal || dialogue || state.ending) return;
  const mission = { letter: 'clock', clock: 'clock', 'seed-note': 'greenhouse', greenhouse: 'greenhouse', platform: 'platform', 'present-stamp': 'platform', 'echo-stamp': 'platform' }[id];
  if (mission && !state.solved[mission]) state.activeMission = mission;
  audio.chime();
  displayDialogue(interact(state, id));
  save(); update();
}

function closeModal() {
  if (!activeModal) return;
  if (activeModal === 'settings') importRevision++;
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

function showJournal(tab = journalTab) {
  journalTab = ['clues', 'deliveries', 'receipts'].includes(tab) ? tab : 'clues';
  const entries = getJournal(state);
  const receipts = getReceipts(state);
  const content = journalTab === 'clues' ? entries.map(entry => `<article class="journal-entry"><h3>${escape(entry.title)}</h3><p>${escape(entry.body)}</p></article>`).join('') : journalTab === 'receipts' ? receipts.length ? receipts.map(receipt => `<article class="journal-entry receipt-entry"><span class="receipt-seal">已送达</span><h3>${escape(receipt.title)}</h3><p>${escape(receipt.body)}</p><div class="keepsake">${icon(missions[receipt.id].glyph)}<strong>${escape(receipt.keepsake)}</strong></div></article>`).join('') : '<p class="empty-state">邮包的这一格还空着。第一封信送到以后，这里就会有回音。</p>' : Object.entries(missions).map(([id, mission]) => `<article class="mission-row ${state.solved[id] ? 'delivered' : ''}">${icon(state.solved[id] ? 'check' : mission.glyph)}<div><h3>${escape(mission.place)} · ${escape(mission.title)}</h3><p>${state.solved[id] ? `已送达 · ${escape(receipts.find(receipt => receipt.id === id).recipient)}` : escape(id === 'platform' ? `邮戳 ${Number(state.stamps.present) + Number(state.stamps.echo)} / 2` : state.clues.includes(id) ? '信件已读，等待抵达' : '还有一封未拆的信')}</p></div>${state.solved[id] ? '' : `<button class="icon-button" data-hint="${id}" aria-label="查看${escape(mission.place)}线索" data-tooltip="线索">${icon('lightbulb')}</button><button class="icon-button" data-track="${id}" aria-label="前往${escape(mission.place)}" data-tooltip="前往">${icon('arrow-up-right')}</button>`}</article>`).join('');
  $('#journal').innerHTML = `<div class="modal-title"><h2 id="journal-title">投递手记</h2><button class="icon-button" data-close aria-label="关闭信笺簿">${icon('x')}</button></div><p class="journal-subtitle">许渡的旧邮包 · 回信 ${receipts.length} / 3 · 纪念物 ${receipts.length} / 3</p><div class="journal-tabs" role="tablist" aria-label="手记分类">${[['clues', '信笺'], ['deliveries', '投递'], ['receipts', '回信']].map(([id, title]) => `<button role="tab" id="tab-${id}" aria-controls="journal-panel" aria-selected="${journalTab === id}" data-tab="${id}">${title}${id === 'receipts' ? `<span>${receipts.length}</span>` : ''}</button>`).join('')}</div><div id="journal-panel" role="tabpanel" aria-labelledby="tab-${journalTab}">${content}</div>`;
  $('#journal [data-close]').addEventListener('click', closeModal);
  $('#journal').querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { showJournal(button.dataset.tab); button = $(`#tab-${journalTab}`); button.focus(); }));
  $('#journal').querySelectorAll('[data-hint]').forEach(button => button.addEventListener('click', () => showHints(button.dataset.hint)));
  $('#journal').querySelectorAll('[data-track]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.track;
    state.activeMission = id; save(); closeModal(); displayDialogue(null); update();
    const target = id === 'clock' && !state.clues.includes(id) ? 'letter' : id === 'greenhouse' && !state.clues.includes(id) ? 'seed-note' : id;
    world?.moveTo(target);
  }));
  $('#journal-dot').hidden = true;
  if (activeModal === 'journal') refreshIcons(); else openModal('journal');
}

function showHints(id = state.activeMission || Object.keys(missions).find(key => !state.solved[key]) || 'clock') {
  const level = hintLevels[id];
  $('#hints').innerHTML = `<div class="modal-title"><h2 id="hints-title">邮包里的便笺</h2><button class="icon-button" data-close aria-label="关闭线索">${icon('x')}</button></div><label class="hint-location" for="hint-location">寄往 <select id="hint-location">${Object.entries(missions).map(([key, mission]) => `<option value="${key}" ${key === id ? 'selected' : ''}>${escape(mission.place)} · ${escape(mission.title)}</option>`).join('')}</select></label><div class="hint-pages">${Array.from({ length: level }, (_, i) => `<article><small>便笺 ${i + 1}</small><p>${escape(getHint(state, id, i + 1))}</p></article>`).join('')}</div>${level < 3 && !state.solved[id] ? `<button class="text-button" id="next-hint">再展开一张 ${icon('chevron-right')}</button>` : '<p class="hint-end">沈伯把能想到的话都写在这里了。</p>'}`;
  $('#hints [data-close]').addEventListener('click', closeModal);
  $('#hint-location').addEventListener('change', event => { showHints(event.target.value); $('#hint-location').focus(); });
  $('#next-hint')?.addEventListener('click', () => {
    hintLevels[id]++; showHints(id);
    const note = $('#hints .hint-pages article:last-child');
    note.tabIndex = -1; note.focus({ preventScroll: true }); note.scrollIntoView({ block: 'nearest' });
  });
  if (activeModal === 'hints') refreshIcons(); else openModal('hints');
}

function showSettings() {
  $('#settings').innerHTML = `<div class="modal-title"><h2 id="settings-title">灯下的片刻</h2><button class="icon-button" data-close aria-label="关闭设置">${icon('x')}</button></div><div class="settings-row"><label for="quality-setting">画面</label><select id="quality-setting"><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>流畅</option><option value="high" ${settings.quality === 'high' ? 'selected' : ''}>精细</option></select></div><div class="settings-row"><label for="volume-setting">音量</label><input id="volume-setting" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"/><output id="volume-value" for="volume-setting">${Math.round(settings.volume * 100)}%</output></div><label class="settings-row" for="motion-setting"><span>减弱动态</span><input id="motion-setting" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}/></label><label class="settings-row" for="text-setting"><span>大号文字</span><input id="text-setting" type="checkbox" ${settings.largeText ? 'checked' : ''}/></label><div class="save-actions"><button id="backup-save" class="text-button">${icon('download')} 备份投递记录</button><button id="restore-save" class="text-button">${icon('upload')} 恢复投递记录</button></div><p class="save-meta">${storageWarning ? '浏览器无法自动保存，请备份记录。' : '投递记录保存在这个浏览器。'} · 第一章 1.1</p><div id="restore-preview"></div>`;
  $('#settings [data-close]').addEventListener('click', closeModal);
  $('#quality-setting').addEventListener('change', event => { settings.quality = event.target.value; storeSettings(); });
  $('#volume-setting').addEventListener('input', event => { settings.volume = Number(event.target.value) / 100; $('#volume-value').textContent = `${event.target.value}%`; storeSettings(); });
  $('#motion-setting').addEventListener('change', event => { settings.reducedMotion = event.target.checked; storeSettings(); });
  $('#text-setting').addEventListener('change', event => { settings.largeText = event.target.checked; storeSettings(); });
  $('#backup-save').disabled = !state.started;
  $('#backup-save').addEventListener('click', () => download(encodeBackup(state), '余信-投递记录.json', 'application/json'));
  $('#restore-save').addEventListener('click', () => { $('#save-file').value = ''; $('#save-file').click(); });
  openModal('settings');
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
  setZoom(1);
  dialogue = null; $('#dialogue').hidden = true; $('#ending').hidden = true;
  save(); update();
  displayDialogue(interact(state, 'keeper'));
}

function showEnding() {
  const ending = getEnding(state);
  if (!ending) return;
  $('#ending').hidden = false;
  $('#ending').innerHTML = `<div class="ending-content"><p class="ending-kicker">THE LAST POST · 余信</p><h2 id="ending-title">${escape(ending.title)}</h2><p class="ending-subtitle">${escape(ending.subtitle)}</p><p class="ending-story">${escape(ending.text)}</p><div class="reflections">${ending.reflections.map(text => `<p>${escape(text)}</p>`).join('')}</div><div class="keepsake-album">${ending.receipts.map(receipt => `<div>${icon(missions[receipt.id].glyph)}<small>${escape(receipt.recipient)}留下</small><strong>${escape(receipt.keepsake)}</strong></div>`).join('')}</div><div class="ending-actions"><button id="revisit-button" class="primary-button"><span>回到最后一夜</span>${icon('rotate-cw')}</button><button id="postcard-button" class="text-button">${icon('download')} 收藏夜航明信片</button><button id="export-button" class="text-button" aria-label="导出投递手记">${icon('feather')} 留下这封信</button></div><p class="ending-footnote">原创故事与程序化美术 · AI 辅助制作<br>谨以此夜，献给所有迟到的告别。</p></div>`;
  $('#revisit-button').addEventListener('click', () => { state.ending = null; $('#ending').hidden = true; save(); update(); toast('灯还亮着，最后的决定仍在等你。'); });
  $('#export-button').addEventListener('click', () => {
    const content = `余信 · ${ending.subtitle}\n${ending.title}\n\n${ending.text}\n\n${ending.reflections.join('\n')}\n\n${ending.receipts.map(receipt => `${receipt.title}\n${receipt.body}\n纪念物：${receipt.keepsake}`).join('\n\n')}\n\n原创叙事游戏《余信 / The Last Post》· AI 辅助制作`;
    download(content, '余信-投递手记.txt', 'text/plain;charset=utf-8');
  });
  $('#postcard-button').addEventListener('click', () => exportPostcard(ending));
  refreshIcons(); pauseWorld();
  requestAnimationFrame(() => $('#revisit-button').focus({ preventScroll: true }));
}

async function exportPostcard(ending) {
  const illustration = new Image();
  illustration.src = harborCover;
  const illustrationReady = await illustration.decode().then(() => true, () => false);
  const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) { toast('当前浏览器无法绘制明信片。'); return; }
  ctx.fillStyle = '#f5e7c8'; ctx.fillRect(0, 0, 1280, 900);
  for (let x = 0; x < 1280; x += 48) {
    ctx.fillStyle = x % 96 === 0 ? '#9a4a3a' : '#2e6159';
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x + 38, 14); ctx.lineTo(x + 14, 14);
    ctx.fill();
  }
  ctx.fillStyle = '#23474a'; ctx.fillRect(48, 60, 550, 647);
  if (illustrationReady) {
    const cropWidth = illustration.naturalHeight * 550 / 647;
    ctx.drawImage(illustration, illustration.naturalWidth - cropWidth, 0, cropWidth, illustration.naturalHeight, 48, 60, 550, 647);
  }
  ctx.strokeStyle = '#aa9571'; ctx.lineWidth = 2; ctx.strokeRect(48, 60, 550, 647);
  ctx.beginPath(); ctx.moveTo(626, 60); ctx.lineTo(626, 808); ctx.stroke();
  ctx.fillStyle = '#23473f'; ctx.font = 'bold 29px "Microsoft YaHei", sans-serif'; ctx.fillText('白沙港 · 夜航', 48, 760);
  ctx.font = '18px Georgia, serif'; ctx.fillText('THE LAST POST', 49, 792);
  ctx.fillStyle = '#914536'; ctx.font = 'bold 22px "Microsoft YaHei", sans-serif'; ctx.fillText(ending.subtitle, 660, 123);
  ctx.fillStyle = '#23473f'; ctx.font = 'bold 56px "Microsoft YaHei", sans-serif'; ctx.fillText(ending.title, 656, 223);
  ctx.font = '20px "Microsoft YaHei", sans-serif';
  let y = 330;
  for (const text of ending.reflections) {
    let line = '';
    for (const char of text) {
      if (ctx.measureText(line + char).width > 546) { ctx.fillText(line, 660, y); line = ''; y += 36; }
      line += char;
    }
    ctx.fillText(line, 660, y);
    y += 66;
  }
  ctx.save();
  ctx.translate(1154, 733); ctx.rotate(-0.14);
  ctx.strokeStyle = '#914536'; ctx.fillStyle = '#914536'; ctx.lineWidth = 2;
  for (const radius of [64, 54]) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); }
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Microsoft YaHei", sans-serif'; ctx.fillText('白沙邮局', 0, -14);
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif'; ctx.fillText('已送达', 0, 18);
  ctx.restore();
  ctx.fillStyle = '#4e6054'; ctx.font = '16px "Microsoft YaHei", sans-serif'; ctx.fillText('原创叙事与美术 · AI 辅助制作', 660, 856);
  canvas.toBlob(blob => {
    if (blob) download(blob, '余信-夜航明信片.png', 'image/png');
    else toast('这张明信片未能导出。');
  }, 'image/png');
}

function setZoom(value) {
  zoom = world?.setZoom(Math.round(value * 10) / 10) ?? 1;
  $('#zoom-in').disabled = zoom >= 1.8;
  $('#zoom-out').disabled = zoom <= 1;
  $('#zoom-reset').disabled = zoom === 1;
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
$('#journal-button').addEventListener('click', () => showJournal());
$('#settings-button').addEventListener('click', showSettings);
$('#zoom-in').addEventListener('click', () => setZoom(zoom + .2));
$('#zoom-out').addEventListener('click', () => setZoom(zoom - .2));
$('#zoom-reset').addEventListener('click', () => setZoom(1));
$('#pause-button').addEventListener('click', () => showPause());
$('#modal-backdrop').addEventListener('click', closeModal);
$('#interact-button').addEventListener('click', () => near && onInteract(near));
$('#phase-button').addEventListener('click', togglePhase);
$('#save-file').addEventListener('change', async event => {
  const revision = ++importRevision;
  const preview = $('#restore-preview');
  if (preview) preview.replaceChildren();
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 200000) throw new Error('这份文件太大，无法放入邮包。');
    const imported = decodeBackup(await file.text());
    if (activeModal !== 'settings' || revision !== importRevision) return;
    $('#restore-preview').innerHTML = `<div class="restore-preview"><strong>${escape(getChapter(imported))} · 已送达 ${getReceipts(imported).length} / 3</strong><p>恢复后将替换这个浏览器里的投递记录。</p><button id="confirm-restore" class="primary-button"><span>恢复这段旅程</span>${icon('upload')}</button></div>`;
    $('#confirm-restore').addEventListener('click', () => {
      if (revision !== importRevision) return;
      closeModal(); displayDialogue(null); $('#ending').hidden = true;
      state = imported; save(); setZoom(1); update();
      if (state.ending) showEnding(); else toast('旧邮包已接好，旅程可以继续了。');
    }); refreshIcons(); $('#confirm-restore').focus();
  } catch (error) {
    if (activeModal === 'settings' && revision === importRevision) toast(error.message || '没有读到完整的投递记录。');
  }
});
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
      const focusable = [...container.querySelectorAll('button:not(:disabled),a[href],select,input:not([type="file"])')].filter(item => !item.hidden && item.getClientRects().length);
      if (focusable.length && (!focusable.includes(document.activeElement) || (event.shiftKey ? document.activeElement === focusable[0] : document.activeElement === focusable.at(-1)))) {
        event.preventDefault(); (event.shiftKey ? focusable.at(-1) : focusable[0]).focus();
      }
    }
  }
  if (event.key === 'Escape') {
    if (activeModal) closeModal();
    else if (dialogue) displayDialogue(null);
    else if (!introVisible && !state.ending) showPause();
  }
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
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
  applySettings(); setZoom(1);
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
