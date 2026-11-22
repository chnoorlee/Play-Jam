export const SAVE_VERSION = 1;

const MISSIONS = ['clock', 'greenhouse', 'platform'];
const DIAL_TARGET = [3, 1, 2];
const MIRROR_TARGET = [1, 2, 3];
const DECISIONS = {
  clock: ['forgive', 'truth'],
  greenhouse: ['plant', 'share'],
  platform: ['wait', 'farewell'],
};
const ENDINGS = ['release', 'preserve', 'carry'];
const PLATFORM_SEQUENCE = ['north', 'closed', 'south', 'reunion'];
const PLATFORM_FRAGMENTS = {
  north: '北站', closed: '停运', south: '南岸', reunion: '重逢',
};
const CLOSE = { label: '收起', action: 'close' };

export function createState() {
  return {
    version: SAVE_VERSION,
    started: false,
    phase: 'present',
    solved: { clock: false, greenhouse: false, platform: false },
    dials: [0, 0, 0],
    mirrors: [0, 0, 0],
    stamps: { present: false, echo: false },
    platformOrder: [],
    clues: [],
    decisions: {},
    activeMission: null,
    deliveryOrder: [],
    ending: null,
  };
}

export function normalizeSave(raw) {
  const state = createState();
  if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) return state;
  state.started = raw.started === true;
  state.phase = raw.phase === 'echo' ? 'echo' : 'present';
  for (const key of ['dials', 'mirrors']) {
    if (Array.isArray(raw[key]) && raw[key].length === 3) {
      state[key] = raw[key].map(value => Number.isInteger(value) && value >= 0 && value < 4 ? value : 0);
    }
  }
  state.stamps.present = raw.stamps?.present === true;
  state.stamps.echo = raw.stamps?.echo === true;
  if (Array.isArray(raw.platformOrder)) {
    state.platformOrder = raw.platformOrder.filter((value, index, list) => PLATFORM_SEQUENCE.includes(value) && list.indexOf(value) === index).slice(0, 4);
  }
  state.clues = ['clock', 'greenhouse'].filter(id => Array.isArray(raw.clues) && raw.clues.includes(id));
  // Decisions are the commit point for each delivery; incomplete saves remain replayable.
  for (const id of MISSIONS) {
    if (raw.solved?.[id] === true && DECISIONS[id].includes(raw.decisions?.[id])) {
      state.solved[id] = true;
      state.decisions[id] = raw.decisions[id];
      state.started = true;
      if (id !== 'platform' && !state.clues.includes(id)) state.clues.push(id);
      if (id === 'clock') state.dials = [...DIAL_TARGET];
      if (id === 'greenhouse') state.mirrors = [...MIRROR_TARGET];
      if (id === 'platform') {
        state.stamps = { present: true, echo: true };
        state.platformOrder = [...PLATFORM_SEQUENCE];
      }
    }
  }
  if (!state.stamps.present || !state.stamps.echo) state.platformOrder = [];
  if (Array.isArray(raw.deliveryOrder)) {
    state.deliveryOrder = raw.deliveryOrder.filter((id, index, list) => MISSIONS.includes(id) && state.solved[id] && list.indexOf(id) === index);
  }
  for (const id of MISSIONS) if (state.solved[id] && !state.deliveryOrder.includes(id)) state.deliveryOrder.push(id);
  if (MISSIONS.includes(raw.activeMission) && !state.solved[raw.activeMission]) state.activeMission = raw.activeMission;
  if (complete(state) && ENDINGS.includes(raw.ending)) state.ending = raw.ending;
  return state;
}

function complete(state) {
  return MISSIONS.every(id => state.solved[id]);
}

function dialogue(speaker, title, text, choices = [CLOSE], extra = {}) {
  return { speaker, title, text, choices, ...extra };
}

export function getChapter(state) {
  if (state.ending) return '终章 · 余信';
  if (!state.started) return '序章 · 归站';
  const count = MISSIONS.filter(id => state.solved[id]).length;
  return ['第一章 · 未达之信', '第二章 · 潮声渐近', '第三章 · 最后一盏灯', '终章 · 今夜之后'][count];
}

