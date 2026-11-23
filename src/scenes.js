import { ArrowLeft, Clock3, Flower2, Lamp, Mail, MessageCircle, NotebookPen, Search, createElement } from 'lucide';
import { createStationBoard } from './station-board.js';
import shen from './art/cast/shen.webp';
import cao from './art/cast/cao.webp';
import ye from './art/cast/ye.webp';
import lan from './art/cast/lan.webp';
import xu from './art/cast/xu.webp';
import postoffice from './art/scenes/postoffice.webp';
import clock from './art/scenes/clock.webp';
import clockPresent from './art/scenes/clock-present.webp';
import greenhouse from './art/scenes/greenhouse.webp';
import greenhousePresent from './art/scenes/greenhouse-present.webp';
import station from './art/scenes/station.webp';
import './scenes.css';

const scenes = {
  postoffice: {
    name: '白沙邮局',
    backdrop: postoffice,
    cast: shen,
    actions: [
      { id: 'keeper', label: '沈伯', icon: MessageCircle, position: [76, 73] },
      { id: 'final', label: '柜台的灯', icon: Lamp, position: [23, 75], requiresStart: true },
    ],
  },
  clock: {
    name: '钟楼',
    backdrop: clock,
    presentBackdrop: clockPresent,
    cast: cao,
    actions: [
      { id: 'cao', label: '曹遥', icon: MessageCircle, position: [78, 72] },
      { id: 'clock', label: '铜环钟机', icon: Clock3, position: [58, 38] },
      { id: 'letter', label: '曹衡的家书', icon: Mail, position: [37, 77] },
    ],
  },
  greenhouse: {
    name: '玻璃温室',
    backdrop: greenhouse,
    presentBackdrop: greenhousePresent,
    cast: ye,
    actions: [
      { id: 'ye', label: '叶青', icon: MessageCircle, position: [79, 73] },
      { id: 'greenhouse', label: '温室的三面镜', icon: Flower2, position: [54, 49] },
      { id: 'seed-note', label: '种植手记', icon: NotebookPen, position: [23, 80] },
    ],
  },
  station: {
    name: '旧站台',
    backdrop: station,
    cast: lan,
    actions: [
      { id: 'lan', label: '阿岚', icon: MessageCircle, position: [77, 72] },
      { id: 'platform', label: '转寄信箱', icon: Mail, position: [37, 62] },
      { id: 'present-stamp', label: '旧站牌', icon: Search, position: [18, 66], phase: 'present' },
      { id: 'echo-stamp', label: '旧站牌', icon: Search, position: [18, 66], phase: 'echo' },
    ],
  },
};

const roomByAction = new Map(Object.entries(scenes).flatMap(([room, scene]) => scene.actions.map(({ id }) => [id, room])));

export function sceneForAnchor(id) {
  return roomByAction.get(id);
}

function makeIcon(icon) {
  const image = createElement(icon);
  image.setAttribute('aria-hidden', 'true');
  return image;
}

