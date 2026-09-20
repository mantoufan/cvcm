#!/usr/bin/env python3
"""Merge batch-2 game locale copy + walkthroughs into existing JSON."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOC = ROOT / "src/locales/games"
WT = LOC / "walkthroughs"


def pack(name, blurb, title, description, lead, cheats_lead, cheats, steps, faqs):
    d = {
        "name": name, "blurb": blurb, "title": title, "description": description,
        "lead": lead, "cheatsLead": cheats_lead,
    }
    for i, c in enumerate(cheats, 1):
        d[f"cheat{i}"] = c
    for i, (t, b) in enumerate(steps, 1):
        d[f"s{i}t"] = t
        d[f"s{i}b"] = b
    for i, (q, a) in enumerate(faqs, 1):
        d[f"q{i}"] = q
        d[f"a{i}"] = a
    return d


def step(sid, title, body, image=None):
    item = {"id": sid, "title": title, "body": body}
    if image:
        item["image"] = image
    return item


def wt(intro, steps):
    return {"intro": intro, "steps": steps}


def tw(s: str) -> str:
    for a, b in [
        ("游戏", "遊戲"), ("通关", "通關"), ("关卡", "關卡"), ("在线", "線上"),
        ("超级马里奥", "超級瑪利歐"), ("洛克人", "洛克人"), ("塞尔达", "薩爾達"),
        ("口袋妖怪", "寶可夢"), ("忍者神龟", "忍者神龜"), ("热血", "熱血"),
        ("炸弹", "炸彈"), ("载入", "載入"), ("菜单", "選單"), ("默认", "預設"),
        ("后", "後"), ("来", "來"), ("对", "對"), ("开", "開"), ("关", "關"),
        ("这", "這"), ("个", "個"), ("们", "們"), ("时", "時"), ("为", "為"),
        ("发", "發"), ("经", "經"), ("现", "現"), ("点", "點"), ("将", "將"),
        ("从", "從"), ("还", "還"), ("过", "過"), ("与", "與"), ("让", "讓"),
        ("说", "說"), ("请", "請"), ("长", "長"), ("门", "門"), ("见", "見"),
        ("里", "裡"), ("并", "並"), ("头", "頭"), ("吗", "嗎"), ("无", "無"),
        ("当", "當"), ("实", "實"), ("击", "擊"), ("战", "戰"), ("图", "圖"),
        ("电", "電"), ("龙", "龍"), ("宝", "寶"), ("剑", "劍"), ("馆", "館"),
        ("练", "練"), ("级", "級"), ("选", "選"), ("单", "單"),
    ]:
        s = s.replace(a, b)
    return s


def tw_obj(o):
    if isinstance(o, dict):
        return {k: tw_obj(v) for k, v in o.items()}
    if isinstance(o, list):
        return [tw_obj(x) for x in o]
    if isinstance(o, str):
        return tw(s) if (s := o) else o
    return o


zh_copy = {}
en_copy = {}
zh_wt = {}
en_wt = {}

zh_copy["snow-bros"] = pack(
    "雪人兄弟", "FC 动作。扔雪球堆怪，金手指、通关攻略、在线玩。",
    "雪人兄弟 金手指｜FC Snow Bros 通关攻略 在线玩 — cv.cm",
    "雪人兄弟完整通关、金手指、NES 模拟器。商业 ROM 自行载入，不上传。",
    "雪人兄弟是 FC 上投雪球堆怪的动作游戏。本页有完整通关和金手指，模拟器在第一屏。",
    "Game Genie 视 ROM 版本而定。载入后在模拟器金手指菜单打开。",
    ["无限命", "无敌", "武器", "跳 Boss"],
    [("载入", "选择 .nes。文件留在当前标签页。"), ("操作", "方向走，B 扔雪球，A 跳。把怪滚成球再踢走。"),
     ("堆怪", "连扔把敌人堆成大球，踢向其他怪。"), ("Boss", "躲弹，把 Boss 堆雪再踢。"), ("通关", "打完所有楼层出结局。")],
    [("雪人兄弟金手指？", "无限命、无敌等见本页。版本不同可能无效。"),
     ("手机能玩吗？", "能。横屏加虚拟手柄。"),
     ("托管 ROM 吗？", "商业 ROM 不托管。选本地文件或自行放到 S3。"),
     ("怎么通关？", "按楼层把怪堆成雪球踢掉，打完 Boss。完整流程在攻略目录。"),
     ("能存档吗？", "模拟器即时存档留在本机。")],
)
en_copy["snow-bros"] = pack(
    "Snow Bros", "NES action. Roll enemies into snowballs. Cheats and a full clear.",
    "Snow Bros cheats and walkthrough | NES in the browser — cv.cm",
    "Full Snow Bros clear, Game Genie cheats, NES emulator. Load your own ROM.",
    "Throw snow, roll enemies, kick the ball. Full stage flow is under the player.",
    "Game Genie codes depend on the dump. Enable them in the emulator cheat menu.",
    ["Infinite lives", "Invincible", "Weapon", "Skip boss"],
    [("Load", "Pick a .nes file. It stays in this tab."), ("Controls", "B throws, A jumps. Roll then kick."),
     ("Stack", "Keep throwing until the enemy is a ball."), ("Boss", "Dodge, pack with snow, kick."), ("Clear", "Finish every floor.")],
    [("Snow Bros cheats?", "Lives and invincible codes are on this page."),
     ("Phone?", "Yes. Landscape plus the overlay pad."),
     ("Hosted ROM?", "Not the commercial dump. Local file or your S3 object."),
     ("How to clear?", "Roll enemies, kick, beat bosses. Full flow in the guide."),
     ("Save?", "Emulator save-states stay in this browser.")],
)
zh_wt["snow-bros"] = wt(
    "FC《雪人兄弟》通关：从 1 楼打到最终 Boss。把敌人堆成雪球再踢，踢中其他怪可连锁。每层清完进下一层。",
    [
        step("ctrl", "操作", "左右走，A 跳，B 扔雪。连续打同一只怪会把它堆成球，再踢出去撞别人。被打掉一层雪，打光掉命。", "ctrl"),
        step("early", "前期楼层", "先学单怪堆球。不要站在球的弹道路径上。道具有加速和更大雪球，优先拿。", "early"),
        step("mid", "中期", "怪会飞、会开枪。先清会开枪的。双人可一人堆一人踢。"),
        step("boss", "Boss 与结局", "Boss 要堆很多次。躲弹，找空隙扔。打完最后一层出结局，通关。", "boss"),
    ],
)
en_wt["snow-bros"] = wt(
    "Snow Bros NES: floor by floor. Pack enemies into balls and kick. Last boss is the clear.",
    [
        step("ctrl", "Controls", "A jump, B throw. Repeat hits pack a snowball; kick it into others.", "ctrl"),
        step("early", "Early floors", "Learn one-enemy packs. Do not stand in the bounce path. Grab size-up items.", "early"),
        step("mid", "Mid game", "Flying and gun enemies. Pack gunners first. Two-player: one packs, one kicks."),
        step("boss", "Bosses and ending", "Bosses take many packs. Dodge, throw gaps. Last floor is the credits.", "boss"),
    ],
)

zh_copy["bubble-bobble"] = pack(
    "泡泡龙", "FC 动作。吐泡困怪，金手指、通关、在线玩。",
    "泡泡龙 金手指｜FC Bubble Bobble 通关攻略 在线玩 — cv.cm",
    "泡泡龙完整通关、真结局条件、金手指、NES 模拟器。商业 ROM 自行载入。",
    "吐泡把怪困住再打破。双人才能看真结局。完整关卡流程在攻略里。",
    "金手指视版本而定。真结局需要两人才过 100 关。",
    ["无限命", "连射", "跳关", "结局"],
    [("吐泡", "B 吐泡，跳到泡上可借力。"), ("困怪", "泡罩住怪再打破才算消灭。"), ("道具", "糖果加速、闪电清屏。"),
     ("100 关", "单人通常假结局。"), ("真结局", "两人一起打完 100 关。")],
    [("泡泡龙金手指？", "无限命、跳关见本页。"), ("手机？", "能玩，横屏更好。"),
     ("ROM？", "不托管商业版。"), ("真结局？", "双人打完 100 关。攻略里写了。"), ("存档？", "即时存档在本机。")],
)
en_copy["bubble-bobble"] = pack(
    "Bubble Bobble", "NES. Trap enemies in bubbles. Cheats and the true ending.",
    "Bubble Bobble cheats and true ending | NES — cv.cm",
    "Full Bubble Bobble clear, two-player true ending, cheats, NES emulator.",
    "Trap, pop, ride bubbles. True ending needs two players through 100 rooms.",
    "Codes vary by dump. True ending is a two-player 100-room clear.",
    ["Infinite lives", "Rapid bubbles", "Skip", "Ending"],
    [("Blow", "B blows. Ride bubbles."), ("Trap", "Encapsulate then pop."), ("Items", "Candy speed, lightning clear."),
     ("100", "Solo often gets the fake ending."), ("True", "Two players, all 100 rooms.")],
    [("Cheats?", "Lives and skip on this page."), ("Phone?", "Yes."), ("ROM?", "Not hosted."),
     ("True ending?", "Two players through 100 rooms."), ("Save?", "Local save-states.")],
)
zh_wt["bubble-bobble"] = wt(
    "FC《泡泡龙》通关：100 个房间。单人打完常是假结局；两人同时在场打完 100 关才是真结局（超级结局还要收集）。",
    [
        step("rooms", "房间规则", "把所有怪困进泡并打破才开门。自己也可以踩泡往上。时间久了怪会发狂变红色，尽快清。", "rooms"),
        step("items", "道具", "闪电、炸弹、药水改变泡的行为。看到闪电优先拿来清屏。字母泡可拼 SUPER。", "items"),
        step("mid", "中后期", "50 关后布局更绕。先清会走位的怪。即时存档每 10 关一次。"),
        step("end", "100 关与真结局", "第 100 关 Boss。单人过常看到「假结束」。两人从开局一直打到 100 才出真结局。", "end"),
    ],
)
en_wt["bubble-bobble"] = wt(
    "Bubble Bobble: 100 rooms. Solo often fake-credits. Two players through 100 is the true ending.",
    [
        step("rooms", "Room rules", "Trap every enemy and pop. Ride bubbles. Hurry before they rage-red.", "rooms"),
        step("items", "Items", "Lightning, bombs, potions. Grab lightning to clear. Letter bubbles spell SUPER.", "items"),
        step("mid", "Later rooms", "After 50 the layouts tangle. Save-state every 10 rooms."),
        step("end", "Room 100 and true ending", "Solo often fake-credits. Two players from start to 100 for the true ending.", "end"),
    ],
)

zh_copy["jackal"] = pack(
    "赤色要塞", "FC 射击。吉普车救人，金手指、通关、在线玩。",
    "赤色要塞 金手指｜FC Jackal 通关攻略 在线玩 — cv.cm",
    "赤色要塞完整通关、金手指、NES 模拟器。商业 ROM 自行载入。",
    "驾驶吉普救人、升级武器。完整关卡在攻略目录。",
    "金手指视版本。载入后在菜单打开。",
    ["无限命", "弹药", "加速", "无敌"],
    [("开车", "方向驾驶，B 机枪，A 榴弹。"), ("救人", "靠近战俘载上车，送到直升机。"),
     ("升级", "救人越多武器越强。"), ("关底", "打炮台和 Boss 车。"), ("通关", "打完所有战区。")],
    [("金手指？", "无限命、弹药见本页。"), ("手机？", "横屏。"), ("ROM？", "不托管。"),
     ("怎么过？", "救人升级，打关底。"), ("存档？", "本机即时存档。")],
)
en_copy["jackal"] = pack(
    "Jackal", "NES jeep shooter. Rescue POWs. Cheats and a full clear.",
    "Jackal cheats and walkthrough | NES — cv.cm",
    "Full Jackal clear, cheats, NES emulator. Load your own ROM.",
    "Drive, rescue, upgrade guns. Stage flow is under the player.",
    "Codes vary by dump.",
    ["Infinite lives", "Ammo", "Speed", "Invincible"],
    [("Drive", "B gun, A grenades."), ("Rescue", "Pick POWs, drop at the chopper."),
     ("Upgrade", "More rescues, stronger guns."), ("Boss", "Turrets and boss vehicles."), ("Clear", "Finish every zone.")],
    [("Cheats?", "On this page."), ("Phone?", "Landscape."), ("ROM?", "Not hosted."),
     ("How?", "Rescue, upgrade, bosses."), ("Save?", "Local states.")],
)
zh_wt["jackal"] = wt(
    "FC《赤色要塞》通关：各战区救人送到直升机换武器，打关底装甲。全战区打完通关。",
    [
        step("drive", "驾驶与武器", "吉普可八向移动。机枪清兵，榴弹打碉堡。不要停在敌炮口前。", "drive"),
        step("pow", "战俘", "靠近俘虏上车，送到地图上的直升机点。救人升级主炮和榴弹。", "pow"),
        step("zones", "战区", "从草地打到沙漠/机场。每区关底有炮台或 Boss 车，用榴弹。"),
        step("end", "通关", "最后战区 Boss 后出结局。建议每区结束存档。", "end"),
    ],
)
en_wt["jackal"] = wt(
    "Jackal NES: rescue POWs for gun upgrades, clear every zone boss.",
    [
        step("drive", "Drive and guns", "Eight-way jeep. Gun for soldiers, grenades for bunkers.", "drive"),
        step("pow", "POWs", "Pick them up, drop at the helicopter. Rescues upgrade weapons.", "pow"),
        step("zones", "Zones", "Grass to desert/airfield. Zone bosses take grenades."),
        step("end", "Clear", "Last zone boss, then credits. Save-state per zone.", "end"),
    ],
)

zh_copy["kunio-soccer"] = pack(
    "热血足球", "FC 热血。射门必杀，金手指、通关、在线玩。",
    "热血足球 金手指｜FC 热血高校 通关攻略 在线玩 — cv.cm",
    "热血足球完整杯赛流程、必杀、金手指、NES 模拟器。",
    "热血足球是 FC 上的街球。带球、抢断、必杀射门。完整杯赛在攻略里。",
    "金手指视汉化版而定。",
    ["比分", "时间", "体力", "必杀"],
    [("带球", "靠近球自动带，B 传/射。"), ("抢断", "冲撞抢球。"), ("必杀", "蓄力射门。"),
     ("杯赛", "一场场赢到决赛。"), ("通关", "赢冠军奖杯。")],
    [("金手指？", "比分、时间见本页。"), ("手机？", "能。"), ("ROM？", "不托管。"),
     ("怎么赢？", "抢断后必杀射门。"), ("存档？", "本机。")],
)
en_copy["kunio-soccer"] = pack(
    "Kunio Soccer", "NES Nekketsu soccer. Super shots, cheats, full cup.",
    "Kunio-kun soccer cheats | NES — cv.cm",
    "Full cup run, super shots, cheats, NES emulator.",
    "Dribble, tackle, super shot. The cup path is in the guide.",
    "Codes vary on fan translations.",
    ["Score", "Time", "Stamina", "Super shot"],
    [("Dribble", "Touch the ball, B pass/shoot."), ("Tackle", "Charge."), ("Super", "Charge a shot."),
     ("Cup", "Win through the final."), ("Clear", "Win the cup.")],
    [("Cheats?", "On this page."), ("Phone?", "Yes."), ("ROM?", "Not hosted."),
     ("How to win?", "Tackle then super shot."), ("Save?", "Local.")],
)
zh_wt["kunio-soccer"] = wt(
    "FC《热血足球》通关：打完杯赛/联赛夺冠。必杀射门是主要得分手段。",
    [
        step("play", "操作", "靠近带球，B 短传或射门。冲撞抢球。蓄力后射出必杀球，门将难防。", "play"),
        step("match", "比赛", "先抢中场。后场不要乱大脚。体力掉了传给满体队友。", "match"),
        step("cup", "杯赛到决赛", "一场场赢。决赛对方更猛，用必杀远射。夺冠通关。", "cup"),
    ],
)
en_wt["kunio-soccer"] = wt(
    "Kunio Soccer: win the cup. Super shots are the scoring plan.",
    [
        step("play", "Controls", "Dribble on contact. B pass/shoot. Charge for a super shot.", "play"),
        step("match", "Matches", "Win midfield. Don't panic-clear. Pass to fresh stamina.", "match"),
        step("cup", "Cup to final", "Win each tie. Finals need long supers. Trophy is the clear.", "cup"),
    ],
)

zh_copy["ninja-turtles"] = pack(
    "忍者神龟", "FC 动作。四龟切换，金手指、通关、在线玩。",
    "忍者神龟 金手指｜FC TMNT 通关攻略 在线玩 — cv.cm",
    "忍者神龟（TMNT）完整关卡、披萨回血、金手指、NES 模拟器。",
    "四只龟切换打关。披萨回血。完整关卡在攻略里。",
    "金手指视美版/汉化而定。",
    ["无限命", "体力", "武器", "披萨"],
    [("换人", "菜单换龟，血空换下一个。"), ("武器", "近战不同。"), ("披萨", "回血。"),
     ("关卡", "街道到基地。"), ("通关", "打完最后 Boss。")],
    [("金手指？", "见本页。"), ("手机？", "能。"), ("ROM？", "不托管。"),
     ("怎么过？", "换人保命，打关底。"), ("存档？", "本机。")],
)
en_copy["ninja-turtles"] = pack(
    "Ninja Turtles", "NES TMNT. Swap four turtles. Cheats and a full clear.",
    "TMNT NES cheats and walkthrough — cv.cm",
    "Full TMNT NES stages, pizza heals, cheats, emulator.",
    "Swap turtles when one is low. Pizza heals. Stage flow below.",
    "Codes vary by region.",
    ["Infinite lives", "Energy", "Weapon", "Pizza"],
    [("Swap", "Pause and switch."), ("Weapons", "Each turtle hits differently."), ("Pizza", "Heal."),
     ("Stages", "Streets to the lair."), ("Clear", "Last boss.")],
    [("Cheats?", "On this page."), ("Phone?", "Yes."), ("ROM?", "Not hosted."),
     ("How?", "Swap, pizza, bosses."), ("Save?", "Local.")],
)
zh_wt["ninja-turtles"] = wt(
    "FC《忍者神龟》通关：多关卡街道/下水道/基地。一只龟没血就换人。打完最后 Boss 通关。",
    [
        step("party", "四人", "暂停换人。别让全员空血。披萨立刻吃。", "party"),
        step("stages", "关卡", "从街道打到下水道和基地。跳跃关注意掉坑。飞镖兵优先清。", "stages"),
        step("boss", "Boss 与结局", "关底 Boss 看武器距离。最后一战留满血龟。打完通关。", "boss"),
    ],
)
en_wt["ninja-turtles"] = wt(
    "TMNT NES: swap turtles, eat pizza, clear street/sewer/lair bosses.",
    [
        step("party", "Four turtles", "Pause-swap. Don't wipe the party. Eat pizza immediately.", "party"),
        step("stages", "Stages", "Streets, sewers, base. Watch pits. Shuriken enemies first.", "stages"),
        step("boss", "Bosses and ending", "Range your weapon. Keep a full-health turtle for the last fight.", "boss"),
    ],
)

zh_copy["mega-man-2"] = pack(
    "洛克人 2", "FC 平台。八大关选顺序，金手指、通关、在线玩。",
    "洛克人2 金手指｜FC 八大关 通关攻略 在线玩 — cv.cm",
    "洛克人 2 推荐关卡顺序、弱点武器、金手指、NES 模拟器。",
    "先打八大关拿武器，再打伍德等人用克制。推荐顺序写在攻略里。",
    "金手指视版本。",
    ["无限命", "能量", "武器", "莱西"],
    [("选关", "八大关任选。"), ("弱点", "用克制武器。"), ("E 罐", "留到残血。"),
     ("城堡", "伍德关后进。"), ("通关", "打完外星 Boss。")],
    [("金手指？", "见本页。"), ("手机？", "能。"), ("ROM？", "不托管。"),
     ("先打谁？", "攻略有推荐顺序。"), ("存档？", "每关后存。")],
)
en_copy["mega-man-2"] = pack(
    "Mega Man 2", "NES. Eight robot masters. Weakness order and cheats.",
    "Mega Man 2 weakness order | NES walkthrough — cv.cm",
    "Recommended stage order, weakness weapons, cheats, NES emulator.",
    "Clear eight stages, then Wily with the right weapon. Order is in the guide.",
    "Codes vary.",
    ["Infinite lives", "Energy", "Weapons", "Rush"],
    [("Select", "Any of eight."), ("Weakness", "Match the chart."), ("E-tanks", "Save for low HP."),
     ("Castle", "After the eight."), ("Clear", "Alien boss.")],
    [("Cheats?", "On this page."), ("Phone?", "Yes."), ("ROM?", "Not hosted."),
     ("Who first?", "See the order in the guide."), ("Save?", "After each stage.")],
)
zh_wt["mega-man-2"] = wt(
    "FC《洛克人 2》通关：推荐顺序 Air → Quick → Flash → Metal → Wood → Crash → Bubble → Heat，再打伍德城堡。用克制武器。",
    [
        step("order", "推荐顺序", "气人 → 迅人 → 闪人 → 金人 → 木人 → 破人 → 泡人 → 热人。这个顺序能尽早拿到好用的克制。", "order"),
        step("weak", "弱点", "闪人克气人，金人克迅人，以此类推。BOSS 战只打弱点，省武器槽。", "weak"),
        step("wily", "伍德城", "八大关后进城堡。几关平台 + 连战。E 罐留到连战。打完外星 Boss 通关。", "wily"),
    ],
)
en_wt["mega-man-2"] = wt(
    "Mega Man 2: Air → Quick → Flash → Metal → Wood → Crash → Bubble → Heat, then Wily.",
    [
        step("order", "Stage order", "Air, Quick, Flash, Metal, Wood, Crash, Bubble, Heat. Unlocks useful weaknesses early.", "order"),
        step("weak", "Weaknesses", "Flash beats Air, Metal beats Quick, and so on. Only fire the weakness on bosses.", "weak"),
        step("wily", "Wily castle", "Platform gauntlet then a boss rush. Save E-tanks. Alien boss is the credits.", "wily"),
    ],
)

zh_copy["zelda-nes"] = pack(
    "塞尔达传说", "FC RPG。迷宫找碎片，金手指、通关、在线玩。",
    "塞尔达传说 金手指｜FC 初代 通关攻略 在线玩 — cv.cm",
    "FC 初代塞尔达 9 迷宫、银箭打加农、金手指、NES 模拟器。",
    "买蜡烛探路，按迷宫顺序收三角。第 9 关银箭打加农通关。",
    "金手指视版本。第二任务是红面匣。",
    ["心", "卢比", "钥匙", "剑"],
    [("探路", "蜡烛烧树丛。"), ("迷宫 1–8", "每座拿地图和碎片。"), ("道具", "炸弹、弓、排箫。"),
     ("9", "银箭。"), ("通关", "加农。")],
    [("金手指？", "见本页。"), ("手机？", "能。"), ("ROM？", "不托管。"),
     ("加农怎么打？", "银箭。攻略有迷宫顺序。"), ("第二任务？", "通关后再开。")],
)
en_copy["zelda-nes"] = pack(
    "The Legend of Zelda", "NES. Nine dungeons, silver arrows, Ganon.",
    "Zelda NES dungeons and Ganon | walkthrough — cv.cm",
    "All 9 NES Zelda dungeons, silver arrows, cheats, emulator.",
    "Burn bushes, collect Triforce, silver-arrow Ganon in 9.",
    "Codes vary. Second quest is the red cartridge face.",
    ["Hearts", "Rupees", "Keys", "Sword"],
    [("Explore", "Candle burns bushes."), ("1–8", "Map and Triforce each."), ("Items", "Bombs, bow, flute."),
     ("9", "Silver arrows."), ("Clear", "Ganon.")],
    [("Cheats?", "On this page."), ("Phone?", "Yes."), ("ROM?", "Not hosted."),
     ("Ganon?", "Silver arrows. Dungeon order in the guide."), ("Quest 2?", "After credits.")],
)
zh_wt["zelda-nes"] = wt(
    "FC 初代《塞尔达》通关：迷宫 1→8 拿三角，迷宫 9 银箭打加农。蜡烛烧树丛找隐藏。",
    [
        step("over", "原野", "买蜡烛和盾。烧树丛、炸墙找洞。心容器散落在原野，先凑到 8 心再打后期。", "over"),
        step("d1", "迷宫 1–4", "1 在森林湖，2 在山，3 在海边，4 在湖中岛（要排箫或绕路）。每座清图拿碎片。", "d1"),
        step("d2", "迷宫 5–8", "5 死亡山，6 迷宫林，7 用排箫，8 森林隐藏。弓和炸弹必带。"),
        step("ganon", "迷宫 9 与加农", "死亡山深处。银箭。加农先打到棕色再银箭。打完通关。红匣是第二任务。", "ganon"),
    ],
)
en_wt["zelda-nes"] = wt(
    "Zelda NES: dungeons 1–8 for Triforce, 9 for silver-arrow Ganon. Burn bushes.",
    [
        step("over", "Overworld", "Buy a candle and shield. Burn bushes, bomb walls. Get hearts before late dungeons.", "over"),
        step("d1", "Dungeons 1–4", "1 forest lake, 2 mountain, 3 coast, 4 island (flute). Map + Triforce each.", "d1"),
        step("d2", "Dungeons 5–8", "5 Death Mountain, 6 woods maze, 7 flute, 8 hidden forest. Bow and bombs."),
        step("ganon", "Dungeon 9 and Ganon", "Death Mountain. Brown Ganon, then silver arrow. Red cart is quest 2.", "ganon"),
    ],
)

zh_copy["kung-fu"] = pack(
    "功夫", "FC 格斗。楼层打上去，金手指、通关、在线玩。",
    "功夫 金手指｜FC Spartan X 通关攻略 在线玩 — cv.cm",
    "功夫 / Spartan X 五层通关、金手指、NES 模拟器。",
    "一层层往上打，拳踢抓。五层 Boss 后通关。",
    "金手指视版本。",
    ["无限命", "体力", "时间", "踢"],
    [("拳踢", "近拳远踢。"), ("抓", "近身投。"), ("一层", "清小兵上楼。"),
     ("Boss", "每层一个。"), ("通关", "五层打完。")],
    [("金手指？", "见本页。"), ("手机？", "能。"), ("ROM？", "不托管。"),
     ("几层？", "五层。"), ("存档？", "每层存。")],
)
en_copy["kung-fu"] = pack(
    "Kung Fu", "NES Spartan X. Five floors, punch and kick, full clear.",
    "Kung Fu NES cheats and five-floor walkthrough — cv.cm",
    "Five floors, bosses, cheats, NES emulator.",
    "Punch, kick, throw. Five bosses, then credits.",
    "Codes vary.",
    ["Infinite lives", "Energy", "Time", "Kick"],
    [("Punch/kick", "Close punch, far kick."), ("Throw", "Grab up close."), ("Floors", "Clear, climb."),
     ("Boss", "One per floor."), ("Clear", "Five floors.")],
    [("Cheats?", "On this page."), ("Phone?", "Yes."), ("ROM?", "Not hosted."),
     ("How many floors?", "Five."), ("Save?", "Per floor.")],
)
zh_wt["kung-fu"] = wt(
    "FC《功夫》通关：五层楼，每层清兵打 Boss，顶层救到人即通关。",
    [
        step("moves", "拳踢抓", "近距离出拳，远距离踢。贴身可投。不要对空连踢。", "moves"),
        step("floors", "1–4 层", "小兵有刀和飞腿。先清投掷再打近战。楼梯口别被夹。每层 Boss 打完上楼。", "floors"),
        step("top", "顶层与结局", "第五层 Boss 最慢但伤害高。打完救出，通关。", "top"),
    ],
)
en_wt["kung-fu"] = wt(
    "Kung Fu NES: five floors, a boss each, rescue at the top.",
    [
        step("moves", "Punch, kick, throw", "Punch close, kick far, throw on grab. Don't kick air.", "moves"),
        step("floors", "Floors 1–4", "Knives and flying kicks. Clear throwers first. Boss, then stairs.", "floors"),
        step("top", "Top floor", "Fifth boss hits hard and slow. Rescue is the credits.", "top"),
    ],
)

zh_copy["chrono-trigger"] = pack(
    "时空之轮", "SFC RPG。多结局，金手指、通关、在线玩。",
    "时空之轮 金手指｜SFC Chrono Trigger 通关攻略 在线玩 — cv.cm",
    "时空之轮主线通关、新游戏+、拉沃斯、金手指、SNES 模拟器。",
    "跟剧情走时代。主线打拉沃斯通关；还有多个隐藏结局。",
    "金手指可能坏剧情，优先用心。",
    ["HP", "MP", "金钱", "必杀"],
    [("时代", "传送点换时代。"), ("组合技", "两人同时出招。"), ("拉沃斯", "主线最终。"),
     ("NG+", "通关后。"), ("多结局", "不同时间打拉沃斯。")],
    [("金手指？", "见本页，慎用。"), ("手机？", "能，偏长。"), ("ROM？", "不托管。"),
     ("主线怎么过？", "跟时代走，打拉沃斯。"), ("多结局？", "攻略里写了时机。")],
)
en_copy["chrono-trigger"] = pack(
    "Chrono Trigger", "SNES RPG. Lavos, New Game+, multiple endings.",
    "Chrono Trigger walkthrough and endings | SNES — cv.cm",
    "Main-line Lavos clear, New Game+, cheats, SNES emulator.",
    "Follow eras. Beat Lavos for the main ending; more endings exist.",
    "Cheats can break flags. Prefer HP codes only.",
    ["HP", "MP", "Gold", "Techs"],
    [("Eras", "Gates."), ("Dual techs", "Two characters."), ("Lavos", "Main final."),
     ("NG+", "After credits."), ("Endings", "When you fight Lavos.")],
    [("Cheats?", "On this page. Careful."), ("Phone?", "Yes, long sessions."), ("ROM?", "Not hosted."),
     ("Main clear?", "Follow eras, fight Lavos."), ("Endings?", "Timing is in the guide.")],
)
zh_wt["chrono-trigger"] = wt(
    "SFC《时空之轮》主线通关：跟剧情走各时代，集齐队友，进拉沃斯内部打败它。通关后 New Game+ 可刷其他结局。",
    [
        step("era", "时代", "中世纪、未来、史前、神殿。传送点来回拿关键道具（梦石、钥匙）。不要跳主线旗标。", "era"),
        step("party", "队伍与组合技", "克罗诺+玛尔、克罗诺+罗格等组合技。Boss 战开组合。", "party"),
        step("lavos", "拉沃斯与结局", "主线在海底神殿后进入拉沃斯。打外壳再打内部。打完主线结局。提前打拉沃斯会出短结局。", "lavos"),
    ],
)
en_wt["chrono-trigger"] = wt(
    "Chrono Trigger main clear: follow era story, beat Lavos inside. NG+ for extra endings.",
    [
        step("era", "Eras", "Middle Ages, future, prehistory, the Kingdom. Gates for key items. Don't skip flags.", "era"),
        step("party", "Dual techs", "Crono+Marle, Crono+Lucca, etc. Open bosses with duals.", "party"),
        step("lavos", "Lavos and endings", "Ocean Palace path into Lavos. Shell then interior. Early Lavos fights are short endings.", "lavos"),
    ],
)

zh_copy["super-mario-kart"] = pack(
    "超级马里奥卡丁车", "SFC 竞速。杯子金杯，金手指、通关、在线玩。",
    "超级马里奥卡丁车 金手指｜SFC 通关攻略 在线玩 — cv.cm",
    "超级马里奥卡丁车 150cc 金杯、特殊杯、金手指、SNES 模拟器。",
    "蘑菇杯到特殊杯。150cc 金杯是完整通关目标。",
    "金手指可解锁，计时赛请关。",
    ["星星", "圈数", "鬼影", "解锁"],
    [("漂", "跳+转向。"), ("道具", "蕉、壳、蘑菇。"), ("杯子", "蘑菇到特殊。"),
     ("150cc", "金杯。"), ("通关", "全金。")],
    [("金手指？", "见本页。"), ("手机？", "手柄更好。"), ("ROM？", "不托管。"),
     ("特殊杯？", "150cc 名次解锁。"), ("存档？", "本机。")],
)
en_copy["super-mario-kart"] = pack(
    "Super Mario Kart", "SNES. 150cc gold cups, Special Cup, cheats.",
    "Super Mario Kart 150cc walkthrough | SNES — cv.cm",
    "150cc gold, Special Cup, cheats, SNES emulator.",
    "Mushroom through Special. 150cc gold is the clear.",
    "Unlock cheats off for time trials.",
    ["Stars", "Laps", "Ghost", "Unlock"],
    [("Drift", "Hop and steer."), ("Items", "Banana, shell, mushroom."), ("Cups", "Mushroom to Special."),
     ("150cc", "Gold."), ("Clear", "All gold.")],
    [("Cheats?", "On this page."), ("Phone?", "A pad is better."), ("ROM?", "Not hosted."),
     ("Special Cup?", "Place well in 150cc."), ("Save?", "Local.")],
)
zh_wt["super-mario-kart"] = wt(
    "SFC《超级马里奥卡丁车》通关：蘑菇/花朵/星星/特殊四杯，150cc 金杯。彩虹容易掉，先存档。",
    [
        step("drive", "驾驶", "跳起转向维持漂。蘑菇用在直道或被打后。香蕉丢弯心。", "drive"),
        step("cups", "杯子", "先 100cc 熟悉。蘑菇杯 → 花朵 → 星星 → 特殊。特殊要 150cc 成绩解锁（视版本）。", "cups"),
        step("gold", "150cc 金杯", "对手攻击强。彩虹赛前进存档。四杯金杯通关。", "gold"),
    ],
)
en_wt["super-mario-kart"] = wt(
    "Super Mario Kart: four cups, 150cc gold. Save-state before Rainbow.",
    [
        step("drive", "Driving", "Hop-steer to drift. Mushrooms on straights. Bananas in apexes.", "drive"),
        step("cups", "Cups", "100cc first. Mushroom → Flower → Star → Special (150cc unlock on many dumps).", "cups"),
        step("gold", "150cc gold", "Rivals attack more. Rainbow: save-state. Four golds is the clear.", "gold"),
    ],
)

zh_copy["super-mario-land"] = pack(
    "超级马里奥大陆", "GB 平台。四个世界，金手指、通关、在线玩。",
    "超级马里奥大陆 金手指｜GB 通关攻略 在线玩 — cv.cm",
    "超级马里奥大陆 4 世界通关、射弹、金手指、GB 模拟器。",
    "GB 初代马里奥。花是射弹不是火球。四个世界打完通关。",
    "金手指视版本。",
    ["无限命", "无敌", "花", "选关"],
    [("射", "花后 B 射击。"), ("世界", "1–4。"), ("飞机关", "2-3 等。"),
     ("城堡", "每世界尾。"), ("通关", "世界 4。")],
    [("金手指？", "见本页。"), ("手机？", "竖屏也行。"), ("ROM？", "不托管。"),
     ("和红白机有何不同？", "花是子弹。"), ("存档？", "本机。")],
)
en_copy["super-mario-land"] = pack(
    "Super Mario Land", "GB. Four worlds, projectile flower, full clear.",
    "Super Mario Land cheats | Game Boy walkthrough — cv.cm",
    "Four worlds, shooting flower, cheats, GB emulator.",
    "Flower shoots, it is not fire. Four worlds to credits.",
    "Codes vary.",
    ["Infinite lives", "Invincible", "Flower", "Stage select"],
    [("Shoot", "B after flower."), ("Worlds", "1–4."), ("Shooter stages", "Like 2-3."),
     ("Castles", "End of each world."), ("Clear", "World 4.")],
    [("Cheats?", "On this page."), ("Phone?", "Portrait works."), ("ROM?", "Not hosted."),
     ("Vs NES?", "Flower is a projectile."), ("Save?", "Local.")],
)
zh_wt["super-mario-land"] = wt(
    "GB《超级马里奥大陆》通关：世界 1–4，每世界 3 关。花是向前射弹。打完 4-3 通关。",
    [
        step("w1", "世界 1", "草地教学。花后可射击。1-3 是城堡，打关底怪。", "w1"),
        step("w2", "世界 2", "有射击关，左右移动发射。不要硬撞飞机。", "w2"),
        step("w3", "世界 3", "水/机关。射弹清前方。"),
        step("w4", "世界 4 与结局", "最后城堡。打完关底出结局。", "w4"),
    ],
)
en_wt["super-mario-land"] = wt(
    "Super Mario Land: worlds 1–4, three stages each. Flower is a projectile. 4-3 is the clear.",
    [
        step("w1", "World 1", "Grass tutorial. Shoot after the flower. 1-3 castle.", "w1"),
        step("w2", "World 2", "Shooter stages. Don't ram planes.", "w2"),
        step("w3", "World 3", "Water and traps. Shoot forward."),
        step("w4", "World 4 and ending", "Last castle. Credits after the boss.", "w4"),
    ],
)

zh_copy["pokemon-crystal"] = pack(
    "口袋妖怪 水晶", "GBC。城都 8 馆，金手指、通关、在线玩。",
    "口袋妖怪水晶 金手指｜GBC 城都 通关攻略 在线玩 — cv.cm",
    "水晶版城都 8 馆、四天王、冠军、金手指、GBC 模拟器。",
    "比金版多水晶剧情和苏醒的神兽。主线仍是城都冠军。",
    "金手指可能乱时钟。",
    ["穿墙", "金钱", "喷雾", "糖果"],
    [("馆", "8 座。"), ("小茜", "大奶罐。"), ("神兽", "后期。"),
     ("四天王", "白银山。"), ("通关", "殿堂。")],
    [("金手指？", "见本页。"), ("和金的区别？", "水晶剧情和神兽。"), ("ROM？", "不托管。"),
     ("小茜？", "状态或格斗。"), ("存档？", "先即时存档再金手指。")],
)
en_copy["pokemon-crystal"] = pack(
    "Pokémon Crystal", "GBC. Johto 8 gyms, Unown, legendary awakening.",
    "Pokémon Crystal Johto walkthrough | GBC — cv.cm",
    "Crystal Johto gyms, E4, Champion, cheats, GBC emulator.",
    "Crystal adds story and roaming beasts. Main clear is still the Johto Champion.",
    "Walk-through-walls can desync the clock.",
    ["Walk through walls", "Money", "Repel", "Rare Candy"],
    [("Gyms", "Eight."), ("Whitney", "Miltank."), ("Beasts", "Late."),
     ("E4", "Mt. Silver."), ("Clear", "Hall of Fame.")],
    [("Cheats?", "On this page."), ("Vs Gold?", "Crystal story and beasts."), ("ROM?", "Not hosted."),
     ("Whitney?", "Status or fighting."), ("Save?", "State before cheats.")],
)
zh_wt["pokemon-crystal"] = wt(
    "GBC《口袋妖怪 水晶》通关：城都 8 馆 + 四天王 + 冠军。神兽是后期。不要跳徽章。",
    [
        step("gyms", "8 馆", "阿笔飞 → 阿菊虫 → 小茜普通 → 阿四幽灵 → 阿杏格斗 → 阿蜜钢 → 柳伯冰 → 阿渡龙。小茜用状态或格斗。", "gyms"),
        step("story", "水晶剧情", "广播塔、缘朱烧塔、神兽苏醒。跟主线，不要穿墙。", "story"),
        step("e4", "四天王与通关", "白银山四天王和冠军。殿堂即主线通关。关都和神兽是后期。", "e4"),
    ],
)
en_wt["pokemon-crystal"] = wt(
    "Pokémon Crystal: Johto 8 gyms, E4, Champion. Beasts are post-story.",
    [
        step("gyms", "Eight gyms", "Falkner → Bugsy → Whitney → Morty → Chuck → Jasmine → Pryce → Clair. Whitney: status or fighting.", "gyms"),
        step("story", "Crystal plot", "Radio tower, Burned Tower, beast awakening. No wall hacks.", "story"),
        step("e4", "E4 and clear", "Mt. Silver. Hall of Fame is the story clear. Kanto/beasts after.", "e4"),
    ],
)

zh_copy["pokemon-fire-red"] = pack(
    "口袋妖怪 火红", "GBA。关都 8 馆重制，金手指、通关、在线玩。",
    "口袋妖怪火红 金手指｜GBA 通关攻略 在线玩 — cv.cm",
    "火红版关都 8 馆、四天王、冠军、金手指、GBA 模拟器。",
    "重制红版。馆顺序与红版相同，画面是 GBA。主线殿堂通关。",
    "GBA 金手指是 Action Replay 格式。",
    ["穿墙", "金钱", "糖果", "喷雾"],
    [("馆", "8 座关都。"), ("御三家", "妙蛙好打小刚。"), ("四天王", "同红版。"),
     ("海底", "后期。"), ("通关", "殿堂。")],
    [("金手指？", "AR 码见本页。"), ("和红版？", "同主线，GBA 画面。"), ("ROM？", "不托管。"),
     ("小刚？", "水草。"), ("存档？", "本机。")],
)
en_copy["pokemon-fire-red"] = pack(
    "Pokémon FireRed", "GBA remake of Red. Kanto gyms, E4, Champion.",
    "Pokémon FireRed walkthrough | GBA — cv.cm",
    "FireRed Kanto 8 gyms, Elite Four, cheats, GBA emulator.",
    "Same gym order as Red, GBA graphics. Hall of Fame is the clear.",
    "Action Replay codes.",
    ["Walk through walls", "Money", "Rare Candy", "Repel"],
    [("Gyms", "Eight Kanto."), ("Starter", "Bulbasaur eases Brock."), ("E4", "Same as Red."),
     ("Sevii", "Post."), ("Clear", "Hall of Fame.")],
    [("Cheats?", "AR on this page."), ("Vs Red?", "Same story, GBA."), ("ROM?", "Not hosted."),
     ("Brock?", "Water/Grass."), ("Save?", "Local.")],
)
zh_wt["pokemon-fire-red"] = wt(
    "GBA《火红》通关：关都 8 馆 + 四天王 + 冠军。路线与红版相同。",
    [
        step("kanto", "8 馆", "小刚岩 → 小霞水 → 马志士电 → 莉佳草 → 阿桔毒 → 娜姿超 → 夏伯火 → 坂木地。御三家选妙蛙最顺。", "kanto"),
        step("hm", "HM 与主线", "居合、冲浪、力量按剧情拿。圣安努、火箭队、实验室都跟地图走。", "hm"),
        step("e4", "四天王与通关", "科拿冰、希巴斗、菊子幽灵、阿渡龙，然后绿。殿堂通关。七岛是后期。", "e4"),
    ],
)
en_wt["pokemon-fire-red"] = wt(
    "FireRed: Kanto 8 gyms, E4, Champion. Same route as Red.",
    [
        step("kanto", "Eight gyms", "Brock → Misty → Surge → Erika → Koga → Sabrina → Blaine → Giovanni. Bulbasaur is the easy Brock.", "kanto"),
        step("hm", "HMs and story", "Cut, Surf, Strength on story flags. SS Anne, Rockets, labs.", "hm"),
        step("e4", "E4 and clear", "Lorelei, Bruno, Agatha, Lance, Blue. Hall of Fame. Sevii is post-game.", "e4"),
    ],
)

zh_copy["sonic-2"] = pack(
    "索尼克 2", "MD。双人塔尔斯，金手指、通关、在线玩。",
    "索尼克2 金手指｜MD 通关攻略 在线玩 — cv.cm",
    "索尼克 2 全 Zone、死亡蛋、混沌绿宝石、金手指、MD 模拟器。",
    "带塔尔斯双人。主线打完死亡蛋通关。7 颗绿宝石是完整结局。",
    "选关在标题。",
    ["无限命", "戒指", "选关", "无敌"],
    [("冲刺", "蹲下冲。"), ("塔尔斯", "飞一截。"), ("特殊关", "星环进。"),
     ("死亡蛋", "最终。"), ("通关", "打蛋头。")],
    [("金手指？", "见本页。"), ("和 1 代？", "有塔尔斯和冲刺。"), ("ROM？", "不托管。"),
     ("死亡蛋？", "攻略有 Zone 顺序。"), ("绿宝石？", "特殊关，非必须。")],
)
en_copy["sonic-2"] = pack(
    "Sonic 2", "Mega Drive. Tails, spin dash, Death Egg.",
    "Sonic 2 Death Egg walkthrough | Mega Drive — cv.cm",
    "All Sonic 2 zones, Death Egg, Chaos Emeralds, cheats, emulator.",
    "Spin dash, Tails flight. Death Egg is the story clear. 7 emeralds for the full ending.",
    "Level select on the title.",
    ["Infinite lives", "Rings", "Level select", "Invincible"],
    [("Spin dash", "Duck then burst."), ("Tails", "Short flight."), ("Special", "Star rings."),
     ("Death Egg", "Final."), ("Clear", "Robotnik.")],
    [("Cheats?", "On this page."), ("Vs Sonic 1?", "Tails and spin dash."), ("ROM?", "Not hosted."),
     ("Death Egg?", "Zone order in the guide."), ("Emeralds?", "Special stages, optional.")],
)
zh_wt["sonic-2"] = wt(
    "MD《索尼克 2》通关：Emerald Hill → Chemical → Aquatic → Casino → Hill Top → Mystic Cave → Oil Ocean → Metropolis → Sky Chase → Wing Fortress → Death Egg。7 绿宝石是完整结局。",
    [
        step("zones", "前半 Zone", "Emerald Hill 教学冲刺。Chemical 注意传送带。Aquatic 水下记气泡。Casino 弹簧不要乱跳。", "zones"),
        step("late", "后半 Zone", "Hill Top 岩浆，Mystic 钉，Oil 滑油，Metropolis 最长。Sky Chase 是射击段。", "late"),
        step("egg", "要塞与死亡蛋", "Wing Fortress 跳飞机。Death Egg 打蛋头机甲。打完通关。绿宝石齐是超级索尼克结局。", "egg"),
    ],
)
en_wt["sonic-2"] = wt(
    "Sonic 2: Emerald Hill through Death Egg. 7 emeralds for the Super ending.",
    [
        step("zones", "Early zones", "Emerald Hill teaches spin dash. Chemical belts. Aquatic bubbles. Casino springs.", "zones"),
        step("late", "Later zones", "Hill Top lava, Mystic spikes, Oil Ocean, long Metropolis. Sky Chase is a shooter.", "late"),
        step("egg", "Fortress and Death Egg", "Wing Fortress to the ship. Death Egg Robotnik. Super Sonic if you have 7 emeralds.", "egg"),
    ],
)

zh_copy["zooming-secretary"] = pack(
    "Zooming Secretary", "Shiru 免费 NES。横版过关，本页即玩。",
    "Zooming Secretary NES 自制｜浏览器即玩 — cv.cm",
    "Zooming Secretary 是 Shiru 免费 NES 自制。ROM 已托管在 S3，点开即玩。",
    "办公室横版：跑、跳、避开障碍。ROM 按作者 freeware 许可托管。",
    "没有金手指包。卡关用即时存档。",
    [],
    [("开玩", "ROM 从 S3 载入，不用选文件。"), ("操作", "方向跑，A 跳。"),
     ("关卡", "一关关往右。"), ("存档", "即时存档。"), ("许可", "Shiru freeware。")],
    [("能免费玩吗？", "能。Shiru 免费 NES 自制，ROM 在 S3。"),
     ("作者？", "Shiru。"), ("金手指？", "没有。"), ("手机？", "能。"),
     ("商业 ROM？", "本页是自制。商业作请用文件选择。")],
)
en_copy["zooming-secretary"] = pack(
    "Zooming Secretary", "Shiru freeware NES. Play instantly.",
    "Zooming Secretary NES homebrew | play in the browser — cv.cm",
    "Shiru freeware NES action. ROM hosted on S3.",
    "Run and jump through office stages. Hosted as author freeware.",
    "No cheat pack. Use save-states.",
    [],
    [("Play", "ROM loads from S3."), ("Move", "D-pad and A."),
     ("Stages", "Go right."), ("Save", "Save-states."), ("License", "Shiru freeware.")],
    [("Free?", "Yes. Shiru freeware on S3."), ("Who?", "Shiru."), ("Cheats?", "None."),
     ("Phone?", "Yes."), ("Commercial ROMs?", "This page is homebrew. Use the file picker on classic titles.")],
)
zh_wt["zooming-secretary"] = wt(
    "Shiru《Zooming Secretary》通关：横版过关，打完设计关卡即结束。ROM 已托管。",
    [
        step("play", "开玩", "免费 ROM 在 S3，自动开始。方向移动，A 跳。", "play"),
        step("stages", "关卡", "往右推进，躲开障碍和敌人。掉坑重来。即时存档。", "stages"),
        step("end", "通关", "打完全部关卡。无商业 Boss。", "end"),
    ],
)
en_wt["zooming-secretary"] = wt(
    "Zooming Secretary: side-scroll Shiru freeware. Finish the designed stages. ROM is hosted.",
    [
        step("play", "Play", "ROM starts from S3. D-pad, A to jump.", "play"),
        step("stages", "Stages", "Go right, avoid hazards. Save-states if you drop.", "stages"),
        step("end", "Clear", "Finish every stage. No commercial boss.", "end"),
    ],
)

zh_copy["lan-master"] = pack(
    "Lan Master", "Shiru 免费 NES 解谜。接线通关，本页即玩。",
    "Lan Master NES 自制解谜｜浏览器即玩 — cv.cm",
    "Lan Master 是 Shiru 免费 NES 解谜：把网线接到正确端口。ROM 已托管。",
    "旋转、连接网线。全部关卡接完即通关。",
    "没有金手指。卡住重置关卡。",
    [],
    [("开玩", "S3 自动载入。"), ("规则", "把线接到对应口。"),
     ("关卡", "后期更绕。"), ("重置", "模拟器重置房间。"), ("许可", "Shiru freeware。")],
    [("能免费玩吗？", "能。Shiru freeware。"), ("作者？", "Shiru。"),
     ("金手指？", "没有。"), ("手机？", "能。"), ("和 Alter Ego？", "同一作者的解谜。")],
)
en_copy["lan-master"] = pack(
    "Lan Master", "Shiru freeware NES puzzle. Play instantly.",
    "Lan Master NES homebrew | play in the browser — cv.cm",
    "Connect the LAN cables. Shiru freeware ROM hosted on S3.",
    "Rotate and connect every cable. Clear all rooms.",
    "No cheats. Reset the room if stuck.",
    [],
    [("Play", "Loads from S3."), ("Rules", "Match cables to ports."),
     ("Stages", "Later rooms twist."), ("Reset", "Emulator reset."), ("License", "Shiru freeware.")],
    [("Free?", "Yes."), ("Who?", "Shiru."), ("Cheats?", "None."),
     ("Phone?", "Yes."), ("Vs Alter Ego?", "Same author, different puzzle.")],
)
zh_wt["lan-master"] = wt(
    "Shiru《Lan Master》通关：每关把网线接到正确端口。全部关卡完成即通关。ROM 已托管。",
    [
        step("rules", "规则", "旋转接头，让每根线连到对应的口。接错会不通。", "rules"),
        step("rooms", "关卡", "早期教学，后期交叉更多。卡住用模拟器重置本关。", "rooms"),
        step("end", "通关", "打完所有设计关卡。无 Boss。", "end"),
    ],
)
en_wt["lan-master"] = wt(
    "Lan Master: connect every cable. Finish all rooms. ROM is hosted.",
    [
        step("rules", "Rules", "Rotate fittings so each cable hits the right port.", "rules"),
        step("rooms", "Rooms", "Later rooms cross more. Reset the stage if stuck.", "rooms"),
        step("end", "Clear", "Finish every room. No boss.", "end"),
    ],
)

assert set(zh_copy) == set(en_copy) == set(zh_wt) == set(en_wt)
for gid in zh_wt:
    z = [s["id"] for s in zh_wt[gid]["steps"]]
    e = [s["id"] for s in en_wt[gid]["steps"]]
    if z != e:
        raise SystemExit(f"wt id mismatch {gid} {z} {e}")
    for a, b in zip(zh_wt[gid]["steps"], en_wt[gid]["steps"]):
        if a.get("image") != b.get("image"):
            raise SystemExit(f"img mismatch {gid} {a['id']}")

# merge copy
for loc in ("en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"):
    path = LOC / f"{loc}.json"
    doc = json.loads(path.read_text())
    if loc == "zh-CN":
        doc.update(zh_copy)
    elif loc == "zh-TW":
        doc.update(tw_obj(zh_copy))
    elif loc == "en":
        doc.update(en_copy)
    else:
        overlay = deepcopy(en_copy)
        # keep English long copy; names already in en
        doc.update(overlay)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("copy", loc, len(doc))

# merge walkthroughs
for loc in ("en", "zh-CN", "zh-TW", "ja", "ko", "vi", "id", "es"):
    path = WT / f"{loc}.json"
    doc = json.loads(path.read_text())
    if loc == "zh-CN":
        doc.update(zh_wt)
    elif loc == "zh-TW":
        doc.update(tw_obj(zh_wt))
    else:
        doc.update(deepcopy(en_wt))
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wt", loc, len(doc), "steps", sum(len(g["steps"]) for g in doc.values()))