export function getObjective(state) {
  if (state.ending) return '此夜已成为来信。';
  if (!state.started) return '守灯人在邮局门前等你。';
  if (complete(state)) return '三封信已抵达。回到邮局，决定最后一盏灯的去向。';
  const remaining = MISSIONS.filter(id => !state.solved[id]);
  const mission = state.activeMission && !state.solved[state.activeMission] ? state.activeMission : remaining.length === 1 ? remaining[0] : null;
  if (mission === 'clock') {
    if (!state.clues.includes('clock')) return '钟楼脚下，压着一封被潮水打湿的家书。';
    return '此刻的钟楼还留着三个刻度：离港、熄灯、归家。';
  }
  if (mission === 'greenhouse') {
    if (!state.clues.includes('greenhouse')) return '温室旁的种植手记里，夹着第二封信。';
    return '温室的光路只在回声中显现。';
  }
  if (mission === 'platform') {
    if (!state.stamps.present) return '旧站台有半枚邮戳，仍留在此刻。';
    if (!state.stamps.echo) return '另一半邮戳，留在旧站台的回声里。';
    return assembled(state) ? '转寄地址已拼好。打开旧站台的信箱，读完这次告别。' : '两半邮戳齐了。回到旧站台的信箱，重组转寄地址。';
  }
  const names = { clock: '钟楼', greenhouse: '温室', platform: '旧站台' };
  return `${remaining.map(id => names[id]).join('、')}仍有未达之信。选一个地址，走完它的故事。`;
}

function greenhouseRoute(state) {
  const connections = [];
  let open = true;
  for (let i = 0; i < 3; i++) {
    open = open && state.mirrors[i] === MIRROR_TARGET[i];
    connections.push(open);
  }
  const matched = connections.filter(Boolean).length;
  const names = ['晨光镜', '午光镜', '暮光镜'];
  const direction = ['北', '东', '南', '西'];
  const feedback = matched === 3 ? '三段光路已经接通。光抵达种壳，叶脉透出了绿色。' : `${matched === 0 ? '光停在第一面镜子。' : `光已穿过 ${matched} 段。`}${names[matched]}正朝${direction[state.mirrors[matched]]}，下一段还没有亮起。`;
  const nodes = [
    { id: 'source', label: '光源', x: 0, y: 0 },
    { id: 'morning', label: '晨光', x: 1, y: 0 },
    { id: 'noon', label: '午光', x: 3, y: 0 },
    { id: 'evening', label: '暮光', x: 3, y: 2 },
    { id: 'seed', label: '种子', x: 1, y: 2 },
  ];
  return {
    connections, matched, feedback, nodes,
    segments: nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: nodes[index + 1].id, active: index === 0 || connections[index - 1] })),
  };
}

export function getPuzzle(state, id) {
  if (id === 'clock') {
    return {
      id,
      title: '归期的刻度',
      labels: ['离港', '熄灯', '归家'],
      options: ['○', 'I', 'II', 'III'],
      values: [...state.dials],
      target: [...DIAL_TARGET],
      solved: state.solved.clock,
      ready: clockReady(state),
      phase: 'present',
      matched: state.dials.filter((value, index) => value === DIAL_TARGET[index]).length,
      feedback: clockReady(state) ? '三个刻度都已经对齐。钟芯等着最后一次落锤。' : '离港轮会带动熄灯轮；熄灯轮会带动归家轮；归家轮单独转动。每次前进一格，四格归零。',
      clue: state.clues.includes('clock') ? '「三声汽笛离港，一盏灯熄灭，两个人归家。」离港带动熄灯，熄灯带动归家，归家单独转动。' : '刻度旁的凹槽，像在等待一封家书。铜轮相互咬合：离港带动熄灯，熄灯带动归家，归家单独转动。',
    };
  }
  if (id === 'greenhouse') {
    return {
      id,
      title: '留给春天的光',
      labels: ['晨光', '午光', '暮光'],
      options: ['北', '东', '南', '西'],
      values: [...state.mirrors],
      target: [...MIRROR_TARGET],
      solved: state.solved.greenhouse,
      ready: greenhouseReady(state),
      phase: 'echo',
      ...greenhouseRoute(state),
      clue: state.clues.includes('greenhouse') ? '「晨光朝东，午光朝南，暮光朝西。让它们各自回家。」' : '花盆旁的手记，还没有被读过。',
    };
  }
  if (id === 'platform') {
    return {
      id,
      title: '一枚完整的邮戳',
      labels: ['此刻', '回声'],
      values: [Number(state.stamps.present), Number(state.stamps.echo)],
      target: [1, 1],
      solved: state.solved.platform,
      ready: platformReady(state),
      sequence: [...state.platformOrder],
      fragments: { ...PLATFORM_FRAGMENTS },
      clue: '同一个站台，两次告别。邮戳被留在了不同的时间。',
    };
  }
  return null;
}

