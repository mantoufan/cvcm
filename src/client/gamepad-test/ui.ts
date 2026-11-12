import { h } from "../dom";
import { t } from "../i18n";
import { axisText, buttonLabel, restVerdict, stickDistance } from "../../shared/gamepad";

type ButtonView = { el: HTMLElement; fill: HTMLElement; pressed: boolean; value: number };
type StickView = { dot: HTMLElement; out: HTMLElement; verdict: HTMLElement; last: string };

let padEl: HTMLSelectElement | null = null;
let statusEl: HTMLElement | null = null;
let infoEl: HTMLElement | null = null;
let boardEl: HTMLElement | null = null;
let rumbleBtn: HTMLButtonElement | null = null;
let buttons: ButtonView[] = [];
let sticks: StickView[] = [];
let axisBars: Array<{ fill: HTMLElement; out: HTMLElement; last: string }> = [];
/** The pad drawn on the board ("index:id:buttons:axes"), so it is rebuilt only when the controller changes. */
let drawn = "";
let frame = 0;
let mounted = false;

export function mountGamepadTest(host: HTMLElement): void {
  mounted = true;
  padEl = h("select", { "data-field": "pad", disabled: true, onChange: () => { drawn = ""; poll(); } });
  statusEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "status" });
  infoEl = h("dl", { class: "stats-grid", "data-out": "info" });
  rumbleBtn = h("button", { type: "button", class: "btn ghost", "data-action": "rumble", disabled: true, onClick: () => void rumble() }, t("gamepadTest.rumble"));
  boardEl = h("div", { class: "gp-board", "data-out": "board" });
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("gamepadTest.title")),
      h("p", { class: "lede" }, t("gamepadTest.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("gamepadTest.options")),
          h("label", { class: "field" }, h("span", null, t("gamepadTest.pad")), padEl),
        ),
        statusEl,
        infoEl,
        h("div", { class: "stage-actions" }, rumbleBtn),
        h("p", { class: "hint" }, t("gamepadTest.hint")),
      ),
      h("div", { class: "rail gp-stage" }, boardEl),
    ),
  );
  window.addEventListener("gamepadconnected", onConnect);
  window.addEventListener("gamepaddisconnected", onConnect);
  say("waiting");
  if (typeof navigator.getGamepads !== "function") {
    // Every current browser has the Gamepad API; the build-time prerender does not, so keep this out of the page's HTML.
    statusEl.dataset.volatile = "";
    say("unsupported");
    return;
  }
  // A pad already announced to this page (a button pressed before) shows at once.
  onConnect();
}

export function unmountGamepadTest(): void {
  mounted = false;
  window.cancelAnimationFrame(frame);
  window.removeEventListener("gamepadconnected", onConnect);
  window.removeEventListener("gamepaddisconnected", onConnect);
  padEl = null;
  statusEl = infoEl = boardEl = null;
  rumbleBtn = null;
  buttons = [];
  sticks = [];
  axisBars = [];
  drawn = "";
}

function say(key: string, vars?: Record<string, string | number>): void {
  if (statusEl) statusEl.textContent = t(`gamepadTest.${key}`, vars);
}

/** Browsers announce a pad (even one already plugged in) on its first button press; poll each frame while one is connected. */
function onConnect(): void {
  poll();
  window.cancelAnimationFrame(frame);
  if (pads().length) frame = window.requestAnimationFrame(loop);
}

function pads(): Gamepad[] {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter((g): g is Gamepad => !!g && g.connected !== false);
  } catch {
    // Blocked by a permissions policy.
    return [];
  }
}

function loop(): void {
  if (!mounted) return;
  poll();
  // Stop polling once the last pad is gone; the next gamepadconnected starts it again.
  if (drawn !== "none") frame = window.requestAnimationFrame(loop);
}

function poll(): void {
  if (!padEl) return;
  const list = pads();
  const want = padEl.value;
  // Keep the select in step with the connected pads.
  // Index and name, so a different controller taking a freed slot is relabelled too. The board is rebuilt only when
  // the shown pad itself changes (see `key` below), so a second pad connecting keeps the first one's tested buttons.
  const ids = list.map((g) => `${g.index}:${g.id}`).join("\n");
  if (padEl.dataset.ids !== ids) {
    padEl.dataset.ids = ids;
    padEl.replaceChildren(...list.map((g) => h("option", { value: String(g.index) }, `${g.index + 1}. ${g.id || t("gamepadTest.unnamed")}`)));
    if (list.some((g) => String(g.index) === want)) padEl.value = want;
    padEl.disabled = list.length < 2;
    if (statusEl && drawn && drawn !== "none") say(list.length > 1 ? "connectedMany" : "connected", { n: list.length });
  }
  const pad = list.find((g) => String(g.index) === padEl!.value) ?? list[0];
  if (!pad) {
    if (drawn !== "none") {
      drawn = "none";
      boardEl?.replaceChildren();
      infoEl?.replaceChildren();
      buttons = [];
      sticks = [];
      axisBars = [];
      if (rumbleBtn) rumbleBtn.disabled = true;
      say("waiting");
    }
    return;
  }
  const key = `${pad.index}:${pad.id}:${pad.buttons.length}:${pad.axes.length}:${pad.mapping}`;
  if (key !== drawn) build(pad, key, list.length);
  paint(pad);
}

