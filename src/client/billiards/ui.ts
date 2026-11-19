import { h } from "../dom";
import { armAudio } from "../audio";
import { t } from "../i18n";
import { creditLine, onScreen, readStore, typingTarget, writeStore } from "../game-input";
import { coarsePointer, createStage, disposeScene, gameShell, heldKeys, holdPad, lostContext, type Stage } from "../three-stage";
import { buildScene, type AimLine, type CameraMode, type TableScene } from "./scene";
import { TICK, anyMoving, cloneBalls, freeSpot, simulate, step, strike, type Ball, type SimEvent, type Vec } from "../../shared/billiards-physics";
import {
  ballIds,
  ballLook,
  cueIdFor,
  inZone,
  isVariant,
  rack,
  respot,
  spotsFor,
  tableFor,
  TABLE_OF,
  isRed,
  firstFreePoint,
  zoneSpots,
  type PlaceZone,
  type TableKind,
  type Variant,
} from "../../shared/billiards-tables";
import { ballsOn, groupLeft, isMatch, judge, newMatch, readShot, type Match, type Note } from "../../shared/billiards-rules";
import { planShot, type Skill } from "../../shared/billiards-ai";
import { drill, drillDone, DRILLS, isDrill, type Drill, type DrillId } from "../../shared/billiards-drills";

/**
 * Billiards trainer (written for cv.cm), shared by /billiards/ and /snooker/: eight-ball, nine-ball, ten-ball,
 * Chinese eight-ball, snooker (15 or 6 reds), Russian free pyramid and three-cushion, against the computer, a friend
 * on the same screen or solo, plus practice drills. Aim help can be off, a cue line with the ghost ball, or the full
 * predicted paths from the same physics. Strings are under `billiards.*`.
 */

/** The pages this trainer serves: /billiards/, /snooker/ and /pool-game/ (8-ball first, its own page copy). */
export type BilliardsPage = "billiards" | "snooker" | "pool-game";

const STORE_KEY = "cvcm.billiards.v1";
type Mode = "cpu" | "two" | "solo";
type AimLevel = "off" | "line" | "full";
/** "wait": a drill result is showing and its layout comes back in a moment. */
type Phase = "aim" | "roll" | "cpu" | "over" | "wait";

interface Saved {
  mode?: Mode;
  skill?: Skill;
  aim?: AimLevel;
  camera?: CameraMode;
  sound?: boolean;
  /** Wins and losses against the computer, per game (variant), shared by every page. */
  records?: Partial<Record<Variant, { wins: number; losses: number }>>;
}

/** A game in progress, kept per page so a visitor can come back to it. */
interface SavedGame {
  variant: Variant;
  mode: Mode;
  match: Match;
  balls: Ball[];
  breaker: 0 | 1;
  /** A shot that was rolling when the page closed: played again from the same table on return (the physics is
   * deterministic, so it ends the same way, and a loss cannot be dodged by reloading). */
  pending?: { angle: number; speed: number; side: number; top: number };
  /** One id per game (rack): its result against the computer is counted once, whichever tab finishes it. */
  gameId?: string;
}

const gameKey = (page: BilliardsPage) => `cvcm.billiards.game.${page}`;
/** The old /pool-game/ page kept its record here; it is carried over once. */
const OLD_POOL_KEY = "cvcm.poolgame.v1";
/** Ids of games whose result was already counted (two tabs may both finish the same saved game). */
const COUNTED_KEY = "cvcm.billiards.counted";

const PAGE_TEXT: Record<BilliardsPage, { title: string; lede: string; intro: string }> = {
  billiards: { title: "billiards.title", lede: "billiards.privacyNote", intro: "billiards.intro" },
  snooker: { title: "billiards.titleSnooker", lede: "billiards.privacyNoteSnooker", intro: "billiards.introSnooker" },
  "pool-game": { title: "billiards.titlePool", lede: "billiards.privacyNotePool", intro: "billiards.introPool" },
};

const MODES: Mode[] = ["cpu", "two", "solo"];
const SKILLS: Skill[] = ["easy", "medium", "hard"];
const AIMS: AimLevel[] = ["full", "line", "off"];
/** Rules shown per game (`billiards.rules.<variant>.r1…`). */
const RULE_COUNT: Record<Variant, number> = { "8-ball": 6, "9-ball": 5, "10-ball": 5, "chinese-8-ball": 6, snooker: 7, "snooker-6": 3, pyramid: 5, "3-cushion": 4 };
/** Fastest cue ball (m/s) per table, at full power. */
const MAX_SPEED: Record<TableKind, number> = { pool: 7.5, chinese: 7.5, snooker: 6, pyramid: 7, carom: 6 };
const POOL_FIRST: Variant[] = ["8-ball", "9-ball", "10-ball", "chinese-8-ball", "snooker", "snooker-6", "pyramid", "3-cushion"];
const PAGE_ORDER: Record<BilliardsPage, Variant[]> = {
  billiards: POOL_FIRST,
  snooker: ["snooker", "snooker-6", "8-ball", "9-ball", "10-ball", "chinese-8-ball", "pyramid", "3-cushion"],
  "pool-game": POOL_FIRST,
};

/** Everyday stroke power (after a break, and on a resumed game). */
const STROKE_POWER = 45;

/** Power the slider starts at for a break (carom has no break shot, just the opening). */
function breakPower(v: Variant): number {
  const kind = TABLE_OF[v];
  return kind === "carom" ? 45 : kind === "snooker" ? 55 : 80;
}

/** A short random id (games, shots). */
function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

let mounted: { cleanup: () => void } | null = null;

/** Tiny synthesized click, thud and drop sounds (no files). */
function sounds() {
  let ctx: AudioContext | null = null;
  let budget = 0;
  // Shared helpers: a refused AudioContext gives null (the game stays silent, never broken), and iOS's
  // "interrupted" state is resumed too.
  let refused = false;
  const ensure = () => {
    if (refused) return null;
    ctx = armAudio(ctx);
    if (!ctx) refused = true;
    return ctx;
  };
  const tone = (freq: number, len: number, vol: number, type: OscillatorType = "sine") => {
    const c = ensure();
    if (!c || budget > 4) return;
    budget++;
    let o: OscillatorNode;
    try {
      o = c.createOscillator();
    } catch {
      return;
    }
    const gn = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    gn.gain.setValueAtTime(Math.min(0.5, vol), c.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + len);
    o.connect(gn).connect(c.destination);
    o.start();
    o.stop(c.currentTime + len);
  };
  return {
    frame: () => {
      budget = 0;
    },
    ball: (speed: number) => tone(2200 + Math.random() * 400, 0.035, speed * 0.12, "triangle"),
    rail: (speed: number) => tone(140, 0.08, speed * 0.1),
    pot: () => tone(90, 0.18, 0.25, "square"),
    cue: (speed: number) => tone(900, 0.03, 0.08 + speed * 0.02, "triangle"),
    unlock: () => void ensure(),
    close: () => void ctx?.close().catch(() => undefined),
  };
}

