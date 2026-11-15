# Games keyword plan

Pulled 2026-09-18 against the same Google Ads Keyword Planner process as `docs/learn-keyword-plan.md` (MCC 馒头饭 `7007031245`, `generateKeywordIdeas`). The delivery account `9132676642` is CANCELED. Config `~/.config/gads/google-ads.yaml` was not on this machine, so this first games batch is seeded from Planner-style query families used on cv.cm (title ≈ the query; FAQ answers the variants) plus Chinese retro SERP intent (金手指 / 攻略 / 在线玩 / 怎么过). Re-pull on the MCC when the yaml is back and replace the volume column.

Mainland Google volume is small; zh pages still target 百度 / 小红书 / 知乎 phrasing. Ad competition is Planner advertiser competition, not organic difficulty.

## Do not host

cv.cm will not scrape or copy commercial dumps from third-party sites. Every game page can start from an S3 object named `{id}.{ext}` when that file exists, and always keeps a local file picker. Shiru freeware (`alter-ego`, `lawn-mower`) is already on S3.

## Query families (every game page)

| Family | zh example | en example | Where it lives |
|---|---|---|---|
| Cheats | `{游戏} 金手指` | `{game} cheat codes` | H2 金手指 + FAQ q1 |
| Walkthrough | `{游戏} 攻略` / `{游戏} 怎么过` | `{game} walkthrough` | H2 攻略 HowTo JSON-LD |
| Play in browser | `{游戏} 在线玩` / `FC 在线玩` | `play {game} in browser` | Title + play module |
| Phone | `{游戏} 手机` / 模拟器 | `{game} on phone` | FAQ + virtual pad |
| Console hub | `FC 游戏` `GBA 金手指` | `NES games online` | `/games/{console}/` |

## First batch (shipped)

Each row is one URL. Title is the query to rank.

| Slug | Console | Primary zh query | Primary en query |
|---|---|---|---|
| super-mario-bros | FC | 超级马里奥 金手指 | Super Mario Bros cheats |
| contra | FC | 魂斗罗 金手指 / 30命 | Contra 30 lives |
| battle-city | FC | 坦克大战 金手指 / 90坦克 | Battle City cheats |
| adventure-island | FC | 冒险岛 金手指 | Adventure Island cheats |
| tetris-nes | FC | 俄罗斯方块 金手指 | NES Tetris cheats |
| double-dragon | FC | 双截龙 金手指 | Double Dragon cheats |
| super-mario-world | SFC | 超级马里奥世界 金手指 | Super Mario World cheats |
| zelda-alttp | SFC | 塞尔达 众神的三角力量 攻略 | ALttP walkthrough |
| street-fighter-ii | SFC | 街头霸王2 出招 | Street Fighter II cheats |
| pokemon-red | GB | 口袋妖怪红 金手指 | Pokémon Red cheats |
| tetris-gb | GB | GB 俄罗斯方块 | Game Boy Tetris |
| kirby-dream-land | GB | 星之卡比 金手指 | Kirby Dream Land cheats |
| pokemon-gold | GBC | 口袋妖怪金 金手指 | Pokémon Gold cheats |
| pokemon-emerald | GBA | 口袋妖怪绿宝石 金手指 | Pokémon Emerald cheats |
| mario-kart-super-circuit | GBA | 马里奥赛车 Advance 金手指 | Super Circuit cheats |
| minish-cap | GBA | 缩小帽 攻略 | Minish Cap walkthrough |
| sonic | MD | 索尼克 金手指 | Sonic cheat codes |
| streets-of-rage-2 | MD | 怒之铁拳2 金手指 | Streets of Rage 2 cheats |
| alter-ego | FC | Alter Ego 在线玩 | Alter Ego NES homebrew |
| lawn-mower | FC | Lawn Mower NES | Lawn Mower NES homebrew |

Hosted FC homebrew picked from the FC图库 catalog (fcpic.nesbbs.com, "版权：其他", 2026-10-21). Only titles whose own release grants commercial redistribution; ROMs come from the author's repo or site, never from fcpic:
`double-action-blaster-guys` (zlib, NovaSquirrel/DABG), `neslife` (zlib, NovaSquirrel/NESLife 64x32), `lunar-limit` (MIT, pubby/lunarlimit), `ralph-4` (MIT, pubby/Ralph-4).
Skipped: hacks of commercial games (most of the catalog), Mojon Twins (CC BY-NC-SA), Nova the Squirrel (assets CC BY-NC-SA), CROSS-LIB (non-commercial), nesdoug / Johnybot / CutterCross / Minekart (no license), Witch n' Wiz (full game sold), Chase (code-only public domain), Russian Roulette (Zapper tech demo).

