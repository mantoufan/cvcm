import { canvasToBlob } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref, withSearch } from "../../shared/path";
import { outputFilename } from "../../shared/filename";
import {
  APERTURES,
  ISOS,
  SHUTTER_TABLE,
  formatAperture,
  formatShutter,
  type HintId,
} from "../../shared/camera";
import {
  catalog,
  clampSimState,
  defaultSimState,
  parseSimQuery,
  serializeSimQuery,
  type FrameId,
  type LensId,
  type PersonId,
  type PoseId,
  type SceneId,
  type SimState,
} from "../../shared/portrait-sim";
import { clearHeroes, fgSrc, loadHero, plateSrc, type DecodedImage } from "./assets";
import { composePortrait } from "./compositor";

const STORAGE = "cvcm.portrait-sim";

let hostEl: HTMLElement | null = null;
let preview: HTMLCanvasElement | null = null;
let hudAf: HTMLElement | null = null;
let hudMeter: HTMLElement | null = null;
let hintEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let snapBtn: HTMLButtonElement | null = null;
let isoInput: HTMLInputElement | null = null;
let apertureInput: HTMLSelectElement | null = null;
let shutterInput: HTMLSelectElement | null = null;
let isoLabel: HTMLElement | null = null;
let apertureLabel: HTMLElement | null = null;
let shutterLabel: HTMLElement | null = null;
let distanceInput: HTMLInputElement | null = null;
let focusInput: HTMLInputElement | null = null;
let distanceLabel: HTMLElement | null = null;
let focusLabel: HTMLElement | null = null;

let state = defaultSimState();
let mountGen = 0;
let abort: AbortController | null = null;
let timer = 0;
let ready = false;
let queryDirty = false;

function hintText(id: HintId): string {
  const key: Record<HintId, string> = {
    underexposed: "portraitSim.hintUnderexposed",
    overexposed: "portraitSim.hintOverexposed",
    handshake: "portraitSim.hintHandshake",
    wideClose: "portraitSim.hintWideClose",
    missFocus: "portraitSim.hintMissFocus",
    uvNoop: "portraitSim.hintUvNoop",
    ndTripod: "portraitSim.hintNdTripod",
    lightMismatch: "portraitSim.hintLightMismatch",
  };
  return t(key[id]);
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  } catch {
    /* quota */
  }
  if (queryDirty) {
    history.replaceState(null, "", withSearch(location.pathname, serializeSimQuery(state)));
  }
}

function loadInitial(): SimState {
  let next = defaultSimState();
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) next = clampSimState(JSON.parse(raw) as Partial<SimState>, next);
  } catch {
    /* ignore */
  }
  const q = parseSimQuery(location.search);
  const had = Object.keys(q).length > 0;
  next = clampSimState({ ...next, ...q }, next);
  if (had) {
    queryDirty = true;
    history.replaceState(null, "", withSearch(location.pathname, serializeSimQuery(next)));
  }
  return next;
}

function setReady(on: boolean): void {
  ready = on;
  if (snapBtn) snapBtn.disabled = !on;
}

function syncReadouts(aperture: number, iso: number, shutter: number, deltaEV: number): void {
  if (isoInput) {
    isoInput.value = String(Math.max(0, ISOS.indexOf(iso as typeof ISOS[number])));
    isoInput.disabled = state.mode === "P";
  }
  if (apertureInput) {
    apertureInput.value = String(aperture);
    apertureInput.disabled = catalog.lenses[state.lens].apertureLocked || state.mode === "P" || state.mode === "Tv";
  }
  if (shutterInput) {
    shutterInput.value = String(shutter);
    shutterInput.disabled = state.mode === "P" || state.mode === "Av";
  }
  if (isoLabel) isoLabel.textContent = `ISO ${iso}`;
  if (apertureLabel) apertureLabel.textContent = formatAperture(aperture);
  if (shutterLabel) shutterLabel.textContent = formatShutter(shutter);
  if (hudMeter) {
    const stops = Math.max(-3, Math.min(3, deltaEV));
    hudMeter.textContent = `${stops > 0 ? "+" : ""}${stops.toFixed(1)} EV`;
  }
}