function clockReady(state) {
  return state.started && state.phase === 'present' && state.clues.includes('clock') && state.dials.every((value, i) => value === DIAL_TARGET[i]);
}

function greenhouseReady(state) {
  return state.started && state.phase === 'echo' && state.clues.includes('greenhouse') && state.mirrors.every((value, i) => value === MIRROR_TARGET[i]);
}

function platformReady(state) {
  return state.started && state.stamps.present && state.stamps.echo && assembled(state);
}

function assembled(state) {
  return state.platformOrder.length === PLATFORM_SEQUENCE.length && state.platformOrder.every((value, index) => value === PLATFORM_SEQUENCE[index]);
}

export function setPhase(state, phase) {
  if ((phase === 'present' || phase === 'echo') && !state.ending) state.phase = phase;
  return state.phase;
}

export function adjustDial(state, index) {
  if (state.started && !state.ending && !state.solved.clock && state.phase === 'present' && Number.isInteger(index) && index >= 0 && index < 3) {
    state.dials[index] = (state.dials[index] + 1) % 4;
    if (index < 2) state.dials[index + 1] = (state.dials[index + 1] + 1) % 4;
    state.activeMission = 'clock';
  }
  return getPuzzle(state, 'clock');
}

export function adjustMirror(state, index) {
  if (state.started && !state.ending && !state.solved.greenhouse && state.phase === 'echo' && Number.isInteger(index) && index >= 0 && index < 3) {
    state.mirrors[index] = (state.mirrors[index] + 1) % 4;
    state.activeMission = 'greenhouse';
  }
  return getPuzzle(state, 'greenhouse');
}

