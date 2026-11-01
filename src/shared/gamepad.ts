/** Button names in the W3C "standard" gamepad layout, Xbox name first, PlayStation second. */
export const STANDARD_BUTTONS = [
  "A / ✕", "B / ○", "X / □", "Y / △",
  "LB / L1", "RB / R1", "LT / L2", "RT / R2",
  "View / Share", "Menu / Options", "LS / L3", "RS / R3",
  "↑", "↓", "←", "→", "Home",
] as const;

/** Button label: the standard name when the layout is standard, otherwise its number. */
export function buttonLabel(index: number, standard: boolean): string {
  return (standard && STANDARD_BUTTONS[index]) || `B${index}`;
}

/** Distance of a stick from centre, 0 to about 1 (some sticks reach a little past 1 on the diagonals). */
export function stickDistance(x: number, y: number): number {
  const d = Math.hypot(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0);
  return Math.round(d * 1000) / 1000;
}

/** Where a stick that is not being touched sits: "centered" under 0.05, "slight" under 0.15, else "drift". */
export function restVerdict(distance: number): "centered" | "slight" | "drift" {
  if (distance < 0.05) return "centered";
  if (distance < 0.15) return "slight";
  return "drift";
}

/** An axis or button value with a sign and two decimals ("+0.25", "−1.00", "0.00"). */
export function axisText(v: number): string {
  const r = Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
  if (r === 0) return "0.00";
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}`;
}
