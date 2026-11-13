/** Random team generator: split a list of names into balanced teams with an unbiased crypto shuffle. */

import { randomBelow } from "./random";

export const MAX_NAMES = 500;
export const MAX_TEAMS = 50;

/**
 * One name per line. A single-line list is split on commas instead, so "Smith, John" pasted from a column stays one
 * person. Blank entries are dropped, duplicates kept (two people can share a name).
 */
export function parseNames(text: string): string[] {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : text.split(/[,，、;；]/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Fisher–Yates from the end. Sudoku puzzle numbers and colour plates depend on this exact order of draws. */
export function shuffle<T>(items: readonly T[], below: (n: number) => number = randomBelow): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = below(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** How many teams: "count" asks for that many teams, "size" for teams of about that many people. */
export function teamCount(names: number, mode: "count" | "size", value: number): number {
  const n = requestedTeams(names, mode, value);
  return Math.min(n, names, MAX_TEAMS);
}

/** Teams the settings ask for before the caps (one per name, MAX_TEAMS); 0 for invalid input. */
export function requestedTeams(names: number, mode: "count" | "size", value: number): number {
  if (names <= 0 || !Number.isInteger(value) || value < 1) return 0;
  return mode === "count" ? value : Math.ceil(names / value);
}

export type TeamPlan =
  | { ok: false; error: "needTwo" | "tooMany" | "badNumber" | "oneTeam" }
  | { ok: true; teams: number; capped: boolean };

/** The one set of rules for both the live preview and Generate. */
export function planTeams(names: number, mode: "count" | "size", value: number): TeamPlan {
  if (names < 2) return { ok: false, error: "needTwo" };
  if (names > MAX_NAMES) return { ok: false, error: "tooMany" };
  if (!Number.isInteger(value) || value < 1) return { ok: false, error: "badNumber" };
  const teams = teamCount(names, mode, value);
  if (teams < 2) return { ok: false, error: "oneTeam" };
  return { ok: true, teams, capped: requestedTeams(names, mode, value) > teams };
}

/** Deals shuffled names round-robin, so team sizes differ by at most one. */
export function makeTeams(names: readonly string[], count: number, below?: (n: number) => number): string[][] {
  if (count < 1) return [];
  const teams: string[][] = Array.from({ length: count }, () => []);
  // Which teams get the extra person is random too, not always the first ones.
  const order = shuffle(teams.map((_, i) => i), below);
  shuffle(names, below).forEach((name, i) => teams[order[i % count]!]!.push(name));
  return teams;
}
