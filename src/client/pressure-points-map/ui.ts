import { h } from "../dom";
import { locale, t } from "../i18n";
import type { Locale } from "../../shared/locale";
import {
  PP_DEFAULT_HOLD, PP_HOLD_SECONDS, PP_POINTS, PP_VIEWS, PP_ZONES, PP_ZONE_FEET, ppClock, ppCodeLabel, ppMatches, ppPoint, ppPointsIn,
  type PpFoot, type PpPoint, type PpSelection, type PpView, type PpZone,
} from "../../shared/pressure-points";
import { VIEW_ART, soleClip, zoneShapes } from "./art";

type PointCopy = { name: string; where: string; press: string; use: string; caution?: string };
type ZoneCopy = { name: string; maps: string };
export type PpCopy = { points: Record<string, PointCopy>; zones: Record<PpZone, ZoneCopy> };

/** Each language's point copy is its own small chunk, loaded with the tool (never in the core locale pack). */
const COPY: Record<Locale, () => Promise<{ default: unknown }>> = {
  en: () => import("../../locales/pressure-points/en.json"),
  "zh-CN": () => import("../../locales/pressure-points/zh-CN.json"),
  "zh-TW": () => import("../../locales/pressure-points/zh-TW.json"),
  ja: () => import("../../locales/pressure-points/ja.json"),
  ko: () => import("../../locales/pressure-points/ko.json"),
  vi: () => import("../../locales/pressure-points/vi.json"),
  id: () => import("../../locales/pressure-points/id.json"),
  es: () => import("../../locales/pressure-points/es.json"),
};

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag: string, attrs: Record<string, string | number> = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

let teardown: (() => void) | null = null;