export function interact(state, id) {
  if (state.ending) return endingDialogue(state);
  if (id === 'keeper') {
    if (!state.started) {
      return dialogue('沈伯 · 最后的守灯人', '今夜，邮局不收新信', '许渡，你回来了。撤离的船已经走了，天亮前，潮水会漫过这座邮局。\n\n柜台上还剩三封没有抵达的信。你母亲总说，信没有收件人，也得有人替它走完最后一段路。\n\n带上她的旧邮包吧。灯亮的地方是此刻；灯背后的回声，留着收件人仍在等待的那个瞬间。把信交到他们手里，才会有一条新的路通向南岸。', [{ label: '接过母亲的邮包', action: 'begin' }]);
    }
    return dialogue('沈伯', '灯还亮着', complete(state) ? '信已经有人接住了。现在，该轮到你回答：一个地方消失以后，它的记忆应当留下，还是跟活着的人一起走？' : '钟楼、温室、旧站台，各有一封信。顺序并不重要，肯停下来读完，就已经比潮水慢了一点。\n\n记不清的字，我替你誊在了邮包里的手记上。', [CLOSE]);
  }
  if (!state.started) return dialogue('旧邮包', '还没有开始的投递', '守灯人站在邮局门前。他好像一直在等你。');
  if (id === 'letter') {
    return dialogue('曹衡写给女儿曹遥', '没有寄出的归期', '小遥：\n\n你说钟楼的钟不准，因为我总在它响过以后才回来。那天的演出，我也没赶上。不是你的歌不重要，是北闸卡住了，我不敢松手。\n\n我想好了一句笨话：三声汽笛离港，一盏灯熄灭，两个人归家。等我回去，我们就照这个刻度，把钟拨准。\n\n纸的最后一行被水浸掉了。只剩「对……」。', [{ label: '把家书夹进手记', action: 'read:clock' }]);
  }
  if (id === 'seed-note') {
    return dialogue('林穗的种植手记', '春天的方向', '叶青：\n\n晨光朝东，午光朝南，暮光朝西。让它们各自回家，温室里的最后一颗种子就会醒。\n\n你说撤离的船太小，带不走整座花园。我知道。可这颗种子既不认识街名，也不认识我们的窗台。它只认得春天。\n\n如果我没有回来，请你替我决定，它的第一片叶子要在哪里长出来。', [{ label: '收好种植手记', action: 'read:greenhouse' }]);
  }
  if (id === 'clock') {
    if (state.solved.clock) return receiptDialogue(state, 'clock');
    if (state.phase !== 'present') return dialogue('钟楼', '没有指针的钟', '回声里，钟声已经响过。真正的三个刻度，还在此刻等你。');
    return dialogue('钟楼', '归期的刻度', '离港、熄灯、归家。三个铜环围着一封没能读完的道歉。\n\n离港轮咬住熄灯轮，熄灯轮咬住归家轮。归家轮的轴齿已经磨平，可以独自转动。', [{ label: '让钟重新走动', action: 'resolve:clock' }, CLOSE], { puzzle: 'clock' });
  }
  if (id === 'greenhouse') {
    if (state.solved.greenhouse) return receiptDialogue(state, 'greenhouse');
    if (state.phase !== 'echo') return dialogue('温室', '玻璃之后', '此刻的玻璃已经碎了，花盆里只剩潮湿的土。过去照进温室的三束光，仍留在回声里。');
    return dialogue('温室', '留给春天的光', '三面镜子停在不同的方向。光没有消失，只是还没找到那颗种子。\n\n第一面镜子把光送到第二面，第二面再交给第三面。前一段熄着，后面的镜子便接不到光。', [{ label: '把光送进花盆', action: 'resolve:greenhouse' }, CLOSE], { puzzle: 'greenhouse' });
  }
  if (id === 'present-stamp' || id === 'echo-stamp') {
    const phase = id === 'present-stamp' ? 'present' : 'echo';
    if (state.phase !== phase) return dialogue('旧站台', '另一面的时间', phase === 'present' ? '这半枚邮戳只留在此刻的站牌下。' : '这半枚邮戳只留在回声的长椅上。');
    if (state.stamps[phase]) return dialogue('旧站台', '已经收好的半枚邮戳', phase === 'present' ? '「北站停运」的半圈字，已经夹进了手记。' : '「南岸重逢」的半圈字，已经夹进了手记。');
    return dialogue('旧站台', phase === 'present' ? '北站停运' : '南岸重逢', phase === 'present' ? '站牌下压着半枚铜邮戳，上面写着「北站停运」。有人用力盖过很多次，好像这样就能把消息送得更远。' : '长椅下的半枚邮戳仍然温热。「南岸重逢」，小川每次念这四个字，都会把「重逢」念得很慢。', [{ label: '收好半枚邮戳', action: `stamp:${phase}` }]);
  }
  if (id === 'platform') {
    if (state.solved.platform) return receiptDialogue(state, 'platform');
    if (!state.stamps.present || !state.stamps.echo) return dialogue('旧站台的信箱', '还差半次告别', `封口上的邮戳缺了一半。\n\n此刻的站牌：${state.stamps.present ? '已收好' : '尚未寻到'}\n回声的长椅：${state.stamps.echo ? '已收好' : '尚未寻到'}\n\n邮戳上的转寄规则是：先写旧站，再说明旧站为何不能收信；接着写新址，最后才写相见的约定。`);
    return dialogue('旧站台的信箱', '寄往另一座站台', '两半邮戳严丝合缝，信箱发出很轻的一声响。', [{ label: '打开这封信', action: 'resolve:platform' }, CLOSE]);
  }
  if (id === 'final') {
    if (!complete(state)) return dialogue('邮局的灯', '灯下还有空位', `三封信里，还有 ${MISSIONS.filter(mission => !state.solved[mission]).length} 封没有抵达。沈伯把灯芯拨亮了一点。`);
    return dialogue('沈伯', '最后一封信，写给你', '柜台下面，是母亲留给你的信。\n\n「小渡，不必替所有人保管过去。邮差的责任，是让人有机会说完；说完之后，路归他们自己。」\n\n天开始亮了。灯油只够最后一次决定。', [
      { label: '放流 · 让信随潮水远行', action: 'ending:release' },
      { label: '守灯 · 为这座邮局留下', action: 'ending:preserve' },
      { label: '携信 · 带着旧邮包离开', action: 'ending:carry' },
      { label: '再停留一会儿', action: 'close' },
    ]);
  }
  return dialogue('潮声', '风从水面经过', '没有新的来信。远处的灯仍然亮着。');
}

function clockDecision() {
  return dialogue('曹遥', '水抹去的最后一行', '钟走起来的时候，曹遥从回声里抬起头。\n\n「我已经不记得那天唱的歌了。可我一直记得，台下空着一把椅子。」\n\n她把最后一行留给你看。你可以替曹衡把那句笨拙的道歉补全，也可以让这封信保留它来时的样子。', [
    { label: '补上「对不起」', action: 'decision:clock:truth' },
    { label: '留下那处空白', action: 'decision:clock:forgive' },
  ]);
}

