import { BookOpen, Check, Waves, createElement } from 'lucide';
import { tideNotches } from './afterword-state.js';
import './voyage-tide.css';

function control(action, value, text) {
  const node = document.createElement('button');
  node.type = 'button';
  node.dataset.voyageAction = action;
  node.dataset.value = value;
  node.textContent = text;
  return node;
}

function icon(symbol) {
  const node = createElement(symbol);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function createTideGauge(stop, language, period = 'dawn', feedback = '') {
  const en = language === 'en';
  const gauge = document.createElement('div');
  gauge.className = 'tide-gauge';
  const periods = document.createElement('div');
  periods.className = 'tide-periods';
  periods.setAttribute('role', 'group');
  periods.setAttribute('aria-label', en ? 'Waterline observations' : '潮位观察');
  const labels = { dawn: en ? 'Dawn rubbing' : '清早拓印', now: en ? 'Water now' : '此刻水面' };
  for (const key of Object.keys(labels)) {
    const item = control('tide-period', key, labels[key]);
    item.prepend(icon(key === 'dawn' ? BookOpen : Waves));
    item.setAttribute('aria-pressed', String(key === period));
    if (stop.tideReadings.includes(key)) {
      item.append(icon(Check));
      item.setAttribute('aria-label', labels[key] + (en ? ', recorded' : '，已记录'));
    }
    periods.append(item);
  }

  const view = document.createElement('div');
  view.className = 'tide-view';
  view.dataset.period = period;
  const level = tideNotches[period];
  view.style.setProperty('--water-line', ((4 - level + 0.5) * 25) + '%');
  const description = document.createElement('span');
  description.className = 'tide-description';
  description.id = 'tide-level-description';
  description.textContent = period === 'dawn'
    ? (en ? 'On the rubbing the chalk stroke meets the third tick from the foot of the staff.' : '拓印上的粉笔线与从尺脚起第三道刻痕相接。')
    : (en ? 'The edge of the water touches the second tick from the foot of the staff.' : '水沿与从尺脚起第二道刻痕相接。');
  const scale = document.createElement('div');
  scale.className = 'tide-staff';
  scale.setAttribute('role', 'group');
  scale.setAttribute('aria-label', en ? 'Mark the waterline' : '标出水痕');
  scale.setAttribute('aria-describedby', description.id);
  for (let notch = 4; notch >= 1; notch--) {
    const tick = control('tide-notch', String(notch), String(notch));
    tick.setAttribute('aria-label', en ? 'Mark notch ' + notch : '标在第 ' + notch + ' 格');
    if (stop.tideReadings.includes(period) && notch === level) tick.dataset.recorded = 'true';
    scale.append(tick);
  }
  view.append(description, scale);

  const note = document.createElement('p');
  note.className = 'tide-note';
  note.setAttribute('role', 'status');
  if (feedback === 'wrong') {
    note.textContent = en ? 'Follow the waterline to its notch on the staff.' : '沿着水痕看，它碰到的是哪一道刻痕？';
  } else {
    note.textContent = Object.keys(labels).map(key => {
      const value = stop.tideReadings.includes(key) ? tideNotches[key] : '□';
      return labels[key] + '  ' + value;
    }).join('   ·   ');
  }
  gauge.append(periods, view, note);
  return gauge;
}