export function mountBilliards(host: HTMLElement, page: BilliardsPage = "billiards"): void {
  unmountBilliards();
  const saved = readStore<Saved>(STORE_KEY) ?? {};
  const fromUrl = new URLSearchParams(location.search).get("game");
  let variant: Variant = isVariant(fromUrl) ? fromUrl : PAGE_ORDER[page][0]!;
  /** The game the player chose (a drill borrows its own table; leaving the drill comes back to this). */
  let homeVariant: Variant = variant;
  /** Who breaks the next rack (two sides alternate). */
  let breaker: 0 | 1 = 0;
  let mode: Mode = MODES.includes(saved.mode as Mode) ? saved.mode! : "cpu";
  let skill: Skill = SKILLS.includes(saved.skill as Skill) ? saved.skill! : "medium";
  let aimLevel: AimLevel = AIMS.includes(saved.aim as AimLevel) ? saved.aim! : "full";
  let camMode: CameraMode = saved.camera === "top" || saved.camera === "3d" ? saved.camera : "3d";
  let soundOn = saved.sound !== false;
  let drillId: DrillId | null = null;
  const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const cleanRecord = (r: unknown) => ({ wins: count((r as { wins?: unknown } | null)?.wins), losses: count((r as { losses?: unknown } | null)?.losses) });
  /** The stored records, read fresh (another open tab may have added a result). */
  const storedRecords = () => readStore<Saved>(STORE_KEY)?.records ?? {};
  /** In-memory copy for the HUD, refreshed on writes here and on storage events from other tabs. */
  let recordsNow: NonNullable<Saved["records"]> = saved.records ?? {};
  /** Wins and losses against the computer for one game (the same 8-ball record on /billiards/ and /pool-game/). */
  const recordOf = (v: Variant) => cleanRecord(recordsNow[v]);
  /** `prefMode` is the opponent preference shared by all pages (a restored game may play in another mode). */
  let prefMode: Mode = mode;
  /** Writes the settings; records always come from the store, so a settings change never rolls one back. */
  const save = (records?: NonNullable<Saved["records"]>) => {
    records ??= storedRecords();
    recordsNow = records;
    writeStore(STORE_KEY, { mode: prefMode, skill, aim: aimLevel, camera: camMode, sound: soundOn, records } satisfies Saved);
  };
  /** Adds one result to the stored records only (settings changed in another tab are left as they are). */
  const addResult = (v: Variant, won: boolean) => {
    const current = readStore<Saved>(STORE_KEY) ?? {};
    const all = current.records ?? {};
    const r = cleanRecord(all[v]);
    recordsNow = { ...all, [v]: won ? { ...r, wins: r.wins + 1 } : { ...r, losses: r.losses + 1 } };
    writeStore(STORE_KEY, { ...current, records: recordsNow } satisfies Saved);
  };
  {
    // The old /pool-game/ page kept its 8-ball record, opponent and level under its own key: carry them over once
    // (added to any 8-ball record already here), then drop that key once the write has landed.
    const old = readStore<{ wins?: unknown; losses?: unknown; mode?: unknown; level?: unknown }>(OLD_POOL_KEY);
    if (old) {
      if (saved.mode === undefined && old.mode === "friend") mode = prefMode = "two";
      if (saved.skill === undefined && (old.level === 0 || old.level === 1 || old.level === 2)) skill = SKILLS[old.level]!;
      const o = cleanRecord(old);
      const all = storedRecords();
      const r = cleanRecord(all["8-ball"]);
      const want = { wins: r.wins + o.wins, losses: r.losses + o.losses };
      save({ ...all, "8-ball": want });
      const got = cleanRecord(readStore<Saved>(STORE_KEY)?.records?.["8-ball"]);
      if (got.wins === want.wins && got.losses === want.losses) writeStore(OLD_POOL_KEY, null);
    }
  }


  /** The current game's id (see SavedGame.gameId); a new one for every new rack. */
  let gameId = newId();
  /** Keeps the game in progress for the next visit (not drills; cleared when a game ends or a new one starts). */
  const saveGame = (keep: boolean, pending?: SavedGame["pending"]) => {
    // Drills are never saved, and leave the saved game alone.
    if (currentDrill) return;
    writeStore(gameKey(page), keep && match.winner === null ? ({ variant, mode, match, balls, breaker, pending, gameId } satisfies SavedGame) : null);
  };

  let match: Match = newMatch(variant, mode === "solo" ? 1 : 2);
  let balls: Ball[] = rack(variant);
  let phase: Phase = "aim";
  let aim = 0;
  let power = 45;
  let side = 0;
  let top = 0;
  let editing = false;
  let currentDrill: Drill | null = null;
  let drillTries = 0;
  let drillHits = 0;
  /** Practice undo: the table and match before each shot. */
  const undoStack: { balls: Ball[]; match: Match; drill: Drill | null; tries: number; hits: number }[] = [];
  let shotBefore: Ball[] = [];
  let events: SimEvent[] = [];
  let simT = 0;
  let aimDirty = true;
  const snd = sounds();

  // ---------- DOM ----------
  const option = (value: string, label: string, selected: boolean) => h("option", { value, selected }, label);
  const variantSel = h("select", { "data-in": "variant" }, ...PAGE_ORDER[page].map((v) => option(v, t(`billiards.games.${v}`), v === variant))) as HTMLSelectElement;
  const modeSel = h("select", { "data-in": "mode" }, ...MODES.map((m) => option(m, t(`billiards.modes.${m}`), m === mode))) as HTMLSelectElement;
  const skillSel = h("select", { "data-in": "skill" }, ...SKILLS.map((s) => option(s, t(`billiards.skills.${s}`), s === skill))) as HTMLSelectElement;
  const aimSel = h("select", { "data-in": "aim" }, ...AIMS.map((a) => option(a, t(`billiards.aims.${a}`), a === aimLevel))) as HTMLSelectElement;
  const drillSel = h("select", { "data-in": "drill" }, option("", t("billiards.noDrill"), true), ...DRILLS.map((d) => option(d, t(`billiards.drills.${d}.name`), false))) as HTMLSelectElement;
  const skillField = h("label", { class: "field" }, h("span", null, t("billiards.skill")), skillSel);
  const newBtn = h("button", { type: "button", class: "btn", "data-act": "new" }, t("billiards.newGame")) as HTMLButtonElement;
  const camBtn = h("button", { type: "button", class: "btn ghost", "data-act": "camera", "aria-pressed": String(camMode === "top") }, t("billiards.topView")) as HTMLButtonElement;
  const soundBox = h("input", { type: "checkbox", "data-in": "sound", checked: soundOn }) as HTMLInputElement;

  const powerIn = h("input", { type: "range", min: 1, max: 100, step: 1, value: power, "data-in": "power", "aria-label": t("billiards.power") }) as HTMLInputElement;
  const powerOut = h("output", { class: "bl-power-val", "data-out": "power" }, `${power}%`);
  const shootBtn = h("button", { type: "button", class: "btn bl-shoot", "data-act": "shoot" }, t("billiards.shoot")) as HTMLButtonElement;
  const spinDot = h("span", { class: "bl-spin-dot" });
  // A 2D pad: the slider value is the vertical offset (top/draw, −50…50 % of a radius); the text says both axes.
  const spinPad = h("div", { class: "bl-spin", role: "slider", tabindex: 0, "aria-label": t("billiards.spin"), "aria-valuemin": -50, "aria-valuemax": 50, "aria-valuenow": 0, "aria-valuetext": "", "data-in": "spin" }, spinDot);
  const spinOut = h("span", { class: "bl-spin-val", "data-out": "spin" });
  const undoBtn = h("button", { type: "button", class: "btn ghost", "data-act": "undo", disabled: true }, t("billiards.undo")) as HTMLButtonElement;
  const editBtn = h("button", { type: "button", class: "btn ghost", "data-act": "edit", "aria-pressed": "false" }, t("billiards.moveBalls")) as HTMLButtonElement;
  const statusEl = h("p", { class: "bl-status", "aria-live": "polite", "data-out": "status" });
  const hudL = h("span", { class: "bl-hud-p", "data-out": "p1" });
  const hudR = h("span", { class: "bl-hud-p", "data-out": "p2" });
  const hudMid = h("span", { class: "bl-hud-mid", "data-out": "on" });
  const hud = h("div", { class: "g3d-hud bl-hud", "aria-hidden": "true" }, hudL, hudMid, hudR);
  const scoreEl = h("p", { class: "bl-score", "data-out": "score" });
  const rulesTitle = h("summary", null);
  const rulesList = h("ul", { class: "bl-rules-list" });
  const rulesBox = h("details", { class: "bl-rules" }, rulesTitle, rulesList);
  const drillTip = h("p", { class: "hint bl-drill-tip", "data-out": "drill" });
  const practiceRow = h("div", { class: "g3d-bar bl-practice" },
    h("label", { class: "field" }, h("span", null, t("billiards.drill")), drillSel),
    undoBtn,
    editBtn,
  );

  /** The running 3D game, set while a stage exists. */
  let game: { scene: TableScene; stage: Stage } | null = null;
  const fine = { held: new Set<"left" | "right" | "fineLeft" | "fineRight">() };
  const keys = heldKeys({ ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ShiftLeft: "fine", ShiftRight: "fine" } as Record<string, "left" | "right" | "fine">, () => game !== null && !shell.covered() && (document.activeElement === shell.stage || onScreen(shell.root)));
  const pad = holdPad<"left" | "right" | "fineLeft" | "fineRight">([
    { action: "left", label: "⟲", aria: t("billiards.turnLeft") },
    { action: "fineLeft", label: "‹", aria: t("billiards.nudgeLeft") },
    { action: "fineRight", label: "›", aria: t("billiards.nudgeRight") },
    { action: "right", label: "⟳", aria: t("billiards.turnRight") },
  ], fine.held, "bl-pad");

  const shell = gameShell({
    label: t("billiards.stage"),
    intro: t(PAGE_TEXT[page].intro),
    className: "bl-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 42, near: 0.02, far: 30, background: 0x2a1c22, active: () => !shell.covered(), onLost: () => { game = null; window.clearTimeout(coverTimer); window.clearTimeout(cpuTimer); lostPlan = cpuAim?.plan ?? null; cpuAim = null; lostContext(shell); } });
      if (!stage) return null;
      try {
        build(stage);
      } catch (e) {
        stage.dispose();
        throw e;
      }
      return () => {
        game = null;
        stage.dispose();
      };
    },
    resume: () => {
      if (phase === "over") newGame(Boolean(drillId), true);
    },
  });
  shell.root.insertBefore(hud, shell.stage.nextSibling);

  // ---------- helpers ----------
  const g = () => tableFor(variant);
  const cueId = () => cueIdFor(variant, match.turn);
  const cueBall = () => balls.find((b) => b.id === cueId())!;
  const human = () => mode !== "cpu" || match.turn === 0;
  const speed = () => 0.15 + (MAX_SPEED[TABLE_OF[variant]] - 0.15) * (power / 100) ** 1.5;
  const playerName = (i: 0 | 1) => (mode === "solo" ? t("billiards.you") : mode === "cpu" ? (i === 0 ? t("billiards.you") : t("billiards.computer")) : t("billiards.player", { n: i + 1 }));

  const noteText = (n: Note) => t(`billiards.msg.${n.key}`, n.params);

  function ballName(id: number): string {
    const look = ballLook(variant, id);
    if (look.kind === "red") return t("billiards.ball.red");
    if (look.kind === "colour") return t(`billiards.ball.v${look.value}`);
    if (look.kind === "carom") return t(`billiards.ball.carom${id}`);
    return String(look.number ?? id);
  }

  function onText(): string {
    if (match.winner !== null) return "";
    const on = ballsOn(match, balls);
    switch (TABLE_OF[variant]) {
      case "snooker":
        if (match.onColour) return t("billiards.onColour");
        if (on.length && isRed(on[0]!)) return t("billiards.onRed");
        return on.length ? t("billiards.onBall", { ball: ballName(on[0]!) }) : "";
      case "pool":
      case "chinese": {
        if (variant === "9-ball" || variant === "10-ball") return on.length ? t("billiards.onBall", { ball: ballName(on[0]!) }) : "";
        const grp = match.groups[match.turn];
        if (!grp) return match.breakShot ? t("billiards.break") : t("billiards.openTable");
        return groupLeft(balls, grp) ? t(`billiards.group.${grp}`, { n: groupLeft(balls, grp) }) : t("billiards.onEight");
      }
      case "pyramid":
      case "carom":
        return t("billiards.raceTo", { n: match.target });
    }
  }

  function renderHud(): void {
    const two = match.players === 2;
    const score = (i: 0 | 1) => {
      const s = match.scores[i];
      return TABLE_OF[variant] === "snooker" || variant === "pyramid" || variant === "3-cushion" ? ` ${s}` : "";
    };
    const grp = (i: 0 | 1) => (match.groups[i] ? ` · ${t(`billiards.groupShort.${match.groups[i]}`)}` : "");
    hudL.textContent = `${playerName(0)}${score(0)}${grp(0)}`;
    hudR.textContent = two ? `${playerName(1)}${score(1)}${grp(1)}` : "";
    hudL.classList.toggle("is-turn", two && match.turn === 0);
    hudR.classList.toggle("is-turn", two && match.turn === 1);
    const on = onText();
    hudMid.textContent = on;
    const parts = [two ? t("billiards.turnOf", { name: playerName(match.turn) }) : "", on];
    if (TABLE_OF[variant] === "snooker") parts.push(t("billiards.breakRun", { n: match.breakRun, best: match.bestBreak }));
    if (match.players === 1) parts.push(t("billiards.stats", { shots: match.shots, pots: match.pots }));
    if (mode === "cpu" && !currentDrill) {
      const r = recordOf(variant);
      parts.push(t("billiards.record", { wins: r.wins, losses: r.losses }));
    }
    if (currentDrill) parts.push(t("billiards.drillScore", { hits: drillHits, tries: drillTries }));
    scoreEl.textContent = parts.filter(Boolean).join(" · ");
    shootBtn.disabled = phase !== "aim" || !human();
    undoBtn.disabled = mode !== "solo" || !undoStack.length || phase === "roll";
    undoBtn.hidden = mode !== "solo";
    editBtn.hidden = mode !== "solo";
  }

  function renderRules(): void {
    rulesTitle.textContent = t("billiards.rulesOf", { game: t(`billiards.games.${variant}`) });
    rulesList.replaceChildren(...Array.from({ length: RULE_COUNT[variant] }, (_, i) => h("li", null, t(`billiards.rules.${variant}.r${i + 1}`))));
  }

  function renderSpin(): void {
    spinDot.style.left = `${50 + side * 80}%`;
    spinDot.style.top = `${50 - top * 80}%`;
    const parts: string[] = [];
    if (top > 0.08) parts.push(t("billiards.spinTop"));
    else if (top < -0.08) parts.push(t("billiards.spinDraw"));
    if (side > 0.08) parts.push(t("billiards.spinRight"));
    else if (side < -0.08) parts.push(t("billiards.spinLeft"));
    const text = parts.join(" + ") || t("billiards.spinCentre");
    spinOut.textContent = text;
    spinPad.setAttribute("aria-valuetext", text);
    spinPad.setAttribute("aria-valuenow", String(Math.round(top * 100)));
  }

  function setStatus(text: string): void {
    statusEl.textContent = text;
  }

  /** Points the cue at the nearest ball on, so a new turn starts with a sensible aim. */
  function aimAtBallOn(): void {
    const cue = cueBall();
    if (!cue?.on) return;
    const on = ballsOn(match, balls);
    let best: Ball | null = null;
    let bestD = Infinity;
    for (const b of balls) {
      if (!b.on || b.id === cue.id || (on.length && !on.includes(b.id))) continue;
      const d = Math.hypot(b.x - cue.x, b.y - cue.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) aim = Math.atan2(best.y - cue.y, best.x - cue.x);
    aimDirty = true;
  }

  /** First spot that fits in a ball-in-hand zone. */
  function placeInZone(ball: Ball, zone: PlaceZone): void {
    const s = spotsFor(variant);
    const gg = g();
    const tries: Vec[] = zone === "d" ? [{ x: s.baulkX - 0.08, y: 0.1 }, { x: s.baulkX - 0.15, y: -0.1 }] : zone === "kitchen" ? [{ x: s.headX - 0.1, y: 0 }] : [{ x: s.headX, y: 0 }];
    tries.push(...zoneSpots(variant, zone));
    for (const p of tries) {
      if (inZone(variant, zone, p.x, p.y) && freeSpot(gg, balls, p.x, p.y, ball.id)) {
        Object.assign(ball, { x: p.x, y: p.y, on: true, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0 });
        return;
      }
    }
    // The zone is full (rare, after moving balls by hand): any free spot on the table, scanning from the head.
    const p = firstFreePoint(variant, (x, y) => freeSpot(gg, balls, x, y, ball.id));
    if (p) Object.assign(ball, { x: p.x, y: p.y, on: true, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0 });
  }

  /** A saved shot the page could have played: finite, a real speed, spin within the tip's half-radius. */
  function pendingValid(p: NonNullable<SavedGame["pending"]>): boolean {
    return [p.angle, p.speed, p.side, p.top].every((n) => Number.isFinite(n)) && p.speed > 0 && p.speed < 10 && Math.hypot(p.side, p.top) <= 0.51;
  }

  /** Saved balls that make a playable table: on the bed and not overlapping. */
  function ballsValid(v: Variant, list: Ball[]): boolean {
    const gg = tableFor(v);
    const up = list.filter((b) => b.on);
    // A ball can rest hanging in a pocket mouth, a little past the cushion line (the physics drops it beyond 0.2R).
    const mx = gg.length / 2 + gg.R * 0.25;
    const my = gg.width / 2 + gg.R * 0.25;
    if (up.some((b) => Math.abs(b.x) > mx || Math.abs(b.y) > my)) return false;
    for (let i = 0; i < up.length; i++) {
      for (let k = i + 1; k < up.length; k++) if (Math.hypot(up[i]!.x - up[k]!.x, up[i]!.y - up[k]!.y) < 2 * gg.R * 0.98) return false;
    }
    return true;
  }

  /** Sets the opponent and the controls that depend on it (computer level, practice row). */
  function applyMode(m: Mode): void {
    mode = m;
    modeSel.value = m;
    skillField.hidden = m !== "cpu";
    practiceRow.hidden = m !== "solo";
  }

  /** Puts a saved game back on the table, if it still fits this page, game choice and opponent setting. */
  function restoreGame(kept: SavedGame | null): void {
    if (!kept || !isVariant(kept.variant) || !MODES.includes(kept.mode)) return;
    // A link to another game starts that game, unless a shot was still rolling: then the saved game comes back
    // and the shot finishes (the link's game is one click away).
    const linked = new URLSearchParams(location.search).get("game");
    if (isVariant(linked) && linked !== kept.variant) {
      if (!kept.pending) return;
      const url = new URL(location.href);
      url.searchParams.set("game", kept.variant);
      window.history.replaceState(window.history.state, "", url);
    }
    const ids = ballIds(kept.variant);
    const ok =
      Array.isArray(kept.balls) &&
      kept.balls.length === ids.length &&
      kept.balls.every((b) => b && Number.isInteger(b.id) && typeof b.on === "boolean" && Number.isFinite(b.x) && Number.isFinite(b.y)) &&
      // Same ball set (racks are stored in rack order, not by id).
      kept.balls.map((b) => b.id).sort((x, y) => x - y).join(",") === ids.join(",") &&
      ballsValid(kept.variant, kept.balls) &&
      isMatch(kept.match, kept.variant) &&
      kept.match.winner === null &&
      (kept.match.players === 1) === (kept.mode === "solo");
    if (!ok) return;
    // The saved game comes back with the opponent it was played against (this page only; the shared
    // preference for new games stays as it was).
    if (kept.mode !== mode) applyMode(kept.mode);
    variant = homeVariant = kept.variant;
    variantSel.value = variant;
    balls = kept.balls.map((b) => ({ ...b, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0 }));
    match = kept.match;
    if (typeof kept.gameId === "string") gameId = kept.gameId;
    // The table on screen may be another game's (drill, link): rebuild it if so.
    if (game) {
      if (sceneKey() !== builtKey) game.scene = makeScene(game.stage);
      else game.scene.sync(balls, 0);
    }
    breaker = kept.breaker === 1 ? 1 : 0;
    phase = mode === "cpu" && match.turn === 1 ? "cpu" : "aim";
    const pendingOk = Boolean(kept.pending && pendingValid(kept.pending));
    // With the table already up (drill → free practice), the computer's turn starts now; else Play starts it.
    if (phase === "cpu" && game && !pendingOk) {
      window.clearTimeout(cpuTimer);
      cpuTimer = window.setTimeout(cpuTurn, 650);
    }
    // Break power for a rack not yet broken, an everyday stroke otherwise.
    setPower(match.breakShot ? breakPower(variant) : STROKE_POWER);
    aimAtBallOn();
    const prompt = match.inHand && human() && !pendingOk ? ` ${t(`billiards.inHand.${match.inHand}`)}` : "";
    setStatus(`${t("billiards.resumed")}${prompt}`);
    renderHud();
    renderRules();
    if (pendingOk) {
      // (A computer ball-in-hand placement is already in the saved balls: cpuTurn moves the cue ball first.)
      const p = kept.pending!;
      // The shot that was rolling plays again; it rolls once Play has built the table.
      takeShot(p.angle, p.speed, p.side, p.top, true);
    }
  }

  /** A drill's match: solo, past the break, ball in hand only for the clearance (in the D). */
  function drillMatch(d: Drill): Match {
    return { ...newMatch(d.variant, 1), breakShot: false, inHand: d.id === "clearance" ? "d" : null };
  }

  /** Plays a rolling shot to its end at once (same physics) and lets the referee rule on it. */
  function settleNow(): void {
    // The computer has chosen (and saved) its shot but is still swinging: play it first.
    if (phase === "cpu" && cpuAim) {
      const p = cpuAim.plan;
      cpuAim = null;
      takeShot(p.angle, p.speed, p.side, p.top);
    }
    if (phase !== "roll") return;
    const res = simulate(g(), balls, { maxTime: Math.max(1, 40 - simT) });
    for (const e of res.events) events.push({ ...e, t: e.t + simT });
    finishRoll();
  }

  /** The balls have stopped (or the cap): zero the leftovers and let the referee rule. */
  function finishRoll(): void {
    for (const b of balls) Object.assign(b, { vx: 0, vy: 0, wx: 0, wy: 0, wz: 0 });
    endShot();
  }

  /**
   * `nextRack`: the same game goes on (New rack, Play again), so the break passes; a mode or game change keeps it.
   * `clearSave`: false keeps the saved game (mount, before a restore; drills, which are never saved).
   */
  function newGame(keepDrill = false, nextRack = false, clearSave = true): void {
    // A shot still rolling (or waiting to replay) counts before the rack is replaced: no dodging a loss.
    if (clearSave && !currentDrill) settleNow();
    if (clearSave && !keepDrill) {
      // Starting a game is a choice of opponent too: it becomes the shared preference.
      if (prefMode !== mode) {
        prefMode = mode;
        save();
      }
    }
    // Drop anything still pending from the last rack (computer turn, drill reset, game-over cover).
    window.clearTimeout(cpuTimer);
    window.clearTimeout(drillTimer);
    window.clearTimeout(coverTimer);
    cpuAim = null;
    drag = null;
    if (clearSave) {
      // A new rack replaces the saved game (written directly: saveGame skips while a drill is on). New rack inside
      // a drill leaves it alone, as drills never touch the save.
      if (!keepDrill) writeStore(gameKey(page), null);
      gameId = newId();
    }
    // A new rack replaces the result under the game-over cover.
    if (game && shell.covered()) shell.uncover();
    if (!keepDrill) {
      currentDrill = null;
      drillId = null;
      drillSel.value = "";
    }
    if (drillId) {
      currentDrill = drill(drillId, Math.random);
      variant = currentDrill.variant;
      variantSel.value = variant;
      // The drill picks its own table; leave it with the drill menu ("Free practice").
      variantSel.disabled = true;
      balls = cloneBalls(currentDrill.balls);
      match = drillMatch(currentDrill);
      drillTip.textContent = t(`billiards.drills.${drillId}.tip`);
    } else {
      currentDrill = null;
      variant = homeVariant;
      variantSel.value = variant;
      variantSel.disabled = false;
      // Two sides take turns to break, rack after rack: the break passes only once a rack has been played.
      if (nextRack && match.players === 2 && match.shots > 0) breaker = breaker === 0 ? 1 : 0;
      balls = rack(variant);
      match = newMatch(variant, mode === "solo" ? 1 : 2);
      if (match.players === 2) match.turn = breaker;
      if (variant === "3-cushion" && match.turn === 1) {
        // UMB: the breaker's ball beside the head spot, the opponent's on it.
        const [w, y] = [balls.find((b) => b.id === 0)!, balls.find((b) => b.id === 1)!];
        [w.x, w.y, y.x, y.y] = [y.x, y.y, w.x, w.y];
      }
      drillTip.textContent = "";
    }
    undoStack.length = 0;
    phase = "aim";
    editing = false;
    editBtn.setAttribute("aria-pressed", "false");
    side = 0;
    top = 0;
    setPower(drillId ? 30 : breakPower(variant));
    renderSpin();
    // The break goes straight up the table.
    aim = 0;
    if (TABLE_OF[variant] === "carom") {
      const red = balls.find((b) => b.id === 2)!;
      const cue = cueBall();
      aim = Math.atan2(red.y - cue.y, red.x - cue.x);
    } else if (drillId) {
      aimAtBallOn();
    } else if (TABLE_OF[variant] === "snooker") {
      const cue = cueBall();
      // Snooker break: thin off the outside red of the pack (15 or 6 reds), so the cue ball clips it and comes back.
      const R = g().R;
      const reds = balls.filter((b) => isRed(b.id));
      const edge = reds.reduce((a, b) => (b.y > a.y + 1e-6 || (Math.abs(b.y - a.y) < 1e-6 && b.x > a.x) ? b : a), reds[0]!);
      aim = Math.atan2(edge.y + R * 1.9 - cue.y, edge.x - cue.x);
    }
    aimDirty = true;
    setStatus(drillId ? t("billiards.drillStart") : match.inHand && human() ? t(`billiards.inHand.${match.inHand}`) : "");
    renderHud();
    renderRules();
    // The computer breaks this rack (started now if the table is up, else when Play builds it).
    if (mode === "cpu" && match.turn === 1) {
      phase = "cpu";
      renderHud();
      if (game) cpuTimer = window.setTimeout(cpuTurn, 900);
    }
    // A new table or ball set needs a new scene; the same one just moves its balls back.
    if (game) {
      if (sceneKey() !== builtKey) game.scene = makeScene(game.stage);
      else game.scene.sync(balls, 0);
    }
  }

  // ---------- shooting ----------
  function shoot(): void {
    if (phase !== "aim" || !game) return;
    takeShot(aim, speed(), side, top);
  }

  function takeShot(angle: number, v: number, sd: number, tp: number, replay = false): void {
    // Saved with the shot itself: a reload while the balls roll plays this shot again (same result), never rewinds.
    saveGame(true, { angle, speed: v, side: sd, top: tp });
    if (mode === "solo") {
      undoStack.push({ balls: cloneBalls(balls), match: { ...match, scores: [...match.scores], groups: [...match.groups] }, drill: currentDrill, tries: drillTries, hits: drillHits });
      if (undoStack.length > 30) undoStack.shift();
    }
    // A pending drill reset must not swap the balls under a rolling shot, and a drag in progress ends here.
    window.clearTimeout(drillTimer);
    drag = null;
    shotBefore = cloneBalls(balls);
    events = [];
    simT = 0;
    editing = false;
    editBtn.setAttribute("aria-pressed", "false");
    const cue = cueBall();
    strike(cue, angle, v, sd, tp, g().R);
    // A replayed shot (page reopened mid-roll) is silent and keeps the "resumed" message.
    if (soundOn && !replay) snd.cue(v);
    phase = "roll";
    game?.scene.cue(false);
    game?.scene.aim([], null);
    game?.scene.zone(null);
    if (!replay) setStatus("");
    renderHud();
  }

  function endShot(): void {
    // After a full-power break, come back to an everyday stroke.
    if (match.breakShot && power > 50) setPower(STROKE_POWER);
    const log = readShot(events, cueId());
    const verdict = judge(match, shotBefore, balls, log);
    const gg = g();
    match = verdict.match;
    const notes = verdict.notes.map(noteText);
    // The shooter's own cue ball (the turn may already have passed to the other player's ball).
    const cueNow = balls.find((b) => b.id === log.cue)!;
    // In hand after the cue ball went in, or (re-spotted black) while it lies outside the zone. It is lifted
    // before the colours go back, so it never blocks a spot.
    const toHand = verdict.cueOff || !cueNow.on || (match.inHand !== null && !inZone(variant, match.inHand, cueNow.x, cueNow.y));
    if (toHand) cueNow.on = false;
    for (const id of verdict.respot) respot(variant, balls, id, (x, y) => freeSpot(gg, balls, x, y, id));
    if (toHand) {
      const zone = match.inHand ?? "anywhere";
      match.inHand = zone;
      placeInZone(cueBall(), zone);
    }
    // The clearance drill is one attempt per run of colours: it ends on the last black or the first miss.
    const clearanceMiss = currentDrill?.pot === null && match.winner === null && (verdict.foul || !log.potted.some((id) => id !== 0));
    if (currentDrill?.pot === null && match.winner !== null) {
      drillTries++;
      if (match.winner === 0) drillHits++;
    }
    if (currentDrill && (currentDrill.pot !== null || clearanceMiss)) {
      drillTries++;
      // The cue ball may already be back in hand here, so a scratch is read from the verdict.
      const ok = currentDrill.pot !== null && !verdict.cueOff && drillDone(currentDrill, balls, log.potted);
      if (ok) drillHits++;
      setStatus(ok ? t("billiards.drillHit") : t("billiards.drillMiss"));
      phase = "wait";
      renderHud();
      // Set the drill up again after a moment.
      window.clearTimeout(drillTimer);
      drillTimer = window.setTimeout(() => {
        // A shot taken in the meantime keeps its balls; the reset waits for the next result.
        if (!currentDrill || phase !== "wait") return;
        phase = "aim";
        currentDrill = drill(currentDrill.id, Math.random);
        balls = cloneBalls(currentDrill.balls);
        match = drillMatch(currentDrill);
        aimAtBallOn();
        game?.scene.sync(balls, 0);
        renderHud();
      }, 1300);
      return;
    }
    if (match.winner !== null) {
      phase = "over";
      saveGame(false);
      if (mode === "cpu" && !match.drawn) {
        const raw = readStore<unknown>(COUNTED_KEY);
        const counted = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
        if (!counted.includes(gameId)) {
          addResult(variant, match.winner === 0);
          writeStore(COUNTED_KEY, [...counted, gameId].slice(-20));
        }
      }
      const solo = match.players === 1;
      // The referee's own reason (8 early, or on a foul), not a guess.
      const failed = verdict.notes.some((n) => n.key === "eightLoss") ? t("billiards.msg.eightLoss") : t("billiards.failedFoul");
      // Solo races (pyramid, three-cushion) end on points, not on a cleared table.
      const race = variant === "pyramid" || variant === "3-cushion";
      const rotation = variant === "9-ball" || variant === "10-ball";
      const soloWin = race ? t("billiards.msg.raceOver") : rotation ? t("billiards.msg.moneyWin", { n: variant === "9-ball" ? 9 : 10 }) : t("billiards.cleared");
      const text = match.drawn ? t("billiards.drawn") : solo ? (match.winner === 0 ? soloWin : failed) : t("billiards.wins", { name: playerName(match.winner) });
      // The referee's note may already say the same thing as the closing line.
      setStatus([...notes.filter((n) => n !== text), text].join(" "));
      renderHud();
      window.clearTimeout(coverTimer);
      coverTimer = window.setTimeout(() => shell.cover(text, t("billiards.again")), 900);
      return;
    }
    // The ball-in-hand prompt is for a person; the computer places the ball itself.
    if (match.inHand && human()) notes.push(t(`billiards.inHand.${match.inHand}`));
    setStatus(notes.join(" "));
    aimAtBallOn();
    saveGame(true);
    if (mode === "cpu" && match.turn === 1) {
      phase = "cpu";
      renderHud();
      window.clearTimeout(cpuTimer);
      cpuTimer = window.setTimeout(cpuTurn, 650);
      return;
    }
    phase = "aim";
    renderHud();
  }

  let cpuTimer = 0;
  let coverTimer = 0;
  let drillTimer = 0;
  /** Computer turn: think, swing the cue to the chosen line, shoot. */
  let cpuAim: { from: number; to: number; t: number; plan: ReturnType<typeof planShot> } | null = null;
  /** The computer's chosen shot when the 3D context was lost mid-swing (played as is after Restart). */
  let lostPlan: ReturnType<typeof planShot> | null = null;
  function cpuTurn(): void {
    if (!game || phase !== "cpu") return;
    const plan = planShot(match, balls, g(), skill);
    if (plan.place) {
      const cue = cueBall();
      Object.assign(cue, { x: plan.place.x, y: plan.place.y, on: true });
    }
    // Shortest turn from the current aim.
    let to = plan.angle;
    while (to - aim > Math.PI) to -= Math.PI * 2;
    while (to - aim < -Math.PI) to += Math.PI * 2;
    cpuAim = { from: aim, to, t: 0, plan };
    // The computer's chosen shot is saved before it swings: a reload replays this shot rather than a new try.
    saveGame(true, { angle: plan.angle, speed: plan.speed, side: plan.side, top: plan.top });
  }

  // ---------- aim prediction ----------
  /** A ball's colour for its predicted path; the black one is drawn light so it shows on the cloth. */
  function lineColor(id: number): number {
    const c = ballLook(variant, id).color;
    return c === 0x111111 ? 0xdddddd : c;
  }

  /** Seconds since the aim last moved: full prediction waits until it settles, the line shows meanwhile. */
  let aimStill = 0;
  function predict(level: AimLevel = aimLevel): { lines: AimLine[]; ghost: Vec | null } {
    const cue = cueBall();
    if (!cue?.on || level === "off") return { lines: [], ghost: null };
    const gg = g();
    const R = gg.R;
    const dx = Math.cos(aim);
    const dy = Math.sin(aim);
    // First contact along the line: a ball (centre within 2R of the path) or a cushion.
    let tHit = Infinity;
    let hitBall: Ball | null = null;
    for (const b of balls) {
      if (!b.on || b.id === cue.id) continue;
      const ox = b.x - cue.x;
      const oy = b.y - cue.y;
      const along = ox * dx + oy * dy;
      if (along <= 0) continue;
      const perp2 = ox * ox + oy * oy - along * along;
      const rr = 4 * R * R;
      if (perp2 > rr) continue;
      const tt = along - Math.sqrt(rr - perp2);
      if (tt < tHit) {
        tHit = tt;
        hitBall = b;
      }
    }
    const Lx = gg.length / 2 - R;
    const Wy = gg.width / 2 - R;
    // Clamped at 0: a cue ball resting in a pocket mouth sits past the cushion line.
    const tRail = Math.max(0, Math.min(dx > 0 ? (Lx - cue.x) / dx : dx < 0 ? (-Lx - cue.x) / dx : Infinity, dy > 0 ? (Wy - cue.y) / dy : dy < 0 ? (-Wy - cue.y) / dy : Infinity));
    const lines: AimLine[] = [];
    let ghost: Vec | null = null;
    const end = Math.min(tHit, tRail);
    const contact = { x: cue.x + dx * end, y: cue.y + dy * end };
    lines.push({ points: [{ x: cue.x, y: cue.y }, contact], color: 0xffffff });
    if (hitBall && tHit <= tRail) {
      ghost = contact;
      if (level === "line") {
        const nx = (hitBall.x - contact.x) / (2 * R);
        const ny = (hitBall.y - contact.y) / (2 * R);
        lines.push({ points: [{ x: hitBall.x, y: hitBall.y }, { x: hitBall.x + nx * 0.45, y: hitBall.y + ny * 0.45 }], color: lineColor(hitBall.id) });
        // Stun line: the cue ball leaves along the tangent.
        const dot = dx * nx + dy * ny;
        const tx = dx - dot * nx;
        const ty = dy - dot * ny;
        const tl = Math.hypot(tx, ty);
        if (tl > 0.02) lines.push({ points: [contact, { x: contact.x + (tx / tl) * 0.3 * tl, y: contact.y + (ty / tl) * 0.3 * tl }], color: 0xffffff, dashed: true });
      }
    }
    if (level === "full") {
      // Full prediction: run the shot in the physics on a copy and draw every ball that moves.
      const copy = cloneBalls(balls);
      const c = copy.find((b) => b.id === cue.id)!;
      strike(c, aim, speed(), side, top, R);
      // Long enough for a medium shot on slow snooker cloth to stop (balls at rest cost almost nothing).
      const res = simulate(gg, copy, { maxTime: 14, trace: 1 / 60 });
      lines.length = 0;
      for (const [id, pts] of res.traces ?? []) {
        if (pts.length < 2) continue;
        const color = id === cue.id ? 0xffffff : lineColor(id);
        const from = balls.find((b) => b.id === id)!;
        lines.push({ points: [{ x: from.x, y: from.y }, ...pts], color, dashed: id !== cue.id });
      }
    }
    return { lines, ghost };
  }

  // ---------- 3D build and frame loop ----------
  let builtKey = "";
  const sceneKey = () => `${TABLE_OF[variant]}:${balls.map((b) => b.id).join(",")}`;

  function makeScene(stage: Stage): TableScene {
    builtKey = sceneKey();
    disposeScene(stage.scene);
    stage.scene.clear();
    const scene = buildScene(stage, variant, g(), balls.map((b) => b.id));
    scene.sync(balls, 0);
    scene.view(camMode, cueBall(), aim, false, 0, true);
    aimDirty = true;
    return scene;
  }

  function build(stage: Stage): void {
    game = { scene: makeScene(stage), stage };
    // Restarted after a lost context on a finished game: rack again rather than sit on a dead table.
    if (phase === "over") newGame(Boolean(drillId), true);
    // The computer's turn (its break, or one cut short by a lost context) starts from the match itself.
    if (mode === "cpu" && match.turn === 1 && match.winner === null && (phase === "cpu" || phase === "aim") && !cpuAim) {
      phase = "cpu";
      renderHud();
      window.clearTimeout(cpuTimer);
      // A shot it had already chosen before the context was lost is played as it was, not planned again.
      const plan = lostPlan;
      lostPlan = null;
      cpuTimer = window.setTimeout(() => {
        if (plan && phase === "cpu") takeShot(plan.angle, plan.speed, plan.side, plan.top);
        else cpuTurn();
      }, 650);
    }
    let predictWait = 0;
    let fullDue = false;
    let rollAcc = 0;
    const coarse = coarsePointer();
    stage.onFrame((dt) => {
      if (!game) return;
      const scene = game.scene;
      snd.frame();
      if (phase === "roll") {
        const before = events.length;
        // Fixed ticks (same as the prediction and the computer's search), caught up from the frame time.
        rollAcc += dt;
        while (rollAcc >= TICK) {
          rollAcc -= TICK;
          step(g(), balls, TICK, events, simT);
          simT += TICK;
        }
        if (soundOn) {
          for (let i = before; i < events.length; i++) {
            const e = events[i]!;
            if (e.kind === "ball" && e.speed > 0.05) snd.ball(e.speed);
            else if (e.kind === "rail" && e.speed > 0.1) snd.rail(e.speed);
            else if (e.kind === "pot") snd.pot();
          }
        }
        if (!anyMoving(balls, g().R) || simT > 40) {
          rollAcc = 0;
          finishRoll();
        }
      }
      if (phase === "aim" && human()) {
        const rate = keys.held.has("fine") ? 0.07 : 0.9;
        if (keys.held.has("left") || fine.held.has("left")) aim += rate * dt;
        if (keys.held.has("right") || fine.held.has("right")) aim -= rate * dt;
        if (fine.held.has("fineLeft")) aim += 0.06 * dt;
        if (fine.held.has("fineRight")) aim -= 0.06 * dt;
        if (keys.held.has("left") || keys.held.has("right") || fine.held.size) aimDirty = true;
      }
      if (phase === "cpu" && cpuAim) {
        cpuAim.t += dt / 0.7;
        const k = Math.min(1, cpuAim.t);
        aim = cpuAim.from + (cpuAim.to - cpuAim.from) * (1 - (1 - k) * (1 - k));
        aimDirty = true;
        if (k >= 1 && cpuAim.t > 1.35) {
          const p = cpuAim.plan;
          cpuAim = null;
          takeShot(p.angle, p.speed, p.side, p.top);
        }
      }
      scene.sync(balls, dt);
      const aiming = phase === "aim" || phase === "cpu";
      const cue = cueBall();
      if (aiming && cue.on) {
        const pull = 0.03 + (power / 100) * 0.12;
        scene.cue(!editing, cue, aim, pull);
        predictWait -= dt;
        aimStill += dt;
        if (aimDirty) aimStill = 0;
        if (aimDirty && predictWait <= 0 && !editing) {
          aimDirty = false;
          // While the aim moves, the cheap line; the full prediction re-runs the physics once it settles.
          predictWait = 0.03;
          const level: AimLevel = aimLevel === "full" ? "line" : aimLevel;
          const p = phase === "aim" && human() ? predict(level) : { lines: [], ghost: null };
          scene.aim(p.lines, p.ghost);
          fullDue = aimLevel === "full";
        }
        if (fullDue && !aimDirty && aimStill > (coarse ? 0.25 : 0.12) && !editing) {
          fullDue = false;
          const p = phase === "aim" && human() ? predict("full") : { lines: [], ghost: null };
          scene.aim(p.lines, p.ghost);
        }
        scene.zone(phase === "aim" && human() && match.inHand && match.inHand !== "anywhere" ? match.inHand : null);
      }
      scene.target(currentDrill?.zone ?? null);
      // Hold the camera still while a ball is dragged, or the point under the pointer would keep moving.
      if (drag?.kind !== "ball") scene.view(camMode, cue.on ? cue : { x: 0, y: 0 }, aim, phase === "roll", dt);
    });
  }

  // ---------- input ----------
  let drag: { kind: "aim" | "ball"; id?: number; x0: number; aim0: number; moved?: boolean } | null = null;
  const canMove = (id: number) => phase === "aim" && human() && (editing || (match.inHand !== null && id === cueId()));

  const onDown = (e: PointerEvent) => {
    if (!game || e.button > 0 || shell.covered()) return;
    shell.stage.focus({ preventScroll: true });
    if (soundOn) snd.unlock();
    if (phase !== "aim" || !human()) return;
    const p = game.scene.pick(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    shell.stage.setPointerCapture?.(e.pointerId);
    const R = g().R;
    let near: Ball | null = null;
    let nearD = Infinity;
    for (const b of balls) {
      if (!b.on || !canMove(b.id)) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      // Behind the ball in 3D the cue ball fills the bottom of the view: grab it only on a close press there.
      if (d < nearD && d < R * (camMode === "top" ? 2.2 : 1.2)) {
        nearD = d;
        near = b;
      }
    }
    if (near) {
      drag = { kind: "ball", id: near.id, x0: e.clientX, aim0: aim };
      return;
    }
    drag = { kind: "aim", x0: e.clientX, aim0: aim };
    if (camMode === "top") {
      const cue = cueBall();
      aim = Math.atan2(p.y - cue.y, p.x - cue.x);
      aimDirty = true;
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || !game) return;
    if (phase !== "aim" || !human()) {
      drag = null;
      return;
    }
    const p = game.scene.pick(e.clientX, e.clientY);
    if (drag.kind === "ball") {
      if (!p) return;
      const b = balls.find((x) => x.id === drag!.id)!;
      const zone: PlaceZone = editing ? "anywhere" : match.inHand ?? "anywhere";
      if (inZone(variant, zone, p.x, p.y) && freeSpot(g(), balls, p.x, p.y, b.id)) {
        b.x = p.x;
        b.y = p.y;
        drag.moved = true;
        aimDirty = true;
      }
      return;
    }
    if (camMode === "top") {
      if (!p) return;
      const cue = cueBall();
      aim = Math.atan2(p.y - cue.y, p.x - cue.x);
    } else {
      // Behind the ball the camera turns with the aim, so drag sideways to turn (finer than pointing).
      aim = drag.aim0 - (e.clientX - drag.x0) * 0.0035;
    }
    aimDirty = true;
  };
  const onUp = () => {
    // A cue ball moved by hand in Move balls mode is placed: the ball-in-hand zone (and its kitchen rule) is done.
    if (drag?.kind === "ball" && drag.moved && editing && drag.id === cueId()) match.inHand = null;
    // Balls moved by hand (Move balls, ball in hand) are part of the saved game.
    if (drag?.kind === "ball" && drag.moved) saveGame(true);
    drag = null;
  };
  shell.stage.addEventListener("pointerdown", onDown);
  shell.stage.addEventListener("pointermove", onMove);
  shell.stage.addEventListener("pointerup", onUp);
  shell.stage.addEventListener("pointercancel", onUp);

  const setPower = (v: number) => {
    power = Math.max(1, Math.min(100, Math.round(v)));
    powerIn.value = String(power);
    powerOut.textContent = `${power}%`;
    aimDirty = true;
  };
  powerIn.addEventListener("input", () => setPower(Number(powerIn.value)));
  shootBtn.addEventListener("click", () => {
    if (soundOn) snd.unlock();
    shoot();
    // Back to the table, so the arrow keys aim the next shot.
    shell.stage.focus({ preventScroll: true });
  });

  const setSpinFrom = (e: PointerEvent) => {
    const r = spinPad.getBoundingClientRect();
    let sx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    let sy = -((e.clientY - r.top) / r.height - 0.5) * 2;
    const len = Math.hypot(sx, sy);
    if (len > 1) {
      sx /= len;
      sy /= len;
    }
    // The tip can go about half a radius off centre before it miscues.
    side = Math.round(sx * 0.5 * 20) / 20;
    top = Math.round(sy * 0.5 * 20) / 20;
    renderSpin();
    aimDirty = true;
  };
  let spinDrag = false;
  spinPad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    spinDrag = true;
    spinPad.setPointerCapture?.(e.pointerId);
    setSpinFrom(e);
  });
  spinPad.addEventListener("pointermove", (e) => {
    if (spinDrag) setSpinFrom(e);
  });
  spinPad.addEventListener("pointerup", () => (spinDrag = false));
  spinPad.addEventListener("pointercancel", () => (spinDrag = false));
  spinPad.addEventListener("keydown", (e) => {
    const stepV = 0.05;
    if (e.key === "ArrowUp") top = Math.min(0.5, top + stepV);
    else if (e.key === "ArrowDown") top = Math.max(-0.5, top - stepV);
    else if (e.key === "ArrowLeft") side = Math.max(-0.5, side - stepV);
    else if (e.key === "ArrowRight") side = Math.min(0.5, side + stepV);
    else if (e.key === "Home" || e.key === "0") {
      side = 0;
      top = 0;
    } else return;
    // Same limit as the pointer: the tip stays within half a radius of centre.
    const off = Math.hypot(side, top);
    if (off > 0.5) {
      side = Math.round(((side * 0.5) / off) * 100) / 100;
      top = Math.round(((top * 0.5) / off) * 100) / 100;
    }
    e.preventDefault();
    e.stopPropagation();
    renderSpin();
    aimDirty = true;
  });
  const centreBtn = h("button", { type: "button", class: "btn ghost bl-centre", "data-act": "centre" }, t("billiards.spinReset")) as HTMLButtonElement;
  centreBtn.addEventListener("click", () => {
    side = 0;
    top = 0;
    renderSpin();
    aimDirty = true;
  });

  variantSel.addEventListener("change", () => {
    if (!isVariant(variantSel.value)) return;
    // The rolling shot ends under the game (and opponent) it was played in.
    settleNow();
    variant = variantSel.value;
    homeVariant = variant;
    const url = new URL(location.href);
    url.searchParams.set("game", variant);
    window.history.replaceState(window.history.state, "", url);
    newGame(false);
  });
  modeSel.addEventListener("change", () => {
    settleNow();
    applyMode(modeSel.value as Mode);
    prefMode = mode;
    save();
    newGame();
  });
  skillSel.addEventListener("change", () => {
    skill = skillSel.value as Skill;
    save();
  });
  aimSel.addEventListener("change", () => {
    aimLevel = aimSel.value as AimLevel;
    aimDirty = true;
    if (aimLevel === "off") game?.scene.aim([], null);
    save();
  });
  drillSel.addEventListener("change", () => {
    settleNow();
    const v = drillSel.value;
    drillId = isDrill(v) ? v : null;
    drillHits = 0;
    drillTries = 0;
    // Drills are never saved and leave the saved game alone; back to free practice, it comes back.
    newGame(true, false, false);
    if (!drillId) restoreGame(readStore<SavedGame>(gameKey(page)));
  });
  camBtn.addEventListener("click", () => {
    camMode = camMode === "3d" ? "top" : "3d";
    camBtn.setAttribute("aria-pressed", String(camMode === "top"));
    save();
    shell.stage.focus({ preventScroll: true });
  });
  soundBox.addEventListener("change", () => {
    soundOn = soundBox.checked;
    save();
  });
  newBtn.addEventListener("click", () => {
    newGame(Boolean(drillId), true);
    shell.stage.focus({ preventScroll: true });
  });
  undoBtn.addEventListener("click", () => {
    // No game (before Play, or after a lost context: its Restart cover must stay) or a shot rolling: nothing to undo.
    if (phase === "roll" || !game) return;
    const last = undoStack.pop();
    if (!last) return;
    window.clearTimeout(drillTimer);
    window.clearTimeout(coverTimer);
    // Only the game-over cover goes away with the shot that caused it.
    if (phase === "over" && shell.covered()) shell.uncover();
    drillTries = last.tries;
    drillHits = last.hits;
    balls = last.balls;
    match = last.match;
    // The drill layout (and its target circle) that went with those balls.
    if (currentDrill && last.drill) currentDrill = last.drill;
    phase = "aim";
    aimDirty = true;
    game?.scene.sync(balls, 0);
    setStatus(t("billiards.undone"));
    renderHud();
    saveGame(true);
  });
  editBtn.addEventListener("click", () => {
    if (phase !== "aim") return;
    editing = !editing;
    editBtn.setAttribute("aria-pressed", String(editing));
    setStatus(editing ? t("billiards.editOn") : "");
    if (editing) game?.scene.aim([], null);
    aimDirty = true;
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    const target = e.target;
    const onStage = target === shell.stage;
    if (!onStage && target instanceof HTMLElement && target.closest("button, a, summary, select, [role=slider]")) return;
    if (!onStage && !onScreen(shell.root)) return;
    if (!game || shell.covered()) return;
    if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      if (!e.repeat) shoot();
    } else if (e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      setPower(power + (e.shiftKey ? 1 : 4));
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      setPower(power - (e.shiftKey ? 1 : 4));
    } else if (e.code === "KeyC" && !e.repeat) {
      camBtn.click();
    }
  };
  window.addEventListener("keydown", onKey);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORE_KEY) return;
    recordsNow = storedRecords();
    renderHud();
  };
  window.addEventListener("storage", onStorage);

  applyMode(mode);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(PAGE_TEXT[page].title)),
      h("p", { class: "lede" }, t(PAGE_TEXT[page].lede)),
    ),
    h("div", { class: "g3d-bar bl-bar" },
      h("label", { class: "field" }, h("span", null, t("billiards.game")), variantSel),
      h("label", { class: "field" }, h("span", null, t("billiards.mode")), modeSel),
      skillField,
      h("label", { class: "field" }, h("span", null, t("billiards.aimHelp")), aimSel),
    ),
    practiceRow,
    scoreEl,
    shell.root,
    h("div", { class: "g3d-bar bl-controls" },
      h("div", { class: "bl-spin-box" }, spinPad, h("div", { class: "bl-spin-text" }, h("span", { class: "bl-label" }, t("billiards.spin")), spinOut, centreBtn)),
      h("label", { class: "bl-power" }, h("span", { class: "bl-label" }, t("billiards.power")), powerIn, powerOut),
      pad,
      shootBtn,
    ),
    h("div", { class: "g3d-bar bl-bar2" },
      newBtn,
      camBtn,
      shell.fullscreenButton,
      h("label", { class: "check" }, soundBox, h("span", null, t("billiards.sound"))),
    ),
    statusEl,
    drillTip,
    rulesBox,
    h("p", { class: "hint" }, t("billiards.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );
  renderSpin();
  // A fresh rack first (without touching the save), then the saved game on top if it still fits.
  newGame(false, false, false);
  restoreGame(readStore<SavedGame>(gameKey(page)));

  mounted = {
    cleanup: () => {
      window.clearTimeout(cpuTimer);
      window.clearTimeout(coverTimer);
      window.clearTimeout(drillTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("storage", onStorage);
      keys.dispose();
      shell.stage.removeEventListener("pointerdown", onDown);
      shell.stage.removeEventListener("pointermove", onMove);
      shell.stage.removeEventListener("pointerup", onUp);
      shell.stage.removeEventListener("pointercancel", onUp);
      shell.dispose();
      snd.close();
      game = null;
    },
  };
}

export function unmountBilliards(): void {
  mounted?.cleanup();
  mounted = null;
}
