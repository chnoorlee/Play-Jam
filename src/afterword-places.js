import marsh from './art/voyage/marsh.webp';
import saltworks from './art/voyage/saltworks.webp';
import observatory from './art/voyage/observatory.webp';

export const passages = {
  release: ['折成纸船的回执漂到了芦苇滩。渡工从船底抄下白沙邮局的名字，寄来了第一封问路信。', 'A ferryman found a paper boat in the reeds. He copied the post office name from its hull and sent the first letter asking for directions.'],
  preserve: ['山那边看不见邮局的灯。你留在灯下，把路线簿交给换班的邮差，请她替你走一趟南岸。', 'The light cannot be seen beyond the hills. You stay at your post and hand the route book to the relief carrier for her first South Bank round.'],
  carry: ['南岸的桌子刚摆好，门缝里就塞进一张船票。背面写着：邮差，今天能走到山顶吗？', 'A ferry ticket slides under the door of your new office. A note on the back asks whether the mail can reach the hilltop today.'],
};

export const places = {
  marsh: {
    art: marsh, name: ['芦苇渡口', 'Reed Ferry'],
    brief: ['渡工正等一张开航单。查清潮水，把今天能过船的水道写给他。', 'The ferryman is waiting for a sailing slip. Read the tide and mark the channel he can use today.'],
    spots: [['系船棚', 'Mooring shed'], ['潮尺', 'Tide gauge'], ['渡船绞盘', 'Ferry winch']],
    coords: [[22,58],[53,43],[78,66]],
    clues: [
      ['屋梁下钉着渡工的规矩：水涨走内汊，水落走外汊。退潮时，内汊的芦根会钩住船底。', 'A plank above the mooring line reads: take the inner cut on a rising tide and the outer cut on a falling tide. Reed roots catch the keel when the inner cut drains.'],
      ['渡工把清早拓下的粉笔线夹在簿里。你翻开那一页，又看了一眼眼前的水面。两次水痕各碰到了潮尺的哪一格？', 'The ferryman kept a rubbing of the dawn chalk line. You unfold it beside the gauge. Which notch does each waterline meet?'],
    ],
    trace: state => state.decisions.platform === 'wait'
      ? ['棚门钉着阿岚留给小川的新站地址。渡工把被雨泡松的那枚钉子又敲紧了。', 'Lan’s forwarding address for Xiaochuan hangs on the shed door. The ferryman taps its rain-loosened nail back into place.']
      : ['棚门挂着阿岚寄来的风景信。她画了南岸新站的屋檐，日期旁空出了原来总写归期的位置。', 'Lan has sent the shed a sketch of the new station roof. Beside the date is the space where she once asked when Xiaochuan would return.'],
    task: ['绞盘把开航单压在木板上。渡工要知道，今天的第一班船该走哪条水道？', 'The sailing slip is pinned beneath the winch. Which channel should the first ferry take today?'],
    choices: { inner: ['内汊', 'Inner cut'], outer: ['外汊', 'Outer cut'] },
    check: ['签发开航单', 'Sign the slip'],
    wrong: ['渡工指向湿青苔。再比一比清早和现在的水位。', 'The ferryman points to the wet moss. Compare the dawn line with the water now.'],
    prompt: ['船绕过浅滩。多抄出来的一张水道图，该留在哪里？', 'The boat clears the shoal. Where should the spare chart hang?'],
    decisions: { crew: ['交给接班渡工', 'In the crew shed'], passengers: ['挂在候船棚', 'In the passenger shelter'] },
    replies: { crew: ['晚班渡工把图收进油布套。他头一回能在天没亮时独自开船。', 'The evening ferryman slips the chart into an oilskin sleeve. Tomorrow he can cast off before dawn on his own.'], passengers: ['候船的人沿着水道图找到了对岸。一个孩子在外汊边画上今天的船。', 'Waiting passengers trace the way across the chart. A child draws today’s boat beside the outer cut.'] },
  },
  saltworks: {
    art: saltworks, name: ['白堤盐场', 'Whitebank Saltworks'],
    brief: ['一只盐袋要随邮船上山。查过票册和出库木牌，再替盐工配重。', 'One sack must go uphill on the mail boat. Check the ledger and dispatch tally, then weigh its load.'],
    spots: [['晾盐棚', 'Drying shed'], ['出库木牌', 'Dispatch tally'], ['包装秤台', 'Packing scales']],
    coords: [[22,50],[53,45],[77,67]],
    clues: [
      ['湿纸上还能认出今天的总数：十斤。盐工用指节敲了敲封口线，每一斤都得在票册上有去处。', 'Today’s total is still legible on the damp ledger: ten jin. The worker taps the sack seam. Every jin must be accounted for.'],
      ['闸边挂着一块翻面木牌：「早班已领三斤」。三斤已经运走，剩下的才是山上的份。', 'By the gate a tally reads “Three jin collected on the early shift.” Those have gone. The hill station gets the remainder.'],
    ],
    trace: state => state.decisions.greenhouse === 'share'
      ? ['棚檐下一排幼苗从南岸苗圃分来。第一只标签写着林穗和叶青，往后几只由盐工自己写。', 'A row of shoots from the public nursery grows under the eaves. The first tag names Lin Sui and Ye Qing. Salt workers wrote the rest.']
      : ['叶青借给盐工一张窗台的照片。蓝花盆缺口朝里，背面记着她第一回换土的日期。', 'Ye Qing lent the workers a photo of her windowsill. The blue pot’s chipped edge faces inward. On the back she recorded the first time she changed the soil.'],
    task: ['把合适的砝码放上秤，再封山上的那一袋盐。每只砝码只有一个。', 'Place the weights on the scale for the hill station’s sack. There is one of each weight.'],
    choices: { 2: ['二斤', '2 jin'], 3: ['三斤', '3 jin'], 5: ['五斤', '5 jin'] },
    check: ['过秤封袋', 'Weigh and seal'],
    wrong: ['盐工把封线解开。票册上的总数里，还要扣去早班已经领走的盐。', 'The worker unties the sack. Subtract the early shift’s collection from the total in the ledger.'],
    prompt: ['秤杆平了。盐工问，另一联收据是给夜班核账，还是寄给等消息的人？', 'The beam balances. Should the duplicate receipt go to the night crew for their count, or to the households waiting for news?'],
    decisions: { workers: ['夹进夜班账本', 'File with the night shift'], families: ['寄到山脚住户', 'Send to the households'] },
    replies: { workers: ['夜班翻开账本，就知道七斤盐到了山上。头一回交班，他们能早一点收工。', 'The night crew open the ledger and know where all seven jin went. For once the handover ends early.'], families: ['收据在山脚几户人家之间传了一圈。有人在空白处添了句「今晚有热汤」。', 'The receipt passes between the houses at the foot of the hill. Someone adds “Hot soup tonight” in the margin.'] },
  },
  observatory: {
    art: observatory, name: ['青岬气象台', 'Cape Observatory'],
    brief: ['山雾把旗语遮住了。找到灯号表，读出值班员要传回海湾的那串信号。', 'Fog has swallowed the signal flags. Find the lamp key and relay the keeper’s call to the bay.'],
    spots: [['风向旗杆', 'Windsock mast'], ['观测值班室', 'Watch office'], ['信号灯台', 'Signal lantern']],
    coords: [[21,47],[53,41],[77,66]],
    clues: [
      ['旧旗绳旁挂着灯号表。一短闪代表海湾，一长闪代表山脊。雾里两个地点互相报平安，一次只报一个名字。', 'Beside the flag halyard hangs a signal key. One short flash means Bay. One long flash means Ridge. In fog each call names a single place.'],
      ['值班员用粗铅笔写下待发呼号：「海湾、山脊、海湾」。旁边的灯芯已经剪好。', 'In thick pencil the watch keeper has written the call to send: “Bay, Ridge, Bay.” The wick beside it is freshly trimmed.'],
    ],
    trace: state => state.decisions.clock === 'truth'
      ? ['值班室收音机旁压着曹遥的新节目单。她写道：「替我把音量拧大一点，他们在山下也许听得到。」', 'Cao Yao’s new programme is tucked beside the radio. She has written, “Turn it up a little. Perhaps they can hear it at the foot of the hill.”']
      : ['收音机旁留着曹遥的节目单。最后一行空白，值班员一直没往上写曲名。', 'Cao Yao’s programme rests beside the radio. The last line is blank. The watch keeper has left it that way.'],
    task: ['按呼号的顺序把三次闪光写进灯盘，再扳开遮光板。', 'Set three flashes on the lantern drum in the order of the call, then open the shutter.'],
    choices: { short: ['短闪', 'Short flash'], long: ['长闪', 'Long flash'] },
    check: ['发出灯号', 'Send the call'],
    wrong: ['海湾回了一串询问信号。先核对每个地名对应的闪光，再核对值班室记录的次序。', 'The bay flashes a query. Match each place to its flash, then check the order in the watch office.'],
    prompt: ['海湾答复了。天色正暗，值班员请你给最后一盏常明灯选个朝向。', 'The bay answers. As dusk settles, the keeper asks where to aim the steady lamp for the night.'],
    decisions: { window: ['照向山脚窗户', 'Toward the houses'], platform: ['照向归航码头', 'Toward the landing'] },
    replies: { window: ['山脚第一扇窗亮起来，接着是第二扇。山顶灯下的路线簿，终于有了一整页收件人的名字。', 'One window answers, then a second. Beneath the hilltop lamp, a whole page of the route book now bears the names of people who received their mail.'], platform: ['最后一艘渡船沿着灯光靠岸。值班员写下靠岸时刻，在今天的路线簿上落了最后一笔。', 'The last ferry follows the light into the landing. The watch keeper enters the arrival time, the last entry on today’s route.'] },
  },
};
