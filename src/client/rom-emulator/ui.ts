import { h } from "../dom";
import { locale, t } from "../i18n";
import { controls, demoPicker, gameEmpty, gameFrame, linkedDemo } from "../games/player";
import { ROM_DEMOS } from "../../shared/demo-roms";
import { clearDraft } from "../session";
import { GAME_ROM_BASE, LEGACY_GAME_IDS } from "../../shared/games";
import { gamesHref } from "../../shared/path";
import { MAX_ROM_BYTES, ROM_ACCEPT, ROM_CONSOLES, ROM_CORE, detectRomConsole, type RomConsoleId } from "../../shared/rom-detect";

const AUTO = "auto";

// A newer file or an unmount makes an in-flight read stale.
let token = 0;

export function mountRomEmulator(host: HTMLElement): void {
  const loc = locale();
  const name = t("romEmulator.title");
  const { frame, boot, stop, focus } = gameFrame({ flash: false, core: ROM_CORE.fc, name });
  const picker = h("input", {
    type: "file",
    accept: ROM_ACCEPT,
    class: "game-rom-input",
    "aria-label": t("games.loadRom"),
  }) as HTMLInputElement;
  const empty = gameEmpty({ flash: false, picker, hidden: false });
  const status = h("p", { class: "game-note", role: "status", "data-out": "status" });
  const select = h("select", { "data-field": "console" },
    h("option", { value: AUTO }, t("romEmulator.auto")),
    ...ROM_CONSOLES.map((id) => h("option", { value: id }, t(`games.consoles.${id}`))),
  ) as HTMLSelectElement;
  const controlsHost = h("div", { "data-out": "controls" });

  let rom: { name: string; buffer: ArrayBuffer } | null = null;
  // What the frame is running: choosing a console that needs the same core must not restart the game.
  let running: { rom: object; core: string } | null = null;

  let reading = false;
  // The demo game now running, if any: its console is fixed, so the select shows it and the next file starts on Auto.
  let demoConsole: RomConsoleId | null = null;
  // Arrowing through a closed select changes it once per key, so focus stays there until the visitor leaves it.
  let keyed = false;

  const play = (): void => {
    if (!rom || reading) return;
    const chosen = select.value === AUTO ? null : (select.value as RomConsoleId);
    const consoleId = chosen ?? detectRomConsole(rom.name, new Uint8Array(rom.buffer));
    if (!consoleId) {
      // The prompt is about this file, so the last game cannot keep running behind it.
      stop();
      running = null;
      controlsHost.replaceChildren();
      empty.hidden = true;
      status.textContent = t("romEmulator.unknown");
      select.focus();
      return;
    }
    const label = t(`games.consoles.${consoleId}`);
    status.textContent = t(chosen ? "romEmulator.chosen" : "romEmulator.detected", { console: label });
    controlsHost.replaceChildren(controls(consoleId));
    empty.hidden = true;
    const core = ROM_CORE[consoleId];
    if (running?.rom !== rom || running.core !== core) {
      running = { rom, core };
      boot({ buffer: rom.buffer, filename: rom.name, core, name: rom.name, cheats: [] });
    }
    // Left on the select after a mouse choice, the arrow keys used to play would change the console and restart the game.
    if (!keyed) focus();
  };

  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) return;
    const mine = ++token;
    // Lets the same file be picked again, after a failed read or a wrong console choice.
    picker.value = "";
    // The last game keeps running until this file is known to be usable.
    if (file.size > MAX_ROM_BYTES) {
      reading = false;
      status.textContent = t("romEmulator.tooBig", { mb: MAX_ROM_BYTES / 1024 / 1024 });
      return;
    }
    reading = true;
    status.textContent = t("romEmulator.reading");
    file.arrayBuffer().then((buffer) => {
      if (mine !== token) return;
      reading = false;
      // A choice made for the last file or shown for a demo says nothing about this one; one made before any file is
      // the answer for it.
      if (rom || demoConsole) select.value = AUTO;
      demoConsole = null;
      rom = { name: file.name, buffer };
      play();
    }).catch(() => {
      if (mine !== token) return;
      reading = false;
      status.textContent = t("romEmulator.readFailed");
    });
  });
  // A hosted open-source game: the console is known, and a pending file read becomes stale.
  const startDemo = (demo: (typeof ROM_DEMOS)[number]): void => {
    token += 1;
    reading = false;
    rom = null;
    running = null;
    demoConsole = demo.console;
    select.value = demoConsole;
    status.textContent = t("games.demos.playing", { title: demo.title });
    controlsHost.replaceChildren(controls(demo.console));
    empty.hidden = true;
    boot({ rom: `${GAME_ROM_BASE}${demo.file}`, core: ROM_CORE[demo.console], name: demo.title, cheats: [] });
    focus();
  };
  select.addEventListener("keydown", () => { keyed = true; });
  select.addEventListener("change", () => {
    // Chosen while a demo plays: the demo keeps running, and the choice is the answer for the next file.
    if (!rom) demoConsole = null;
    play();
    keyed = false;
  });

  host.append(
    h("header", { class: "tool-head game-head" },
      h("h1", null, name),
      h("p", { class: "lede" }, t("romEmulator.privacyNote")),
    ),
    h("section", { class: "game-play", "aria-label": t("games.play") },
      h("div", { class: "game-stage" }, frame, empty),
      h("div", { class: "game-playbar" },
        h("label", { class: "btn" }, t("games.loadRom"), picker),
        h("label", { class: "game-console" }, h("span", null, t("romEmulator.console")), select),
        status,
      ),
      h("p", { class: "game-note muted" }, t("games.emulator"), " · ", t("games.mobile")),
      demoPicker(ROM_DEMOS, startDemo),
      controlsHost,
    ),
    h("p", { class: "more" }, h("a", { href: gamesHref(loc, null), "data-nav": "games" }, t("romEmulator.games"))),
  );
  const linked = linkedDemo(ROM_DEMOS);
  if (linked) startDemo(linked);
  forgetRetiredRoms();
}

const FORGOT_KEY = "cvcm.emu.forgotRoms";

/**
 * The retired game pages could keep a visitor's own ROM in IndexedDB ("rom:<game id>", Remember in this browser). Those
 * pages are gone, and with them the Forget button, so clear what they stored, once per browser.
 */
function forgetRetiredRoms(): void {
  try {
    if (localStorage.getItem(FORGOT_KEY)) return;
    localStorage.setItem(FORGOT_KEY, "1");
  } catch {
    return;
  }
  if (typeof indexedDB === "undefined") return;
  for (const id of LEGACY_GAME_IDS) clearDraft(`rom:${id}`).catch(() => {});
}

export function unmountRomEmulator(): void {
  token += 1;
}