function build(pad: Gamepad, key: string, count: number): void {
  drawn = key;
  const standard = pad.mapping === "standard";
  buttons = pad.buttons.map((_, i) => {
    const fill = h("span", { class: "gp-fill" });
    const el = h("div", { class: "gp-btn", "data-button": String(i) }, fill, h("span", { class: "gp-name" }, buttonLabel(i, standard)));
    return { el, fill, pressed: false, value: -1 };
  });
  sticks = [];
  axisBars = [];
  const parts: HTMLElement[] = [];
  if (standard && pad.axes.length >= 4) {
    const stickBox = h("div", { class: "gp-sticks" });
    for (const side of ["left", "right"] as const) {
      const dot = h("span", { class: "gp-dot" });
      const out = h("span", { class: "gp-axes", "data-out": `${side}-stick` });
      const verdict = h("span", { class: "gp-verdict" });
      sticks.push({ dot, out, verdict, last: "" });
      stickBox.append(h("figure", { class: "gp-stick" },
        h("div", { class: "gp-ring" }, h("span", { class: "gp-zone" }), dot),
        h("figcaption", null, h("strong", null, t(`gamepadTest.${side}Stick`)), out, verdict),
      ));
    }
    parts.push(stickBox);
  }
  // Axes past the two sticks (or every axis on a non-standard pad) as bars.
  const extra = standard && pad.axes.length >= 4 ? 4 : 0;
  if (pad.axes.length > extra) {
    const list = h("div", { class: "gp-bars" });
    for (let i = extra; i < pad.axes.length; i++) {
      const fill = h("span", { class: "gp-bar-fill" });
      const out = h("span", { class: "gp-bar-value" });
      axisBars.push({ fill, out, last: "" });
      list.append(h("div", { class: "gp-bar" }, h("span", null, t("gamepadTest.axis", { n: i })), h("span", { class: "gp-bar-track" }, fill), out));
    }
    parts.push(list);
  }
  boardEl?.replaceChildren(h("div", { class: "gp-buttons" }, ...buttons.map((b) => b.el)), ...parts);
  const rows: Array<[string, string]> = [
    [t("gamepadTest.name"), pad.id || "—"],
    [t("gamepadTest.mapping"), t(standard ? "gamepadTest.standard" : "gamepadTest.nonStandard")],
    [t("gamepadTest.buttons"), String(pad.buttons.length)],
    [t("gamepadTest.axes"), String(pad.axes.length)],
  ];
  infoEl?.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  if (rumbleBtn) rumbleBtn.disabled = typeof pad.vibrationActuator?.playEffect !== "function";
  say(count > 1 ? "connectedMany" : "connected", { n: count });
}

function paint(pad: Gamepad): void {
  pad.buttons.forEach((b, i) => {
    const view = buttons[i];
    if (!view) return;
    const value = Math.round((b.value || (b.pressed ? 1 : 0)) * 100) / 100;
    if (b.pressed !== view.pressed) {
      view.pressed = b.pressed;
      view.el.classList.toggle("down", b.pressed);
      // Once pressed, a button stays marked as working.
      if (b.pressed) view.el.classList.add("done");
    }
    if (value !== view.value) {
      view.value = value;
      view.fill.style.height = `${value * 100}%`;
    }
  });
  sticks.forEach((s, i) => {
    const x = pad.axes[i * 2] ?? 0;
    const y = pad.axes[i * 2 + 1] ?? 0;
    const text = `X ${axisText(x)} · Y ${axisText(y)}`;
    if (text === s.last) return;
    s.last = text;
    // ±1 reaches the edge of the ring (the dot is centred on its point by CSS).
    s.dot.style.left = `${50 + Math.max(-1, Math.min(1, x)) * 50}%`;
    s.dot.style.top = `${50 + Math.max(-1, Math.min(1, y)) * 50}%`;
    s.out.textContent = text;
    const d = stickDistance(x, y);
    s.verdict.textContent = t(`gamepadTest.rest_${restVerdict(d)}`, { n: d.toFixed(2) });
  });
  axisBars.forEach((bar, j) => {
    const v = pad.axes[j + (sticks.length ? 4 : 0)] ?? 0;
    const text = axisText(v);
    if (text === bar.last) return;
    bar.last = text;
    const c = Math.max(-1, Math.min(1, v));
    bar.fill.style.left = `${50 + Math.min(0, c) * 50}%`;
    bar.fill.style.width = `${Math.abs(c) * 50}%`;
    bar.out.textContent = text;
  });
}

async function rumble(): Promise<void> {
  const pad = pads().find((g) => String(g.index) === padEl?.value) ?? pads()[0];
  const act = pad?.vibrationActuator;
  if (!act || typeof act.playEffect !== "function") return;
  try {
    await act.playEffect("dual-rumble", { startDelay: 0, duration: 800, weakMagnitude: 0.6, strongMagnitude: 1 });
  } catch {
    say("rumbleFailed");
  }
}