function placeAf(eye: { x: number; y: number }): void {
  if (!hudAf || !preview) return;
  const w = preview.clientWidth || preview.width;
  const h = preview.clientHeight || preview.height;
  const sx = w / preview.width;
  const sy = h / preview.height;
  hudAf.style.left = `${eye.x * sx}px`;
  hudAf.style.top = `${eye.y * sy}px`;
}

async function compose(snap = false): Promise<void> {
  if (!preview) return;
  const gen = mountGen;
  abort?.abort();
  abort = new AbortController();
  const { signal } = abort;
  setReady(false);
  if (statusEl) statusEl.textContent = t("portraitSim.loading");
  try {
    const plate = await loadHero(plateSrc(state.scene, state.lens), signal, snap);
    const cut = catalog.cutouts.find((c) => c.person === state.person && c.pose === state.pose);
    if (!cut) throw new Error("cutout");
    const subject = await loadHero(cut.src, signal, snap);
    const fgUrl = fgSrc(state.scene, state.lens);
    let fg: DecodedImage | null = null;
    if (fgUrl) fg = await loadHero(fgUrl, signal, snap);
    if (gen !== mountGen) return;
    const result = composePortrait(preview, state, plate, subject, fg, snap);
    if (gen !== mountGen) return;
    state = { ...state, aperture: result.aperture, iso: result.iso, shutterSec: result.shutterSec };
    syncReadouts(result.aperture, result.iso, result.shutterSec, result.deltaEV);
    placeAf(result.eye);
    if (hintEl) hintEl.textContent = result.hints.map(hintText).join(" · ");
    if (statusEl) {
      statusEl.textContent = result.limitedBlur ? t("portraitSim.limitedBlur") : t("portraitSim.ready");
    }
    setReady(true);
    persist();
  } catch (err) {
    if ((err as DOMException).name === "AbortError") return;
    if (statusEl) statusEl.textContent = t("portraitSim.errorPlate");
    setReady(false);
  }
}

function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void compose(false), 32);
}

function change(partial: Partial<SimState>): void {
  queryDirty = true;
  let next = { ...state, ...partial };
  if (partial.mode) next.autoIso = partial.mode === "P";
  if (partial.scene && partial.scene !== state.scene && !partial.light) {
    next.light = catalog.scenes[partial.scene].defaultLight;
  }
  if (partial.pose && partial.distanceM === undefined) {
    next.distanceM = catalog.poses[partial.pose].subjectDistanceM;
    next.focusM = next.distanceM;
  }
  state = clampSimState(next, state);
  mark("person", state.person);
  mark("pose", state.pose);
  mark("scene", state.scene);
  mark("mode", state.mode);
  mark("frame", state.frame);
  const scene = catalog.scenes[state.scene];
  if (distanceInput) {
    distanceInput.min = String(scene.distanceMinM);
    distanceInput.max = String(scene.distanceMaxM);
    distanceInput.value = String(state.distanceM);
  }
  if (focusInput) {
    focusInput.min = String(scene.distanceMinM);
    focusInput.max = String(scene.distanceMaxM);
    focusInput.value = String(state.focusM);
  }
  if (distanceLabel) distanceLabel.textContent = `${state.distanceM.toFixed(1)} m`;
  if (focusLabel) focusLabel.textContent = `${state.focusM.toFixed(1)} m`;
  const lensSel = hostEl?.querySelector("#ps-lens") as HTMLSelectElement | null;
  if (lensSel) lensSel.value = state.lens;
  const filterSel = hostEl?.querySelector("#ps-filter") as HTMLSelectElement | null;
  if (filterSel) filterSel.value = state.filter;
  const lightSel = hostEl?.querySelector("#ps-light") as HTMLSelectElement | null;
  if (lightSel) lightSel.value = state.light;
  const tripod = hostEl?.querySelector("#ps-tripod") as HTMLInputElement | null;
  if (tripod) tripod.checked = state.tripod;
  refillApertures();
  schedule();
}

