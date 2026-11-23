import './station-board.css';

function lettering(className, text) {
  const line = document.createElement('span');
  line.className = className;
  line.textContent = text;
  return line;
}

export function createStationBoard(phase, closeup = false) {
  const present = phase === 'present';
  const board = document.createElement(closeup ? 'div' : 'button');
  board.className = 'station-board ' + (closeup ? 'station-board--closeup' : 'station-board--mounted');
  board.dataset.phase = phase;
  if (!closeup) {
    board.type = 'button';
    board.setAttribute('aria-label', '查看旧站牌');
  }
  const face = document.createElement('span');
  face.className = 'station-board-face';
  face.append(lettering('station-board-office', present ? '北站邮务处' : '北站行车时刻'));
  if (present) {
    face.append(lettering('station-board-name', '停运通告'),
      lettering('station-board-notice', '本站永久停止收寄。未投邮件请办理转寄。'));
  } else {
    const row = document.createElement('span');
    row.className = 'station-board-departure';
    row.append(lettering('station-board-time', '17:40'), lettering('station-board-name', '南岸'));
    const note = document.createElement('span');
    note.className = 'station-board-note';
    note.append(lettering('station-board-hand', '姐，南岸月台见。'), lettering('station-board-author', '小川'));
    face.append(row, note);
  }
  board.append(face);
  return board;
}
