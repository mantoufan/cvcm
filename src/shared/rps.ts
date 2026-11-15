/** Rock paper scissors, and the five-move Rock Paper Scissors Lizard Spock (Sam Kass and Karen Bryla's rules). */

export const MOVES = ["rock", "paper", "scissors", "lizard", "spock"] as const;
export type Move = (typeof MOVES)[number];
export type Variant = "classic" | "spock";
export const VARIANTS: readonly Variant[] = ["classic", "spock"];

export function movesOf(variant: Variant): readonly Move[] {
  return variant === "classic" ? MOVES.slice(0, 3) : MOVES;
}

/** Each move, what it beats and the verb (a key under rps.v_* in the locale packs). */
const BEATS: Record<Move, Partial<Record<Move, string>>> = {
  rock: { scissors: "crushes", lizard: "crushes" },
  paper: { rock: "covers", spock: "disproves" },
  scissors: { paper: "cuts", lizard: "decapitates" },
  lizard: { paper: "eats", spock: "poisons" },
  spock: { scissors: "smashes", rock: "vaporizes" },
};

export type Result = "win" | "lose" | "draw";

/** The round from the first player's side. */
export function play(a: Move, b: Move): Result {
  if (a === b) return "draw";
  return BEATS[a][b] ? "win" : "lose";
}

/** Why the winner won: { winner, verb, loser }, or null for a draw. */
export function reason(a: Move, b: Move): { winner: Move; verb: string; loser: Move } | null {
  if (a === b) return null;
  const verb = BEATS[a][b];
  return verb ? { winner: a, verb, loser: b } : { winner: b, verb: BEATS[b][a]!, loser: a };
}

/** First to `target` wins (0 = no match, play on). */
export const TARGETS = [0, 2, 3, 4] as const;
export type Target = (typeof TARGETS)[number];

export type Score = { win: number; lose: number; draw: number };

/** "win" or "lose" when someone has reached the target, else null. */
export function matchOver(score: Score, target: Target): "win" | "lose" | null {
  if (!target) return null;
  if (score.win >= target) return "win";
  if (score.lose >= target) return "lose";
  return null;
}

/** A zeroed tally of throws per move, for the stats line. */
export function noThrows(): Record<Move, number> {
  return { rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 };
}