export async function mountPressurePoints(host: HTMLElement): Promise<void> {
  let copy: PpCopy;
  try {
    copy = (await COPY[locale()]()).default as PpCopy;
  } catch {
    // Offline, or a tab still on an older deploy's chunk names: say so and offer another try (a reload if it fails again).
    let tries = 0;
    const retry = h("button", { type: "button", class: "btn", "data-action": "retry", onClick: () => {
      tries += 1;
      if (tries > 1) {
        location.reload();
        return;
      }
      host.replaceChildren();
      void mountPressurePoints(host);
    } }, t("ppm.retry"));
    host.append(
      h("header", { class: "tool-head" }, h("h1", null, t("ppm.title")), h("p", { class: "ppm-disclaimer", role: "note" }, t("ppm.disclaimer"))),
      h("p", { role: "alert", "data-out": "load-error" }, t("ppm.loadError")),
      retry,
    );
    return;
  }
  let view: PpView = "hand";
  let sel: PpSelection = { kind: "point", id: "li4" };
  let hold: number = PP_DEFAULT_HOLD;
  let timer: number | null = null;
  let endsAt = 0;
  let audio: AudioContext | null = null;

  const pointName = (p: PpPoint) => copy.points[p.id].name;
  const zoneLabel = (zone: PpZone, foot: PpFoot) => t("ppm.zoneOn", { foot: t(`ppm.${foot}`), zone: copy.zones[zone].name });

  // Tabs: one per view (roving focus with the arrow keys).
  const tabs = PP_VIEWS.map((v) => h("button", {
    type: "button", role: "tab", class: "chip", id: `ppm-tab-${v}`, "aria-controls": "ppm-stage", "data-view": v,
    onClick: () => showView(v, true),
  }, t(`ppm.v_${v}`)));
  const tabList = h("div", { class: "chip-row ppm-tabs", role: "tablist", "aria-label": t("ppm.views") }, ...tabs);
  tabList.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    next.focus();
    showView(next.dataset.view as PpView, true);
  });

  const svg = svgEl("svg", { class: "ppm-svg", role: "group" });
  const caption = h("p", { class: "ppm-caption", "data-out": "caption" });
  const feet = h("p", { class: "ppm-feet", "aria-hidden": "true" }, h("span", null, t("ppm.left")), h("span", null, t("ppm.right")));
  const stage = h("figure", { class: "ppm-stage", id: "ppm-stage", role: "tabpanel" }, svg, feet, caption);

  // Only the point / zone details are a live region; the timer below it announces just its start and end.
  const details = h("div", { "aria-live": "polite", "data-out": "details" });
  const panel = h("section", { class: "ppm-panel", "data-out": "panel" });

  // Timer.
  const holdSel = h("select", { "data-field": "hold", "aria-label": t("ppm.timer"), onChange: () => { hold = Number(holdSel.value); stopTimer(); } },
    ...PP_HOLD_SECONDS.map((n) => h("option", { value: String(n), selected: n === PP_DEFAULT_HOLD }, t("ppm.seconds", { n }))));
  const startBtn = h("button", { type: "button", class: "btn", "data-action": "timer", onClick: () => (timer === null ? startTimer() : stopTimer()) });
  // role=timer is not announced as it ticks (aria-live off); a button's changing label is not announced either.
  const clock = h("span", { class: "ppm-clock", role: "timer", "aria-live": "off", "data-out": "clock" });
  const bar = h("progress", { class: "ppm-bar", max: "1", value: "0", "aria-hidden": "true" });
  const timerStatus = h("p", { class: "ppm-timer-status", "aria-live": "polite", "data-out": "timer-status" });
  const timerBox = h("div", { class: "ppm-timer" },
    h("h3", null, t("ppm.timer")),
    h("div", { class: "ppm-timer-row" }, holdSel, startBtn, clock),
    bar, timerStatus);

  const paintTimer = () => {
    const left = timer === null ? hold : Math.max(0, (endsAt - Date.now()) / 1000);
    startBtn.textContent = timer === null ? t("ppm.start", { n: hold }) : t("ppm.stop");
    startBtn.setAttribute("aria-pressed", String(timer !== null));
    clock.textContent = ppClock(left);
    bar.value = timer === null ? 0 : 1 - left / hold;
  };
  function stopTimer(): void {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    paintTimer();
  }
  function chime(): void {
    try {
      const ctx = audio;
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 660;
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    } catch {
      // No sound: the status line still says the time is up.
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) navigator.vibrate?.(200);
  }
  function startTimer(): void {
    timerStatus.textContent = t("ppm.started", { n: hold });
    // The audio context is made on the press (a user gesture), so the end chime may play.
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audio && Ctx) audio = new Ctx();
      void audio?.resume();
    } catch {
      audio = null;
    }
    endsAt = Date.now() + hold * 1000;
    timer = window.setInterval(() => {
      if (Date.now() >= endsAt) {
        stopTimer();
        timerStatus.textContent = t("ppm.done");
        chime();
      } else paintTimer();
    }, 250);
    paintTimer();
  }

  const section = (title: string, ...kids: Array<Node | string>) => [h("h3", null, title), ...kids];

  const paintPanel = () => {
    details.replaceChildren();
    if (sel.kind === "point") {
      const p = ppPoint(sel.id)!;
      const c = copy.points[p.id];
      details.append(
        h("h2", { "data-out": "name" }, c.name),
        h("p", { class: "ppm-code", "data-out": "code" }, `${p.pinyin} · ${ppCodeLabel(p)}`),
        ...section(t("ppm.where"), h("p", { "data-out": "where" }, c.where), h("p", { class: "ppm-small" }, t("ppm.cun"))),
        ...section(t("ppm.how"), h("p", { "data-out": "press" }, c.press), p.light ? h("p", { class: "ppm-small" }, t("ppm.lightNote")) : ""),
        ...section(t("ppm.use"), h("p", { "data-out": "use" }, c.use)),
      );
      if (c.caution) details.append(h("p", { class: "ppm-caution", "data-out": "caution" }, c.caution));
    } else {
      const z = copy.zones[sel.id];
      details.append(
        h("h2", { "data-out": "name" }, zoneLabel(sel.id, sel.foot)),
        ...section(t("ppm.zoneTitle"), h("p", { "data-out": "where" }, z.maps)),
        ...section(t("ppm.how"), h("p", null, t("ppm.zoneHow"))),
        h("p", { class: "ppm-caution", "data-out": "caution" }, t("ppm.zoneNote")),
      );
    }
    paintTimer();
  };
  panel.append(details, timerBox);

  /** The focusable targets on the drawing, in reading order (for arrow-key movement). */
  let targets: SVGGElement[] = [];

  const isSelected = (s: PpSelection) => (s.kind === sel.kind && s.id === sel.id && (s.kind === "point" || (sel.kind === "zone" && s.foot === sel.foot)));

  const target = (s: PpSelection, label: string, kids: SVGElement[], focusable = true) => {
    const g = svgEl("g", { class: s.kind === "point" ? "ppm-dot" : "ppm-zone", "data-target": s.kind === "point" ? s.id : `${s.foot}-${s.id}` }) as SVGGElement;
    if (focusable) {
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", label);
      targets.push(g);
    } else g.setAttribute("aria-hidden", "true");
    g.append(...kids);
    g.addEventListener("click", () => select(s));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select(s);
        return;
      }
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      const i = targets.indexOf(g);
      if (!step || i < 0) return;
      e.preventDefault();
      targets[(i + step + targets.length) % targets.length].focus();
    });
    return g;
  };

  const dot = (p: PpPoint, x: number, focusable: boolean) => target({ kind: "point", id: p.id }, `${pointName(p)} (${ppCodeLabel(p)})`, [
    svgEl("circle", { class: "ppm-hit", cx: x, cy: p.y, r: 13 }),
    svgEl("circle", { class: "ppm-ring", cx: x, cy: p.y, r: 11 }),
    svgEl("circle", { class: "ppm-core", cx: x, cy: p.y, r: 6 }),
  ], focusable);

  const paintSvg = () => {
    const art = VIEW_ART[view];
    svg.replaceChildren();
    targets = [];
    svg.setAttribute("viewBox", art.viewBox);
    svg.setAttribute("aria-label", t("ppm.mapLabel", { view: t(`ppm.v_${view}`) }));
    const body = svgEl("g", { class: "ppm-body-line", "aria-hidden": "true" });
    body.innerHTML = art.body;
    const fill = svgEl("g", { class: "ppm-body-fill", "aria-hidden": "true" });
    fill.innerHTML = art.body;
    svg.append(body, fill);
    if (view === "sole") {
      const defs = svgEl("defs");
      for (const foot of ["left", "right"] as const) {
        const clip = svgEl("clipPath", { id: `ppm-clip-${foot}` });
        clip.innerHTML = soleClip(foot);
        defs.append(clip);
      }
      svg.append(defs);
      for (const foot of ["left", "right"] as const) {
        const g = svgEl("g", { "clip-path": `url(#ppm-clip-${foot})` });
        for (const { zone, d } of zoneShapes(foot)) {
          const s: PpSelection = { kind: "zone", id: zone, foot };
          g.append(target(s, zoneLabel(zone, foot), [svgEl("path", { class: `ppm-area ppm-area-${zone}`, d })]));
        }
        svg.append(g);
      }
    }
    const details = svgEl("g", { class: "ppm-detail", "aria-hidden": "true" });
    details.innerHTML = art.details;
    svg.append(details);
    for (const p of ppPointsIn(view)) {
      if (p.mirrorX !== undefined) svg.append(dot(p, p.mirrorX, false));
      svg.append(dot(p, p.x, true));
    }
    markSelected();
  };

  const markSelected = () => {
    for (const g of svg.querySelectorAll<SVGGElement>("[data-target]")) {
      const key = g.dataset.target;
      const on = sel.kind === "point" ? key === sel.id : key === `${sel.foot}-${sel.id}`;
      g.classList.toggle("on", on);
      if (g.hasAttribute("role")) g.setAttribute("aria-pressed", String(on));
    }
    for (const b of listEl.querySelectorAll<HTMLButtonElement>("[data-pick]")) {
      const on = b.dataset.pick === (sel.kind === "point" ? sel.id : `${sel.foot}-${sel.id}`);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
  };

  function showView(v: PpView, pickFirst: boolean): void {
    const changed = v !== view;
    view = v;
    for (const b of tabs) {
      const on = b.dataset.view === v;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    stage.setAttribute("aria-labelledby", `ppm-tab-${v}`);
    caption.textContent = t(`ppm.c_${v}`);
    feet.hidden = v !== "sole";
    if (changed && pickFirst) {
      const first = ppPointsIn(v)[0];
      sel = v === "sole" ? { kind: "zone", id: "toes", foot: "left" } : { kind: "point", id: first.id };
      stopTimer();
      timerStatus.textContent = "";
      paintPanel();
    }
    paintSvg();
  }

  function select(s: PpSelection): void {
    if (!isSelected(s)) {
      sel = s;
      stopTimer();
      timerStatus.textContent = "";
      paintPanel();
    }
    const v = s.kind === "point" ? ppPoint(s.id)!.view : "sole";
    if (v !== view) showView(v, false);
    else markSelected();
  }

  // Search + list of every point and zone.
  const listEl = h("div", { class: "ppm-list", "data-out": "list" });
  const noneEl = h("p", { class: "ppm-small", hidden: true, "data-out": "none" }, t("ppm.none"));
  const items: { el: HTMLElement; names: string[] }[] = [];
  const pointsRow = h("div", { class: "chip-row" });
  for (const p of PP_POINTS) {
    const b = h("button", { type: "button", class: "chip", "data-pick": p.id, "aria-pressed": "false", onClick: () => select({ kind: "point", id: p.id }) },
      `${pointName(p)} `, h("small", null, ppCodeLabel(p)));
    pointsRow.append(b);
    items.push({ el: b, names: [pointName(p), p.english, p.pinyin, p.code, p.altCode ?? "", p.id] });
  }
  const zonesRow = h("div", { class: "chip-row" });
  for (const zone of PP_ZONES) {
    for (const foot of PP_ZONE_FEET[zone]) {
      const b = h("button", { type: "button", class: "chip", "data-pick": `${foot}-${zone}`, "aria-pressed": "false", onClick: () => select({ kind: "zone", id: zone, foot }) }, zoneLabel(zone, foot));
      zonesRow.append(b);
      items.push({ el: b, names: [zoneLabel(zone, foot), copy.zones[zone].name, t(`ppm.${foot}`)] });
    }
  }
  const zonesTitle = h("h3", { class: "ppm-list-title" }, t("ppm.zonesTitle"));
  listEl.append(pointsRow, zonesTitle, zonesRow, noneEl);
  const findEl = h("input", { type: "search", "data-field": "find", placeholder: t("ppm.findPlaceholder"), autocomplete: "off", onInput: () => {
    let shown = 0;
    for (const it of items) {
      const ok = ppMatches(findEl.value, it.names);
      it.el.hidden = !ok;
      if (ok) shown++;
    }
    zonesTitle.hidden = !items.some((it) => !it.el.hidden && it.el.dataset.pick?.includes("-"));
    noneEl.hidden = shown > 0;
  } });

  // Every point as text: where it is and its traditional use, for reading without the drawing.
  const guide = h("section", { class: "ppm-guide" }, h("h2", null, t("ppm.guideTitle")));
  for (const v of PP_VIEWS) {
    const pts = ppPointsIn(v);
    if (!pts.length) continue;
    guide.append(h("h3", null, t(`ppm.v_${v}`)));
    const dl = h("dl", null);
    for (const p of pts) dl.append(h("dt", null, `${pointName(p)} (${p.pinyin}, ${ppCodeLabel(p)})`), h("dd", null, copy.points[p.id].where));
    guide.append(dl);
  }

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("ppm.title")),
      h("p", { class: "lede" }, t("ppm.lede")),
      h("p", { class: "ppm-disclaimer", role: "note" }, t("ppm.disclaimer")),
    ),
    tabList,
    h("div", { class: "ppm-layout" }, stage, panel),
    h("section", { class: "ppm-find" },
      h("label", { class: "field" }, h("span", null, t("ppm.find")), findEl),
      listEl,
    ),
    h("section", { class: "ppm-cautions" },
      h("h2", null, t("ppm.cautionsTitle")),
      h("ul", null, h("li", null, t("ppm.caution1")), h("li", null, t("ppm.caution2")), h("li", null, t("ppm.caution3"))),
    ),
    guide,
  );
  paintPanel();
  showView(view, false);

  teardown = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    void audio?.close().catch(() => undefined);
    audio = null;
  };
}

export function unmountPressurePoints(): void {
  teardown?.();
  teardown = null;
}