Hosted SFC / MD / GBA / GB homebrew (2026-10-22), each from the author's own repo or itch page, license allowing commercial redistribution:
SFC `elevator-madness-dx`, `bat-cave`, `pipes-snes`, `castle-platformer` (MIT, undisbeliever; art CC0); MD `miniplanets` (zlib, Sik), `kleleatoms-md` (MIT, Nightwolf-47), `pixel-dungeon-md` (GPL-3.0 per the LICENSE in the ROM and source zips, though the itch metadata says LGPL-3.0; 2 Drinks In Games after Watabou — source mirrored at `files/games/src/pixel-dungeon-md-source.zip`); GBA `dungeon-puzzlers-lament` (code MPL-2.0, art CC BY 4.0, music CC-BY 3.0 VWolfdog; 2023 jam build, so the source link is pinned to agb f4214b5, the last commit with that music); GB `bunkerboy` (MIT, UrbanZero).
Skipped: Memory Game (dupes pelmanism), Horizontal Shooter (demo), Retail Clerk '89, Lock and Toad (title font), RC Shuriken (boss crash), and NC / unlicensed / third-party-IP titles.

## Flash hub (2026-09-23)

One URL, not a pile of commercial SWF pages. Title is the query.

| URL | Primary zh query | Primary en query |
|---|---|---|
| `/games/flash/` | Flash 游戏在线玩 / SWF 播放器 / Flash 小游戏 | play Flash games online / SWF player |

Ruffle (MIT or Apache-2.0) runs in `/emu/flash`. The runtime is on S3 at `files/games/emu/ruffle/`, proxied as `/emu/assets/ruffle/`. The player asks for a manual upload when no file is present. Host a SWF only when its license allows redistribution. Single-file SWFs only; multi-file games and sitelocks stay off this page.

Hosted MIT titles from Antoine Boucher, 2010 (`antoinebou12/FlashGames`): `detruit-les-ballons`, `tag-chase`, `ricochet-kill`.

Hosted GPL-2.0 title from Aaron Steed, 2013 (`st33d/Ending`, `bin/game.swf`): `ending`.

## Emulator

Most-maintained browser frontend researched 2026-09-18: **EmulatorJS/EmulatorJS** (4.2k stars, commits through 2026-08, used by zaixianwan.app). Cores on S3: fceumm, snes9x, gambatte, mgba, genesis_plus_gx. Player is `/emu/player.html` (iframe; EmulatorJS must not mount in the SPA). Nostalgist.js (986) is a nicer API but needs the same RetroArch WASM; jsnes is NES-only.

## Writing rules

1. One game per URL. Title ≈ `{name} 金手指` / `{name} cheats`.
2. Five walkthrough steps. One action per step.
3. Five FAQ items covering Planner variants: 金手指, 手机, ROM, 攻略, 存档.
4. Do not paste another site's walkthrough. Short original steps only.
5. IA reference: zaixianwan.app (console + cover + play). Do not copy their ROM library.

## ROM emulator and Flash player tools (2026-11-07)

Names come from Google Ads Keyword Planner (average monthly searches, language plus main markets; close variants are merged, and `zh-CN` mostly counts where Google is reachable). Slugs are one English word pair for all locales; display names follow each language.

| Locale | ROM tool name | Evidence | Flash tool name | Evidence |
|---|---|---|---|---|
| en | ROM emulator | rom emulator 60,500; online emulator 5,400; rom player 320 | Flash player | flash player 6,600; swf player 3,600 |
| zh-CN | 游戏模拟器 | 游戏模拟器 140; rom 模拟器 10; GBA 模拟器 590 in title | Flash 播放器 | flash player 590; swf 播放器 50; flash 播放器 40 |
| zh-TW | 遊戲模擬器 | 遊戲模擬器 590; rom 模擬器 30; GBA 模擬器 4,400 in title | Flash 播放器 | flash player 1,900; flash 播放器 140; swf 播放器 140 |
| ja | ROM エミュレーター | rom エミュレーター 590; レトロゲーム 260 | フラッシュプレイヤー | flash player 1,000; swf 再生 720; フラッシュプレイヤー 480 |
| ko | 고전 게임 에뮬레이터 | 고전 게임 170; 게임 90; rom 0 | 플래시 플레이어 | 플래시 플레이어 260; swf 플레이어 110 |
| vi | Trình giả lập game | giả lập game 140; giả lập rom 0 | Flash Player | flash player 590; swf player 110; trình phát flash 0 |
| id | Emulator game | emulator game 33,100; emulator rom 9,900 | Flash Player | flash player 880; swf player 590 |
| es | Emulador online | emulador online 4,400; emulador de rom 70 | Flash Player | flash player 2,900; reproductor swf 90 |