function greenhouseDecision() {
  return dialogue('叶青', '一颗种子的去处', '最后一束光照进花盆，种壳裂开了一条细缝。叶青的手里，一边是那只缺口的蓝花盆，一边是南岸公共苗圃的纸袋。\n\n「我想留住我们的花园。可也许，花园可以是许多人的。」\n\n她问你，这封信该写哪一个新地址。', [
    { label: '写下她新家的窗台', action: 'decision:greenhouse:plant' },
    { label: '写下南岸公共苗圃', action: 'decision:greenhouse:share' },
  ]);
}

function platformDecision() {
  return dialogue('阿岚', '不再等同一班车', '姐：\n\n别在北站等我，最后一班车不会来了。我跟救援队去了南岸，那里正在建新站台。等它有名字，我就写信告诉你。\n\n阿岚读完，才发现自己把旧车票捏出了一个洞。\n\n「原来，他不是让我一直等下去。」她问你，新站台还要留一张等人的纸吗？', [
    { label: '留下名字，也踏上新的路', action: 'decision:platform:wait' },
    { label: '收起车票，给等待画上句点', action: 'decision:platform:farewell' },
  ]);
}

function platformAssembly(state) {
  const order = state.platformOrder;
  const correct = order.every((value, index) => value === PLATFORM_SEQUENCE[index]);
  const full = order.length === PLATFORM_SEQUENCE.length;
  const choices = PLATFORM_SEQUENCE.filter(value => !order.includes(value)).map(value => ({ label: PLATFORM_FRAGMENTS[value], action: `sequence:platform:${value}` }));
  if (order.length) choices.push({ label: '重新摆好四块邮戳', action: 'sequence:platform:reset' });
  choices.push(CLOSE);
  return dialogue('旧站台的转寄台', full ? '地址读反了' : '把两次告别排成一句话', `${order.length ? `已经摆下：${order.map(value => PLATFORM_FRAGMENTS[value]).join(' → ')}\n\n` : '两半邮戳各有两块字：北站、停运；南岸、重逢。\n\n'}${full ? '旧地址和新地址混在了一起。信箱上的小铜片没有落下。把四块字重新摆好，这封信就不会再寄回过去。' : correct ? '转寄单从旧址读起：先是哪一站，然后是它无法收信的原因；再写新址，最后写相见的约定。' : '这一行的次序和转寄规则对不上。旧站应当先说明去向，新的约定才能接在后面。'}`, choices, { assembly: 'platform' });
}

