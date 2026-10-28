export type Phase = "focus" | "short" | "long";

/** Minutes per phase and how many focus sessions come before a long break. */
export type PomodoroSettings = { focus: number; short: number; long: number; rounds: number };

export const DEFAULT_POMODORO: PomodoroSettings = { focus: 25, short: 5, long: 15, rounds: 4 };

export const MAX_MINUTES = 180;
export const MAX_ROUNDS = 12;

/** Whole minutes 1–180 and rounds 1–12, or null when any field is out of range. */
export function normalizeSettings(input: Partial<Record<keyof PomodoroSettings, number>>): PomodoroSettings | null {
  const out = { ...DEFAULT_POMODORO };
  for (const key of ["focus", "short", "long", "rounds"] as const) {
    const raw = input[key];
    if (raw == null) continue;
    if (!Number.isFinite(raw)) return null;
    const n = Math.floor(raw);
    const max = key === "rounds" ? MAX_ROUNDS : MAX_MINUTES;
    if (n < 1 || n > max) return null;
    out[key] = n;
  }
  return out;
}

export function phaseSeconds(settings: PomodoroSettings, phase: Phase): number {
  return settings[phase] * 60;
}

/**
 * Phase after the current one ends. `completedFocus` counts focus sessions finished so far
 * (including the one that just ended when `phase` is "focus").
 */
export function nextPhase(phase: Phase, completedFocus: number, rounds: number): Phase {
  if (phase !== "focus") return "focus";
  const r = Math.max(1, Math.floor(rounds));
  return completedFocus > 0 && completedFocus % r === 0 ? "long" : "short";
}

export function mmss(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
