import type { GameConsoleId } from "./games";

export type ControlRow = {
  action: string;
  keys: string;
};

// EmulatorJS default keyboard map (emulator.min.js `defaultControllers`):
// B=X, Y=S, Select=V, Start=Enter, A=Z, X=A, L=Q, R=E. Mega Drive A/B/C sit on Y/B/A, i.e. S/X/Z.
const NES: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "b", keys: "X" },
  { action: "a", keys: "Z" },
  { action: "select", keys: "V" },
  { action: "start", keys: "Enter" },
];

const SNES: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "y", keys: "S" },
  { action: "x", keys: "A" },
  { action: "b", keys: "X" },
  { action: "a", keys: "Z" },
  { action: "l", keys: "Q" },
  { action: "r", keys: "E" },
  { action: "select", keys: "V" },
  { action: "start", keys: "Enter" },
];

const GB: ControlRow[] = NES;

const GBA: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "b", keys: "X" },
  { action: "a", keys: "Z" },
  { action: "l", keys: "Q" },
  { action: "r", keys: "E" },
  { action: "select", keys: "V" },
  { action: "start", keys: "Enter" },
];

const MD: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "a", keys: "S" },
  { action: "b", keys: "X" },
  { action: "c", keys: "Z" },
  { action: "start", keys: "Enter" },
];

const FLASH: ControlRow[] = [
  { action: "pointer", keys: "Mouse" },
  { action: "primary", keys: "Click" },
  { action: "secondary", keys: "Right click" },
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "start", keys: "Enter" },
];

export const CONSOLE_CONTROLS: Record<GameConsoleId, ControlRow[]> = {
  fc: NES,
  sfc: SNES,
  gb: GB,
  gbc: GB,
  gba: GBA,
  md: MD,
  flash: FLASH,
};
