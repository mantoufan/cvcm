import { h } from "../dom";
import { locale, t } from "../i18n";
import { CONSOLE_CONTROLS } from "../../shared/game-controls";
import type { DemoRom } from "../../shared/demo-roms";
import { GAME_ROM_BASE, type EmuConsoleId } from "../../shared/games";
import { clearDraftsWithPrefix } from "../session";

const GAME_SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => {
    if (!GAME_SCROLL_KEYS.has(event.key)) return;
    const active = document.activeElement;
    if (active instanceof HTMLIFrameElement && active.classList.contains("game-frame")) {
      event.preventDefault();
    }
  });
}

/** The emulator iframe. `boot` may override `core` and `name` for tools where the file decides them. */
export function gameFrame(spec: { flash: boolean; core: string; name: string }): {
  frame: HTMLIFrameElement;
  boot: (payload: Record<string, unknown>) => void;
  stop: () => void;
  focus: () => void;
} {
  const initial = h("iframe", {
    class: "game-frame",
    title: spec.name,
    allow: "autoplay; fullscreen; gamepad",
    src: "about:blank",
  }) as HTMLIFrameElement;
  let frame = initial;
  const shellPath = spec.flash ? "/emu/flash" : "/emu/player";
  let loads = 0;
  // The shell boots once, so every ROM gets a new element. Navigating the old one would add a history entry, and Back
  // would land on a shell with no ROM. A discarded element also takes its pending load listener with it.
  const swap = (src: string): HTMLIFrameElement => {
    const next = frame.cloneNode(false) as HTMLIFrameElement;
    next.src = src;
    frame.replaceWith(next);
    frame = next;
    return next;
  };
  const boot = (payload: Record<string, unknown>): void => {
    const message = { type: "boot", core: spec.core, name: spec.name, ...payload };
    const lang = locale() === "zh-CN" ? "zh-CN" : "en-US";
    // Only the page's own title goes in the URL: `message.name` can be a local file name, which must not reach the server.
    const qs = new URLSearchParams({ core: message.core, name: spec.name, lang });
    if (typeof payload.rom === "string") qs.set("rom", payload.rom);
    loads += 1;
    const target = swap(`${shellPath}?v=${spec.flash ? "1" : "5"}&${qs.toString()}${loads > 1 ? `&n=${loads}` : ""}`);
    target.addEventListener("load", () => {
      target.contentWindow?.postMessage(message, location.origin);
    }, { once: true });
  };
  return {
    frame: initial,
    boot,
    stop: () => { if (loads) swap("about:blank"); },
    focus: () => { frame.focus(); },
  };
}

/** The "no file" panel. */
export function gameEmpty(spec: { flash: boolean; picker: HTMLInputElement; hidden: boolean }): HTMLElement {
  const { flash, picker } = spec;
  const empty = h("div", { class: "game-empty", role: "status", hidden: spec.hidden },
    h("p", { class: "game-empty-title" }, t(flash ? "games.flash.needFile" : "games.needFile")),
    h("p", null, t(flash ? "games.flash.needFileBody" : "games.needFileBody")),
    h("button", { class: "btn", type: "button" }, t(flash ? "games.flash.load" : "games.loadRom")),
  );
  empty.querySelector("button")?.addEventListener("click", () => { picker.click(); });
  return empty;
}

/** Buttons that start one of the hosted open-source games (src/shared/demo-roms.ts), with their credit lines. */
export function demoPicker<T extends DemoRom>(roms: readonly T[], start: (rom: T) => void): HTMLElement {
  // A retired game page redirects to #demo-<id>: that game's button is marked, for the visitor to start (a mount makes
  // no network calls, so it does not boot the emulator by itself).
  const linked = linkedDemo(roms);
  return h("section", { class: "game-demos", "aria-labelledby": "game-demos-title" },
    h("h2", { id: "game-demos-title" }, t("games.demos.title")),
    h("p", { class: "game-note" }, t("games.demos.lead")),
    // One row per console, labelled when the list spans more than one (the ROM emulator; the Flash player has one).
    ...[...new Set(roms.map((rom) => rom.console))].map((consoleId, _, all) =>
      h("div", { class: "game-demo-row" },
        ...(all.length > 1 ? [h("span", { class: "game-demo-console" }, t(`games.consoles.${consoleId}`))] : []),
        ...roms.filter((rom) => rom.console === consoleId).map((rom) => {
          const button = h("button", { class: "btn ghost" + (rom === linked ? " on" : ""), type: "button", "data-demo": rom.id, "aria-current": rom === linked ? "true" : undefined }, rom.title) as HTMLButtonElement;
          button.addEventListener("click", () => start(rom));
          return button;
        }),
      )),
    h("ul", { class: "game-demo-credits game-note muted" },
      ...roms.map((rom) =>
        h("li", null,
          `${rom.title} · ${rom.author}, ${rom.year} · ${rom.license} · `,
          h("a", { href: rom.source, target: "_blank", rel: "noopener noreferrer" }, t("games.demos.source")),
        ),
      ),
    ),
  );
}

