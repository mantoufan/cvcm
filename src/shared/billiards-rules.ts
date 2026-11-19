/**
 * Referee for the billiards games (written for cv.cm). After every shot `judge` reads what happened (first ball hit,
 * cushions, pots, from the physics events) and returns the new match state: fouls, points, whose turn, ball in hand,
 * balls to spot again and the winner. Rules follow the WPA (eight-, nine- and ten-ball), WPBSA (snooker), Chinese
 * eight-ball, free pyramid and UMB three-cushion rules, without calling shots: the simplifications are listed in the
 * page copy (`billiards.rules.*`).
 */

import type { Ball, SimEvent } from "./billiards-physics";
import { groupOf, type Group } from "./pool-game";
import { TABLE_OF, cueIdFor, spotsFor, isRed, snookerValue, SNOOKER_FIRST_COLOUR, type PlaceZone, type Variant } from "./billiards-tables";

export type { Group };

export interface Match {
  variant: Variant;
  /** 1 = solo practice (every shot is yours), 2 = two sides (a friend or the computer). */
  players: 1 | 2;
  turn: 0 | 1;
  scores: [number, number];
  /** Eight-ball groups per player (null while the table is open). */
  groups: [Group | null, Group | null];
  /** The next shot is the break. */
  breakShot: boolean;
  /** Ball in hand for the shooter, and where it may go. */
  inHand: PlaceZone | null;
  /** Snooker: a red went in, so the next ball on is a colour. */
  onColour: boolean;
  /** Snooker: points in the current break, and the best break of the match. */
  breakRun: number;
  bestBreak: number;
  /** Race length (pyramid balls, three-cushion points). */
  target: number;
  winner: 0 | 1 | null;
  /** The game ended level (pyramid with the table cleared on equal points); `winner` is then 0 only to end it. */
  drawn: boolean;
  /** Shots taken and balls potted (practice stats). */
  shots: number;
  pots: number;
}

export interface Note {
  key: string;
  params?: Record<string, string | number>;
}

export interface Verdict {
  match: Match;
  foul: boolean;
  /** Message keys under billiards.msg. */
  notes: Note[];
  /** Balls to put back on their spots, in order. */
  respot: number[];
  /** The cue ball went in (put it back in hand). */
  cueOff: boolean;
}

export function newMatch(variant: Variant, players: 1 | 2): Match {
  return {
    variant,
    players,
    turn: 0,
    scores: [0, 0],
    groups: [null, null],
    breakShot: true,
    inHand: TABLE_OF[variant] === "snooker" ? "d" : TABLE_OF[variant] === "carom" ? null : "kitchen",
    onColour: false,
    breakRun: 0,
    bestBreak: 0,
    target: variant === "pyramid" ? 8 : variant === "3-cushion" ? 10 : 0,
    winner: null,
    drawn: false,
    shots: 0,
    pots: 0,
  };
}

/** What happened in one shot, read from the physics events. */
export interface ShotLog {
  cue: number;
  firstHit: number | null;
  potted: number[];
  /** Any ball reached a cushion after the cue ball's first contact. */
  railAfterContact: boolean;
  /** Distinct object balls that touched a cushion (break rule). */
  objectRails: number;
  /** Three-cushion: the cue ball scored (both balls, three cushions before the second). */
  caromPoint: boolean;
}

export function readShot(events: readonly SimEvent[], cue: number): ShotLog {
  let firstHit: number | null = null;
  let firstT = Infinity;
  const potted: number[] = [];
  const objectRails = new Set<number>();
  let railAfterContact = false;
  // Three-cushion bookkeeping.
  const hitBalls: number[] = [];
  let cueRails = 0;
  let caromPoint = false;
  // In time order (contacts inside one sub-step are stamped with their own impact times).
  const ordered = events.map((e, i) => ({ e, i })).sort((x, y) => x.e.t - y.e.t || x.i - y.i).map((x) => x.e);
  for (const e of ordered) {
    if (e.kind === "ball") {
      if (e.a === cue || e.b === cue) {
        const other = e.a === cue ? e.b : e.a;
        if (firstHit === null) {
          firstHit = other;
          firstT = e.t;
        }
        if (!hitBalls.includes(other)) {
          hitBalls.push(other);
          if (hitBalls.length === 2 && cueRails >= 3) caromPoint = true;
        }
      }
    } else if (e.kind === "rail") {
      if (e.a !== cue) objectRails.add(e.a);
      if (e.t >= firstT) railAfterContact = true;
      if (e.a === cue && hitBalls.length < 2) cueRails++;
    } else if (e.kind === "pot") {
      potted.push(e.a);
    }
  }
  return { cue, firstHit, potted, railAfterContact, objectRails: objectRails.size, caromPoint };
}


