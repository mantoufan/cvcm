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

## Emulator

Most-maintained browser frontend researched 2026-09-18: **EmulatorJS/EmulatorJS** (4.2k stars, commits through 2026-08, used by zaixianwan.app). Cores on S3: fceumm, snes9x, gambatte, mgba, genesis_plus_gx. Player is `/emu/player.html` (iframe; EmulatorJS must not mount in the SPA). Nostalgist.js (986) is a nicer API but needs the same RetroArch WASM; jsnes is NES-only.

## Writing rules

1. One game per URL. Title ≈ `{name} 金手指` / `{name} cheats`.
2. Five walkthrough steps. One action per step.
3. Five FAQ items covering Planner variants: 金手指, 手机, ROM, 攻略, 存档.
4. Do not paste another site's walkthrough. Short original steps only.
5. IA reference: zaixianwan.app (console + cover + play). Do not copy their ROM library.
