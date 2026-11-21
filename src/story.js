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
    clues: [],
    decisions: {},
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
      if (id === 'platform') state.stamps = { present: true, echo: true };
    }
  }
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
  if (!state.solved.clock) {
    if (!state.clues.includes('clock')) return '钟楼脚下，压着一封被潮水打湿的家书。';
    return '此刻的钟楼还留着三个刻度：离港、熄灯、归家。';
  }
  if (!state.solved.greenhouse) {
    if (!state.clues.includes('greenhouse')) return '温室旁的种植手记里，夹着第二封信。';
    return '温室的光路只在回声中显现。';
  }
  if (!state.stamps.present) return '旧站台有半枚邮戳，仍留在此刻。';
  if (!state.stamps.echo) return '另一半邮戳，留在旧站台的回声里。';
  return '两半邮戳齐了，旧站台的信箱终于可以开启。';
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
      clue: state.clues.includes('clock') ? '「三声汽笛离港，一盏灯熄灭，两个人归家。」' : '刻度旁的凹槽，像在等待一封家书。',
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
  return state.started && state.stamps.present && state.stamps.echo;
}

export function setPhase(state, phase) {
  if ((phase === 'present' || phase === 'echo') && !state.ending) state.phase = phase;
  return state.phase;
}

export function adjustDial(state, index) {
  if (state.started && !state.ending && !state.solved.clock && state.phase === 'present' && Number.isInteger(index) && index >= 0 && index < 3) {
    state.dials[index] = (state.dials[index] + 1) % 4;
  }
  return getPuzzle(state, 'clock');
}

export function adjustMirror(state, index) {
  if (state.started && !state.ending && !state.solved.greenhouse && state.phase === 'echo' && Number.isInteger(index) && index >= 0 && index < 3) {
    state.mirrors[index] = (state.mirrors[index] + 1) % 4;
  }
  return getPuzzle(state, 'greenhouse');
}