function mark(key: string, value: string): void {
  hostEl?.querySelectorAll(`[data-${key}]`).forEach((el) => {
    el.classList.toggle("on", (el as HTMLElement).dataset[key] === value);
  });
}

function refillApertures(): void {
  if (!apertureInput) return;
  const lens = catalog.lenses[state.lens];
  const keep = state.aperture;
  apertureInput.replaceChildren();
  for (const n of APERTURES) {
    if (n + 1e-9 < lens.maxAperture || n - 1e-9 > lens.minAperture) continue;
    apertureInput.append(h("option", { value: String(n), selected: Math.abs(n - keep) < 0.05 }, formatAperture(n)));
  }
}

async function snap(mime: "image/png" | "image/jpeg"): Promise<void> {
  if (!preview || !ready) return;
  if (statusEl) statusEl.textContent = t("portraitSim.working");
  await compose(true);
  if (!preview) return;
  const blob = await canvasToBlob(preview, mime, 0.92);
  downloadBlob(blob, outputFilename("portrait-sim.png", mime, ""));
  await compose(false);
}

function chip(label: string, on: boolean, onClick: () => void, id?: string, data?: Record<string, string>): HTMLElement {
  const btn = h("button", {
    type: "button",
    class: "chip" + (on ? " on" : ""),
    id,
    onClick,
  }, label);
  if (data) {
    for (const [key, value] of Object.entries(data)) btn.setAttribute(`data-${key}`, value);
  }
  return btn;
}

function thumbBtn(src: string, label: string, on: boolean, onClick: () => void, data: Record<string, string>): HTMLElement {
  const btn = h("button", {
    type: "button",
    class: "ps-thumb" + (on ? " on" : ""),
    onClick,
  },
    h("img", { src, alt: "", width: "80", height: "50" }),
    h("span", null, label),
  );
  for (const [key, value] of Object.entries(data)) btn.setAttribute(`data-${key}`, value);
  return btn;
}

function labeled(label: string, control: HTMLElement, extra?: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control, extra || null);
}

function rail(): HTMLElement {
  return h("aside", { class: "rail" },
    h("h2", null, t("portraitSim.people")),
    h("div", { class: "ps-thumbs" },
      ...(["mira", "ken", "lin"] as PersonId[]).map((id) =>
        thumbBtn(catalog.people[id].thumb, t(`portraitSim.person.${id}`), state.person === id, () => change({ person: id }), { person: id }),
      ),
    ),
    h("h2", null, t("portraitSim.poses")),
    h("div", { class: "ps-thumbs" },
      ...(["stand34", "sit45", "prop", "away"] as PoseId[]).map((id) =>
        thumbBtn(catalog.poses[id].thumb, t(`portraitSim.pose.${id}`), state.pose === id, () => change({ pose: id }), { pose: id }),
      ),
    ),
    h("h2", null, t("portraitSim.scenes")),
    h("div", { class: "ps-thumbs" },
      ...(["window", "shade", "cafe", "indoor"] as SceneId[]).map((id) =>
        thumbBtn(catalog.scenes[id].thumb, t(`portraitSim.scene.${id}`), state.scene === id, () => change({ scene: id }), { scene: id }),
      ),
    ),
  );
}

