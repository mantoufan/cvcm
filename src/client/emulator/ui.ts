import { h } from "../dom";
import { locale, t } from "../i18n";
import { controls, gameEmpty, gameFrame } from "../games/player";
import { appHref, gamesHref } from "../../shared/path";
import { MAX_ROM_BYTES, ROM_ACCEPT, ROM_CONSOLES, ROM_CORE, detectRomConsole, type RomConsoleId } from "../../shared/rom-detect";

const AUTO = "auto";

// A newer file or an unmount makes an in-flight read stale.
let token = 0;

export function mountEmulator(host: HTMLElement): void {
  const loc = locale();
  const name = t("emulator.title");
  const { frame, boot } = gameFrame({ flash: false, core: ROM_CORE.fc, name });
  const picker = h("input", {
    type: "file",
    accept: ROM_ACCEPT,
    class: "game-rom-input",
    "aria-label": t("games.loadRom"),
  }) as HTMLInputElement;
  const empty = gameEmpty({ flash: false, picker, hidden: false });
  const status = h("p", { class: "game-note", role: "status", "data-out": "status" }, t("games.needFileBody"));
  const select = h("select", { "data-field": "console" },
    h("option", { value: AUTO }, t("emulator.auto")),
    ...ROM_CONSOLES.map((id) => h("option", { value: id }, t(`games.consoles.${id}`))),
  ) as HTMLSelectElement;
  const controlsHost = h("div", { "data-out": "controls" });

  let rom: { name: string; buffer: ArrayBuffer } | null = null;

  const play = (): void => {
    if (!rom) return;
    const chosen = select.value === AUTO ? null : (select.value as RomConsoleId);
    const consoleId = chosen ?? detectRomConsole(rom.name, new Uint8Array(rom.buffer));
    if (!consoleId) {
      status.textContent = t("emulator.unknown");
      select.focus();
      return;
    }
    const label = t(`games.consoles.${consoleId}`);
    status.textContent = t(chosen ? "emulator.chosen" : "emulator.detected", { console: label });
    controlsHost.replaceChildren(controls(consoleId));
    empty.hidden = true;
    boot({ buffer: rom.buffer, filename: rom.name, core: ROM_CORE[consoleId], name: rom.name, cheats: [] });
  };

  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) return;
    const mine = ++token;
    // Lets the same file be picked again, after a failed read or a wrong console choice.
    picker.value = "";
    if (file.size > MAX_ROM_BYTES) {
      status.textContent = t("emulator.tooBig", { mb: MAX_ROM_BYTES / 1024 / 1024 });
      return;
    }
    status.textContent = t("emulator.reading");
    file.arrayBuffer().then((buffer) => {
      if (mine !== token) return;
      rom = { name: file.name, buffer };
      // A choice made for the last file says nothing about this one.
      select.value = AUTO;
      play();
    }).catch(() => {
      if (mine === token) status.textContent = t("emulator.readFailed");
    });
  });
  select.addEventListener("change", play);

  host.append(
    h("header", { class: "tool-head game-head" },
      h("a", { class: "back", href: appHref(loc, null), "data-nav": "home" }, t("emulator.back")),
      h("h1", null, name),
      h("p", { class: "lede" }, t("emulator.privacyNote")),
    ),
    h("section", { class: "game-play", "aria-label": t("games.play") },
      h("div", { class: "game-stage" }, frame, empty),
      h("div", { class: "game-playbar" },
        h("label", { class: "btn" }, t("games.loadRom"), picker),
        h("label", { class: "game-console" }, h("span", null, t("emulator.console")), select),
        status,
      ),
      h("p", { class: "game-note muted" }, t("games.emulator"), " · ", t("games.mobile")),
      controlsHost,
    ),
    h("p", { class: "more" }, h("a", { href: gamesHref(loc, null), "data-nav": "games" }, t("emulator.games"))),
  );
}

export function unmountEmulator(): void {
  token += 1;
}
