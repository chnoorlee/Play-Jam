// Chinese is the authored source in story.js. Keep saved decisions and game actions language-neutral.
const passages = new Map([
  ["北站", "North Station"],
  ["停运", "Service Suspended"],
  ["南岸", "South Bank"],
  ["重逢", "Meet Again"],
  ["收起", "Close"],
  ["终章 · 余信", "Epilogue · Letters That Remain"],
  ["序章 · 归站", "Prologue · Homecoming"],
  ["第一章 · 未达之信", "Chapter I · Letters in Waiting"],
  ["第二章 · 潮声渐近", "Chapter II · The Tide Draws Near"],
  ["第三章 · 最后一盏灯", "Chapter III · The Last Light"],
  ["终章 · 今夜之后", "Epilogue · After Tonight"],
  ["此夜已成为来信。", "Tonight has become a letter of its own."],
  ["守灯人在邮局门前等你。", "The lampkeeper is waiting outside the post office."],
  ["三封信已抵达。回到邮局，决定最后一盏灯的去向。", "All three letters are delivered. Return to the post office and decide what to do with its last light."],
  ["钟楼脚下，压着一封被潮水打湿的家书。", "A waterlogged letter from home lies at the foot of the Clock Tower."],
  ["此刻的钟楼还留着三个刻度：离港、熄灯、归家。", "In the Present, the Clock Tower still has three dials: Departure, Lights Out and Homecoming."],
  ["温室旁的种植手记里，夹着第二封信。", "A second letter is tucked inside the grower's notebook beside the Glasshouse."],
  ["温室的光路只在回声中显现。", "The path of light through the Glasshouse is visible only in the Echo."],
  ["旧站台有半枚邮戳，仍留在此刻。", "Half a postmark remains at the Old Platform in the Present."],
  ["另一半邮戳，留在旧站台的回声里。", "The other half of the postmark is in the Old Platform's Echo."],
  ["转寄地址已拼好。打开旧站台的信箱，读完这次告别。", "The forwarding address is complete. Open the platform mailbox and read the farewell."],
  ["两半邮戳齐了。回到旧站台的信箱，重组转寄地址。", "You have both halves. Return to the Old Platform mailbox and piece together the forwarding address."],
  ["钟楼", "Clock Tower"],
  ["温室", "Glasshouse"],
  ["旧站台", "Old Platform"],
  ["晨光镜", "Dawn mirror"],
  ["午光镜", "Noon mirror"],
  ["暮光镜", "Dusk mirror"],
  ["北", "north"],
  ["东", "east"],
  ["南", "south"],
  ["西", "west"],
  ["三段光路已经接通。光抵达种壳，叶脉透出了绿色。", "All three mirrors catch the light. It reaches the seed, and green shows in the veins of a leaf."],
  ["光停在第一面镜子。", "The light stops at the first mirror."],
  ["光源", "Source"],
  ["晨光", "Dawn"],
  ["午光", "Noon"],
  ["暮光", "Dusk"],
  ["种子", "Seed"],
  ["归期的刻度", "The Hour of Homecoming"],
  ["离港", "Departure"],
  ["熄灯", "Lights Out"],
  ["归家", "Homecoming"],
  ["三个刻度都已经对齐。钟芯等着最后一次落锤。", "All three dials are aligned. The clock is waiting for its first stroke."],
  ["离港轮会带动熄灯轮；熄灯轮会带动归家轮；归家轮单独转动。每次前进一格，四格归零。", "Departure also turns Lights Out. Lights Out also turns Homecoming. Homecoming turns alone. Each turn advances one mark; after the fourth, the dial returns to zero."],
  ["「三声汽笛离港，一盏灯熄灭，两个人归家。」离港带动熄灯，熄灯带动归家，归家单独转动。", "“Three whistles for departure, one light goes out, two come home.” Departure also turns Lights Out. Lights Out also turns Homecoming. Homecoming turns alone."],
  ["刻度旁的凹槽，像在等待一封家书。铜轮相互咬合：离港带动熄灯，熄灯带动归家，归家单独转动。", "The hollow beside the dials looks just the size of a letter. The brass wheels mesh: Departure also turns Lights Out, and Lights Out also turns Homecoming. Homecoming turns alone."],
  ["留给春天的光", "A Light for Spring"],
  ["「晨光朝东，午光朝南，暮光朝西。让它们各自回家。」", "“Dawn faces east, noon faces south, dusk faces west. Let each find its way home.”"],
  ["花盆旁的手记，还没有被读过。", "You haven't read the notebook beside the flowerpot yet."],
  ["一枚完整的邮戳", "A Postmark Made Whole"],
  ["此刻", "Present"],
  ["回声", "Echo"],
  ["同一个站台，两次告别。邮戳被留在了不同的时间。", "One platform, two goodbyes. Half the postmark is caught in each time."],
  ["沈伯 · 最后的守灯人", "Uncle Shen · The Last Lampkeeper"],
  ["今夜，邮局不收新信", "No New Mail Tonight"],
  ["许渡，你回来了。撤离的船已经走了，天亮前，潮水会漫过这座邮局。\n\n柜台上还剩三封没有抵达的信。你母亲总说，信没有收件人，也得有人替它走完最后一段路。\n\n带上她的旧邮包吧。灯亮的地方是此刻；灯背后的回声，留着收件人仍在等待的那个瞬间。把信交到他们手里，才会有一条新的路通向南岸。", "Xu Du. You came back. The evacuation boat has gone. By morning the tide will be inside this post office.\n\nThree letters on that counter never reached anyone. Your mother used to say, even a letter with no one to receive it deserves someone to carry it the last few steps.\n\nTake her old mailbag. Where the lamp shines, you're in the Present. In the Echo behind its light, each recipient is still waiting. Put the letters in their hands. Then a new road to the South Bank can open."],
  ["接过母亲的邮包", "Take Mother's mailbag"],
  ["沈伯", "Uncle Shen"],
  ["灯还亮着", "The Lamp Is Still Lit"],
  ["信已经有人接住了。现在，该轮到你回答：一个地方消失以后，它的记忆应当留下，还是跟活着的人一起走？", "Every letter has found a pair of hands. Now it's your turn. When a place is gone, should its memories stay where they were, or go with the people who live on?"],
  ["钟楼、温室、旧站台，各有一封信。顺序并不重要，肯停下来读完，就已经比潮水慢了一点。\n\n记不清的字，我替你誊在了邮包里的手记上。", "The Clock Tower, the Glasshouse, the Old Platform. One letter at each. Start wherever you like. Stop long enough to read, and you'll already be going a little slower than the tide.\n\nI've copied the words into the journal in your mailbag, in case any slip your mind."],
  ["旧邮包", "Old Mailbag"],
  ["还没有开始的投递", "Before the First Delivery"],
  ["守灯人站在邮局门前。他好像一直在等你。", "The lampkeeper stands outside the post office. He looks as though he's been waiting for you."],
  ["曹遥", "Cao Yao"],
  ["下一次开场", "The Next Opening Night"],
  ["我把演出的曲谱从钟匣里拿出来了。明天要是有人肯听，我想从第一句开始唱。", "I took the score out of the clock case. Tomorrow, if anyone will listen, I'd like to sing it from the first line."],
  ["还没拨准的钟", "A Clock Still Out of Time"],
  ["我再等一声钟响就开唱。台下那把椅子，我答应过要给他留着。", "One more chime, and I'll start singing. I promised I'd save him that chair in the audience."],
  ["钟摆停了那晚，我把他留的纸压在铜盒下。你帮我把那封信读出来吧，我试过很多次了。", "The night the pendulum stopped, I slipped his letter under the brass case. Will you read it for me? I've tried so many times."],
  ["叶青", "Ye Qing"],
  ["走之前浇一次水", "One Last Watering"],
  ["我给空花盆都浇了水。林穗要是看见，大概会笑我。可我还记得哪一盆昨天忘了浇。", "I watered all the empty pots. Lin Sui would laugh if she saw me. I can still tell you which one I forgot yesterday."],
  ["她记太阳，我记浇水", "She Kept Track of the Sun"],
  ["林穗说镜子转错了也别怕。看光在哪里断掉，再从那一面往下接。", "Lin Sui said turning a mirror the wrong way was nothing to worry about. Just follow the light to where it stops and start again from that mirror."],
  ["这本手记上全是林穗的字。你带它去看看玻璃还没碎的时候，或许还能认出最后一颗种子。", "That's Lin Sui's handwriting all through the notebook. Take it back to when the glass was whole. You might still recognize the last seed."],
  ["阿岚", "A-Lan"],
  ["看一眼南岸", "A Look Across the Water"],
  ["我站在这里太久，忘了栈桥也能通向别的地方。等雨小一点，我想去看看南岸的新站。", "I've stood here so long I forgot this pier goes places. When the rain lets up, I'd like to see the new station on the South Bank."],
  ["有张票还没剪", "One Ticket Still Unpunched"],
  ["小川走前在这张长椅上刻了个记号。你看看椅子下面，还留着他从旧邮局带来的半枚戳。", "Before he left, Xiaochuan carved a mark in this bench. Look underneath. He left half a stamp there, from the old post office."],
  ["到站时间已经划掉了。停运的通知在站牌下，另一半消息还在长椅留着的那个时候。", "They've crossed out the arrival time. The service notice is under the sign. You'll find the rest of the news back when someone still sat on that bench."],
  ["曹衡写给女儿曹遥", "From Cao Heng to his daughter, Cao Yao"],
  ["没有寄出的归期", "A Homecoming Never Posted"],
  ["小遥：\n\n你说钟楼的钟不准，因为我总在它响过以后才回来。那天的演出，我也没赶上。不是你的歌不重要，是北闸卡住了，我不敢松手。\n\n我想好了一句笨话：三声汽笛离港，一盏灯熄灭，两个人归家。等我回去，我们就照这个刻度，把钟拨准。\n\n纸的最后一行被水浸掉了。只剩「对……」。", "My little Yao,\n\nYou said the tower clock ran wrong because I always came home after it rang. I missed your concert that day, too. Your song mattered to me. The north sluice gate had jammed, and I didn't dare let go.\n\nI thought up a silly little rhyme: three whistles for departure, one light goes out, two come home. When I get back, we'll set the clock by it together.\n\nWater has washed away the last line. All you can make out is “I'm s…”"],
  ["把家书夹进手记", "Tuck the letter into your journal"],
  ["林穗的种植手记", "Lin Sui's Grower's Notebook"],
  ["春天的方向", "The Way to Spring"],
  ["叶青：\n\n晨光朝东，午光朝南，暮光朝西。让它们各自回家，温室里的最后一颗种子就会醒。\n\n你说撤离的船太小，带不走整座花园。我知道。可这颗种子既不认识街名，也不认识我们的窗台。它只认得春天。\n\n如果我没有回来，请你替我决定，它的第一片叶子要在哪里长出来。", "Ye Qing,\n\nDawn faces east, noon faces south, dusk faces west. Let each find its way home and the last seed in the glasshouse will wake.\n\nYou said the evacuation boat was too small for a whole garden. I know. But this seed knows neither our street name nor our windowsill. All it knows is spring.\n\nIf I don't come back, will you decide where its first leaf should grow?"],
  ["收好种植手记", "Keep the grower's notebook"],
  ["没有指针的钟", "The Clock Without Hands"],
  ["回声里，钟声已经响过。真正的三个刻度，还在此刻等你。", "In the Echo, the chimes have already sounded. The three dials you can turn are in the Present."],
  ["离港、熄灯、归家。三个铜环围着一封没能读完的道歉。\n\n离港轮咬住熄灯轮，熄灯轮咬住归家轮。归家轮的轴齿已经磨平，可以独自转动。", "Departure, Lights Out, Homecoming. Three brass rings surround an unfinished apology.\n\nThe Departure wheel meshes with Lights Out. Lights Out meshes with Homecoming. The teeth on Homecoming's shaft are worn smooth, so it can turn on its own."],
  ["让钟重新走动", "Start the clock"],
  ["玻璃之后", "On the Other Side of the Glass"],
  ["此刻的玻璃已经碎了，花盆里只剩潮湿的土。过去照进温室的三束光，仍留在回声里。", "In the Present the panes are broken and the pot holds only wet soil. The three beams that once lit the Glasshouse are still there in the Echo."],
  ["三面镜子停在不同的方向。光没有消失，只是还没找到那颗种子。\n\n第一面镜子把光送到第二面，第二面再交给第三面。前一段熄着，后面的镜子便接不到光。", "Three mirrors face different ways. The light is still here. It hasn't found the seed yet.\n\nThe first mirror passes the light to the second, and the second to the third. While one stretch stays dark, no mirror beyond it can catch the beam."],
  ["把光送进花盆", "Send the light to the pot"],
  ["另一面的时间", "The Other Side of Time"],
  ["这半枚邮戳只留在此刻的站牌下。", "This half of the postmark is under the sign, in the Present."],
  ["这半枚邮戳只留在回声的长椅上。", "This half of the postmark is on the bench, in the Echo."],
  ["已经收好的半枚邮戳", "A Half Already Collected"],
  ["「北站停运」的半圈字，已经夹进了手记。", "The half-circle that reads “North Station · Service Suspended” is already in your journal."],
  ["「南岸重逢」的半圈字，已经夹进了手记。", "The half-circle that reads “South Bank · Meet Again” is already in your journal."],
  ["北站停运", "North Station · Service Suspended"],
  ["南岸重逢", "South Bank · Meet Again"],
  ["站牌下压着半枚铜邮戳，上面写着「北站停运」。有人用力盖过很多次，好像这样就能把消息送得更远。", "Half a brass stamp lies wedged under the sign. “North Station · Service Suspended.” Someone pressed it down hard, over and over, as though that might carry the news a little farther."],
  ["长椅下的半枚邮戳仍然温热。「南岸重逢」，小川每次念这四个字，都会把「重逢」念得很慢。", "The half-stamp under the bench still feels warm. “South Bank · Meet Again.” Whenever Xiaochuan read the words aloud, he took his time over “Meet Again.”"],
  ["收好半枚邮戳", "Take the half-stamp"],
  ["旧站台的信箱", "Old Platform Mailbox"],
  ["还差半次告别", "Half a Goodbye Missing"],
  ["已收好", "collected"],
  ["尚未寻到", "still missing"],
  ["寄往另一座站台", "Forward to Another Platform"],
  ["两半邮戳严丝合缝，信箱发出很轻的一声响。", "The two halves fit perfectly. Something clicks softly inside the mailbox."],
  ["打开这封信", "Open the letter"],
  ["邮局的灯", "The Post Office Lamp"],
  ["灯下还有空位", "Room Beneath the Light"],
  ["最后一封信，写给你", "One Last Letter, for You"],
  ["柜台下面，是母亲留给你的信。\n\n「小渡，不必替所有人保管过去。邮差的责任，是让人有机会说完；说完之后，路归他们自己。」\n\n天开始亮了。灯油只够最后一次决定。", "Under the counter is a letter from your mother.\n\n“Little Du, you don't have to keep everyone's past for them. A letter carrier gives people a chance to finish what they meant to say. Once they've said it, the road is theirs.”\n\nDawn is breaking. There's enough oil for one last decision."],
  ["放流 · 让信随潮水远行", "Set the letters afloat"],
  ["守灯 · 为这座邮局留下", "Stay and tend the lamp"],
  ["携信 · 带着旧邮包离开", "Leave with the mailbag"],
  ["再停留一会儿", "Stay a little longer"],
  ["潮声", "The Tide"],
  ["风从水面经过", "Wind Across the Water"],
  ["没有新的来信。远处的灯仍然亮着。", "No new mail. Far out across the water, a light still burns."],
  ["水抹去的最后一行", "The Line the Water Took"],
  ["钟走起来的时候，曹遥从回声里抬起头。\n\n「我已经不记得那天唱的歌了。可我一直记得，台下空着一把椅子。」\n\n她把最后一行留给你看。你可以替曹衡把那句笨拙的道歉补全，也可以让这封信保留它来时的样子。", "As the clock starts up, Cao Yao looks up from the Echo.\n\n“I can't even remember the song I sang that day. But I still remember that empty chair.”\n\nShe holds out the last line. You could finish Cao Heng's awkward apology for him, or leave the letter just as it came."],
  ["补上「对不起」", "Finish the line: “I'm sorry”"],
  ["留下那处空白", "Leave the line blank"],
  ["一颗种子的去处", "A Place for a Seed"],
  ["最后一束光照进花盆，种壳裂开了一条细缝。叶青的手里，一边是那只缺口的蓝花盆，一边是南岸公共苗圃的纸袋。\n\n「我想留住我们的花园。可也许，花园可以是许多人的。」\n\n她问你，这封信该写哪一个新地址。", "The last beam reaches the pot, and a hairline crack opens in the seed. In one hand Ye Qing holds a chipped blue pot; in the other, a paper bag from the public nursery on the South Bank.\n\n“I wanted to keep our garden. But maybe a garden can belong to more people than just us.”\n\nShe asks which new address should go on the letter."],
  ["写下她新家的窗台", "Her new windowsill"],
  ["写下南岸公共苗圃", "The South Bank public nursery"],
  ["不再等同一班车", "Done Waiting for That Train"],
  ["姐：\n\n别在北站等我，最后一班车不会来了。我跟救援队去了南岸，那里正在建新站台。等它有名字，我就写信告诉你。\n\n阿岚读完，才发现自己把旧车票捏出了一个洞。\n\n「原来，他不是让我一直等下去。」她问你，新站台还要留一张等人的纸吗？", "Sis,\n\nDon't wait for me at North Station. The last train isn't coming. I went to the South Bank with the rescue team. They're building a platform here. Once it has a name, I'll write and tell you.\n\nOnly when she finishes reading does A-Lan notice she's worn a hole in the ticket she's been clutching.\n\n“He never meant for me to wait forever.” Should she leave a note for him at the new platform?"],
  ["留下名字，也踏上新的路", "Leave your name, then move on"],
  ["收起车票，给等待画上句点", "Put the ticket away and let the waiting end"],
  ["重新摆好四块邮戳", "Reset the four stamp pieces"],
  ["旧站台的转寄台", "Old Platform Forwarding Desk"],
  ["地址读反了", "The Address Is Out of Order"],
  ["把两次告别排成一句话", "Put Two Goodbyes into Words"],
  ["两半邮戳各有两块字：北站、停运；南岸、重逢。\n\n", "Each half has two pieces: North Station and Service Suspended; South Bank and Meet Again.\n\n"],
  ["旧地址和新地址混在了一起。信箱上的小铜片没有落下。把四块字重新摆好，这封信就不会再寄回过去。", "The old and new addresses are mixed up. The brass tab on the mailbox hasn't dropped. Start the line over so the letter won't be sent back into the past."],
  ["转寄单从旧址读起：先是哪一站，然后是它无法收信的原因；再写新址，最后写相见的约定。", "A forwarding slip starts with the old station and why it can no longer take mail. Next comes the new address, and last, the promise to meet."],
  ["这一行的次序和转寄规则对不上。旧站应当先说明去向，新的约定才能接在后面。", "That order doesn't match the forwarding slip. Say what happened at the old station before adding the new promise."],
  ["许渡", "Xu Du"],
  ["邮包还认得你的肩膀", "The Bag Still Fits Your Shoulder"],
  ["旧邮包里有一张母亲画的路线：钟楼、温室、旧站台。三个地址，三句没说完的话。\n\n你提起灯。潮水没有催你。", "Inside the old mailbag is a route your mother drew: the Clock Tower, the Glasshouse, the Old Platform. Three addresses. Three things left unsaid.\n\nYou lift the lamp. The tide gives you time."],
  ["走进这一个夜晚", "Step into the night"],
  ["投递手记", "Delivery Journal"],
  ["归期已经记下", "The Hour of Homecoming, Noted"],
  ["春天的方向已经记下", "The Way to Spring, Noted"],
  ["离港 III，熄灯 I，归家 II。钟楼的三个铜环，终于有了等待的刻度。铜轮是联动的，要先照顾上游，再调下游。", "Departure III, Lights Out I, Homecoming II. At last you know where the three brass rings should point. They turn together: set the first wheel before tending to those that follow."],
  ["晨光向东，午光向南，暮光向西。回声里的镜子，还记得玻璃完整的样子。光要一段一段接过来。", "Dawn east, noon south, dusk west. In the Echo the mirrors remember a time before the glass broke. Pass the light from one to the next."],
  ["半枚邮戳已收好", "Half a Postmark Collected"],
  ["两半邮戳已经齐了。它们各有两块字。旧站台的信箱还需要一行按转寄规则排好的地址。", "Now you have both halves, each bearing two pieces of the message. Put them in forwarding order at the Old Platform mailbox."],
  ["邮戳的另一半留在这个站台的另一面时间里。", "The other half is here at the same platform, on the other side of time."],
  ["刻度还没有对齐", "The Dials Are Still Out of Line"],
  ["铜环旁的家书还没有被读过。答案或许就在没有寄出的归期里。", "You haven't read the letter by the brass rings yet. It might tell you what hour to set."],
  ["真正的钟留在此刻。", "The clock you can turn is in the Present."],
  ["钟芯轻轻弹回。家书里的顺序是离港、熄灯、归家。", "The mechanism springs gently back. The letter names the dials in order: Departure, Lights Out, Homecoming."],
  ["再看看铜环", "Examine the rings again"],
  ["光还没有抵达", "The Light Hasn't Reached the Seed"],
  ["花盆旁的种植手记，也许还留着光的方向。", "The grower's notebook beside the pot may tell you where the light should go."],
  ["完整的镜子只存在于回声里。", "The mirrors are whole only in the Echo."],
  ["光停在了花盆之外。手记上的晨光、午光、暮光，各有自己的方向。", "The light falls short of the pot. In the notebook, dawn, noon and dusk each face a different way."],
  ["再看看镜子", "Examine the mirrors again"],
  ["沈伯还在邮局门前。先接过那个旧邮包。", "Uncle Shen is still outside the post office. Go and take the old mailbag."],
  ["这封信已经抵达。它留下的回执，还在你的投递手记里。", "The letter has been delivered. You'll find its reply in your journal."],
  ["家书写的是三个最终刻度，不是三个按钮各自转动的次数。留意相邻的铜轮会不会跟着动。", "The letter gives the final dial readings. Watch what happens to the next wheel when you turn one."],
  ["先调离港轮，再调熄灯轮，最后调归家轮。这样后面的调整不会再改变已经对好的上游刻度。目标来自家书：III、I、II。", "Start with Departure, then set Lights Out, then Homecoming. That keeps the dials you've set in place. The letter gives their marks: III, I, II."],
  ["先读完钟楼脚下的家书。", "Read the letter at the foot of the Clock Tower first."],
  ["真正的铜轮在此刻。", "The brass wheels you can turn are in the Present."],
  ["不要先照顾最靠近种子的镜子。找到光第一次熄灭的位置，先把那一段接通。", "Follow the beam to the first dark stretch and fix that mirror first. The mirror nearest the seed can wait."],
  ["回声里的光按晨光、午光、暮光的顺序传递。种植手记为它们分别留下了东、南、西三个方向。", "In the Echo, light passes from dawn to noon to dusk. The notebook gives their directions in that order: east, south, west."],
  ["完整的光路在回声里。", "The whole light path is in the Echo."],
  ["先收好温室旁的种植手记。", "Collect the grower's notebook beside the Glasshouse first."],
  ["同一座站台的两面时间，各留着半枚邮戳。完整的地址应当告诉人先离开哪里，再去哪里。", "Each side of the platform's history holds half a postmark. A forwarding address tells you where the letter must leave before it tells you where to go."],
  ["此刻的站牌留着旧站和停运的消息，回声的长椅留着新地址与约定。先写旧址及原因，再写新址及约定。", "The Present's sign gives the old station and its closure. The Echo's bench gives the new address and the promise. Put the old address and reason first, then the new address and promise."],
  ["到此刻的站牌下收好半枚邮戳。", "Collect the half-stamp under the sign in the Present."],
  ["到回声的长椅边收好另一半。", "Collect the other half by the bench in the Echo."],
  ["先重新摆好四块字。", "Reset the four pieces first."],
  ["空椅子旁的回信", "A Reply Beside an Empty Chair"],
  ["许渡：\n\n我看见你补上的那三个字了。我暂时还说不出「没关系」。可是我终于知道，那天舞台外也有一个人，在拼命守着什么。\n\n到南岸以后，我想重新学那首没唱完的歌。下次的座位，我会留给愿意来听的人。\n\n——曹遥", "Xu Du,\n\nI saw the words you added. I can't quite tell him “It's all right.” But now I know that while I was on stage, someone out there was holding on to something for dear life.\n\nWhen I get to the South Bank, I want to learn that unfinished song again. Next time I'll save the seat for someone who wants to listen.\n\nYours, Cao Yao"],
  ["一张写着新曲名的节目单", "A concert program with a new song title"],
  ["留白处的回信", "A Reply Written in the Margin"],
  ["许渡：\n\n谢谢你没有替他把最后一句说完。我把那一行空白留了下来，不再拿它猜一个答案。\n\n等他真的站在我面前，我会问，也会告诉他，那把空椅子让我难过了多久。今夜，我先把自己的歌唱完。\n\n——曹遥", "Xu Du,\n\nThank you for leaving his last sentence unfinished. I kept that blank line. I've stopped trying to guess what belongs there.\n\nWhen he stands in front of me, I'll ask. And I'll tell him how long that empty chair hurt. Tonight I'll finish singing my own song first.\n\nYours, Cao Yao"],
  ["一角留着空白的信纸", "A corner of writing paper left blank"],
  ["寄往许多扇窗的回信", "A Reply to Many Windows"],
  ["许渡：\n\n苗圃的人说，一颗种子也可以登记。他们给了我第一张标签，我写了林穗的名字，也写了自己的。\n\n我原来以为把花园交出去，就什么也不剩了。现在我想，也许明年有人会来问：这株花最初是谁种的？到那时，我就能从头讲。\n\n——叶青", "Xu Du,\n\nThe nursery says you can register even a single seed. They gave me the first label. I wrote Lin Sui's name on it, and mine.\n\nI thought giving the garden away would leave me with nothing. Now I wonder if next year someone might ask who planted this flower in the first place. Then I can tell it from the beginning.\n\nYours, Ye Qing"],
  ["印着两个人名字的苗圃标签", "A nursery label bearing two names"],
  ["蓝花盆旁的回信", "A Reply Beside the Blue Pot"],
  ["许渡：\n\n新房间的窗台很窄，恰好放得下那只旧花盆。缺口朝着里面，叶子朝着外面。\n\n我还没有力气照顾一整座花园。不过每天早晨，我愿意起来，看看这一片叶子。谢谢你替我留了这样小的一件事。\n\n——叶青", "Xu Du,\n\nThe windowsill in my new room is narrow. There's just enough space for the old pot. The chip faces in, and the leaf faces out.\n\nI haven't the strength for a whole garden yet. But every morning I'm willing to get up and look in on this one leaf. Thank you for leaving me something small enough to do.\n\nYours, Ye Qing"],
  ["蓝花盆缺口处的一片瓷", "A porcelain chip from the blue pot"],
  ["有了新地址的回信", "A Reply with a New Address"],
  ["许渡：\n\n我把名字留在南岸的新站台上，然后去找了住的地方。原来离开长椅，并不等于把一个人忘掉。\n\n等小川回来，他能找到那张纸。等他没回来时，我也能好好过完今天。\n\n——阿岚", "Xu Du,\n\nI left my name at the new platform on the South Bank and went to look for somewhere to live. It turns out I can get up from that bench and still remember someone.\n\nWhen Xiaochuan comes back, he'll find the note. On the days he doesn't, I can get on with living.\n\nYours, A-Lan"],
  ["一张写着南岸新址的站台纸签", "A platform tag with the new South Bank address"],
  ["不再询问归期的回信", "A Reply Without a Question"],
  ["许渡：\n\n我没有再买一张相同的车票。我写信告诉小川，我到了南岸，也告诉他这里今天刮什么风。\n\n写完才发现，一封信里可以有许多事，不必每一行都在问「你什么时候回来」。旧车票交给你吧。它已经带我走得够远了。\n\n——阿岚", "Xu Du,\n\nI didn't buy another ticket like the old one. I wrote to Xiaochuan that I'd reached the South Bank, and told him which way the wind was blowing today.\n\nWhen I'd finished, I saw how much can fit into a letter when every line isn't asking “When are you coming home?” Keep the old ticket. It's carried me far enough.\n\nYours, A-Lan"],
  ["一张被手心捏出小洞的旧车票", "An old ticket with a hole worn through it"],
  ["潮水替你寄出", "Posted by the Tide"],
  ["结局一 · 放流", "Ending I · Afloat"],
  ["你熄灭灯，把三封投递回执折成纸船。原来的信已经有人接住，这些回声也终于可以远行。它们经过旧站台，经过温室，经过终于走准的钟。\n\n沈伯没有挽留你。他把邮局的钥匙放进水里。邮局失去了最后一位守灯人，南岸却多了一个肯替人送信的人。\n\n很多年后，你不再记得每一个字。你还记得，他们接过信时的手。", "You put out the lamp and fold the three delivery receipts into paper boats. The letters have found their people; now their echoes can travel on. They float past the Old Platform, past the Glasshouse, past the clock that finally keeps good time.\n\nUncle Shen lets you go. He lowers the post office key into the water. The post office loses its last lampkeeper. Across the water, the South Bank gains someone willing to carry a letter.\n\nYears later you can't recall every word. You remember their hands as they took the letters."],
  ["灯下仍有回声", "Echoes Beneath the Lamp"],
  ["结局二 · 守灯", "Ending II · The Lampkeeper"],
  ["你拨亮灯芯，把每一张投递回执重新铺平。原来的信各有归处，回信却给了这座邮局新的地址。潮水漫过台阶，没有越过灯照着的那一小块地方。\n\n天亮以后，南岸的人偶尔会在雾里看见一间邮局。有人来问旧地址，有人来讲新生活。你把两种故事写在同一页上。\n\n你留住了邮局，也错过了第一班去新城的船。沈伯把椅子让给你，第一次走出了门。", "You turn up the wick and smooth each receipt flat. The letters all found homes, and the replies have given this post office a new address. The tide rises over the steps and stops just short of the little patch the lamp lights.\n\nAfter dawn, people on the South Bank sometimes glimpse a post office in the fog. Some come asking after old addresses; others bring news of their lives. You write both kinds of story on the same page.\n\nYou keep the post office and miss the first boat to the new city. Uncle Shen offers you his chair and steps outside for the first time."],
  ["把远方装进邮包", "What the Mailbag Holds"],
  ["结局三 · 携信", "Ending III · The Letter Carrier"],
  ["你没有足够大的邮包带走整座邮局。你收好三位收件人的回信，也收好他们留给你的小东西。每一样都很轻，放在一起，却让肩膀往下沉了一点。\n\n潮水进门时，你踏上了去南岸的小船。邮包里也有你还没学会放下的东西。\n\n新城的第一夜，你借来一张桌子，在门口写下：这里也收旧地址的信。", "Your mailbag couldn't possibly hold a whole post office. You pack the three replies and the small things their writers left you. Each weighs next to nothing. Together they're enough to pull your shoulder down a little.\n\nAs the tide crosses the threshold, you board a small boat for the South Bank. There are things in your mailbag you haven't learned to set down yet.\n\nOn your first night in the new city, you borrow a table. By the door you put up a sign: Letters to old addresses accepted here."],
  ["曹遥带走了一句补全的道歉。她不必原谅，才能继续生活。", "Cao Yao takes a finished apology with her. She can get on with her life before she's ready to forgive."],
  ["曹遥带走了最后一行空白。有些话，她决定留给真正写信的人。", "Cao Yao keeps the last line blank. Some words are for the person who wrote the letter to say."],
  ["南岸公共苗圃的第一张标签上，写着林穗和叶青的名字。", "On the first label at the South Bank public nursery are two names: Lin Sui and Ye Qing."],
  ["叶青新家的窗台上，缺口的蓝花盆长出了第一片叶子。", "On the windowsill in Ye Qing's new home, a first leaf grows from the chipped blue pot."],
  ["阿岚在新站台留下了名字。等待终于有了一个新的地址。", "A-Lan leaves her name at the new platform. At last, waiting has a new address."],
  ["阿岚收起旧车票，给弟弟寄出了第一封不询问归期的信。", "A-Lan puts away the old ticket and writes her brother a letter. For the first time, she doesn't ask when he'll be home."],
  ["许渡的投递手记", "Xu Du's Delivery Journal"],
  ["今夜的投递", "Tonight's Deliveries"],
  ["母亲的旧邮包", "Mother's Old Mailbag"],
  ["三个地址：钟楼、温室、旧站台。信的投递顺序，并不重要。此刻留着事物的形状，回声留着它们没说完的话。", "Three addresses: the Clock Tower, the Glasshouse, the Old Platform. Visit them in any order. The Present keeps the shape of things. The Echo keeps what went unsaid."],
  ["家书 · 归期的刻度", "Letter from Home · The Hour of Homecoming"],
  ["三声汽笛离港，一盏灯熄灭，两个人归家。离港 III / 熄灯 I / 归家 II。真正的钟在此刻。铜轮从上游带动相邻下游：离港带熄灯，熄灯带归家，归家单独转动。", "Three whistles for departure, one light goes out, two come home. Departure III / Lights Out I / Homecoming II. The clock you can turn is in the Present. Each wheel also turns the next: Departure turns Lights Out, Lights Out turns Homecoming, and Homecoming turns alone."],
  ["种植手记 · 春天的方向", "Grower's Notebook · The Way to Spring"],
  ["晨光朝东，午光朝南，暮光朝西。完整的镜子仍留在回声里。", "Dawn faces east, noon faces south, dusk faces west. The unbroken mirrors are in the Echo."],
  ["站台 · 两半邮戳", "Platform · Two Halves of a Postmark"],
  ["北站停运，已收好", "North Station · Service Suspended, collected"],
  ["南岸重逢，已收好", "South Bank · Meet Again, collected"],
  ["封口上的邮戳缺了一半。", "Half the postmark is missing from the seal."],
  ["邮戳上的转寄规则是：先写旧站，再说明旧站为何不能收信；接着写新址，最后才写相见的约定。", "The postmark gives the forwarding order: the old station, why it can no longer take mail, the new address, then the promise to meet."],
  ["然后让钟重新走动。", "Then start the clock."],
  ["三面镜子的方向已经对齐。", "All three mirrors are aligned."],
  ["读过种植手记以后，把光送进花盆。", "Once you've read the grower's notebook, send the light to the pot."],
  ["完整顺序是：北站 → 停运 → 南岸 → 重逢。", "The full order is North Station → Service Suspended → South Bank → Meet Again."],
]);