Bare terms (模拟器, エミュレーター, emulador) are larger but mostly mean Android and PlayStation emulators, so they are not the page name. "Flash player" searches lean toward Adobe's download, so the copy says the page is Ruffle and not from Adobe, and titles keep "SWF player" for the exact-intent query.

Tutorial slugs, same source: `open-swf-file` (how to open swf files 720, open swf file 480, swf 檔案開啟 170, como abrir archivos swf 110; how to play flash games 480) and `use-emulator` (how to use emulator 480, エミュレーター 使い方 110; how to use rom emulator 10, how to play roms 70).

## Open-source HTML5 games (2026-11-14)

Google Ads Keyword Planner, `generateKeywordHistoricalMetrics` on MCC `7007031245`, average monthly searches. Markets: en US/UK/CA/AU/SG/PH; zh-TW TW+HK; zh-CN overseas (SG/MY/US/CA/AU); ja JP; ko KR; vi VN; id ID; es MX/ES/AR/CO/CL/PE.

"open source games" is only 1,900 (free open source games 90, open source browser games 70), so each page is named after the game and the source is credited on the page, not in the title.

| Slug | Upstream (licence) | Evidence |
|---|---|---|
| `2048` | gabrielecirulli/2048 (MIT) | en 2048 1,000,000; ja 201,000; es 135,000; zh-CN 823,000 (bare "2048", diaspora + other uses); zh-TW 74,000; ko 33,100 |
| `dinosaur-game` | Chromium T-Rex runner via wayou/t-rex-runner (BSD-3-Clause) | en dinosaur game 1,500,000 (dino game merged), chrome dino 90,500; ja 恐竜ゲーム 301,000; ko 공룡 게임 201,000; id game dinosaurus 165,000; es juego del dinosaurio 165,000; zh-TW 恐龍遊戲 49,500 |
| `mahjong` | ffalt/mah (MIT); tiles Wikimedia Commons Unicode set (public domain) | en mahjong 1,500,000, mahjong solitaire 246,000, mahjong online 201,000; ja 麻雀 1,000,000 / 上海 90,500; es 550,000; id 368,000; zh-TW 麻將 60,500 |
| `chess` | chess.js (BSD-2-Clause) + Stockfish.js 19 lite (GPL-3.0); pieces Colin M.L. Burnett (BSD) | en chess 3,350,000, chess online 673,000, play chess against computer 60,500; es ajedrez 550,000; vi cờ vua 301,000; ja チェス 135,000; ko 체스 110,000; id catur 135,000 |
| `chinese-chess` | XiangQi Wizard Light (GPL-2.0-or-later) | vi cờ tướng 301,000; zh-TW 象棋 33,100 + 暗棋 12,100; zh-CN 象棋 12,100 / 中国象棋 9,900; en chinese chess 33,100, xiangqi 14,800 |

Not done (trademark or game IP): wordle, tetris, pac-man, geometry dash, flappy bird, cookie clicker, slope, crossy road, angry birds; "connect 4" and "othello" are brands (use four in a row / reversi). Next by volume, to be written for cv.cm (existing open-source clones are small or unlicensed): solitaire 16.6M (spider 1.5M, freecell 823k), minesweeper 5M, snake 9.1M, checkers 1M, gomoku (lihongxun945/gobang has no licence), nonogram 110k (HandsomeOne/Nonogram MIT), typing game (ja 201,000).

## Self-written classics (2026-11-14, batch 30)

Same Keyword Planner pull as above. Existing open-source versions were small, old or unlicensed, so these are written for cv.cm.

| Slug | Evidence (monthly) | Page names |
|---|---|---|
| `solitaire` | solitaire 16.6M, free solitaire 823k, klondike solitaire 246k; es solitario 1.83M; ja ソリティア 1.83M; ko 솔리테어 74k | 纸牌接龙 / 接龍 / ソリティア |
| `spider-solitaire` | spider solitaire 1.5M; es solitario spider 823k; ja 246k; zh-CN 蜘蛛纸牌 4.4k | 蜘蛛纸牌 / スパイダーソリティア |
| `freecell` | freecell 823k; ja フリーセル 301k; es carta blanca 246k; ko 프리셀 22k | 空当接龙 / 新接龍 / フリーセル |
| `minesweeper` | minesweeper 5M; es buscaminas 823k; ja 823k; ko 지뢰찾기 368k; zh-TW 踩地雷 90.5k; vi dò mìn 74k | 扫雷 / 踩地雷 |
| `snake-game` | snake game 9.14M; es snake 1.5M; id snake game 90.5k; ko 지렁이 게임 74k; vi rắn săn mồi 60.5k | 贪吃蛇 / 貪食蛇 |

Still open: checkers 1M (checkers online 90.5k), gomoku (ko 오목 74k), nonogram 110k (HandsomeOne/Nonogram MIT), typing game (ja 201k), word search 550k.
