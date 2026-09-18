import type { GameConsoleId } from "./games";

export type ControlRow = {
  action: string;
  keys: string;
};

const NES: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "b", keys: "Z" },
  { action: "a", keys: "X" },
  { action: "select", keys: "Shift" },
  { action: "start", keys: "Enter" },
];

const SNES: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "y", keys: "A" },
  { action: "x", keys: "S" },
  { action: "b", keys: "Z" },
  { action: "a", keys: "X" },
  { action: "l", keys: "Q" },
  { action: "r", keys: "W" },
  { action: "select", keys: "Shift" },
  { action: "start", keys: "Enter" },
];

const GB: ControlRow[] = NES;

const GBA: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "b", keys: "Z" },
  { action: "a", keys: "X" },
  { action: "l", keys: "Q" },
  { action: "r", keys: "W" },
  { action: "select", keys: "Shift" },
  { action: "start", keys: "Enter" },
];

const MD: ControlRow[] = [
  { action: "move", keys: "← ↑ ↓ →" },
  { action: "a", keys: "A" },
  { action: "b", keys: "S" },
  { action: "c", keys: "D" },
  { action: "start", keys: "Enter" },
];

export const CONSOLE_CONTROLS: Record<GameConsoleId, ControlRow[]> = {
  fc: NES,
  sfc: SNES,
  gb: GB,
  gbc: GB,
  gba: GBA,
  md: MD,
};