export function interact(state, id) {
  if (state.ending) return endingDialogue(state);
  if (id === 'keeper') {
    if (!state.started) {
      return dialogue('沈伯 · 最后的守灯人', '今夜，邮局不收新信', '许渡，你回来了。撤离的船已经走了，天亮前，潮水会漫过这座邮局。\n\n柜台上还剩三封没有抵达的信。你母亲总说，信没有收件人，也得有人替它走完最后一段路。\n\n带上她的旧邮包吧。灯亮的地方是此刻；灯背后的回声，还留着人们没说完的话。', [{ label: '接过母亲的邮包', action: 'begin' }]);
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
    if (state.solved.clock) return dialogue('钟楼的回声', '归期已抵达', state.decisions.clock === 'truth' ? '你补全了那句「对不起」。曹遥把信折成很小的一方，放进胸前的口袋。钟终于没有再替任何人解释。' : '你让那行被水抹去的字留白。曹遥轻声数着：三、一、二。她说，剩下的那句，等他自己回来讲。');
    if (state.phase !== 'present') return dialogue('钟楼', '没有指针的钟', '回声里，钟声已经响过。真正的三个刻度，还在此刻等你。');
    return dialogue('钟楼', '归期的刻度', '离港、熄灯、归家。三个铜环围着一封没能读完的道歉。', [{ label: '让钟重新走动', action: 'resolve:clock' }, CLOSE], { puzzle: 'clock' });
  }
  if (id === 'greenhouse') {
    if (state.solved.greenhouse) return dialogue('温室的回声', '种子已经醒来', state.decisions.greenhouse === 'share' ? '叶青把种子装进公共苗圃的纸袋。「那么，就让许多扇窗都看见它。」' : '叶青把种子放进一只缺口的蓝花盆。「先有一扇窗亮起来，也好。」');
    if (state.phase !== 'echo') return dialogue('温室', '玻璃之后', '此刻的玻璃已经碎了，花盆里只剩潮湿的土。过去照进温室的三束光，仍留在回声里。');
    return dialogue('温室', '留给春天的光', '三面镜子停在不同的方向。光没有消失，只是还没找到那颗种子。', [{ label: '把光送进花盆', action: 'resolve:greenhouse' }, CLOSE], { puzzle: 'greenhouse' });
  }
  if (id === 'present-stamp' || id === 'echo-stamp') {
    const phase = id === 'present-stamp' ? 'present' : 'echo';
    if (state.phase !== phase) return dialogue('旧站台', '另一面的时间', phase === 'present' ? '这半枚邮戳只留在此刻的站牌下。' : '这半枚邮戳只留在回声的长椅上。');
    if (state.stamps[phase]) return dialogue('旧站台', '已经收好的半枚邮戳', phase === 'present' ? '「北站停运」的半圈字，已经夹进了手记。' : '「南岸重逢」的半圈字，已经夹进了手记。');
    return dialogue('旧站台', phase === 'present' ? '北站停运' : '南岸重逢', phase === 'present' ? '站牌下压着半枚铜邮戳，上面写着「北站停运」。有人用力盖过很多次，好像这样就能把消息送得更远。' : '长椅下的半枚邮戳仍然温热。「南岸重逢」，小川每次念这四个字，都会把「重逢」念得很慢。', [{ label: '收好半枚邮戳', action: `stamp:${phase}` }]);
  }
  if (id === 'platform') {
    if (state.solved.platform) return dialogue('阿岚的回声', '告别之后', state.decisions.platform === 'wait' ? '阿岚在新站台留下一张写着名字的纸。她会登船，也会给重逢留一处找得到的地址。' : '阿岚把旧车票折回信封。「我会去南岸。今天，不用等同一班车了。」');
    if (!platformReady(state)) return dialogue('旧站台的信箱', '还差半次告别', `封口上的邮戳缺了一半。\n\n此刻的站牌：${state.stamps.present ? '已收好' : '尚未寻到'}\n回声的长椅：${state.stamps.echo ? '已收好' : '尚未寻到'}\n\n两半文字连起来，才是这封信真正的地址。`);
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
    return dialogue('投递手记', id === 'clock' ? '归期已经记下' : '春天的方向已经记下', id === 'clock' ? '离港 III，熄灯 I，归家 II。钟楼的三个铜环，终于有了等待的刻度。' : '晨光向东，午光向南，暮光向西。回声里的镜子，还记得玻璃完整的样子。');
  }
  if (action === 'stamp:present' || action === 'stamp:echo') {
    const phase = action.slice(6);
    if (state.phase !== phase) return interact(state, `${phase}-stamp`);
    state.stamps[phase] = true;
    return dialogue('投递手记', '半枚邮戳已收好', platformReady(state) ? '「北站停运，南岸重逢。」两半邮戳已经齐了。旧站台的信箱，等到了完整的地址。' : '邮戳的另一半留在这个站台的另一面时间里。');
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
    return platformReady(state) ? platformDecision() : interact(state, 'platform');
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

export function getEnding(state) {
  if (!state.ending || !complete(state)) return null;
  const endings = {
    release: {
      title: '潮水替你寄出',
      subtitle: '结局一 · 放流',
      text: '你熄灭灯，把三封信折成纸船。它们经过旧站台，经过温室，经过终于走准的钟。\n\n沈伯没有挽留你。他把邮局的钥匙放进水里。邮局失去了最后一位守灯人，南岸却多了一个肯替人送信的人。\n\n很多年后，你不再记得每一个字。你还记得，他们接过信时的手。',
    },
    preserve: {
      title: '灯下仍有回声',
      subtitle: '结局二 · 守灯',
      text: '你拨亮灯芯，把每一封信重新铺平。潮水漫过台阶，却没有越过灯照着的那一小块地方。\n\n天亮以后，南岸的人偶尔会在雾里看见一间邮局。有人来问旧地址，有人来讲新生活。你把两种故事写在同一页上。\n\n你留住了邮局，也错过了第一班去新城的船。沈伯把椅子让给你，第一次走出了门。',
    },
    carry: {
      title: '把远方装进邮包',
      subtitle: '结局三 · 携信',
      text: '你没有足够大的邮包带走整座邮局。你取下钟的一片刻度、温室的一片种壳、站台的一张旧车票，把它们和信一起装好。\n\n潮水进门时，你踏上了去南岸的小船。邮包很沉，里面也有你还没学会放下的东西。\n\n新城的第一夜，你借来一张桌子，在门口写下：这里也收旧地址的信。',
    },
  };
  return {
    id: state.ending,
    ...endings[state.ending],
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
  if (state.clues.includes('clock')) entries.push({ title: '家书 · 归期的刻度', body: '三声汽笛离港，一盏灯熄灭，两个人归家。离港 III / 熄灯 I / 归家 II。真正的钟在此刻。' });
  if (state.clues.includes('greenhouse')) entries.push({ title: '种植手记 · 春天的方向', body: '晨光朝东，午光朝南，暮光朝西。完整的镜子仍留在回声里。' });
  if (state.stamps.present || state.stamps.echo) entries.push({ title: '站台 · 两半邮戳', body: `此刻：${state.stamps.present ? '北站停运，已收好' : '尚未寻到'}。回声：${state.stamps.echo ? '南岸重逢，已收好' : '尚未寻到'}。两半合在一起，才是信箱的地址。` });
  if (state.solved.clock) entries.push({ title: '已投递 · 曹遥', body: state.decisions.clock === 'truth' ? '你补上了「对不起」。她收好信，没有答应原谅，也没有再把那把空椅子带走。' : '你留下了那处空白。她说，剩下的话，等真正写信的人回来讲。' });
  if (state.solved.greenhouse) entries.push({ title: '已投递 · 叶青', body: state.decisions.greenhouse === 'share' ? '种子寄往南岸公共苗圃。花园可以拥有许多扇窗。' : '种子寄往新家的窗台。一扇窗亮起来，也算春天的开始。' });
  if (state.solved.platform) entries.push({ title: '已投递 · 阿岚', body: state.decisions.platform === 'wait' ? '她留下名字，走向新站台。给重逢留地址，也给自己留路。' : '她收起车票，走向南岸。等待不再是她唯一能做的事。' });
  const ending = getEnding(state);
  if (ending) entries.push({ title: ending.subtitle, body: ending.text });
  return entries;
}