export function choose(state, action) {
  if (action === 'close') return null;
  if (state.ending) return endingDialogue(state);
  if (action === 'begin') {
    state.started = true;
    return dialogue('许渡', '邮包还认得你的肩膀', '旧邮包里有一张母亲画的路线：钟楼、温室、旧站台。三个地址，三句没说完的话。\n\n你提起灯。潮水没有催你。', [{ label: '走进这一个夜晚', action: 'close' }]);
  }
  if (!state.started) return interact(state, 'keeper');
  if (action === 'read:clock' || action === 'read:greenhouse') {
    const id = action.slice(5);
    if (!state.clues.includes(id)) state.clues.push(id);
    state.activeMission = state.solved[id] ? null : id;
    return dialogue('投递手记', id === 'clock' ? '归期已经记下' : '春天的方向已经记下', id === 'clock' ? '离港 III，熄灯 I，归家 II。钟楼的三个铜环，终于有了等待的刻度。铜轮是联动的，要先照顾上游，再调下游。' : '晨光向东，午光向南，暮光向西。回声里的镜子，还记得玻璃完整的样子。光要一段一段接过来。');
  }
  if (action === 'stamp:present' || action === 'stamp:echo') {
    const phase = action.slice(6);
    if (state.phase !== phase) return interact(state, `${phase}-stamp`);
    state.stamps[phase] = true;
    state.activeMission = state.solved.platform ? null : 'platform';
    return dialogue('投递手记', '半枚邮戳已收好', state.stamps.present && state.stamps.echo ? '两半邮戳已经齐了。它们各有两块字。旧站台的信箱还需要一行按转寄规则排好的地址。' : '邮戳的另一半留在这个站台的另一面时间里。');
  }
  if (action === 'resolve:clock') {
    if (state.solved.clock) return interact(state, 'clock');
    if (clockReady(state)) return clockDecision();
    return dialogue('钟楼', '刻度还没有对齐', !state.clues.includes('clock') ? '铜环旁的家书还没有被读过。答案或许就在没有寄出的归期里。' : state.phase !== 'present' ? '真正的钟留在此刻。' : '钟芯轻轻弹回。家书里的顺序是离港、熄灯、归家。', [{ label: '再看看铜环', action: 'inspect:clock' }, CLOSE]);
  }
  if (action === 'resolve:greenhouse') {
    if (state.solved.greenhouse) return interact(state, 'greenhouse');
    if (greenhouseReady(state)) return greenhouseDecision();
    return dialogue('温室', '光还没有抵达', !state.clues.includes('greenhouse') ? '花盆旁的种植手记，也许还留着光的方向。' : state.phase !== 'echo' ? '完整的镜子只存在于回声里。' : '光停在了花盆之外。手记上的晨光、午光、暮光，各有自己的方向。', [{ label: '再看看镜子', action: 'inspect:greenhouse' }, CLOSE]);
  }
  if (action === 'resolve:platform') {
    if (state.solved.platform) return interact(state, 'platform');
    state.activeMission = 'platform';
    if (platformReady(state)) return platformDecision();
    return state.stamps.present && state.stamps.echo ? platformAssembly(state) : interact(state, 'platform');
  }
  if (typeof action === 'string' && action.startsWith('sequence:platform:')) {
    if (!state.stamps.present || !state.stamps.echo || state.solved.platform) return interact(state, 'platform');
    const token = action.slice('sequence:platform:'.length);
    state.activeMission = 'platform';
    if (token === 'reset') state.platformOrder = [];
    else if (PLATFORM_SEQUENCE.includes(token) && !state.platformOrder.includes(token)) state.platformOrder.push(token);
    return assembled(state) ? platformDecision() : platformAssembly(state);
  }
  if (action === 'inspect:clock') return interact(state, 'clock');
  if (action === 'inspect:greenhouse') return interact(state, 'greenhouse');
  if (typeof action === 'string' && action.startsWith('decision:')) {
    const [, id, decision] = action.split(':');
    if (!MISSIONS.includes(id) || !DECISIONS[id].includes(decision) || state.solved[id]) return null;
    const ready = id === 'clock' ? clockReady(state) : id === 'greenhouse' ? greenhouseReady(state) : platformReady(state);
    if (!ready) return interact(state, id);
    state.decisions[id] = decision;
    state.solved[id] = true;
    state.activeMission = null;
    if (!state.deliveryOrder.includes(id)) state.deliveryOrder.push(id);
    return interact(state, id);
  }
  if (typeof action === 'string' && action.startsWith('ending:')) {
    const ending = action.slice(7);
    if (!complete(state) || !ENDINGS.includes(ending)) return interact(state, 'final');
    state.ending = ending;
    return endingDialogue(state);
  }
  return null;
}

export function getHint(state, id, level = 1) {
  if (!MISSIONS.includes(id)) return '';
  if (!state.started) return '沈伯还在邮局门前。先接过那个旧邮包。';
  if (state.solved[id]) return '这封信已经抵达。它留下的回执，还在你的投递手记里。';
  const tier = Number.isFinite(level) ? Math.min(3, Math.max(1, Math.trunc(level))) : 1;
  if (id === 'clock') {
    if (tier === 1) return '家书写的是三个最终刻度，不是三个按钮各自转动的次数。留意相邻的铜轮会不会跟着动。';
    if (tier === 2) return '先调离港轮，再调熄灯轮，最后调归家轮。这样后面的调整不会再改变已经对好的上游刻度。目标来自家书：III、I、II。';
    const turns = [];
    turns[0] = (DIAL_TARGET[0] - state.dials[0] + 4) % 4;
    turns[1] = (DIAL_TARGET[1] - state.dials[1] - turns[0] + 8) % 4;
    turns[2] = (DIAL_TARGET[2] - state.dials[2] - turns[1] + 8) % 4;
    return `${!state.clues.includes('clock') ? '先读完钟楼脚下的家书。' : ''}${state.phase !== 'present' ? '真正的铜轮在此刻。' : ''}从当前刻度开始，依次转动：离港 ${turns[0]} 次，熄灯 ${turns[1]} 次，归家 ${turns[2]} 次。然后让钟重新走动。`;
  }
  if (id === 'greenhouse') {
    if (tier === 1) return '不要先照顾最靠近种子的镜子。找到光第一次熄灭的位置，先把那一段接通。';
    if (tier === 2) return '回声里的光按晨光、午光、暮光的顺序传递。种植手记为它们分别留下了东、南、西三个方向。';
    const route = greenhouseRoute(state);
    if (route.matched === 3) return `${state.phase !== 'echo' ? '完整的光路在回声里。' : ''}三面镜子的方向已经对齐。读过种植手记以后，把光送进花盆。`;
    return `${!state.clues.includes('greenhouse') ? '先收好温室旁的种植手记。' : ''}${state.phase !== 'echo' ? '完整的光路在回声里。' : ''}从当前方向开始，依次转动晨光 ${(MIRROR_TARGET[0] - state.mirrors[0] + 4) % 4} 次、午光 ${(MIRROR_TARGET[1] - state.mirrors[1] + 4) % 4} 次、暮光 ${(MIRROR_TARGET[2] - state.mirrors[2] + 4) % 4} 次。`;
  }
  if (tier === 1) return '同一座站台的两面时间，各留着半枚邮戳。完整的地址应当告诉人先离开哪里，再去哪里。';
  if (tier === 2) return '此刻的站牌留着旧站和停运的消息，回声的长椅留着新地址与约定。先写旧址及原因，再写新址及约定。';
  return `${!state.stamps.present ? '到此刻的站牌下收好半枚邮戳。' : ''}${!state.stamps.echo ? '到回声的长椅边收好另一半。' : ''}${state.platformOrder.length && !state.platformOrder.every((value, index) => value === PLATFORM_SEQUENCE[index]) ? '先重新摆好四块字。' : ''}完整顺序是：北站 → 停运 → 南岸 → 重逢。`;
}