const onTable = (balls: readonly Ball[], id: number) => balls.some((b) => b.id === id && b.on);

/** Object balls still on the table. */
function objects(balls: readonly Ball[], cue: number): number[] {
  return balls.filter((b) => b.on && b.id !== cue).map((b) => b.id);
}

/** Lowest-numbered object ball on the table (rotation games). */
function lowest(balls: readonly Ball[]): number | null {
  let lo: number | null = null;
  for (const b of balls) if (b.on && b.id !== 0 && (lo === null || b.id < lo)) lo = b.id;
  return lo;
}

/** Snooker: the colour due in the final sequence (yellow first), or null while reds remain. */
function nextColour(balls: readonly Ball[]): number | null {
  if (balls.some((b) => b.on && isRed(b.id))) return null;
  for (let id = SNOOKER_FIRST_COLOUR; id <= SNOOKER_FIRST_COLOUR + 5; id++) if (onTable(balls, id)) return id;
  return null;
}

/**
 * The balls the shooter may legally hit first (for the computer player, the aim hint and the HUD). Pyramid and
 * three-cushion list every other ball; empty only when nothing is left to hit.
 */
export function ballsOn(m: Match, balls: readonly Ball[]): number[] {
  const on = ballsOnAnywhere(m, balls);
  // In hand behind the head string (WPA, pyramid): a ball behind it may not be hit first.
  if (m.inHand !== "kitchen" || m.breakShot) return on;
  const headX = spotsFor(m.variant).headX;
  const past = on.filter((id) => (balls.find((b) => b.id === id)?.x ?? Infinity) > headX);
  return past.length ? past : on;
}

function ballsOnAnywhere(m: Match, balls: readonly Ball[]): number[] {
  const cue = cueIdFor(m.variant, m.turn);
  switch (m.variant) {
    case "8-ball":
    case "chinese-8-ball": {
      const g = m.groups[m.turn];
      const left = objects(balls, cue);
      if (!g) return m.breakShot ? left : left.filter((id) => id !== 8);
      const mine = left.filter((id) => groupOf(id) === g);
      return mine.length ? mine : left.filter((id) => id === 8);
    }
    case "9-ball":
    case "10-ball": {
      const lo = lowest(balls);
      return lo === null ? [] : [lo];
    }
    case "snooker":
    case "snooker-6": {
      if (m.onColour) return balls.filter((b) => b.on && b.id >= SNOOKER_FIRST_COLOUR).map((b) => b.id);
      const reds = balls.filter((b) => b.on && isRed(b.id)).map((b) => b.id);
      if (reds.length) return reds;
      const c = nextColour(balls);
      return c === null ? [] : [c];
    }
    case "pyramid":
      return objects(balls, cue);
    case "3-cushion":
      return balls.filter((b) => b.id !== cue).map((b) => b.id);
  }
}

/** The group a player has, or what they still need. */
export function groupLeft(balls: readonly Ball[], g: Group): number {
  return balls.filter((b) => b.on && groupOf(b.id) === g).length;
}

/**
 * In hand behind the head string (WPA), the first ball hit must lie outside the kitchen. (Going off a cushion
 * past the head string first would also be legal; the page keeps the simpler rule and the AI never tries it.)
 */
function fromKitchenAtKitchenBall(prev: Match, before: readonly Ball[], log: ShotLog): boolean {
  // Derived from ballsOn, so the referee, the aim and the computer share one rule.
  if (prev.inHand !== "kitchen" || prev.breakShot || log.firstHit === null) return false;
  return ballsOnAnywhere(prev, before).includes(log.firstHit) && !ballsOn(prev, before).includes(log.firstHit);
}

function pass(m: Match): void {
  if (m.players === 2) m.turn = m.turn === 0 ? 1 : 0;
}

