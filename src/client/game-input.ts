import { h } from "./dom";
import { t } from "./i18n";

/** Shared bits of the open-source game pages (2048, dinosaur game, mahjong, chess, Chinese chess). */

export type Swipe = "up" | "right" | "down" | "left";

/** A swipe of at least `min` CSS pixels along its main axis (the 2048 original uses 10). */
export function swipeDirection(dx: number, dy: number, min = 10): Swipe | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < min) return null;
  return ax > ay ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

/** Keys typed into a field must not also move pieces or make the dinosaur jump. */
export function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * "Based on X by Y (licence) · source": the credit and source link every open-source game page shows, as the
 * licences ask. `key` names a string with `{name}` (linked to `url`) and the rest as plain text.
 */
export function creditLine(key: string, url: string, name: string): HTMLParagraphElement {
  const [before, after] = t(key, { name: "\u0000" }).split("\u0000");
  return h("p", { class: "hint game-credit" }, before ?? "", h("a", { href: url, rel: "noopener", target: "_blank" }, name), after ?? "");
}

/** At least half of the element is inside the viewport (page-wide game keys only act then). */
export function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (!r.height) return false;
  const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  return visible >= r.height / 2;
}

/** Reads JSON from localStorage; private mode, a blocked store or bad JSON give null. */
export function readStore<T>(key: string): T | null {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

/** Writes JSON to localStorage (null removes the key); failures are ignored, the game just is not kept. */
export function writeStore(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode.
  }
}

/** Uniform in [0, 1) from Web Crypto. */
export function cryptoRand(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 0x1_0000_0000;
}
