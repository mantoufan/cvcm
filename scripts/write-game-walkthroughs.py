#!/usr/bin/env python3
"""Generate complete illustrated walkthrough JSON for all cv.cm games."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src/locales/games/walkthroughs"
ROOT.mkdir(parents=True, exist_ok=True)


def step(sid: str, title: str, body: str, image: str | None = None) -> dict:
    item = {"id": sid, "title": title, "body": body}
    if image:
        item["image"] = image
    return item


def wt(intro: str, steps: list[dict]) -> dict:
    return {"intro": intro, "steps": steps}


def tw(s: str) -> str:
    pairs = [
        ("完整通关", "完整通關"), ("通关", "通關"), ("关卡", "關卡"), ("游戏", "遊戲"),
        ("超级马里奥", "超級瑪利歐"), ("超级玛丽", "超級瑪莉"), ("魂斗罗", "魂鬥羅"),
        ("坦克大战", "坦克大戰"), ("冒险岛", "冒險島"), ("俄罗斯方块", "俄羅斯方塊"),
        ("双截龙", "雙截龍"), ("塞尔达", "薩爾達"), ("口袋妖怪", "寶可夢"),
        ("绿宝石", "綠寶石"), ("缩小帽", "縮小帽"), ("索尼克", "索尼克"),
        ("载入", "載入"), ("默认", "預設"), ("菜单", "選單"), ("砖块", "磚塊"),
        ("管道", "管道"), ("城堡", "城堡"), ("隐藏", "隱藏"), ("跳跃", "跳躍"),
        ("无敌", "無敵"), ("无限", "無限"), ("选关", "選關"), ("后续", "後續"),
        ("开头", "開頭"), ("里面", "裡面"), ("这里", "這裡"), ("这个", "這個"),
        ("后", "後"), ("来", "來"), ("对", "對"), ("开", "開"), ("关", "關"),
        ("条", "條"), ("为", "為"), ("发", "發"), ("经", "經"), ("现", "現"),
        ("点", "點"), ("将", "將"), ("从", "從"), ("还", "還"), ("过", "過"),
        ("与", "與"), ("让", "讓"), ("说", "說"), ("请", "請"), ("长", "長"),
        ("门", "門"), ("见", "見"), ("里", "裡"), ("并", "並"), ("头", "頭"),
        ("吗", "嗎"), ("无", "無"), ("当", "當"), ("实", "實"), ("击", "擊"),
        ("战", "戰"), ("图", "圖"), ("电", "電"), ("盘", "盤"), ("乱", "亂"),
        ("号", "號"), ("录", "錄"), ("处", "處"), ("读", "讀"), ("会", "會"),
        ("汉", "漢"), ("页", "頁"), ("码", "碼"), ("钟", "鐘"), ("术", "術"),
        ("级", "級"), ("单", "單"), ("东", "東"), ("车", "車"), ("马", "馬"),
        ("龙", "龍"), ("宝", "寶"), ("剑", "劍"), ("铁", "鐵"), ("银", "銀"),
        ("锤", "錘"), ("钩", "鉤"), ("宫", "宮"), ("广", "廣"), ("冲", "衝"),
        ("余", "餘"), ("云", "雲"), ("砖", "磚"), ("团", "團"), ("启", "啟"),
        ("儿", "兒"), ("么", "麼"), ("个", "個"), ("们", "們"), ("时", "時"),
        ("这", "這"), ("齐", "齊"), ("杀", "殺"), ("敌", "敵"), ("达", "達"),
        ("红", "紅"), ("蓝", "藍"), ("绿", "綠"), ("黄", "黃"), ("黑", "黑"),
        ("问", "問"), ("题", "題"), ("块", "塊"), ("运", "運"), ("动", "動"),
        ("击", "擊"), ("传", "傳"), ("进", "進"), ("边", "邊"), ("线", "線"),
        ("场", "場"), ("区", "區"), ("岛", "島"), ("桥", "橋"), ("雾", "霧"),
        ("汤", "湯"), ("药", "藥"), ("馆", "館"), ("宠", "寵"), ("灵", "靈"),
        ("属", "屬"), ("种", "種"), ("练", "練"), ("习", "習"), ("胜", "勝"),
        ("负", "負"), ("败", "敗"), ("钱", "錢"), ("买", "買"), ("卖", "賣"),
        ("记", "記"), ("证", "證"), ("钥", "鑰"), ("锁", "鎖"), ("灭", "滅"),
        ("灯", "燈"), ("火", "火"), ("冰", "冰"), ("风", "風"), ("飞", "飛"),
        ("鸟", "鳥"), ("鱼", "魚"), ("兽", "獸"),
    ]
    for a, b in pairs:
        s = s.replace(a, b)
    return s


def tw_obj(obj):
    if isinstance(obj, dict):
        return {k: tw_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [tw_obj(x) for x in obj]
    if isinstance(obj, str):
        return tw(obj)
    return obj


zh: dict = {}
en: dict = {}

# ---------- Super Mario Bros ----------
zh["super-mario-bros"] = wt(
    "这是 FC《超级马里奥兄弟》完整通关流程：8 个世界、每世界 4 关（共 32 关），含隐藏 1UP、Warp 管道、水下关和最终城堡库巴。按关卡顺序打即可通关；想跳关走 1-2 / 4-2 的 Warp。建议每过一关在模拟器里即时存档。",
    [
        step("controls", "操作与命", "方向键左右走，下蹲，上进管道。A 跳，B 跑；助跑再跳能越过宽坑。碰到怪物或掉坑掉一命。小马里奥顶到问号出蘑菇变大；大马里奥顶出火花变火球（B 发射）。星星约 8 秒无敌。旗杆碰得越高，分越高。\n\n开局 3 命。顶隐藏砖可出 1UP。通关以碰到 8-4 里的斧头砍断吊桥为准。", "items"),
        step("1-1", "1-1 草地", "一路向右。第一组问号最左是硬币，踩着砖顶中间那块得蘑菇，吃完变大。跳过第一根绿管，管后坑用助跑跳。楼梯顶到旗杆。\n\n隐藏：第一根管子后的一排砖，从左数第四块顶出 1UP。旗杆前高楼梯可跳上旗尖。", "w1"),
        step("1-2", "1-2 地下（Warp）", "进第一根管子下地。向右打几个怪，注意移动平台和坑。出口在右侧向上的管子。\n\nWarp：不要进出口管。站在出口管上方的砖顶，向右走到画面外的房间，进标着 2、3、4 的管子可跳到对应世界。只想正经通关就走普通出口去 1-3。", "warp"),
        step("1-3", "1-3 高台", " outdoors 高台。红陆龟要从背后踢，别正面撞。移动平台等它靠近再跳。坑很宽，必须助跑。旗杆在右侧。"),
        step("1-4", "1-4 城堡", "地面有火棒，看节奏穿。假桥会塌，跑过去。终点是假库巴：踩或打火球，它变成怪物。碰斧头过世界。"),
        step("2-1", "2-1", "回到草地，敌人更密。注意从管子里钻出的食人花，等它缩回去再过。有一组砖可顶出星星，拿了直接冲。", "w2"),
        step("2-2", "2-2 水下", "水下关。B 加速，上下调整高度。食人花和鱼不要硬撞。右侧进管子出水。水里不能蹲，被夹住就掉命。"),
        step("2-3", "2-3 跳台", "一长串会掉的白平台，只能往前不能回头。短跳连跳。飞鱼从下面窜，看准空隙。"),
        step("2-4", "2-4 城堡", "火棒更快。有升降电梯，等它到脚边再跳。假库巴后再砍桥。"),
        step("3-1", "3-1", "夜间草地。隐藏 1UP 在第一组砖附近。锤子兄弟成对出现，引诱其中一个砸空再跳脚。", "w3"),
        step("3-2", "3-2", "连续红陆龟。可踢壳清屏，但别被反弹壳打到。坑比 1-1 多，助跑。"),
        step("3-3", "3-3", "高台加自动卷屏倾向的跳台。掉下去直接掉命。等平台对齐再跳。"),
        step("3-4", "3-4 城堡", "迷宫感：错误的路会绕回。优先走看起来往右上的通道。火棒密集，大火球清近身怪。"),
        step("4-1", "4-1", "食人花管子更多。第一组高砖可顶出蘑菇。锤子兄弟守路，远距离火球或等他们跳开。", "w4"),
        step("4-2", "4-2 地下（第二个 Warp）", "类似 1-2。普通出口去 4-3。\n\nWarp：在关卡后段找到隐藏的白砖块顶出豆茎，爬上去进云端，再进管子可跳到世界 6、7、8。想打全关就走普通出口。"),
        step("4-3", "4-3", "平衡木平台，站一端另一端翘起。保持在中段，连续短跳。"),
        step("4-4", "4-4 城堡", "迷宫。走错会循环。口诀是记住几次「上/下」分叉：通常先下再右。假库巴后出世界 5。"),
        step("5-1", "5-1", "子弹比尔从炮台射出，蹲可躲低弹。炮台本身可当踏板。有云电梯。", "w5"),
        step("5-2", "5-2", "地下加水下的混合。先地段再进水管。水下鱼更密，贴底或贴顶走一条线。"),
        step("5-3", "5-3", "和 1-3 类似但敌人带翅膀。翼龟要踩两次或火球。平台间距大。"),
        step("5-4", "5-4 城堡", "火棒 + 升降。假库巴用火球最快。"),
        step("6-1", "6-1", "夜间。风不会推你，但能见度差。隐藏砖多，用头探路。", "w6"),
        step("6-2", "6-2", "管子迷宫。部分管子可进。优先向右的出口管。花从管子进出，等缩回。"),
        step("6-3", "6-3", "高空跳台。掉下去即死。移动平台要等它走完一程再跳下一座。"),
        step("6-4", "6-4 城堡", "循环迷宫。分叉选「一直偏右」通常能到斧头。"),
        step("7-1", "7-1", "锤子兄弟密集。用星星或火球。子弹炮台可踩。", "w7"),
        step("7-2", "7-2 水下", "最长水下关之一。章鱼喷弹，绕开或贴边。不要停在喷口正前方。"),
        step("7-3", "7-3", "跳台 + 飞鱼。节奏与 2-3 相同，容错更低。"),
        step("7-4", "7-4 城堡", "迷宫。需要按特定顺序走（上-右-下等）。走错回起点。建议即时存档后试错。"),
        step("8-1", "8-1", "世界 8 开始。敌人几乎铺满。能踩就踩，能跳过就跳过，不要贪硬币。", "w8"),
        step("8-2", "8-2", "炮台和花极多。低速走，看准空隙冲。有隐藏豆茎可拿硬币，非必须。"),
        step("8-3", "8-3", "锤子兄弟连续战。远火球或踩头。过了这关就是最终城堡。"),
        step("8-4", "8-4 最终城堡", "水陆迷宫。正确路线大致：进关向右，下水管，游过水下，再进下一根管，继续向右遇到真库巴。\n\n真库巴：他跳着喷火。站在他落地后的间隙用火球打，或等他跳起从桥的另一侧绕到斧头。碰斧头吊桥断开，库巴掉进岩浆，通关。"),
        step("minus", "Minus 世界与收尾", "部分版本从世界 1-2 的 Warp 房间走进错误的管会进到「减世界」循环，只能重置。正式结局是 8-4 斧头后的公主对话。全 32 关打完即 100% 主线；Warp 跳关不算全收集。"),
    ],
)
en["super-mario-bros"] = wt(
    "Full Super Mario Bros. clear: 8 worlds × 4 stages (32 levels), hidden 1-UPs, warp zones, water stages, and Bowser. Play in order, or skip with the 1-2 / 4-2 warps. Save-state after each flag.",
    [
        step("controls", "Controls and power-ups", "D-pad walks and ducks; up enters pipes. A jumps, B runs. A running jump clears wide pits. Mushrooms grow Small Mario; flowers add fireballs (B). Stars grant brief invincibility. Higher flag grabs score more.\n\nYou start with 3 lives. Hidden bricks hold 1-UPs. Beating 8-4 means hitting the axe that drops Bowser.", "items"),
        step("1-1", "1-1 Grass", "Go right. The first ? block row: coins, then a mushroom from the middle brick while standing on the row. Jump the first pipe and the pit after it with a run-up. Hit the flagpole.\n\nHidden 1-UP: fourth brick after the first pipe. You can jump onto the top of the flag from the high stairs.", "w1"),
        step("1-2", "1-2 Underground (warp)", "Enter the first pipe. Cross the underground, take the upward pipe at the end.\n\nWarp: do not enter the exit pipe. Walk on the bricks above it into the secret room and take the pipe labeled 2, 3, or 4. For a full clear, take the normal exit to 1-3.", "warp"),
        step("1-3", "1-3 Platforms", "Outdoor platforms. Kick red Koopas from behind. Wait for moving lifts. Run before wide gaps."),
        step("1-4", "1-4 Castle", "Time the firebars. Fake bridges collapse — keep moving. The fake Bowser turns into a Goomba/Koopa; then hit the axe."),
        step("2-1", "2-1", "Denser enemies. Wait for Piranhas to duck into pipes. A star in the brick cluster lets you rush.", "w2"),
        step("2-2", "2-2 Water", "B swims faster. Steer around Cheep-Cheeps and plants. Exit through the pipe on the right. You cannot duck underwater."),
        step("2-3", "2-3 Lifts", "One-way collapsing lifts. Short hops. Flying fish come from below."),
        step("2-4", "2-4 Castle", "Faster firebars and elevators. Axe after the fake Bowser."),
        step("3-1", "3-1", "Night grass. Hidden 1-UP near the first bricks. Bait Hammer Bros, then stomp.", "w3"),
        step("3-2", "3-2", "Koopa shells can clear a crowd — do not catch the rebound. More pits than 1-1."),
        step("3-3", "3-3", "High platforms. Falling is a life. Wait for lifts to line up."),
        step("3-4", "3-4 Castle", "Wrong paths loop. Prefer upward-right corridors. Fireballs help in tight halls."),
        step("4-1", "4-1", "More Piranha pipes. Hammer Bros: fire from range or wait for a jump.", "w4"),
        step("4-2", "4-2 Underground (second warp)", "Normal exit goes to 4-3.\n\nWarp: hit the hidden beanstalk brick late in the stage, climb into the clouds, then take pipes to worlds 6–8."),
        step("4-3", "4-3", "See-saws. Stay near the center and make short hops."),
        step("4-4", "4-4 Castle", "Maze. Remember the up/down forks; usually down then right. Axe to world 5."),
        step("5-1", "5-1", "Duck under Bullet Bills. Use cannons as steps.", "w5"),
        step("5-2", "5-2", "Ground then water. Pick one swim line (ceiling or floor) and stick to it."),
        step("5-3", "5-3", "Like 1-3 with winged Koopas. Stomp twice or use fire."),
        step("5-4", "5-4 Castle", "Firebars and lifts. Fireballs melt the fake Bowser."),
        step("6-1", "6-1", "Night. Probe for hidden blocks with your head.", "w6"),
        step("6-2", "6-2", "Pipe maze. Take pipes that lead right. Wait out Piranhas."),
        step("6-3", "6-3", "Sky lifts. One fall is a life. Wait for a full cycle before the next jump."),
        step("6-4", "6-4 Castle", "Looping maze. Bias right at forks."),
        step("7-1", "7-1", "Hammer Bros packs. Star or fire. Cannons are platforms.", "w7"),
        step("7-2", "7-2 Water", "Long underwater. Circle around Bloobers; do not sit in front of their ink."),
        step("7-3", "7-3", "Same rhythm as 2-3, less room for error."),
        step("7-4", "7-4 Castle", "Ordered maze (up-right-down). Wrong turn resets. Save-state and trial-and-error."),
        step("8-1", "8-1", "World 8. Ignore coins. Stomp or skip.", "w8"),
        step("8-2", "8-2", "Cannons and plants. Slow, then sprint the gaps. Beanstalk is optional."),
        step("8-3", "8-3", "Hammer Bros gauntlet. Fire from far or stomp. Last stage before the final castle."),
        step("8-4", "8-4 Final castle", "Land/water maze: right, down a pipe, swim, next pipe, then real Bowser.\n\nBowser jumps and breathes fire. Fireball him on landing, or run under a jump to the axe. The axe drops the bridge — that is the credits."),
        step("minus", "Minus World and ending", "A wrong warp pipe can trap you in the Minus World on some dumps; reset. The real ending is the princess after the 8-4 axe. All 32 stages is a full clear; warps skip worlds."),
    ],
)

# ---------- Contra ----------
zh["contra"] = wt(
    "FC《魂斗罗》完整通关：8 关（丛林、基地1、瀑布、基地2、雪地、能量地带、机库、异形老巢）。默认 3 命；标题画面输入上上下下左右左右 BA 再 Start 为 30 命（美版）。优先捡 S 散弹。每关 Boss 前即时存档。",
    [
        step("prep", "30 命、武器与操作", "标题：上上下下左右左右 B A，再按 Start（30 命）。很多中文卡带无效，改用金手指无限命。方向移动，A 跳，B 射击，下+跳可落下平台。\n\n武器：S 散弹（优先）、M 机枪、L 激光、F 火、R 防护罩、B 炸弹。被打会掉回默认枪，尽量别丢 S。", "weapons"),
        step("s1", "第 1 关 丛林", "向右推进。蹲着躲平弹。飞兵从两侧跳入，边走边打。中段有水池，可跳到对岸或游。枪械盒打开会跳道具，先拿 S。\n\n关底炮台：左右两个地面炮，打完再打中间高台炮。炮口朝你时躲开，张开间隙打。", "s1"),
        step("s2", "第 2 关 基地内部 1", "室内自动卷轴。打闪的感应器/核心，打完门才开。地板会移动，不要站死。垂直通道先清头顶再跳。\n\nBoss 是墙上的核心：等它张开打内部，躲避环形弹。散弹很快能磨死。", "s2"),
        step("s3", "第 3 关 瀑布", "向上爬。优先站稳平台再射击。两侧会出机枪兵。中间有会掉的平台，不要站太久。\n\nBoss 在瀑布顶：左右移动的炮台/怪，站两侧高台打，躲开向下的弹。", "s3"),
        step("s4", "第 4 关 基地 2", "又是室内。传感器布局更绕，有的要先下后上。火焰喷口看节奏过。\n\nBoss 类似关 2 但弹幕更密。贴边输出，张开再打。", "s4"),
        step("s5", "第 5 关 雪地", "向右。雪地滑，不要冲刺过头掉坑。雪人兵和炮台交替。空中有飞机丢弹，边走边抬头打。\n\n关底是多炮口的碉堡，先打地面口再打上方。用散弹覆盖。", "s5"),
        step("s6", "第 6 关 能量地带", "机械平台，有斜坡和电球。电球绕圈，从空隙钻。不要贪打小兵被电球撞。\n\nBoss 是大型机械核心，弱点在张开时的中心。躲两侧导弹。", "s6"),
        step("s7", "第 7 关 机库", "飞机残骸和输送带。输送带会把你送进弹幕，逆着走。空中运输机要优先打掉。\n\nBoss 多为双核心或移动炮台，清小兵再集火。", "s7"),
        step("s8", "第 8 关 异形老巢", "最后一关。通道窄，异形从墙上探出。用散弹清前路。中段有会关的嘴形门，打完核心再过。\n\n最终 Boss：巨大异形心脏/头。第一阶段打两侧器官，第二阶段打中心。弹幕呈环形，绕走。打完出结局。没有二周目强制；美版通关结束。", "s8"),
        step("clear", "通关路线小结", "顺序：丛林 → 基地1 → 瀑布 → 基地2 → 雪地 → 能量地带 → 机库 → 老巢。全程保住 S。30 命或金手指只为练关，熟悉弹幕后可以关作弊打真结局。双人时 2P 从另一侧清，避免抢同一道具。"),
    ],
)
en["contra"] = wt(
    "Full Contra (NES) clear: 8 stages. The US title code Up Up Down Down Left Right Left Right B A Start gives 30 lives. Grab S (spread) first. Save-state before bosses.",
    [
        step("prep", "30 lives, weapons, controls", "Title screen: ↑↑↓↓←→←→BA then Start for 30 lives. Many FC dumps skip it — use Game Genie instead. A jump, B shoot, down+jump to drop through.\n\nWeapons: S spread (best), M machine gun, L laser, F fire, R barrier, B bombs. A hit drops you back to the default gun.", "weapons"),
        step("s1", "Stage 1 Jungle", "Push right. Crouch under shots. Shoot flying soldiers as they leap in. Take S from the first flying weapon bay.\n\nEnd turrets: ground guns first, then the raised one. Shoot when the barrel faces away.", "s1"),
        step("s2", "Stage 2 Base 1", "Auto-scroll indoors. Destroy flashing sensors to open doors. Moving floors — keep walking. Clear above you before a jump.\n\nBoss: the wall core. Shoot when it opens; dodge the ring. Spread melts it.", "s2"),
        step("s3", "Stage 3 Waterfall", "Climb. Plant your feet, then shoot. Side gunners. Falling platforms.\n\nBoss at the top: turrets on the sides. Stand on the side ledges.", "s3"),
        step("s4", "Stage 4 Base 2", "Indoor sensors with extra vertical loops. Time flame jets.\n\nBoss like stage 2, denser bullets. Hug a wall and shoot openings.", "s4"),
        step("s5", "Stage 5 Snowfield", "Snow slides — do not over-run pits. Alternate snowmen and turrets. Planes overhead.\n\nBunker boss: lower ports, then upper. Spread covers the face.", "s5"),
        step("s6", "Stage 6 Energy Zone", "Slopes and orbiting energy balls. Thread the gaps. Do not tunnel-vision on soldiers.\n\nBoss: mechanical core. Weak when open. Missiles from the sides.", "s6"),
        step("s7", "Stage 7 Hangar", "Conveyor belts push you into fire. Walk against them. Priority: incoming transports.\n\nBoss: dual cores or a moving turret. Clear adds, then dump spread.", "s7"),
        step("s8", "Stage 8 Alien's Lair", "Tight halls, aliens from walls. Spread the path. Mouth-doors need a core destroyed first.\n\nFinal boss: organs on the sides, then the heart. Circle the ring shots. Credits after it dies.", "s8"),
        step("clear", "Clear route", "Jungle → Base 1 → Waterfall → Base 2 → Snow → Energy → Hangar → Lair. Keep S. 30 lives is for learning; turn cheats off for a clean clear."),
    ],
)

# I'll fill remaining games in the same structure with complete chapter lists.
def add(gid: str, z_intro: str, z_steps: list, e_intro: str, e_steps: list) -> None:
    zh[gid] = wt(z_intro, z_steps)
    en[gid] = wt(e_intro, e_steps)


add("battle-city",
    "FC《坦克大战》（90 坦克）通关：守住底部老鹰，消灭每关全部敌坦克。默认 3 命。红坦克被打掉会掉道具。35 关循环，打完一轮即通关展示。以下按规则 + 关卡阶段写完整流程。",
    [
        step("rules", "规则与老鹰", "你在地图下方。老鹰在底部砖墙后，被打穿即失败。炮弹可拆砖、砌砖（对砖再打会拆）。钢砖要星星强化后的炮弹才能打。树木挡视线不挡弹。冰面会滑。水面不能过。\n\n敌坦克从上方三口刷出。消灭本关额度（通常 20 辆）即过关。被打掉剩命-1，从己方出生点重出。", "base"),
        step("items", "道具", "闪的坦克被打掉出道具：星星（炮弹升级，三级可打钢）、手榴弹（清屏）、铲子（老鹰墙变钢一段时间）、坦克（+1 命）、时钟（定住敌军）、钢盔（短无敌）、炸弹同手榴弹。\n\n优先：铲子（守家）、星星（后期）、手榴弹（危急）。不要在老鹰墙边乱开炮给自己挖洞。"),
        step("early", "第 1–10 关", "地图砖多、钢少。开局立刻把老鹰上方补成完整砖，不要留直射孔。一人守家一人清场（双人）。单人则清完一波再回家补墙。\n\n红坦克出现就集火拿星星。第 5 关后开始有冰，少在冰上对射。", "early"),
        step("mid", "第 11–20 关", "钢砖和树更多。三级炮才能拆钢。敌人会绕后打老鹰，不要把家门口打成通道。\n\n时钟道具在被围时再吃。铲子期间去对面清场。"),
        step("late", "第 21–35 关", "敌坦克更快、更厚。出生点会被堵，预留回家路线。有的关几乎全钢，必须星星。\n\n35 关打完通常回第 1 关或出结束画面（视 ROM）。算通关。"),
        step("fail", "常见失败", "自己把老鹰墙打穿；去对面贪杀被两辆红坦克绕后；冰上刹不住撞钢。被打穿前用手榴弹。通关标准：老鹰始终在、打完 35 关额度。"),
    ],
    "Battle City / 90 Tank: protect the eagle, clear each stage's tanks. Flash tanks drop power-ups. 35 stages is a loop/clear depending on the dump.",
    [
        step("rules", "Rules and the eagle", "You spawn at the bottom. If the eagle is shot, you lose. Shots break and rebuild brick. Steel needs a starred tank. Trees hide, ice slides, water blocks.\n\nEnemies spawn from the top. Clear the quota (usually 20) to finish the stage.", "base"),
        step("items", "Power-ups", "Star (shot power, steel at level 3), grenade (screen clear), shovel (steel eagle wall), tank (life), clock (freeze), helmet (brief armor). Shovel and star first. Do not tunnel into your own base."),
        step("early", "Stages 1–10", "Brick-heavy. Patch the eagle wall immediately. One player guards, one hunts. Focus flashing tanks for stars.", "early"),
        step("mid", "Stages 11–20", "More steel and trees. Enemies flank the eagle. Eat the clock only when surrounded."),
        step("late", "Stages 21–35", "Faster, thicker tanks. Leave a path home. Some maps are almost all steel — you need stars. Stage 35 is the clear."),
        step("fail", "How runs die", "You open the eagle wall yourself; two reds sneak home while you hunt; ice slides you into steel. Grenade before a breach."),
    ],
)

add("adventure-island",
    "FC《高桥名人之冒险岛》通关：8 大关，每大关多小关 + Boss。生命是头顶的火苗计时，吃水果续火。火灭即死。滑板、锤子从蛋里来。按世界顺序打完 8 号 Boss 即通关。",
    [
        step("rules", "火苗、水果、蛋", "火苗空了掉命。见到水果就吃，不要为了赶路全空。打蛋：锤子（平射，蹲射地面怪）、滑板（加速飞坑，被打会掉）、蜜蜂（躲开）。字母彩蛋凑齐可进奖励，非必须。", "items"),
        step("w1", "世界 1", "平地教学。保持锤子。第一关 Boss 是会扔石头的岩怪：中距离跳石，张开再砸。不要骑滑板进 Boss 房（不好下车）。", "w1"),
        step("w2", "世界 2", "更多坑和花。滑板适合这一世界的宽坑。Boss 类似，弹道更快。存档在 Boss 门。"),
        step("w3", "世界 3", "夜间/洞穴。能见度差，水果仍要吃。蜜蜂蛋多，跳过。Boss 有横向冲撞，跳过再打。"),
        step("w4", "世界 4", "冰或雨。滑。助跑距离预留长一点。Boss 两阶段，先小怪再本体。"),
        step("w5", "世界 5", "云和移动平台。掉下去掉命。锤子留着打空中蛋。"),
        step("w6", "世界 6", "敌人带投掷。蹲射。火苗紧，这一世界水果密度尚可，仍不要连跳空过。"),
        step("w7", "世界 7", "长关。中段缺水果时往回找。Boss 前强制存档。"),
        step("w8", "世界 8 与结局", "最终世界。陷阱最密。最终 Boss 按前几关模式加强：跳弹、打弱点、不要贪刀。打完出结束画面，通关。", "w8"),
    ],
    "Adventure Island: 8 worlds. The flame timer is your health — eat fruit. Eggs give hammer, skateboard, or bees. Beat world 8's boss to clear.",
    [
        step("rules", "Flame, fruit, eggs", "Empty flame = death. Eat fruit. Eggs: hammer (shoot, duck-shoot), skateboard (pits; a hit knocks it off), bees (avoid). Letter eggs are optional.", "items"),
        step("w1", "World 1", "Tutorial flats. Keep the hammer. Rock boss: mid-range, jump stones, hit when open. Do not skate into the boss room.", "w1"),
        step("w2", "World 2", "Wider pits — skateboard helps. Faster boss shots. Save at the door."),
        step("w3", "World 3", "Caves. Still eat. Bee eggs: skip. Boss charges; jump, then hit."),
        step("w4", "World 4", "Ice/rain. Leave more runway. Two-phase boss."),
        step("w5", "World 5", "Clouds. Falling is a life. Hammer air eggs."),
        step("w6", "World 6", "Throwing enemies. Duck-throw. Do not skip fruit."),
        step("w7", "World 7", "Long. Backtrack if the flame is low. Save-state before the boss."),
        step("w8", "World 8 and ending", "Tightest traps. Final boss is a harder version of earlier patterns. Credits after it dies.", "w8"),
    ],
)

add("tetris-nes",
    "NES《俄罗斯方块》通关：A-Type 是无尽（目标是撑到尽量高等级）；B-Type 是 25 行，选高难度打完即「通关」看火箭。下面按模式写完整流程。",
    [
        step("modes", "A-Type 与 B-Type", "标题选 Type-A 无尽、Type-B 25 行。B-Type 还选关卡高度（垃圾行）和等级。想看结局动画打 B-Type 9-5。想练堆叠打 A-Type。", "modes"),
        step("stack", "堆叠与井", "10 列。右侧留 1 列给长条（I），其余 9 列尽量平。乱了先消 1、2 行清坑，不要死等 Tetris。左右点按微调，按住才滑。", "stack"),
        step("a-type", "A-Type 流程", "1–9 级重力尚可，把井养平。10 级后软降要早。死亡条件是方块卡住顶端。没有官方「通关」，纪录是等级和分数。金手指只建议练习。"),
        step("b-type", "B-Type 通关（9-5）", "选 Level 9、Height 5。开局顶部已有垃圾。先挖出井再等 I 消四。25 行满出火箭/飞机动画，即通关。低 Height 是热身。"),
        step("clear", "结束条件", "A-Type：顶出即结束。B-Type：25 行。双人是对战，先顶死对方。通关收藏以 B-Type 9-5 为准。"),
    ],
    "NES Tetris: A-Type is endless. B-Type 25 lines is the 'clear' (9-5 for the rocket). Keep a well for the I-piece.",
    [
        step("modes", "A-Type vs B-Type", "A-Type endless. B-Type 25 lines with a starting height. 9-5 is the usual credits goal.", "modes"),
        step("stack", "Stacking", "10 columns. Keep a 1-wide well on the right for I. Burn singles to fix holes.", "stack"),
        step("a-type", "A-Type", "Levels 1–9: flatten. 10+: soft drop earlier. Top-out ends the run. No official clear."),
        step("b-type", "B-Type 9-5 clear", "Level 9 height 5. Dig a well, Tetris the garbage, finish 25 lines for the rocket."),
        step("clear", "End states", "A-Type: top-out. B-Type: 25 lines. Versus: top the other player out."),
    ],
)

add("double-dragon",
    "FC《双截龙》通关：4 个 Mission。拳踢抓投，捡棒/刀/鞭。打完最后房间的机甲/最终 Boss 救 Marian 即通关。单人即可，双人会抢经验（视版本）。",
    [
        step("moves", "拳、踢、抓、武器", "近身连拳再踢。跳踢清门口。被抓用肘击挣脱，别乱跳掉坑。地上武器捡起来，挨打可能掉。能量条空了掉命。", "moves"),
        step("m1", "Mission 1 街道", "向右清小兵。先拳后踢，门口跳踢。捡棒。进巷子注意从两头夹击的人。关底小 Boss 用跳踢 + 连拳。", "m1"),
        step("m2", "Mission 2 工厂/楼梯", "先清屏再爬楼梯，否则背后刷人。传送带和坑。武器留到楼梯顶的持刀敌人。"),
        step("m3", "Mission 3", "室外到室内。会用枪的敌人要冲过去近战，不要远距离硬吃子弹。中 Boss 有抓投，被抓立刻挣脱。"),
        step("m4", "Mission 4 与结局", "最终据点。连续房间，每房清完再进。留一件武器给最后一战。最终 Boss（机甲/威利）走位躲冲撞，近身连打。打完救出 Marian，通关。", "m4"),
    ],
    "Double Dragon NES: 4 missions. Punch, kick, grab, weapons. Beat the last boss and rescue Marian.",
    [
        step("moves", "Moves and weapons", "Punch then kick. Jump-kick doors. Elbow out of grabs. Weapons drop if you get hit.", "moves"),
        step("m1", "Mission 1 Streets", "Right. Bat from the first alley. Jump-kick the door pack. Small boss: jump-kick plus punches.", "m1"),
        step("m2", "Mission 2 Stairs", "Clear the screen before you climb. Conveyor pits. Keep a weapon for the knife enemy at the top."),
        step("m3", "Mission 3", "Gunners: rush to melee. Mid-boss grabs — mash out."),
        step("m4", "Mission 4 ending", "Room by room. Save a weapon for the last fight. Dodge charges, combo, rescue Marian.", "m4"),
    ],
)

add("super-mario-world",
    "SFC《超级马里奥世界》完整通关主线：耀西岛 → 甜甜圈平原 → 香草圆顶 → 双桥 → 森林 → 巧克力岛 → 谷地 → 库巴城堡。另有开关宫殿和星星之路（特殊世界，非打库巴所必须）。下面按主线世界写完。",
    [
        step("yoshi", "耀西岛（世界 1）", "1 号关拿耀西（能吃怪和浆果，被刺则掉）。打完 1-2 的钥匙关可进黄开关（虚线砖变黄砖，强烈建议）。正常出口推地图到岛上城堡，打完出门去甜甜圈。", "yoshi"),
        step("donut", "甜甜圈平原", "主线向右打关。秘密出口（钥匙孔）开红开关和星星之路入口。主线只需打到甜甜圈城堡。斗篷在这一带开始出现：平地助跑按住跳可滑翔。", "donut"),
        step("vanilla", "香草圆顶", "洞穴和鬼屋。鬼屋找正确的门（看提示块）。城堡后地图接到双桥。"),
        step("bridges", "奶油桥 / 双桥", "两条桥选一条主线即可到森林。上桥有秘密，下桥更直接。城堡是库巴的一个孩子，打法是跳到其台上。"),
        step("forest", "森林迷宫", "地图会绕。跟着关卡出口的箭头走，不要在迷宫里空转。蓝开关在这一带的秘密关，建议打。"),
        step("chocolate", "巧克力岛", "关卡出口会改地图形状。按「新出现的路」走。城堡后再进谷地。"),
        step("valley", "谷地到库巴", "谷地鬼屋和城堡。打完谷地城堡，地图出现库巴的大门。进门前建议满状态（斗篷 + 耀西可选）。", "valley"),
        step("bowser", "库巴战与结局", "小丑飞船。第一阶段打飞船上的机械，第二阶段库巴在小丑机里：等它张开，从下方顶。打完出结局。星星之路/特殊世界是 100% 内容，不是主线必须。", "bowser"),
    ],
    "Super Mario World main line: Yoshi's Island → Donut → Vanilla → Twin Bridges → Forest → Chocolate → Valley → Bowser. Switch palaces and Star Road are extra.",
    [
        step("yoshi", "Yoshi's Island", "Grab Yoshi in 1-1/1-2. Yellow switch palace from a key exit — do it. Castle, then Donut.", "yoshi"),
        step("donut", "Donut Plains", "Main exits toward the castle. Keyholes open red switch and Star Road. Cape: run, hold jump, glide.", "donut"),
        step("vanilla", "Vanilla Dome", "Caves and ghost houses. Follow the hint blocks to the real door."),
        step("bridges", "Twin Bridges", "Either bridge reaches the Forest castle. Hit the Koopaling on the platform."),
        step("forest", "Forest of Illusion", "Follow exit arrows. Blue switch is here — recommended."),
        step("chocolate", "Chocolate Island", "Exits reshape the map. Take newly opened paths."),
        step("valley", "Valley to Bowser", "Ghost house then castle. The gate to Bowser opens after. Cape recommended.", "valley"),
        step("bowser", "Bowser and ending", "Clown car. Hit the mech, then hit Bowser from below when the car opens. Star World is post-game.", "bowser"),
    ],
)

add("zelda-alttp",
    "SFC《塞尔达传说 众神的三角力量》完整通关：光世界 3 神殿 + 大师剑 + 阿加尼姆，再打暗世界 7 神殿，最后盖农塔和盖农。按神殿顺序走即可，不跳剧情旗标。",
    [
        step("open", "开场雨夜与海拉尔城", "醒来，叔叔留剑和盾。进海拉尔城从下水道救塞尔达，送到圣堂。找萨哈斯拉拉，开始东神殿。", "open"),
        step("east", "东神殿（弓）", "神殿里拿弓。打阿莫斯骑士：不停走，箭射静止的石像。徽章 1。", "east"),
        step("desert", "沙漠神殿（力量手套）", "南沙漠。用书读碑进门。神殿拿力量手套。Boss 是蠕虫，打段。徽章 2。"),
        step("hera", "赫拉之塔（月珠）", "死亡山。手套搬石头上山。塔里拿月珠。Boss 软体，用剑或月亮。徽章 3。"),
        step("master", "大师剑与阿加尼姆", "三徽章开迷失森林的大师剑。回城堡上层打阿加尼姆：挡弹反弹。打完掉进暗世界。", "master"),
        step("dark1", "暗世界 1–3 神殿", "第一神殿（黑暗）拿锤子。沼泽神殿要钩爪和翻转世界。骷髅森林要灯火。每座打完一颗水晶。"),
        step("dark2", "暗世界 4–7 神殿", "盗贼神殿（盲）、冰神殿（火杖）、悲惨沼泽（炸弹+沙罗）、龟岩（镜子+铁锤）。七颗水晶齐。"),
        step("ganon", "盖农塔与盖农", "金字塔上的塔。用银箭。顶上再打阿加尼姆，然后盖农：打到黑暗里用银箭。打完通关。", "ganon"),
    ],
    "A Link to the Past full clear: 3 light-world pendants, Master Sword, Agahnim, 7 dark crystals, Ganon.",
    [
        step("open", "Rain and the castle", "Sword from uncle, Zelda in the sewers, sanctuary, Sahasrahla, Eastern Palace.", "open"),
        step("east", "Eastern Palace (bow)", "Get the bow. Armos Knights: keep moving, arrows. Pendant 1.", "east"),
        step("desert", "Desert Palace (gloves)", "Book on the plaque. Power gloves. Lanmolas. Pendant 2."),
        step("hera", "Tower of Hera (moon pearl)", "Death Mountain with gloves. Moon pearl. Moldorm. Pendant 3."),
        step("master", "Master Sword and Agahnim", "Lost Woods. Castle tower. Reflect Agahnim's shots. Fall to the Dark World.", "master"),
        step("dark1", "Dark palaces 1–3", "Darkness (hammer), Swamp (hookshot), Skull Woods (fire). One crystal each."),
        step("dark2", "Dark palaces 4–7", "Thieves, Ice, Misery Mire, Turtle Rock. Seven crystals."),
        step("ganon", "Ganon's Tower and Ganon", "Silver arrows. Agahnim again, then Ganon in the dark with silvers. Credits.", "ganon"),
    ],
)

add("street-fighter-ii",
    "SFC《街头霸王 II》通关：街机模式连打一串对手，最后打到 M. Bison（视版本还有 Sagat 等）。选一个角色练会波动/升龙即可通关电脑。",
    [
        step("char", "选人与键位", "波动角色（隆、肯）最好上手。模拟器里把拳脚轻重分开。电脑用默认键。手机建议手柄。", "char"),
        step("moves", "波动、升龙、防御", "波动：下、下前、前、拳。升龙：前、下、下前、拳（防空）。挡住再反击。不要无脑对波。"),
        step("arcade", "街机模式流程", "开 Arcade。每赢一场加一个对手。中期会有车、桶奖励关：蹲重拳砸。输了用币/命继续。", "arcade"),
        step("boss", "四天王与通关", "Balrog、Vega、Sagat、Bison。Sagat 的大波要跳过或波对波。Bison 的滑步用升龙或跳。打完 Bison 出结局，通关。", "boss"),
    ],
    "Street Fighter II SNES arcade mode: a gauntlet ending in M. Bison. Hadouken + shoryuken is enough for the CPU.",
    [
        step("char", "Character and buttons", "Ryu/Ken are the easy clear. Map punch/kick strengths. A pad beats touch.", "char"),
        step("moves", "Fireball, DP, block", "Hadouken: d, df, f, punch. Shoryuken anti-air. Block, then punish."),
        step("arcade", "Arcade flow", "Win, next fighter. Bonus car/barrels: crouch fierce. Continues on a loss.", "arcade"),
        step("boss", "Bosses and ending", "Balrog, Vega, Sagat, Bison. Jump Sagat's grand fireball. DP Bison's scissor kick. Credits after Bison.", "boss"),
    ],
)

add("pokemon-red",
    "GB《口袋妖怪 红》完整通关：8 枚徽章 + 四天王 + 冠军。主线不需要图鉴 151。按城镇顺序走即可。",
    [
        step("pallet", "真新镇与御三家", "选妙蛙种子最好打小刚；杰尼龟均衡；小火龙前期最亏。给大木送包裹，拿图鉴。1 号道路练到 8 级再进常青森林。", "pallet"),
        step("brock", "常青森林到小刚", "森林里抓皮卡丘/独角虫。尼比市买伤药。小刚用岩石：水/草打点。小火龙就练火花到 12+ 再打。徽章 1。", "brock"),
        step("misty", "月见山到小霞", "3 号路、月见山（化石可选）。华蓝市。小霞水系：电/草。尼多王/皮卡丘很好用。徽章 2。"),
        step("surge", "圣安努号到马志士", "金黄市上船拿居合斩。马志士垃圾桶：第一个随机，第二个在邻格。电系怕地面。徽章 3。"),
        step("erika", "地鼠山洞到莉佳", "岩隧道到枯叶。莉佳草系：火/飞/毒。游戏城可抓急冻鸟相关道具线。徽章 4。"),
        step("koga", "金黄塔到阿桔", "先拿眼镜去塔救精灵（冲浪前）。红莲镇冲浪。浅红市阿桔毒系：超能/地面。狩猎区抓缺的 HM 宠。徽章 5。"),
        step("rest", "娜姿、夏伯、坂木", "金黄道馆娜姿超能（恶在初代是普通，用虫/幽灵/恶不可靠，用恶食兽或高速物理）。红莲夏伯火系（水/岩）。常青坂木地面（水/草）。徽章 6–8。"),
        step("e4", "冠军之路到四天王", "冠军之路推石头。四天王：科拿冰、希巴斗、菊子幽灵、阿渡龙。龙怕冰。每人打完回血。", "e4"),
        step("champ", "冠军绿与通关", "绿用你没选的御三家进化型。克制打。打完进殿堂，通关。之后可抓三神鸟和超梦（必须闪+飞）。", "champ"),
    ],
    "Pokémon Red full story: 8 badges, Elite Four, Champion. Dex 151 is optional.",
    [
        step("pallet", "Pallet and starter", "Bulbasaur eases Brock; Squirtle is even; Charmander is the hard early game. Parcel for Oak. Grind Route 1 to ~8.", "pallet"),
        step("brock", "Forest to Brock", "Pikachu/Weedle in the forest. Water/Grass for Brock. Charmander needs Ember and extra levels. Badge 1.", "brock"),
        step("misty", "Mt. Moon to Misty", "Fossil optional. Electric/Grass for Misty. Badge 2."),
        step("surge", "SS Anne to Surge", "Cut from the ship. Trash cans: first random, second adjacent. Ground types. Badge 3."),
        step("erika", "Rock Tunnel to Erika", "Fire/Flying/Poison. Badge 4."),
        step("koga", "Tower to Koga", "Silph Scope, then Fuchsia. Psychic/Ground. Safari for HM slaves. Badge 5."),
        step("rest", "Sabrina, Blaine, Giovanni", "Saffron psychic, Cinnabar fire, Viridian ground. Badges 6–8."),
        step("e4", "Victory Road and Elite Four", "Lorelei ice, Bruno fighting, Agatha ghost, Lance dragon (ice). Heal between.", "e4"),
        step("champ", "Champion Blue", "He uses the starter that beats yours. Hall of Fame is the clear. Birds and Mewtwo are post-game.", "champ"),
    ],
)

add("tetris-gb",
    "GB《俄罗斯方块》通关：A-Type 无尽；B-Type 25 行。B-Type 高难度打完出火箭，算通关。",
    [
        step("modes", "A / B 型", "A 型无尽练手。B 型选等级和高度，25 行结束。想通关打 B 型高等级。", "modes"),
        step("play", "堆法", "与 NES 相同：右侧留井，平堆，乱了先消。GB 前期重力更慢，软降到位。", "play"),
        step("clear", "B-Type 通关", "Level 9 Height 5 是常见目标。打完 25 行出动画。A 型顶出即结束。"),
    ],
    "GB Tetris: A-Type endless, B-Type 25 lines. 9-5 is the usual clear.",
    [
        step("modes", "A / B", "A-Type to learn. B-Type for a finish line.", "modes"),
        step("play", "Stack", "Right well, keep it flat. Soft drop on GB's gentle gravity.", "play"),
        step("clear", "B-Type clear", "9-5, 25 lines, rockets. A-Type ends on top-out."),
    ],
)

add("kirby-dream-land",
    "GB《星之卡比 梦之泉物语》通关：5 关（绿绿草原、城堡 Lololo、浮游岛屿、冰山、帝帝帝之城）。吸吐、漂浮。打完帝帝帝即通关。很短。",
    [
        step("moves", "吸、吐、漂", "B 吸，再 B 吐星星。按住 A 漂浮，几乎所有坑都能飞过。初代不能复制能力。", "moves"),
        step("g1", "关 1 绿绿草原", "教学。Boss 风语大树：吹风时漂，掉苹果就吸回来吐。", "g1"),
        step("g2", "关 2 城堡", "门会绕。打完房间从原门出。Boss Lololo & Lalala：躲箱子，吸箱子反击。"),
        step("g3", "关 3 浮岛", "更多漂。Boss 是云怪，吸弹吐回。"),
        step("g4", "关 4 冰山", "冰滑，用漂比走稳。Boss 类似投掷。"),
        step("g5", "关 5 帝帝帝", "最终城堡。帝帝帝挥锤：漂过挥击，吸地上的星吐回去。打完通关。", "g5"),
    ],
    "Kirby's Dream Land: 5 stages. Inhale, spit, float. Dedede is the clear.",
    [
        step("moves", "Inhale and float", "B inhale/spit. Hold A to float. No copy in this first game.", "moves"),
        step("g1", "Green Greens", "Whispy: float the wind, spit apples.", "g1"),
        step("g2", "Castle Lololo", "Doors loop. Spit boxes at Lololo & Lalala."),
        step("g3", "Float Islands", "More hovering. Spit projectiles at the cloud boss."),
        step("g4", "Bubbly Clouds / ice", "Float instead of walking ice. Throw-boss."),
        step("g5", "Mt. Dedede", "Float over the hammer, spit stars back. Credits.", "g5"),
    ],
)

add("pokemon-gold",
    "GBC《口袋妖怪 金》完整通关：城都 8 馆 + 四天王 + 冠军。关都是后期。按馆顺序走，不要用金手指跳徽章，否则剧情传送会卡。",
    [
        step("start", "若叶镇到阿笔（徽章 1）", "选御三家。帮空木送蛋，29 号到桔梗买球。阿笔飞行馆用电/岩石。徽章 1。", "start"),
        step("bugsy", "阿菊（徽章 2）", "桐树林拿居合斩。阿菊虫系：火/飞。喇叭芽之塔可练级。"),
        step("whitney", "小茜（徽章 3）", "金黄市。大奶罐连环很痛：上状态或格斗系，不要硬抗。商店补伤药。"),
        step("morty", "阿四（徽章 4）", "缘朱市幽灵馆。普通/恶在初代金里用法不同，用鬼系或恶食兽。塔的剧情跟主线。"),
        step("chuck", "阿杏（徽章 5）", "湛蓝市格斗馆。飞/超能。冲浪之后城都西边能走。"),
        step("jasmine", "阿蜜（徽章 6）", "浅葱市钢馆。火/格斗。灯塔剧情先做完才能打馆。"),
        step("pryce", "柳伯（徽章 7）", "满金市冰馆。火/格斗/岩。火箭队基地穿插在这一段，跟地图走。"),
        step("clair", "阿渡（徽章 8）", "烟墨市龙馆。冰系最好。龙穴要先通。徽章 8 后去白银山。"),
        step("e4", "四天王、冠军与关都", "白银山四天王后冠军。殿堂即主线通关。之后可去关都打第二套馆和红。", "e4"),
    ],
    "Pokémon Gold full Johto clear: 8 gyms, Elite Four, Champion. Kanto is post-game. Do not skip gym flags.",
    [
        step("start", "New Bark to Falkner (badge 1)", "Elm's egg errand. Falkner flying: electric/rock.", "start"),
        step("bugsy", "Bugsy (badge 2)", "Ilex Cut. Fire/Flying. Sprout Tower for EXP."),
        step("whitney", "Whitney (badge 3)", "Miltank rollout: status or fighting. Do not tank it."),
        step("morty", "Morty (badge 4)", "Ecruteak ghost gym. Follow the tower story."),
        step("chuck", "Chuck (badge 5)", "Cianwood fighting. Flying/psychic. Surf opens west Johto."),
        step("jasmine", "Jasmine (badge 6)", "Olivine steel. Fire/fighting. Finish the lighthouse first."),
        step("pryce", "Pryce (badge 7)", "Mahogany ice. Rockets hideout is on this stretch."),
        step("clair", "Clair (badge 8)", "Blackthorn dragon. Ice types. Dragon's Den first."),
        step("e4", "E4, Champion, Kanto", "Mt. Silver E4 then Champion. Hall of Fame is the story clear. Kanto after.", "e4"),
    ],
)

add("pokemon-emerald",
    "GBA《口袋妖怪 绿宝石》完整通关：丰缘 8 馆 + 冠军。开拓区可选。天气队剧情必须跟主线，不要穿墙。",
    [
        step("start", "未白镇到杜娟（徽章 1）", "选御三家。101 到古辰拿跑步鞋。紫堇岩石馆：水/草。徽章 1。", "start"),
        step("brawly", "藤树（徽章 2）", "凯那市格斗馆。飞行系。海边的洞穴可练级。"),
        step("wattson", "铁旋（徽章 3）", "橙华市电系。地面招最稳。天气研究所剧情在这一段。"),
        step("flannery", "亚莎（徽章 4）", "釜炎市火系。水/地面。温泉后打馆。"),
        step("norman", "千里（徽章 5）", "橙华父亲的普通馆。格斗系。主线旗标，不要跳。"),
        step("winona", "娜琪（徽章 6）", "茵郁市飞行馆。电/冰。需要冲浪和飞。"),
        step("tate", "小枫小南（徽章 7）", "琉璃市双人超能馆。恶/鬼。潜水剧情之后。"),
        step("juan", "亚当（徽章 8）", "彩幽市水馆。电/草。然后冠军之路。"),
        step("champ", "冠军与开拓区", "冠军战。殿堂即主线通关。开拓区是后期，不是必须。", "champ"),
    ],
    "Pokémon Emerald full Hoenn clear: 8 gyms and the Champion. Follow Aqua/Magma. Frontier is optional.",
    [
        step("start", "Littleroot to Roxanne (badge 1)", "Running Shoes. Water/Grass for Rock. Badge 1.", "start"),
        step("brawly", "Brawly (badge 2)", "Dewford fighting. Flying types."),
        step("wattson", "Wattson (badge 3)", "Mauville electric. Ground moves. Weather institute story."),
        step("flannery", "Flannery (badge 4)", "Lavaridge fire. Water/Ground."),
        step("norman", "Norman (badge 5)", "Petalburg normal. Fighting. Story flag — do not skip."),
        step("winona", "Winona (badge 6)", "Fortree flying. Electric/Ice. Surf and Fly."),
        step("tate", "Tate & Liza (badge 7)", "Mossdeep dual psychic. Dark/Ghost after Dive."),
        step("juan", "Juan (badge 8)", "Sootopolis water. Electric/Grass. Then Victory Road."),
        step("champ", "Champion and Frontier", "Hall of Fame is the clear. Battle Frontier is post-game.", "champ"),
    ],
)

add("mario-kart-super-circuit",
    "GBA《马里奥赛车 Advance》通关：蘑菇杯 → 花朵杯 → 星星杯 → 特殊杯 → Extra。150cc 金杯是完整通关目标。",
    [
        step("drive", "漂移与道具", "按住加速转向长漂出 mini-turbo。绿壳直线，香蕉弯道，蘑菇跳台前用。有手柄把 R 映射到肩键。", "drive"),
        step("mushroom", "蘑菇杯", "50cc 热身，100cc 认真打。前三名晋级。注意第一场的急弯，不要蘑菇撞墙。"),
        step("flower", "花朵杯", "开始有跳台。蘑菇留到空中。100cc 金杯后开更高杯。"),
        step("star", "星星杯", "对手更攻击性。被绿壳打了立刻吃蘑菇追。"),
        step("special", "特殊杯与彩虹", "彩虹容易掉，进关前即时存档。掉下去会丢名次。", "cups"),
        step("extra", "Extra 与 150cc", "解锁 Extra（含超任赛道）。150cc 全金杯算完整通关。计时赛关金手指。"),
    ],
    "Mario Kart Super Circuit: Mushroom → Flower → Star → Special → Extra. 150cc gold is the clear.",
    [
        step("drive", "Drift and items", "Hold a drift for mini-turbo. Shells on straights, bananas on corners, mushrooms before jumps.", "drive"),
        step("mushroom", "Mushroom Cup", "50cc to learn, 100cc to rank. Don't mushroom into walls."),
        step("flower", "Flower Cup", "Jumps start here. Save mushrooms for air."),
        step("star", "Star Cup", "Rivals attack more. Mushroom after a shell hit."),
        step("special", "Special Cup and Rainbow", "Save-state before Rainbow. Falling costs places.", "cups"),
        step("extra", "Extra and 150cc", "Unlock Extra (SNES tracks). 150cc gold cups is the full clear. Cheats off for ghosts."),
    ],
)

add("minish-cap",
    "GBA《缩小帽》完整通关：四个元素神殿 + 风之宫殿 + 瓦吉。缩小、祈愿石、四剑。",
    [
        step("south", "海拉尔南部到深林", "见艾库罗，拿剑，迷你村，深林神殿拿风元素（吸筒）。合一些祈愿石开路。", "south"),
        step("fire", "炎之洞窟", "火元素。炸弹和挖。Boss 用吸筒/剑按弱点。"),
        step("water", "冰神殿", "水元素。翻转与冰块。拿鳍之后地图大开。"),
        step("wind", "风之宫殿到瓦吉", "第四元素后开风之宫殿。最后用四剑分身打瓦吉。打完通关。", "vaati"),
    ],
    "Minish Cap: four elements, Palace of Winds, Vaati. Shrink, Kinstones, Four Sword.",
    [
        step("south", "South Hyrule to Deepwood", "Ezlo, smith's sword, Minish Village, Gust Jar / earth element. Fuse Kinstones.", "south"),
        step("fire", "Cave of Flames", "Fire element. Bombs and digging."),
        step("water", "Temple of Droplets", "Water element. Flippers open the map."),
        step("wind", "Palace of Winds to Vaati", "Fourth element, then split with the Four Sword. Credits after Vaati.", "vaati"),
    ],
)

add("sonic",
    "MD《索尼克》完整通关：6 个 Zone × 3 Act（绿丘、大理石、弹簧、迷宫、星光、最终）+ Final Zone。收集 50 环进特殊关拿混沌绿宝石是 100%，主线通关不强制。",
    [
        step("gh", "Green Hill 1–3", "斜坡加速，留环。被打掉环立刻捡。Act 3 Boss 蛋头：跳车上。", "gh"),
        step("marble", "Marble 1–3", "岩浆。慢慢走，别冲。推机关砖。Act 3 更长，存档。", "marble"),
        step("spring", "Spring Yard 1–3", "弹簧和钉。看准再跳。Boss 是钉车，等它停。"),
        step("labyrinth", "Labyrinth 1–3", "水下。顶气泡。憋气槽空了会淹死。可跳过用水下路线或选关。"),
        step("star", "Star Light 1–3", "可以冲。炸弹跳过。Boss 前留环。"),
        step("scrap", "Scrap Brain 与 Final", "机关最多。Act 3 进 Final Zone：只有 Boss。打蛋头几次即通关。无绿宝石也会出结局，有绿宝石是完整结局。", "final"),
    ],
    "Sonic 1: six zones × 3 acts plus Final Zone. Chaos Emeralds are 100%, not required for the credits.",
    [
        step("gh", "Green Hill 1–3", "Build speed, keep rings. Boss: jump the wrecking ball car.", "gh"),
        step("marble", "Marble 1–3", "Lava. Walk. Push blocks. Save on act 3.", "marble"),
        step("spring", "Spring Yard 1–3", "Springs and spikes. Boss: spiked ball, hit when it stops."),
        step("labyrinth", "Labyrinth 1–3", "Bubbles. Drown timer. Level select skips this if you only want Scrap Brain."),
        step("star", "Star Light 1–3", "Speed is safe. Jump bombs. Rings before the boss."),
        step("scrap", "Scrap Brain and Final", "Traps. Final Zone is boss-only. Hit Robotnik until the ending. Emeralds change the credits.", "final"),
    ],
)

add("streets-of-rage-2",
    "MD《怒之铁拳 2》通关：8 关到 Mr. X。选 Blaze 或 Axel 最好上手。被围放必杀（扣血）。打完 Mr. X 出结局。",
    [
        step("char", "选人", "Axel 均衡，Blaze 快，Max 慢而重，Skate 快但脆。第一次通关用 Axel/Blaze。", "char"),
        step("s1", "1–3 关 街到桥", "向右清。抓投。血黄了吃食物。必杀留给围殴。关底小 Boss 走位躲冲。", "s1"),
        step("s2", "4–6 关", "船、竞技场、电梯。清一波再往前，否则背后刷。双人别把人挤下边。"),
        step("s3", "7–8 关与 Mr. X", "大楼到顶。Mr. X 两阶段：枪和近战。躲枪，近身连打，残血再必杀。打完通关。", "mx"),
    ],
    "Streets of Rage 2: 8 stages to Mr. X. Axel or Blaze for a first clear.",
    [
        step("char", "Roster", "Axel even, Blaze fast, Max heavy, Skate fragile. First clear: Axel/Blaze.", "char"),
        step("s1", "Stages 1–3", "Throw, eat when yellow, specials in crowds.", "s1"),
        step("s2", "Stages 4–6", "Boat, arena, elevators. Clear a wave before you push."),
        step("s3", "Stages 7–8 and Mr. X", "Gun phase then melee. Dodge, combo, special at low HP. Credits.", "mx"),
    ],
)

add("alter-ego",
    "Shiru 免费 NES 解谜《Alter Ego》通关：每关收齐跳动的像素，用「换位」和分身互换位置。打完所有房间即通关。ROM 已托管，可直接玩。",
    [
        step("swap", "换位", "分身镜像移动。按换位键与分身对调，才能过只有分身能站的砖。先想后换，否则两边都卡住。", "swap"),
        step("rooms", "房间流程", "每关目标：收齐像素。像素会跳，站位预判。出口在收齐后打开。后期房间要连续换位两次。卡关用模拟器重置房间。", "rooms"),
        step("end", "通关", "打完作者设计的全部关卡出结束画面。没有商业 Boss。可再挑战更快时间。"),
    ],
    "Alter Ego (Shiru freeware): swap with your twin, collect pixels, finish every room. ROM is hosted.",
    [
        step("swap", "Swap", "The twin mirrors you. Swap to stand on tiles only the ghost can reach. Think before you swap.", "swap"),
        step("rooms", "Rooms", "Collect every bouncing pixel to open the exit. Late rooms need two swaps in a row. Reset the room if both bodies are stuck.", "rooms"),
        step("end", "Clear", "Finish all rooms for the ending. No commercial boss. Time attacks are optional."),
    ],
)

add("lawn-mower",
    "Shiru 免费 NES《Lawn Mower》通关：每关把所有草格割完，且不要把自己堵死（类似一笔画/贪吃蛇）。全部关卡割完即通关。ROM 已托管。",
    [
        step("mow", "割草规则", "开过的草格可能不能再当退路。先从外围或预留回廊。只有方向键。", "mow"),
        step("stages", "关卡", "早期地图简单，后期有障碍。堵死了重置关。不要从中心开始。", "stages"),
        step("end", "通关", "打完所有设计关卡。无 Boss。适合试虚拟手柄。"),
    ],
    "Lawn Mower (Shiru freeware): mow every grass tile without trapping yourself. ROM is hosted.",
    [
        step("mow", "Rules", "Mowed tiles may not be a path back. Plan like a snake. D-pad only.", "mow"),
        step("stages", "Stages", "Obstacles later. Reset if trapped. Do not start in the center.", "stages"),
        step("end", "Clear", "Finish every stage. No boss."),
    ],
)

assert set(zh) == set(en)
for gid in zh:
    zs = [s["id"] for s in zh[gid]["steps"]]
    es = [s["id"] for s in en[gid]["steps"]]
    if zs != es:
        raise SystemExit(f"step id mismatch {gid}: {zs} vs {es}")
    for a, b in zip(zh[gid]["steps"], en[gid]["steps"]):
        if a.get("image") != b.get("image"):
            raise SystemExit(f"image mismatch {gid} {a['id']}")

tw_data = tw_obj(zh)
others = {loc: deepcopy(en) for loc in ("ja", "ko", "vi", "id", "es")}

files = {"en": en, "zh-CN": zh, "zh-TW": tw_data, **others}
for loc, data in files.items():
    path = ROOT / f"{loc}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(loc, "games", len(data), "steps", sum(len(g["steps"]) for g in data.values()), "bytes", path.stat().st_size)