/** Applies the rules to a finished shot. `before` is the table as it stood before the shot, `after` as it stopped. */
export function judge(prev: Match, before: readonly Ball[], after: readonly Ball[], log: ShotLog): Verdict {
  const m: Match = { ...prev, scores: [...prev.scores] as [number, number], groups: [...prev.groups] as [Group | null, Group | null] };
  m.shots++;
  m.inHand = null;
  const notes: Note[] = [];
  const respot: number[] = [];
  const cueOff = log.potted.includes(log.cue);
  const objectPots = log.potted.filter((id) => id !== log.cue);

  const wasBreak = prev.breakShot;
  m.breakShot = false;
  let foul = false;
  const foulNote = (key: string, params?: Record<string, string | number>) => {
    foul = true;
    notes.push({ key, params });
  };

  switch (prev.variant) {
    case "8-ball":
    case "chinese-8-ball": {
      const shooter = prev.turn;
      const g = prev.groups[shooter];
      const legal = ballsOn(prev, before);
      if (log.firstHit === null) foulNote("noHit");
      else if (fromKitchenAtKitchenBall(prev, before, log)) foulNote("kitchenBall");
      else if (!legal.includes(log.firstHit)) foulNote("wrongBall");
      if (cueOff) foulNote("scratch");
      if (!foul && !objectPots.length && !log.railAfterContact) foulNote("noRail");
      if (wasBreak && !foul && !objectPots.length && log.objectRails < 4) foulNote("badBreak");
      const eight = objectPots.includes(8);
      if (eight) {
        if (wasBreak) {
          respot.push(8);
          notes.push({ key: "eightSpotted" });
        } else {
          const cleared = g !== null && groupLeft(before, g) === 0;
          // Solo practice: winner 0 means the rack was cleared, 1 that the 8 went down too early.
          m.winner = !foul && cleared ? shooter : ((shooter === 0 ? 1 : 0) as 0 | 1);
          notes.push({ key: !foul && cleared ? "eightWin" : "eightLoss" });
          return { match: m, foul, notes, respot, cueOff };
        }
      }
      // Open table: the first legal pot after the break picks the groups.
      if (!g && !wasBreak && !foul) {
        const first = objectPots.map(groupOf).find((x): x is Group => x !== null);
        if (first) {
          m.groups[shooter] = first;
          m.groups[shooter === 0 ? 1 : 0] = first === "solids" ? "stripes" : "solids";
          notes.push({ key: first === "solids" ? "groupSolids" : "groupStripes" });
        }
      }
      const mine = m.groups[shooter];
      const scored = mine ? objectPots.some((id) => groupOf(id) === mine) : objectPots.some((id) => id !== 8);
      if (foul) {
        pass(m);
        m.inHand = wasBreak && cueOff && prev.variant === "8-ball" ? "kitchen" : "anywhere";
      } else if (!scored && !(wasBreak && objectPots.length)) {
        pass(m);
      }
      break;
    }
    case "9-ball":
    case "10-ball": {
      const money = prev.variant === "9-ball" ? 9 : 10;
      const lo = lowest(before);
      if (log.firstHit === null) foulNote("noHit");
      else if (log.firstHit !== lo) foulNote("wrongBall");
      if (cueOff) foulNote("scratch");
      if (!foul && !objectPots.length && !log.railAfterContact) foulNote("noRail");
      if (wasBreak && !foul && !objectPots.length && log.objectRails < 4) foulNote("badBreak");
      if (objectPots.includes(money)) {
        const lastBall = before.filter((b) => b.on && b.id !== 0).length === 1;
        // Nine-ball: any legal pot of the 9 wins. Ten-ball (no calling here): only as the last ball, never on the break.
        const wins = !foul && (prev.variant === "9-ball" || (lastBall && !wasBreak));
        if (wins) {
          m.winner = prev.turn;
          notes.push({ key: "moneyWin", params: { n: money } });
          return { match: m, foul, notes, respot, cueOff };
        }
        respot.push(money);
        notes.push({ key: "moneySpotted", params: { n: money } });
      }
      if (foul) {
        pass(m);
        m.inHand = "anywhere";
      } else if (!objectPots.length) {
        pass(m);
      }
      break;
    }
    case "snooker":
    case "snooker-6": {
      const legal = ballsOn(prev, before);
      const reds = before.some((b) => b.on && isRed(b.id));
      const clearance = !reds && !prev.onColour;
      // A colour may be nominated by hitting it first.
      const nominated = prev.onColour && log.firstHit !== null && log.firstHit >= SNOOKER_FIRST_COLOUR ? log.firstHit : null;
      const ballOnValue = prev.onColour ? (nominated ? snookerValue(nominated) : 0) : clearance ? snookerValue(legal[0] ?? 0) : 1;
      if (log.firstHit === null) foulNote("noHit");
      else if (!legal.includes(log.firstHit)) foulNote("wrongBall");
      if (cueOff) foulNote("inOff");
      for (const id of objectPots) {
        const ok = prev.onColour ? id === nominated && objectPots.filter((x) => x >= SNOOKER_FIRST_COLOUR).length === 1 && !objectPots.some(isRed) : clearance ? id === legal[0] : isRed(id);
        if (!ok && !notes.some((n) => n.key === "wrongPot")) foulNote("wrongPot");
      }
      const shooter = prev.turn;
      const other = (shooter === 0 ? 1 : 0) as 0 | 1;
      if (foul) {
        const penalty = Math.max(4, ballOnValue, log.firstHit !== null ? snookerValue(log.firstHit) : 0, ...objectPots.map(snookerValue));
        // Solo practice keeps the penalty as a note only.
        if (m.players === 2) m.scores[other] += penalty;
        notes.push({ key: "foulPoints", params: { n: penalty } });
      } else {
        const points = objectPots.reduce((s, id) => s + snookerValue(id), 0);
        m.scores[shooter] += points;
        if (points) {
          m.breakRun += points;
          m.bestBreak = Math.max(m.bestBreak, m.breakRun);
        }
      }
      // Colours come back while reds remain (and after any foul); in the clearance a legal pot stays down.
      // The black that ends the frame (legally or not) stays down. Higher colours are re-spotted first.
      const lastBlack = clearance && legal[0] === SNOOKER_FIRST_COLOUR + 5;
      for (const id of objectPots) {
        if (id < SNOOKER_FIRST_COLOUR || (lastBlack && id === legal[0])) continue;
        if (!clearance || foul) respot.push(id);
      }
      respot.sort((a, b) => b - a);
      const scored = !foul && objectPots.length > 0;
      if (scored) {
        m.onColour = !prev.onColour && !clearance;
      } else {
        m.onColour = false;
        m.breakRun = 0;
        pass(m);
      }
      if (cueOff) m.inHand = "d";
      // Frame over: the table is clear after this shot, or (WPBSA) the first score or foul with only the black left.
      const left = after.filter((b) => b.on && b.id !== 0).length;
      // Solo practice has no opponent to score the foul: only a potted black ends the frame there.
      const blackDone = lastBlack && (objectPots.includes(legal[0]!) || (foul && m.players === 2));
      if ((left === 0 && !respot.length) || blackDone) {
        if (m.players === 1 || m.scores[0] !== m.scores[1]) {
          // Solo: a last black that went down on a foul does not clear the table.
          m.winner = m.players === 1 ? (foul ? 1 : 0) : m.scores[0] > m.scores[1] ? 0 : 1;
          notes.push({ key: "frameOver" });
        } else {
          // A tie: the black is spotted and played again from hand. WPBSA draws lots for who goes first; this
          // uses the shot count as the lot, so it does not depend on who potted or fouled the last black.
          respot.push(SNOOKER_FIRST_COLOUR + 5);
          m.inHand = "d";
          if (m.players === 2) m.turn = (m.shots % 2) as 0 | 1;
          m.breakRun = 0;
          m.onColour = false;
          notes.push({ key: "reSpotBlack" });
        }
      }
      break;
    }
    case "pyramid": {
      const shooter = prev.turn;
      if (log.firstHit === null) foulNote("noHit");
      else if (fromKitchenAtKitchenBall(prev, before, log)) foulNote("kitchenBall");
      else if (!objectPots.length && !cueOff && !log.railAfterContact) foulNote("noRail");
      let points = objectPots.length;
      // Free pyramid: pocketing the cue ball off an object ball scores too, and the cue ball comes back in hand.
      if (cueOff && !foul) points++;
      if (foul) {
        m.scores[shooter] -= 1;
        // Balls potted on a foul go back on the table.
        respot.push(...objectPots);
        notes.push({ key: "minusOne" });
        pass(m);
        if (cueOff) m.inHand = "kitchen";
      } else {
        m.scores[shooter] += points;
        if (cueOff) {
          m.inHand = "kitchen";
          notes.push({ key: "cueScores" });
        }
        if (!points) pass(m);
      }
      const left = after.filter((b) => b.on && b.id !== 0).length + respot.length;
      if (m.scores[shooter] >= m.target || left === 0) {
        m.drawn = m.players === 2 && m.scores[shooter] < m.target && m.scores[0] === m.scores[1];
        m.winner = m.players === 1 ? 0 : m.scores[shooter] >= m.target ? shooter : m.scores[0] >= m.scores[1] ? 0 : 1;
        notes.push({ key: "raceOver" });
      }
      break;
    }
    case "3-cushion": {
      const shooter = prev.turn;
      // UMB: the opening shot must hit the red (id 2) first.
      if (log.caromPoint && !(wasBreak && log.firstHit !== 2)) {
        m.scores[shooter] += 1;
        notes.push({ key: "caromPoint" });
        if (m.scores[shooter] >= m.target) {
          m.winner = shooter;
          notes.push({ key: "raceOver" });
        }
      } else {
        notes.push({ key: "caromMiss" });
        pass(m);
      }
      break;
    }
  }
  // Practice stats count balls that stayed down.
  if (!foul) m.pots += objectPots.filter((id) => !respot.includes(id)).length;
  if (!foul && objectPots.length && TABLE_OF[prev.variant] !== "snooker") notes.unshift({ key: "potted", params: { n: objectPots.length } });
  return { match: m, foul, notes, respot, cueOff };
}
