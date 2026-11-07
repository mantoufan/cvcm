import { h } from "../dom";
import { locale, t } from "../i18n";
import { CONSOLE_CONTROLS } from "../../shared/game-controls";
import type { GameConsoleId, GameId } from "../../shared/games";
import { clearDraft, loadDraft, saveDraft } from "../session";

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

type SavedRom = { blob: Blob; name: string };

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

export function player(spec: {
  id?: GameId;
  remember?: boolean;
  console: GameConsoleId;
  core: string;
  accept: string;
  name: string;
  romUrl: string | null;
  cheats: { name: string; code: string }[];
}): HTMLElement {
  const flash = spec.console === "flash";
  const box = h("section", { class: "game-play", "aria-label": t("games.play") });
  const { frame, boot: bootFrame } = gameFrame({ flash, core: spec.core, name: spec.name });
  const status = h("p", { class: "game-note", role: "status" }, t(flash ? "games.flash.needFileBody" : "games.byoNote"));
  const picker = h("input", {
    type: "file",
    accept: spec.accept,
    class: "game-rom-input",
    "aria-label": t(flash ? "games.flash.load" : "games.loadRom"),
  }) as HTMLInputElement;
  const empty = gameEmpty({ flash, picker, hidden: !!spec.romUrl });
  const showEmpty = (): void => { empty.hidden = false; };
  const boot = (payload: Record<string, unknown>): void => {
    empty.hidden = true;
    bootFrame(payload);
  };

  // Opt-in only: page copy promises a picked file stays in the tab unless the player saves it here.
  const remember = !!(spec.remember && spec.id);
  const savedKey = `rom:${spec.id ?? ""}`;
  let current: SavedRom | null = null; // local file now playing
  let stored = false; // a ROM for this game is in IndexedDB
  let currentStored = false; // ...and it is the one now playing
  let busy = false;
  let reads = 0; // a newer pick makes a slower, earlier read stale
  const rememberBtn = h("button", { class: "btn ghost", type: "button", hidden: true }, t("games.rememberRom")) as HTMLButtonElement;
  const forgetBtn = h("button", { class: "btn ghost", type: "button", hidden: true }, t("games.forgetRom")) as HTMLButtonElement;
  // Move focus only if the user has not gone elsewhere during a slow save.
  const refocus = (target: HTMLButtonElement): void => {
    const active = document.activeElement;
    if (!target.hidden && (active === document.body || active === rememberBtn || active === forgetBtn)) target.focus();
  };
  const sync = (): void => {
    rememberBtn.hidden = !(remember && current && !currentStored);
    forgetBtn.hidden = !(remember && stored);
    rememberBtn.disabled = busy;
    forgetBtn.disabled = busy;
  };
  rememberBtn.addEventListener("click", () => {
    const rom = current;
    if (!rom || busy) return;
    busy = true;
    sync();
    void navigator.storage?.persist?.().catch(() => false);
    saveDraft(savedKey, rom).then(() => {
      stored = true;
      if (current === rom) {
        currentStored = true;
        status.textContent = t("games.rememberedRom");
      }
    }).catch(() => {
      if (current === rom) status.textContent = t("games.rememberFailed");
    }).finally(() => {
      busy = false;
      sync();
      refocus(forgetBtn.hidden ? rememberBtn : forgetBtn);
    });
  });
  forgetBtn.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    sync();
    clearDraft(savedKey).then(() => {
      stored = false;
      currentStored = false;
      status.textContent = t("games.forgotRom");
    }).catch(() => {
      /* still stored: Forget stays available to retry */
    }).finally(() => {
      busy = false;
      sync();
      refocus(rememberBtn.hidden ? forgetBtn : rememberBtn);
    });
  });

  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    status.textContent = flash ? file.name : t("games.loadRomHint");
    if (remember) {
      // Keep the File (a Blob) rather than a second ArrayBuffer copy.
      current = { blob: file, name: file.name };
      currentStored = false;
      sync();
    }
    const read = ++reads;
    try {
      const buffer = await file.arrayBuffer();
      if (read === reads) boot({ buffer, filename: file.name, cheats: spec.cheats });
      // With nothing hosted to race against, the same file can be opened again.
      if (!spec.romUrl) picker.value = "";
    } catch {
      if (read !== reads) return;
      status.textContent = t("romEmulator.readFailed");
      // The file can be picked again, and an unreadable one must not be offered to Remember.
      picker.value = "";
      current = null;
      sync();
    }
  });

  box.append(
    h("div", { class: "game-stage" }, frame, empty),
    h("div", { class: "game-playbar" },
      h("label", { class: "btn" }, t(flash ? "games.flash.load" : "games.loadRom"), picker),
      rememberBtn,
      forgetBtn,
      status,
    ),
    h("p", { class: "game-note muted" }, t(flash ? "games.flash.emulator" : "games.emulator"), " · ", t(flash ? "games.flash.mobile" : "games.mobile")),
    controls(spec.console),
  );

  const tryHosted = (romUrl: string): void => {
    void fetch(romUrl, { method: "HEAD" }).then((res) => {
      if (picker.files?.length) return;
      if (!res.ok) {
        showEmpty();
        return;
      }
      status.textContent = t("games.hostedNote");
      boot({ rom: romUrl, cheats: spec.cheats });
    }).catch(() => {
      if (!picker.files?.length) showEmpty();
    });
  };

  if (spec.romUrl) {
    const romUrl = spec.romUrl;
    queueMicrotask(() => {
      if (!remember || typeof indexedDB === "undefined") {
        tryHosted(romUrl);
        return;
      }
      loadDraft<SavedRom>(savedKey).then(async (saved) => {
        if (picker.files?.length) return;
        if (!saved || !(saved.blob instanceof Blob)) {
          tryHosted(romUrl);
          return;
        }
        // Mark it stored first so an unreadable entry can still be forgotten.
        stored = true;
        sync();
        const buffer = await saved.blob.arrayBuffer();
        if (picker.files?.length) return;
        current = saved;
        // Forget may have finished while the blob was being read.
        currentStored = stored;
        sync();
        status.textContent = t("games.savedRomLoaded");
        boot({ buffer, filename: saved.name, cheats: spec.cheats });
      }).catch(() => tryHosted(romUrl));
    });
  }
  return box;
}

export function controls(consoleId: GameConsoleId): HTMLElement {
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