export function getReceipts(state) {
  const records = {
    clock: state.decisions.clock === 'truth' ? {
      title: '空椅子旁的回信', recipient: '曹遥',
      body: '许渡：\n\n我看见你补上的那三个字了。我暂时还说不出「没关系」。可是我终于知道，那天舞台外也有一个人，在拼命守着什么。\n\n到南岸以后，我想重新学那首没唱完的歌。下次的座位，我会留给愿意来听的人。\n\n——曹遥',
      keepsake: '一张写着新曲名的节目单',
    } : {
      title: '留白处的回信', recipient: '曹遥',
      body: '许渡：\n\n谢谢你没有替他把最后一句说完。我把那一行空白留了下来，不再拿它猜一个答案。\n\n等他真的站在我面前，我会问，也会告诉他，那把空椅子让我难过了多久。今夜，我先把自己的歌唱完。\n\n——曹遥',
      keepsake: '一角留着空白的信纸',
    },
    greenhouse: state.decisions.greenhouse === 'share' ? {
      title: '寄往许多扇窗的回信', recipient: '叶青',
      body: '许渡：\n\n苗圃的人说，一颗种子也可以登记。他们给了我第一张标签，我写了林穗的名字，也写了自己的。\n\n我原来以为把花园交出去，就什么也不剩了。现在我想，也许明年有人会来问：这株花最初是谁种的？到那时，我就能从头讲。\n\n——叶青',
      keepsake: '印着两个人名字的苗圃标签',
    } : {
      title: '蓝花盆旁的回信', recipient: '叶青',
      body: '许渡：\n\n新房间的窗台很窄，恰好放得下那只旧花盆。缺口朝着里面，叶子朝着外面。\n\n我还没有力气照顾一整座花园。不过每天早晨，我愿意起来，看看这一片叶子。谢谢你替我留了这样小的一件事。\n\n——叶青',
      keepsake: '蓝花盆缺口处的一片瓷',
    },
    platform: state.decisions.platform === 'wait' ? {
      title: '有了新地址的回信', recipient: '阿岚',
      body: '许渡：\n\n我把名字留在南岸的新站台上，然后去找了住的地方。原来离开长椅，并不等于把一个人忘掉。\n\n等小川回来，他能找到那张纸。等他没回来时，我也能好好过完今天。\n\n——阿岚',
      keepsake: '一张写着南岸新址的站台纸签',
    } : {
      title: '不再询问归期的回信', recipient: '阿岚',
      body: '许渡：\n\n我没有再买一张相同的车票。我写信告诉小川，我到了南岸，也告诉他这里今天刮什么风。\n\n写完才发现，一封信里可以有许多事，不必每一行都在问「你什么时候回来」。旧车票交给你吧。它已经带我走得够远了。\n\n——阿岚',
      keepsake: '一张被手心捏出小洞的旧车票',
    },
  };
  const order = [...state.deliveryOrder, ...MISSIONS.filter(id => !state.deliveryOrder.includes(id))];
  return order.filter(id => state.solved[id]).map(id => ({ id, ...records[id] }));
}

