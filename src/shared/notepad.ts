/** Online notepad: the saved note, and a file name for downloading it. */

import { titleStem } from "./filename";

export type Note = { text: string; savedAt: number };

/** Longest note kept (characters): well under the ~5 MB localStorage quota even as UTF-16. */
export const MAX_NOTE = 1_000_000;

/** Reads the note saved by an earlier visit; anything malformed reads as no note. */
export function parseNote(raw: string | null): Note | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const { text, savedAt } = data as Partial<Note>;
    if (typeof text !== "string") return null;
    return { text: text.slice(0, MAX_NOTE), savedAt: typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : 0 };
  } catch {
    return null;
  }
}

/**
 * A .txt file name from the note's first line ("Shopping list.txt"), without characters file systems refuse;
 * `fallback` (e.g. "note-2026-11-03") when the first line has nothing usable.
 */
export function noteFileName(text: string, fallback: string): string {
  const first = text.split("\n").find((l) => l.trim()) ?? "";
  return `${titleStem(first) || fallback}.txt`;
}
