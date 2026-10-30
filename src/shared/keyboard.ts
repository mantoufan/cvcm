/** [event.code, keycap label, width in key units]. A null code is a gap. */
export type Key = readonly [string | null, string, number];

export const MAIN_ROWS: ReadonlyArray<ReadonlyArray<Key>> = [
  [["Escape", "Esc", 1], [null, "", 1], ["F1", "F1", 1], ["F2", "F2", 1], ["F3", "F3", 1], ["F4", "F4", 1], [null, "", 0.5], ["F5", "F5", 1], ["F6", "F6", 1], ["F7", "F7", 1], ["F8", "F8", 1], [null, "", 0.5], ["F9", "F9", 1], ["F10", "F10", 1], ["F11", "F11", 1], ["F12", "F12", 1]],
  [["Backquote", "`", 1], ["Digit1", "1", 1], ["Digit2", "2", 1], ["Digit3", "3", 1], ["Digit4", "4", 1], ["Digit5", "5", 1], ["Digit6", "6", 1], ["Digit7", "7", 1], ["Digit8", "8", 1], ["Digit9", "9", 1], ["Digit0", "0", 1], ["Minus", "-", 1], ["Equal", "=", 1], ["Backspace", "Backspace", 2]],
  [["Tab", "Tab", 1.5], ["KeyQ", "Q", 1], ["KeyW", "W", 1], ["KeyE", "E", 1], ["KeyR", "R", 1], ["KeyT", "T", 1], ["KeyY", "Y", 1], ["KeyU", "U", 1], ["KeyI", "I", 1], ["KeyO", "O", 1], ["KeyP", "P", 1], ["BracketLeft", "[", 1], ["BracketRight", "]", 1], ["Backslash", "\\", 1.5]],
  [["CapsLock", "Caps Lock", 1.75], ["KeyA", "A", 1], ["KeyS", "S", 1], ["KeyD", "D", 1], ["KeyF", "F", 1], ["KeyG", "G", 1], ["KeyH", "H", 1], ["KeyJ", "J", 1], ["KeyK", "K", 1], ["KeyL", "L", 1], ["Semicolon", ";", 1], ["Quote", "'", 1], ["Enter", "Enter", 2.25]],
  [["ShiftLeft", "Shift", 2.25], ["KeyZ", "Z", 1], ["KeyX", "X", 1], ["KeyC", "C", 1], ["KeyV", "V", 1], ["KeyB", "B", 1], ["KeyN", "N", 1], ["KeyM", "M", 1], ["Comma", ",", 1], ["Period", ".", 1], ["Slash", "/", 1], ["ShiftRight", "Shift", 2.75]],
  [["ControlLeft", "Ctrl", 1.25], ["MetaLeft", "Win ⌘", 1.25], ["AltLeft", "Alt", 1.25], ["Space", "Space", 6.25], ["AltRight", "Alt", 1.25], ["MetaRight", "Win ⌘", 1.25], ["ContextMenu", "Menu", 1.25], ["ControlRight", "Ctrl", 1.25]],
];

export const NAV_ROWS: ReadonlyArray<ReadonlyArray<Key>> = [
  [["PrintScreen", "PrtSc", 1], ["ScrollLock", "ScrLk", 1], ["Pause", "Pause", 1]],
  [["Insert", "Ins", 1], ["Home", "Home", 1], ["PageUp", "PgUp", 1]],
  [["Delete", "Del", 1], ["End", "End", 1], ["PageDown", "PgDn", 1]],
  [[null, "", 1], [null, "", 1], [null, "", 1]],
  [[null, "", 1], ["ArrowUp", "↑", 1], [null, "", 1]],
  [["ArrowLeft", "←", 1], ["ArrowDown", "↓", 1], ["ArrowRight", "→", 1]],
];

export const NUMPAD_ROWS: ReadonlyArray<ReadonlyArray<Key>> = [
  [[null, "", 1], [null, "", 1], [null, "", 1], [null, "", 1]],
  [["NumLock", "Num", 1], ["NumpadDivide", "/", 1], ["NumpadMultiply", "*", 1], ["NumpadSubtract", "-", 1]],
  [["Numpad7", "7", 1], ["Numpad8", "8", 1], ["Numpad9", "9", 1], ["NumpadAdd", "+", 1]],
  [["Numpad4", "4", 1], ["Numpad5", "5", 1], ["Numpad6", "6", 1], [null, "", 1]],
  [["Numpad1", "1", 1], ["Numpad2", "2", 1], ["Numpad3", "3", 1], ["NumpadEnter", "Enter", 1]],
  [["Numpad0", "0", 2], ["NumpadDecimal", ".", 1], [null, "", 1]],
];

export const ALL_CODES: ReadonlySet<string> = new Set(
  [...MAIN_ROWS, ...NAV_ROWS, ...NUMPAD_ROWS].flat().map(([code]) => code).filter((c): c is string => c !== null),
);

/** Location names for KeyboardEvent.location. */
export const LOCATIONS = ["standard", "left", "right", "numpad"] as const;