const FORGOT_KEY = "cvcm.emu.forgotRoms";

/**
 * The retired game pages could keep a visitor's own ROM or SWF in IndexedDB ("rom:<game id>", Remember in this browser).
 * Those pages are gone, and with them the Forget button, so both players clear what they stored, once per browser
 * (marked only after the delete succeeded).
 */
export function forgetRetiredRoms(): void {
  try {
    if (typeof indexedDB === "undefined" || localStorage.getItem(FORGOT_KEY)) return;
  } catch {
    return;
  }
  clearDraftsWithPrefix("rom:").then(() => {
    try {
      localStorage.setItem(FORGOT_KEY, "1");
    } catch {
      /* tried again next visit */
    }
  }).catch(() => {});
}

/** The demo a `#demo-<id>` link asks for (a retired game page redirects there), if it is one of these. */
export function linkedDemo<T extends DemoRom>(roms: readonly T[]): T | undefined {
  const id = /^#demo-([a-z0-9-]+)$/.exec(typeof location === "undefined" ? "" : location.hash)?.[1];
  return roms.find((rom) => rom.id === id);
}

/** The Flash player: a local .swf, or one of the hosted demo games. (The ROM emulator builds its own from the parts above.) */
export function player(spec: { name: string; demos?: readonly DemoRom[] }): HTMLElement {
  const box = h("section", { class: "game-play", "aria-label": t("games.play") });
  const { frame, boot: bootFrame, focus } = gameFrame({ flash: true, core: "ruffle", name: spec.name });
  const status = h("p", { class: "game-note", role: "status" }, t("games.flash.needFileBody"));
  const picker = h("input", {
    type: "file",
    accept: ".swf",
    class: "game-rom-input",
    "aria-label": t("games.flash.load"),
  }) as HTMLInputElement;
  const empty = gameEmpty({ flash: true, picker, hidden: false });
  const boot = (payload: Record<string, unknown>): void => {
    empty.hidden = true;
    bootFrame(payload);
  };
  let reads = 0; // a newer pick (or a demo) makes a slower, earlier read stale
  const startDemo = (rom: DemoRom): void => {
    reads += 1;
    status.textContent = t("games.demos.playing", { title: rom.title });
    boot({ rom: `${GAME_ROM_BASE}${rom.file}`, name: rom.title, cheats: [] });
    // Keyboard games (Ending) take the arrow keys at once, as the ROM emulator's demos do.
    focus();
  };

  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    status.textContent = file.name;
    const read = ++reads;
    // The same file can be opened again.
    picker.value = "";
    try {
      const buffer = await file.arrayBuffer();
      if (read === reads) boot({ buffer, filename: file.name, cheats: [] });
    } catch {
      if (read === reads) status.textContent = t("romEmulator.readFailed");
    }
  });

  box.append(
    h("div", { class: "game-stage" }, frame, empty),
    h("div", { class: "game-playbar" },
      h("label", { class: "btn" }, t("games.flash.load"), picker),
      status,
    ),
    h("p", { class: "game-note muted" }, t("games.flash.emulator"), " · ", t("games.flash.mobile")),
    ...(spec.demos?.length ? [demoPicker(spec.demos, startDemo)] : []),
    controls("flash"),
  );
  forgetRetiredRoms();
  return box;
}

export function controls(consoleId: EmuConsoleId): HTMLElement {
  const rows = CONSOLE_CONTROLS[consoleId];
  return h("section", { class: "game-controls", "aria-labelledby": "controls-title" },
    h("h2", { id: "controls-title" }, t("games.controls.title")),
    h("p", { class: "game-note" }, t(consoleId === "flash" ? "games.flash.mobile" : "games.controls.touch")),
    h("div", { class: "control-table" },
      ...rows.map((row) =>
        h("div", { class: "control-row" },
          h("span", { class: "control-action" }, t(`games.controls.${row.action}`)),
          h("kbd", null, row.keys),
        ),
      ),
    ),
  );
}
