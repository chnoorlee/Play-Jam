import { createElement, ArrowLeft, ArrowRight, Check, Flag, LockKeyhole, MapPin, Download, Languages, Undo2 } from 'lucide';
import { passages, places } from './afterword-places.js';
import { ports, portOpen, visit, inspect, recordTide, changeDraft, checkDraft, deliver } from './afterword-state.js';
import { createTideGauge } from './voyage-tide.js';
import { createVoyageEffect } from './voyage-effects.js';
import './afterword.css';

function el(tag, cls, text) {
  const result = document.createElement(tag);
  if (cls) result.className = cls;
  if (text) result.textContent = text;
  return result;
}

function button(action, value, label, glyph, className = '') {
  const node = el('button', className);
  node.type = 'button';
  node.dataset.voyageAction = action;
  if (value !== null) node.dataset.value = value;
  if (glyph) {
    const icon = createElement(glyph);
    icon.setAttribute('aria-hidden', 'true');
    node.append(icon);
  }
  node.append(el('span', '', label));
  return node;
}

export function createAfterword(host, { getState, language, switchLanguage, save, exit, backup, chime }) {
  let message = '', lastPort = '', previousSpot = null;
  let tidePeriod = 'dawn', tideFeedback = '';
  const tr = pair => pair[language() === 'en' ? 1 : 0];

  function render(focus, animate = false) {
    const state = getState(), voyage = state.voyage, id = voyage.port, place = places[id], stop = voyage.stops[id];
    if (!voyage.active) { host.hidden = true; return; }
    const samePort = lastPort === id;
    const sameSpot = samePort && previousSpot === voyage.spot;
    const offset = sameSpot ? host.querySelector('.voyage-pan')?.scrollLeft : 0;
    const reading = sameSpot ? host.querySelector('.voyage-paper')?.scrollTop : 0;
    host.hidden = false;
    host.dataset.port = id;
    const showingResult = voyage.spot === 2 && stop.solved && (id === 'marsh' || id === 'observatory');
    host.dataset.view = voyage.spot === null ? 'overview' : showingResult ? 'outcome' : 'detail';
    host.lang = language();
    lastPort = id;
    previousSpot = voyage.spot;
    const header = el('header', 'voyage-head');
    const title = el('div', 'voyage-identity');
    title.append(el('small', '', tr(['南岸邮路', 'South Bank mail route'])), el('h2', '', tr(place.name)));
    title.lastChild.id = 'voyage-title';
    title.lastChild.tabIndex = -1;
    const tools = el('div', 'voyage-tools');
    tools.append(button('back', null, tr(['返回结局', 'Return to ending']), ArrowLeft));
    for (const [action, label, glyph] of [['language', language() === 'en' ? '中文' : 'English', Languages], ['backup', tr(['备份投递记录', 'Back up journey']), Download]]) {
      const node = button(action, null, label, glyph, action === 'backup' ? 'voyage-icon' : '');
      node.title = label;
      tools.append(node);
    }
    header.append(title, tools);
    const route = el('nav', 'voyage-route');
    route.setAttribute('aria-label', tr(['南岸航线', 'South Bank destinations']));
    for (const key of ports) {
      const open = portOpen(voyage, key), finished = Boolean(voyage.stops[key].delivered);
      const node = button('port', key, tr(places[key].name), !open ? LockKeyhole : finished ? Check : Flag);
      node.disabled = !open;
      if (key === id) node.setAttribute('aria-current', 'location');
      route.append(node);
    }
    const pan = el('div', 'voyage-pan');
    const map = el('div', 'voyage-landscape');
    const plate = el('div', 'voyage-plate');
    const illustration = el('img');
    illustration.src = place.art; illustration.alt = ''; illustration.draggable = false; plate.append(illustration);
    plate.append(createVoyageEffect(id, stop, {language: language(), animate}));
    if (!showingResult) place.spots.forEach((name, i) => {
      const node = button('spot', i, tr(name), stop.seen.includes(i) || (i === 2 && stop.delivered) ? Check : MapPin, 'voyage-pin');
      node.style.left = place.coords[i][0] + '%';
      node.style.top = place.coords[i][1] + '%';
      node.setAttribute('aria-pressed', String(voyage.spot === i));
      plate.append(node);
    });
    map.append(plate);
    pan.append(map);
    const paper = el('section', 'voyage-paper');
    paper.setAttribute('aria-labelledby', 'voyage-caption');
    const spot = voyage.spot, heading = el('h3', '', tr(spot !== null ? place.spots[spot] : ['本次投递', 'Today’s delivery']));
    heading.id = 'voyage-caption';
    heading.tabIndex = -1;
    const actions = el('div', 'voyage-choices');
    const add = (tag, cls, pair) => paper.append(el(tag, cls, tr(pair)));
    paper.append(heading);
    if (spot === null) {
      if (id === 'marsh') add('p', '', passages[state.ending]);
      add('p', '', place.brief);
      place.spots.forEach((label, i) => actions.append(button('spot', i, tr(label), MapPin)));
    } else if (spot < 2) {
      add('p', '', place.clues[spot]);
      if (id === 'marsh' && spot === 1) paper.append(createTideGauge(stop, language(), tidePeriod, tideFeedback));
      if (spot === (id === 'observatory' ? 1 : 0)) add('p', 'voyage-trace', place.trace(state));
      actions.append(button('spot', (spot + 1) % 3, tr(place.spots[(spot + 1) % 3]), ArrowRight));
    } else if (stop.delivered) {
      add('p', 'voyage-receipt', place.replies[stop.delivered]);
      const next = ports[ports.indexOf(id) + 1];
      if (next) actions.append(button('port', next, tr(places[next].name), ArrowRight, 'voyage-submit'));
      else {
        add('p', 'voyage-trace', ['今日邮路投递完毕。三站的回执都已收入路线簿。', 'The round is complete. All three receipts are in the route book.']);
        actions.append(button('back', null, tr(['回到结局明信片', 'Return to the ending postcard']), ArrowLeft));
      }
    } else if (stop.solved) {
      add('p', '', place.prompt);
      for (const [key, pair] of Object.entries(place.decisions)) actions.append(button('deliver', key, tr(pair), ArrowRight));
    } else {
      add('p', '', place.task);
      if (id === 'saltworks') {
        const amount = stop.draft.reduce((sum, value) => sum + Number(value), 0);
        add('strong', 'voyage-instrument', ['秤盘上 · ' + amount + ' 斤', 'On the scale · ' + amount + ' jin']);
      } else if (id === 'observatory') {
        const slots = Array.from({length: 3}, (_, i) => stop.draft[i] === 'short' ? '●' : stop.draft[i] === 'long' ? '━' : '□');
        const output = el('strong', 'voyage-instrument', slots.join('   '));
        output.setAttribute('role', 'img');
        output.setAttribute('aria-label', stop.draft.map(piece => tr(place.choices[piece])).join(', ') || tr(['灯盘空着', 'Empty signal drum']));
        paper.append(output);
      }
      for (const [key, pair] of Object.entries(place.choices)) {
        const node = button('piece', key, tr(pair), null);
        if (id !== 'observatory') node.setAttribute('aria-pressed', String(stop.draft.includes(key)));
        if (id === 'observatory' && stop.draft.length >= 3) node.disabled = true;
        actions.append(node);
      }
      if (id === 'observatory') {
        const undo = button('undo', null, tr(['退回一格', 'Undo flash']), Undo2);
        undo.disabled = !stop.draft.length;
        actions.append(undo);
      }
      actions.append(button('check', null, tr(place.check), Check, 'voyage-submit'));
    }
    if (message) {
      const feedback = el('p', 'voyage-feedback', tr(message === 'missing'
        ? (id === 'marsh' && !stop.seen.includes(1)
          ? ['潮尺的记录还不齐。去潮尺旁记下清早和现在的两条水线。', 'The tide record is incomplete. At the gauge, mark the waterline at dawn and now.']
          : ['还缺一处现场记录。读过前两个地点的记录，再回来核对。', 'The route book is missing field notes. Read both of the other sites, then check again.']) : place.wrong));
      feedback.setAttribute('role', 'status');
      paper.append(feedback);
    }
    if (spot !== null) actions.append(button('overview', null, tr(['看全图', 'Map overview']), MapPin, 'voyage-plain'));
    paper.append(actions);
    host.replaceChildren(header, route, pan, paper);
    pan.scrollLeft = !sameSpot && spot !== null
      ? map.offsetWidth * place.coords[spot][0] / 100 - pan.clientWidth / 2
      : offset || 0;
    paper.scrollTop = reading || 0;
    const target = focus && host.querySelector(focus);
    if (target) target.focus({preventScroll: true});
  }

  host.addEventListener('click', event => {
    const node = event.target.closest('[data-voyage-action]');
    if (!node || node.disabled) return;
    const {voyageAction: action, value} = node.dataset;
    const voyage = getState().voyage, stop = voyage.stops[voyage.port];
    let focus = '#voyage-caption';
    let animate = false;
    message = '';
    tideFeedback = '';
    switch (action) {
      case 'back': exit(); return;
      case 'backup': backup(); return;
      case 'language': switchLanguage(); render('[data-voyage-action="language"]'); return;
      case 'port': visit(voyage, value); focus = '#voyage-title'; break;
      case 'spot':
        inspect(voyage, Number(value));
        if (voyage.port === 'marsh' && voyage.spot === 1) tidePeriod = stop.tideReadings?.includes('dawn') ? 'now' : 'dawn';
        break;
      case 'overview': voyage.spot = null; break;
      case 'tide-period':
        tidePeriod = value;
        focus = '[data-voyage-action="tide-period"][data-value="' + value + '"]';
        break;
      case 'tide-notch':
        tideFeedback = recordTide(voyage, tidePeriod, Number(value));
        focus = '[data-voyage-action="tide-notch"][data-value="' + value + '"]';
        break;
      case 'piece':
        changeDraft(voyage, value);
        focus = voyage.port === 'observatory' && stop.draft.length === 3 ? '[data-voyage-action="check"]' : '[data-voyage-action="piece"][data-value="' + value + '"]';
        break;
      case 'undo': stop.draft.pop(); focus = '[data-voyage-action="piece"]'; break;
      case 'check': {
        const result = checkDraft(voyage);
        if (result !== 'ready') { message = result; focus = '[data-voyage-action="check"]'; }
        else animate = voyage.port === 'marsh' || voyage.port === 'observatory';
        break;
      }
      case 'deliver':
        deliver(voyage, value);
        animate = voyage.port === 'observatory' && stop.delivered === value;
        break;
      default: return;
    }
    save(); chime(); render(focus, animate);
  });
  return {
    show() {
      message = ''; tideFeedback = '';
      tidePeriod = getState().voyage.stops.marsh.tideReadings?.includes('dawn') ? 'now' : 'dawn';
      render('#voyage-title');
    },
    hide() { message = ''; lastPort = ''; host.hidden = true; host.replaceChildren(); },
    escape() {
      const voyage = getState().voyage;
      if (voyage.spot === null) exit();
      else { voyage.spot = null; message = ''; save(); render('#voyage-caption'); }
    },
  };
}