export function createScenes(host, { onAction, onExit }) {
  const image = document.createElement('img');
  image.id = 'scene-backdrop';
  image.className = 'scene-backdrop';
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;
  image.src = postoffice;

  const light = document.createElement('div');
  light.className = 'scene-light';
  light.setAttribute('aria-hidden', 'true');

  const actor = document.createElement('img');
  actor.className = 'scene-cast';
  actor.alt = '';
  actor.decoding = 'async';
  actor.draggable = false;
  actor.src = shen;

  const stationFraming = document.createElement('div');
  stationFraming.className = 'station-framing';
  const stationPainting = document.createElement('div');
  stationPainting.className = 'station-painting';
  stationFraming.append(stationPainting);

  const title = document.createElement('h2');
  title.id = 'scene-title';
  title.className = 'scene-title';
  title.tabIndex = -1;

  const exit = document.createElement('button');
  exit.type = 'button';
  exit.id = 'scene-exit';
  exit.className = 'scene-exit';
  exit.append(makeIcon(ArrowLeft), '返回港湾');
  exit.addEventListener('click', onExit);

  const actionList = document.createElement('div');
  actionList.className = 'scene-actions';
  actionList.setAttribute('role', 'group');
  actionList.setAttribute('aria-label', '场景调查');

  host.setAttribute('aria-labelledby', title.id);
  host.replaceChildren(image, stationFraming, light, actor, title, exit, actionList);

  let current = null;
  let activeState;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function resetParallax() {
    host.style.removeProperty('--scene-x');
    host.style.removeProperty('--scene-y');
  }

  host.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motion.matches || document.body.classList.contains('reduced-motion')) return;
    const { x, y, width, height } = host.getBoundingClientRect();
    host.style.setProperty('--scene-x', `${(event.clientX - x) / width * 2 - 1}`);
    host.style.setProperty('--scene-y', `${(event.clientY - y) / height * 2 - 1}`);
  });
  host.addEventListener('pointerleave', resetParallax);

  function setState(state) {
    if (!current || !state) return;
    const { phase, started } = state;
    if (activeState?.phase === phase && activeState?.started === started) return;
    activeState = { phase, started };
    host.dataset.scenePhase = phase;
    const scene = scenes[current];
    const backdrop = phase === 'present' && scene.presentBackdrop ? scene.presentBackdrop : scene.backdrop;
    if (image.getAttribute('src') !== backdrop) image.src = backdrop;

    if (current === 'station') {
      const board = createStationBoard(phase);
      board.addEventListener('click', () => onAction(phase + '-stamp'));
      const restoreFocus = stationPainting.contains(document.activeElement);
      stationPainting.replaceChildren(board);
      if (restoreFocus) board.focus({ preventScroll: true });
    } else {
      stationPainting.replaceChildren();
    }

    const focused = document.activeElement;
    let currentPhaseAction;
    for (const button of actionList.children) {
      const { phase: actionPhase, requiresStart } = button.dataset;
      button.hidden = Boolean((actionPhase && actionPhase !== phase) || (requiresStart && !started));
      if (actionPhase === phase) currentPhaseAction = button;
    }
    if (actionList.contains(focused) && focused.hidden) {
      (currentPhaseAction || title).focus({ preventScroll: true });
    }
  }

  function setSpeaker(speaker) {
    if (!current) return;
    const name = speaker?.split(' · ')[0];
    const playerSpeaking = current === 'postoffice' && name === '许渡';
    const portrait = playerSpeaking ? xu : scenes[current].cast;
    if (actor.getAttribute('src') !== portrait) actor.src = portrait;
    host.dataset.playerSpeaking = String(playerSpeaking);
    host.dataset.speaking = String(playerSpeaking || name === host.dataset.sceneCast);
  }

  function show(room, state) {
    if (!Object.hasOwn(scenes, room)) return;
    if (room !== current) {
      current = room;
      activeState = undefined;
      const scene = scenes[room];
      host.dataset.sceneId = room;
      host.dataset.sceneCast = scene.actions[0].label;
      title.textContent = scene.name;
      setSpeaker();
      resetParallax();

      actionList.replaceChildren(...scene.actions.map((action, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = index === 0 ? 'scene-action scene-action--cast' : 'scene-action';
        button.dataset.sceneAction = action.id;
        if (action.phase) button.dataset.phase = action.phase;
        if (action.requiresStart) button.dataset.requiresStart = 'true';
        button.style.setProperty('--mark-x', `${action.position[0]}%`);
        button.style.setProperty('--mark-y', `${action.position[1]}%`);
        if (index === 0) button.setAttribute('aria-label', `与${action.label}交谈`);
        const label = document.createElement('span');
        label.textContent = action.label;
        button.append(makeIcon(action.icon), label);
        button.addEventListener('click', () => onAction(action.id));
        return button;
      }));
    }
    setState(state);
    host.hidden = false;
  }

  function hide() {
    current = null;
    host.hidden = true;
    delete host.dataset.sceneId;
    delete host.dataset.sceneCast;
    delete host.dataset.scenePhase;
    delete host.dataset.speaking;
    delete host.dataset.playerSpeaking;
  }

  function focus(id) {
    const action = Array.from(actionList.children).find(button => button.dataset.sceneAction === id && !button.hidden);
    (action || title).focus({ preventScroll: true });
  }

  return { show, setState, setSpeaker, hide, focus, get current() { return current; } };
}
