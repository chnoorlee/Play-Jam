import ferry from './art/voyage/ferry.webp';
import './voyage-effects.css';

// Coordinates match the 1200 by 675 drawing space in paint-voyage.py.
function svgNode(name, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function boat(className, withWake) {
  const group = svgNode('g', { class: className });
  if (withWake) {
    group.append(svgNode('path', {
      d: 'M92 -4 q37 6 82 -4 l-17 5 -33 5 -30 -1 -20 -2z M105 9 l51 -3 -18 4 -29 2z M153 1 l63 -5 -23 4 -36 4z',
      fill: '#ece2bc', opacity: '.82',
      transform: className === 'voyage-last-ferry' ? 'scale(-1 1)' : 'scale(1)',
    }));
  }
  group.append(svgNode('image', { href: ferry, x: -142, y: -173, width: 285, height: 180 }));
  return group;
}

function showCall(scene) {
  const flash = svgNode('g', { class: 'voyage-signal-flash' });
  flash.append(
    svgNode('path', { d: 'M896 324l14 -14 17 -7 22 7 11 17 -2 21 -15 16 -23 5 -20 -12 -7 -15z', fill: '#ffde93', opacity: '.32' }),
    svgNode('path', { d: 'M910 321l12 -4v38l-12 -3z M930 316l15 5v28l-15 6z', fill: '#fff2be' }),
  );
  const stamp = svgNode('g', { fill: '#ffecad', stroke: '#514f49', 'stroke-width': 1 });
  stamp.append(
    svgNode('circle', { cx: 913, cy: 388, r: 3 }),
    svgNode('path', { d: 'M919 385h14v5h-14z' }),
    svgNode('circle', { cx: 940, cy: 387, r: 3 }),
  );
  scene.append(flash, stamp);
}

function lamp(scene, towardHouses) {
  const defs = svgNode('defs', {});
  const wash = svgNode('linearGradient', {
    id: 'voyage-lamp-wash', x1: towardHouses ? '100%' : '0%', x2: towardHouses ? '0%' : '100%', y1: '0%', y2: '0%',
  });
  for (const [offset, opacity] of [[0, .78], [.7, .38], [1, 0]]) {
    wash.append(svgNode('stop', { offset, 'stop-color': '#ffe3a1', 'stop-opacity': opacity }));
  }
  defs.append(wash);
  const beam = svgNode('g', { class: 'voyage-lamp-beam' });
  const tip = towardHouses ? '755 291 755 334' : '1121 325 1125 353';
  beam.append(svgNode('polygon', { points: '927 330 ' + tip + ' 927 339', fill: 'url(#voyage-lamp-wash)' }));
  beam.append(svgNode('path', {
    d: towardHouses ? 'M927 333 L773 307 775 318 927 337Z' : 'M927 333 L1104 336 1105 345 927 337Z',
    fill: 'url(#voyage-lamp-wash)', opacity: '.7',
  }));
  scene.append(defs, beam);
  if (towardHouses) {
    for (const [index, [x, y]] of [[780,320], [807,315], [834,321]].entries()) {
      const light = svgNode('g', { class: 'voyage-window-light' });
      light.style.setProperty('--lamp-delay', (350 + index * 440) + 'ms');
      light.append(
        svgNode('path', { d: 'M-11 -1 -5 -6 3 -8 10 -4 11 3 5 7 -4 6Z', fill: '#ffc56b', opacity: '.38' }),
        svgNode('path', { d: 'M-3 -3 2 -3 3 2 -3 2Z', fill: '#fff1ac' }),
      );
      light.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      scene.append(light);
    }
  } else {
    const inbound = boat('voyage-last-ferry', true);
    scene.append(inbound, svgNode('path', {
      d: 'M1089 338l5 -1 1 5 -5 1z M1104 336l3 -1v4l-3 1z', fill: '#ffdf8c',
    }));
  }
}

const descriptions = {
  moored: ['渡船停在右岸的木码头旁。', 'The ferry is moored beside the wooden landing on the right.'],
  sailing: ['渡船驶入外汊，船尾在芦苇间留下了一道白浪。', 'The ferry sails into the outer channel, leaving a pale wake between the reeds.'],
  signal: ['灯号已发送：短闪、长闪、短闪。', 'Signal sent: short flash, long flash, short flash.'],
  window: ['灯束朝向山脚的住户，三扇窗相继亮起。', 'The beam reaches the hillside houses and three windows light up.'],
  platform: ['灯束照亮小码头，最后一艘渡船沿灯光靠岸。', 'The beam lights the landing. The last ferry follows it to the pier.'],
};

export function createVoyageEffect(id, stop, { language, animate = false }) {
  let state;
  if (id === 'marsh') state = stop.solved ? 'sailing' : 'moored';
  if (id === 'observatory') state = stop.delivered || (stop.solved && 'signal');
  if (!Object.hasOwn(descriptions, state)) return document.createDocumentFragment();

  const scene = svgNode('svg', {
    class: 'voyage-effect', viewBox: '0 0 1200 675', role: 'img', focusable: 'false',
    'aria-label': descriptions[state][language === 'en' ? 1 : 0], 'data-voyage-effect': state,
  });
  if (animate && state !== 'moored') scene.setAttribute('data-animate', '');
  if (id === 'marsh') scene.append(boat('voyage-ferry', stop.solved));
  else if (state === 'signal') showCall(scene);
  else lamp(scene, state === 'window');
  return scene;
}
