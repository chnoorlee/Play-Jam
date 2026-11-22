export const ports = ['marsh', 'saltworks', 'observatory'];
const pieces = { marsh: ['inner', 'outer'], saltworks: ['2', '3', '5'], observatory: ['short', 'long'] };
export const recipients = { marsh: ['crew', 'passengers'], saltworks: ['workers', 'families'], observatory: ['window', 'platform'] };

function emptyStop() {
  return { seen: [], draft: [], solved: false, delivered: null };
}

export function createVoyage() {
  return { active: false, port: 'marsh', spot: null, stops: Object.fromEntries(ports.map(id => [id, emptyStop()])) };
}

export function portOpen(voyage, id) {
  const i = ports.indexOf(id);
  return i === 0 || (i > 0 && Boolean(voyage.stops[ports[i - 1]].delivered));
}

function fits(id, draft) {
  if (id === 'marsh') return draft.join() === 'outer';
  if (id === 'saltworks') return draft.reduce((sum, value) => sum + Number(value), 0) === 7;
  return draft.join() === 'short,long,short';
}

export function normalizeVoyage(raw) {
  const result = createVoyage();
  if (!raw || typeof raw !== 'object') return result;
  for (const id of ports) {
    const source = raw.stops?.[id], stop = result.stops[id];
    if (!source || !portOpen(result, id)) break;
    stop.seen = [0, 1].filter(index => Array.isArray(source.seen) && source.seen.includes(index));
    const valid = Array.isArray(source.draft) ? source.draft.filter(value => pieces[id].includes(value)) : [];
    stop.draft = id === 'saltworks' ? [...new Set(valid)] : valid.slice(0, id === 'marsh' ? 1 : 3);
    stop.solved = source.solved === true && stop.seen.length === 2 && fits(id, stop.draft);
    if (stop.solved && recipients[id].includes(source.delivered)) stop.delivered = source.delivered;
  }
  result.port = portOpen(result, raw.port) ? raw.port : 'marsh';
  result.active = raw.active === true;
  result.spot = [0, 1, 2].includes(raw.spot) ? raw.spot : null;
  return result;
}

export function visit(voyage, id) {
  if (!portOpen(voyage, id)) return false;
  voyage.port = id;
  voyage.spot = null;
  return true;
}

export function inspect(voyage, index) {
  if (![0, 1, 2].includes(index)) return;
  voyage.spot = index;
  const stop = voyage.stops[voyage.port];
  if (index < 2 && !stop.seen.includes(index)) stop.seen.push(index);
}

export function changeDraft(voyage, piece) {
  const id = voyage.port, stop = voyage.stops[id];
  if (stop.solved || !pieces[id].includes(piece)) return;
  if (id === 'marsh') stop.draft = [piece];
  else if (id === 'saltworks') {
    stop.draft = stop.draft.includes(piece) ? stop.draft.filter(value => value !== piece) : [...stop.draft, piece];
  } else if (stop.draft.length < 3) stop.draft.push(piece);
}

export function checkDraft(voyage) {
  const id = voyage.port, stop = voyage.stops[id];
  if (stop.seen.length !== 2) return 'missing';
  if (!fits(id, stop.draft)) return 'wrong';
  stop.solved = true;
  return 'ready';
}

export function deliver(voyage, recipient) {
  const id = voyage.port, stop = voyage.stops[id];
  if (stop.solved && !stop.delivered && recipients[id].includes(recipient)) stop.delivered = recipient;
}