// Dialogues, receipts and endings reuse these paragraphs in several combinations.
for (const [source, english] of [...passages]) {
  const original = source.split('\n\n');
  const translated = english.split('\n\n');
  if (original.length > 1 && original.length === translated.length) {
    original.forEach((paragraph, i) => {
      if (paragraph) passages.set(paragraph, translated[i]);
    });
  }
}

function translateSequence(text, separator, joiner = separator) {
  const parts = text.split(separator);
  if (parts.length === 1) return null;
  const translated = parts.map(translateStory);
  return translated.every((value, i) => value !== parts[i] || !parts[i])
    ? translated.join(joiner) : null;
}

function plural(count, singular, multiple = singular + 's') {
  return count === '1' ? singular : multiple;
}

export function translateStory(text) {
  if (typeof text !== 'string' || !/[\u3400-\u9fff]/u.test(text)) return text;
  if (passages.has(text)) return passages.get(text);

  let match = /^((?:(?:钟楼|温室|旧站台)、?)+)仍有未达之信。选一个地址，走完它的故事。$/u.exec(text);
  if (match) {
    const locations = match[1].split('、').map(translateStory);
    return 'Undelivered mail at ' + locations.join(', ') + '. Choose an address and follow its story.';
  }

  match = /^光已穿过 (\d+) 段。$/u.exec(text);
  if (match) return 'The light has crossed ' + match[1] + ' ' + plural(match[1], 'stretch', 'stretches') + '.';
  match = /^(晨光镜|午光镜|暮光镜)正朝(北|东|南|西)，下一段还没有亮起。$/u.exec(text);
  if (match) return 'The ' + translateStory(match[1]).toLowerCase() + ' faces ' + translateStory(match[2]) + '. The next stretch is still dark.';

  match = /^(此刻的站牌|回声的长椅)：(已收好|尚未寻到)$/u.exec(text);
  if (match) return (match[1] === '此刻的站牌' ? 'Sign in the Present' : 'Bench in the Echo') + ': ' + translateStory(match[2]) + '.';
  match = /^三封信里，还有 (\d+) 封没有抵达。沈伯把灯芯拨亮了一点。$/u.exec(text);
  if (match) return 'Of the three letters, ' + match[1] + ' ' + plural(match[1], 'still needs', 'still need') + ' delivering. Uncle Shen turns up the wick a little.';
  match = /^已经摆下：(.+)$/u.exec(text);
  if (match) {
    const pieces = match[1].split(' → ');
    if (pieces.every(piece => passages.has(piece))) return 'Placed so far: ' + pieces.map(translateStory).join(' → ');
  }
  match = /^从当前刻度开始，依次转动：离港 (\d+) 次，熄灯 (\d+) 次，归家 (\d+) 次。$/u.exec(text);
  if (match) return 'From here, turn the wheels in order: Departure ×' + match[1] + ', Lights Out ×' + match[2] + ', Homecoming ×' + match[3] + '.';
  match = /^从当前方向开始，依次转动晨光 (\d+) 次、午光 (\d+) 次、暮光 (\d+) 次。$/u.exec(text);
  if (match) return 'From here, turn the mirrors in order: Dawn ×' + match[1] + ', Noon ×' + match[2] + ', Dusk ×' + match[3] + '.';

  match = /^(曹遥|叶青|阿岚) · 投递回执$/u.exec(text);
  if (match) return translateStory(match[1]) + ' · Delivery Receipt';
  match = /^已投递 · (曹遥|叶青|阿岚) · (.+)$/u.exec(text);
  if (match && passages.has(match[2])) return 'Delivered · ' + translateStory(match[1]) + ' · ' + translateStory(match[2]);
  match = /^邮包里多了：(.+)。$/u.exec(text);
  if (match && passages.has(match[1])) return 'Added to your mailbag: ' + translateStory(match[1]) + '.';
  match = /^纪念物：(.+)$/u.exec(text);
  if (match && passages.has(match[1])) return 'Keepsake: ' + translateStory(match[1]);
  match = /^此刻：(北站停运，已收好|尚未寻到)。回声：(南岸重逢，已收好|尚未寻到)。转寄规则：旧站 → 不能收信的原因 → 新址 → 相见的约定。$/u.exec(text);
  if (match) return 'Present: ' + translateStory(match[1]) + '. Echo: ' + translateStory(match[2]) + '. Forwarding order: old station → reason for closure → new address → promise to meet.';

  // Dynamic hints concatenate whole sentences. Preserve the original if any part is unknown.
  return translateSequence(text, '\n\n') ?? translateSequence(text, '\n')
    ?? translateSequence(text, /(?<=。)(?=.)/u, ' ') ?? text;
}