function receiptDialogue(state, id) {
  const receipt = getReceipts(state).find(value => value.id === id);
  return dialogue(`${receipt.recipient} · 投递回执`, receipt.title, `${receipt.body}\n\n邮包里多了：${receipt.keepsake}。`, [CLOSE], { receipt: id });
}

export function getEnding(state) {
  if (!state.ending || !complete(state)) return null;
  const endings = {
    release: {
      title: '潮水替你寄出',
      subtitle: '结局一 · 放流',
      text: '你熄灭灯，把三封投递回执折成纸船。原来的信已经有人接住，这些回声也终于可以远行。它们经过旧站台，经过温室，经过终于走准的钟。\n\n沈伯没有挽留你。他把邮局的钥匙放进水里。邮局失去了最后一位守灯人，南岸却多了一个肯替人送信的人。\n\n很多年后，你不再记得每一个字。你还记得，他们接过信时的手。',
    },
    preserve: {
      title: '灯下仍有回声',
      subtitle: '结局二 · 守灯',
      text: '你拨亮灯芯，把每一张投递回执重新铺平。原来的信各有归处，回信却给了这座邮局新的地址。潮水漫过台阶，没有越过灯照着的那一小块地方。\n\n天亮以后，南岸的人偶尔会在雾里看见一间邮局。有人来问旧地址，有人来讲新生活。你把两种故事写在同一页上。\n\n你留住了邮局，也错过了第一班去新城的船。沈伯把椅子让给你，第一次走出了门。',
    },
    carry: {
      title: '把远方装进邮包',
      subtitle: '结局三 · 携信',
      text: '你没有足够大的邮包带走整座邮局。你收好三位收件人的回信，也收好他们留给你的小东西。每一样都很轻，放在一起，却让肩膀往下沉了一点。\n\n潮水进门时，你踏上了去南岸的小船。邮包里也有你还没学会放下的东西。\n\n新城的第一夜，你借来一张桌子，在门口写下：这里也收旧地址的信。',
    },
  };
  return {
    id: state.ending,
    ...endings[state.ending],
    receipts: getReceipts(state),
    keepsakes: getReceipts(state).map(receipt => receipt.keepsake),
    reflections: [
      state.decisions.clock === 'truth' ? '曹遥带走了一句补全的道歉。她不必原谅，才能继续生活。' : '曹遥带走了最后一行空白。有些话，她决定留给真正写信的人。',
      state.decisions.greenhouse === 'share' ? '南岸公共苗圃的第一张标签上，写着林穗和叶青的名字。' : '叶青新家的窗台上，缺口的蓝花盆长出了第一片叶子。',
      state.decisions.platform === 'wait' ? '阿岚在新站台留下了名字。等待终于有了一个新的地址。' : '阿岚收起旧车票，给弟弟寄出了第一封不询问归期的信。',
    ],
  };
}

function endingDialogue(state) {
  const ending = getEnding(state);
  return dialogue('许渡的投递手记', ending.title, `${ending.text}\n\n${ending.reflections.join('\n')}`, [CLOSE], { ending: true });
}

export function getJournal(state) {
  const entries = [{ title: '今夜的投递', body: getObjective(state) }];
  if (state.started) entries.push({ title: '母亲的旧邮包', body: '三个地址：钟楼、温室、旧站台。信的投递顺序，并不重要。此刻留着事物的形状，回声留着它们没说完的话。' });
  if (state.clues.includes('clock')) entries.push({ title: '家书 · 归期的刻度', body: '三声汽笛离港，一盏灯熄灭，两个人归家。离港 III / 熄灯 I / 归家 II。真正的钟在此刻。铜轮从上游带动相邻下游：离港带熄灯，熄灯带归家，归家单独转动。' });
  if (state.clues.includes('greenhouse')) entries.push({ title: '种植手记 · 春天的方向', body: '晨光朝东，午光朝南，暮光朝西。完整的镜子仍留在回声里。' });
  if (state.stamps.present || state.stamps.echo) entries.push({ title: '站台 · 两半邮戳', body: `此刻：${state.stamps.present ? '北站停运，已收好' : '尚未寻到'}。回声：${state.stamps.echo ? '南岸重逢，已收好' : '尚未寻到'}。转寄规则：旧站 → 不能收信的原因 → 新址 → 相见的约定。` });
  for (const receipt of getReceipts(state)) entries.push({ title: `已投递 · ${receipt.recipient} · ${receipt.title}`, body: `${receipt.body}\n\n纪念物：${receipt.keepsake}` });
  const ending = getEnding(state);
  if (ending) entries.push({ title: ending.subtitle, body: ending.text });
  return entries;
}