function stage(): HTMLElement {
  preview = h("canvas", { class: "preview", width: 1440, height: 960, id: "ps-preview" });
  hudAf = h("span", { class: "ps-af", "aria-hidden": "true" });
  hudMeter = h("span", { class: "ps-meter", "aria-live": "polite" }, "0.0 EV");
  const frame = h("div", { class: "ps-view" }, preview, hudAf, hudMeter);
  hintEl = h("p", { class: "hint", id: "ps-hint" });
  statusEl = h("p", { class: "status", "aria-live": "polite" }, t("portraitSim.loading"));
  snapBtn = h("button", {
    type: "button",
    class: "btn",
    id: "ps-snap",
    disabled: true,
    onClick: () => void snap("image/jpeg"),
  }, t("portraitSim.snapJpeg")) as HTMLButtonElement;
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame ps-stage" }, frame),
    hintEl,
    h("div", { class: "stage-actions" },
      snapBtn,
      h("button", { type: "button", class: "btn ghost", id: "ps-snap-png", onClick: () => void snap("image/png") }, t("portraitSim.snapPng")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  const lens = catalog.lenses[state.lens];
  const scene = catalog.scenes[state.scene];
  apertureInput = h("select", {
    id: "ps-aperture",
    onChange: (e: Event) => change({ aperture: Number((e.target as HTMLSelectElement).value) }),
  },
    ...APERTURES.filter((n) => n >= lens.maxAperture && n <= lens.minAperture).map((n) =>
      h("option", { value: String(n), selected: Math.abs(n - state.aperture) < 0.05 }, formatAperture(n)),
    ),
  ) as HTMLSelectElement;
  shutterInput = h("select", {
    id: "ps-shutter",
    onChange: (e: Event) => change({ shutterSec: Number((e.target as HTMLSelectElement).value) }),
  },
    ...SHUTTER_TABLE.map((n) =>
      h("option", { value: String(n), selected: Math.abs(n - state.shutterSec) < 1e-6 }, formatShutter(n)),
    ),
  ) as HTMLSelectElement;
  isoInput = h("input", {
    type: "range",
    id: "ps-iso",
    min: "0",
    max: String(ISOS.length - 1),
    step: "1",
    value: String(Math.max(0, ISOS.indexOf(state.iso as typeof ISOS[number]))),
    onInput: (e: Event) => {
      const i = Number((e.target as HTMLInputElement).value);
      change({ iso: ISOS[i] ?? 200 });
    },
  }) as HTMLInputElement;
  isoLabel = h("em", { class: "ps-readout" }, `ISO ${state.iso}`);
  apertureLabel = h("em", { class: "ps-readout" }, formatAperture(state.aperture));
  shutterLabel = h("em", { class: "ps-readout" }, formatShutter(state.shutterSec));
  distanceInput = h("input", {
    type: "range",
    id: "ps-distance",
    min: String(scene.distanceMinM),
    max: String(scene.distanceMaxM),
    step: "0.1",
    value: String(state.distanceM),
    onInput: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value);
      change({ distanceM: v, focusM: v });
    },
  }) as HTMLInputElement;
  focusInput = h("input", {
    type: "range",
    id: "ps-focus",
    min: String(scene.distanceMinM),
    max: String(scene.distanceMaxM),
    step: "0.1",
    value: String(state.focusM),
    onInput: (e: Event) => change({ focusM: Number((e.target as HTMLInputElement).value) }),
  }) as HTMLInputElement;
  distanceLabel = h("em", { class: "ps-readout" }, `${state.distanceM.toFixed(1)} m`);
  focusLabel = h("em", { class: "ps-readout" }, `${state.focusM.toFixed(1)} m`);

  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("portraitSim.camera")),
      labeled(t("portraitSim.mode"),
        h("div", { class: "convert-chips", id: "ps-mode" },
          ...(["P", "Av", "Tv", "M"] as const).map((mode) =>
            chip(mode, state.mode === mode, () => change({ mode }), `ps-mode-${mode}`, { mode }),
          ),
        ),
      ),
      labeled(t("portraitSim.lens"),
        h("select", {
          id: "ps-lens",
          onChange: (e: Event) => change({ lens: (e.target as HTMLSelectElement).value as LensId }),
        },
          ...(["phone", "24", "35", "50", "85", "135"] as LensId[]).map((id) =>
            h("option", { value: id, selected: state.lens === id }, t(`portraitSim.lenses.${id}`)),
          ),
        ),
      ),
      labeled(t("portraitSim.frame"),
        h("div", { class: "convert-chips" },
          ...(["3-2", "4-5", "16-9"] as FrameId[]).map((id) =>
            chip(id.replace("-", ":"), state.frame === id, () => change({ frame: id }), `ps-frame-${id}`, { frame: id }),
          ),
        ),
      ),
      labeled(t("portraitSim.iso"), isoInput, isoLabel),
      labeled(t("portraitSim.aperture"), apertureInput, apertureLabel),
      labeled(t("portraitSim.shutter"), shutterInput, shutterLabel),
      labeled(t("portraitSim.distance"), distanceInput, distanceLabel),
      labeled(t("portraitSim.focus"), focusInput, focusLabel),
      h("label", { class: "check" },
        h("input", {
          type: "checkbox",
          id: "ps-tripod",
          checked: state.tripod,
          onChange: (e: Event) => change({ tripod: (e.target as HTMLInputElement).checked }),
        }),
        t("portraitSim.tripod"),
      ),
    ),
    h("fieldset", null,
      h("legend", null, t("portraitSim.filter")),
      h("select", {
        id: "ps-filter",
        onChange: (e: Event) => change({ filter: (e.target as HTMLSelectElement).value as SimState["filter"] }),
      },
        h("optgroup", { label: t("portraitSim.filterGroupProtection") },
          h("option", { value: "none", selected: state.filter === "none" }, t("portraitSim.filters.none")),
          h("option", { value: "uv", selected: state.filter === "uv" }, t("portraitSim.filters.uv")),
        ),
        h("optgroup", { label: t("portraitSim.filterGroupExposure") },
          h("option", { value: "nd3", selected: state.filter === "nd3" }, t("portraitSim.filters.nd3")),
          h("option", { value: "nd6", selected: state.filter === "nd6" }, t("portraitSim.filters.nd6")),
          h("option", { value: "cpl", selected: state.filter === "cpl" }, t("portraitSim.filters.cpl")),
        ),
        h("optgroup", { label: t("portraitSim.filterGroupLook") },
          h("option", { value: "soft", selected: state.filter === "soft" }, t("portraitSim.filters.soft")),
          h("option", { value: "warm", selected: state.filter === "warm" }, t("portraitSim.filters.warm")),
          h("option", { value: "cool", selected: state.filter === "cool" }, t("portraitSim.filters.cool")),
        ),
      ),
    ),
    h("fieldset", null,
      h("legend", null, t("portraitSim.exposureLook")),
      h("select", {
        id: "ps-light",
        onChange: (e: Event) => change({ light: (e.target as HTMLSelectElement).value as SimState["light"] }),
      },
        ...(["sunny", "shade", "window", "overcast", "golden"] as const).map((id) =>
          h("option", { value: id, selected: state.light === id }, t(`portraitSim.lights.${id}`)),
        ),
      ),
      h("p", { class: "muted" }, t("portraitSim.lightNote")),
    ),
  );
}

export async function mountPortraitSim(host: HTMLElement): Promise<void> {
  mountGen += 1;
  hostEl = host;
  state = loadInitial();
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("portraitSim.back")),
      h("h1", null, t("portraitSim.title")),
      h("p", { class: "lede" }, t("portraitSim.lede")),
      h("p", { class: "muted" }, t("portraitSim.privacyNote")),
    ),
    h("div", { class: "tool ps-tool" }, rail(), stage(), controls()),
  );
  await compose(false);
}

export function unmountPortraitSim(): void {
  mountGen += 1;
  abort?.abort();
  abort = null;
  window.clearTimeout(timer);
  clearHeroes();
  hostEl = null;
  preview = null;
  hudAf = null;
  hudMeter = null;
  hintEl = null;
  statusEl = null;
  snapBtn = null;
  isoInput = null;
  apertureInput = null;
  shutterInput = null;
  isoLabel = null;
  apertureLabel = null;
  shutterLabel = null;
  distanceInput = null;
  focusInput = null;
  distanceLabel = null;
  focusLabel = null;
}
