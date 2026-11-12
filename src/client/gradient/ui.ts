import { copyWithFlash } from "../copy";
import { downloadBlob, h } from "../dom";
import { t } from "../i18n";
import {
  MAX_STOPS,
  MIN_STOPS,
  PRESETS,
  clampAngle,
  clampPos,
  cloneGradient,
  cssRule,
  gradientCss,
  linearLine,
  newStop,
  normalizeHex,
  radialRadii,
  randomGradient,
  sortedStops,
  type Gradient,
  type GradientKind,
  type RadialShape,
} from "../../shared/gradient";

const PNG_SIZES: ReadonlyArray<[number, number]> = [[1920, 1080], [1080, 1920], [2560, 1440], [1080, 1080]];

let g: Gradient = cloneGradient(PRESETS[0]);
let previewEl: HTMLElement | null = null;
let codeEl: HTMLTextAreaElement | null = null;
let stopsEl: HTMLElement | null = null;
let kindEl: HTMLSelectElement | null = null;
let shapeEl: HTMLSelectElement | null = null;
let angleEl: HTMLInputElement | null = null;
let angleOut: HTMLOutputElement | null = null;
let angleField: HTMLElement | null = null;
let shapeField: HTMLElement | null = null;
let sizeEl: HTMLSelectElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let addBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;

export function mountGradient(host: HTMLElement): void {
  g = cloneGradient(PRESETS[0]);
  kindEl = h("select", { "data-field": "kind", onChange: () => { g.kind = kindEl!.value as GradientKind; paint(); } },
    h("option", { value: "linear", selected: true }, t("gradient.linear")),
    h("option", { value: "radial" }, t("gradient.radial")),
    h("option", { value: "conic" }, t("gradient.conic")),
  );
  shapeEl = h("select", { "data-field": "shape", onChange: () => { g.shape = shapeEl!.value as RadialShape; paint(); } },
    h("option", { value: "circle", selected: true }, t("gradient.circle")),
    h("option", { value: "ellipse" }, t("gradient.ellipse")),
  );
  angleEl = h("input", { type: "range", min: "0", max: "359", step: "1", value: String(g.angle), "data-field": "angle", onInput: () => { g.angle = clampAngle(Number(angleEl!.value)); paint(false); } });
  angleOut = h("output", { "data-out": "angle" });
  sizeEl = h("select", { "data-field": "size" },
    ...PNG_SIZES.map(([w, hh], i) => h("option", { value: String(i), selected: i === 0 }, `${w} × ${hh}`)),
  );
  previewEl = h("div", { class: "grad-preview", "data-out": "preview", role: "img", "aria-label": t("gradient.preview") });
  codeEl = h("textarea", { class: "clip-input grad-code", readonly: true, rows: "3", spellcheck: "false", "data-out": "css", "aria-label": t("gradient.css") });
  stopsEl = h("div", { class: "grad-stops", "data-out": "stops" });
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("gradient.title")),
      h("p", { class: "lede" }, t("gradient.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("gradient.options")),
          h("label", { class: "field" }, h("span", null, t("gradient.type")), kindEl),
          angleField = h("label", { class: "field" }, h("span", null, t("gradient.angle"), " ", angleOut), angleEl),
          shapeField = h("label", { class: "field" }, h("span", null, t("gradient.shape")), shapeEl),
        ),
        h("fieldset", null,
          h("legend", null, t("gradient.stops")),
          stopsEl,
          addBtn = h("button", { type: "button", class: "btn ghost", "data-action": "add-stop", onClick: () => addStop() }, t("gradient.addStop")),
        ),
        h("fieldset", null,
          h("legend", null, t("gradient.presets")),
          h("div", { class: "grad-presets" },
            ...PRESETS.map((p, i) =>
              h("button", {
                type: "button",
                class: "grad-swatch",
                "data-preset": String(i),
                "aria-label": t("gradient.presetN", { n: i + 1 }),
                style: { backgroundImage: gradientCss(p) },
                onClick: () => setGradient(p),
              }),
            ),
            h("button", { type: "button", class: "chip", "data-action": "random", onClick: () => setGradient(randomGradient()) }, t("gradient.random")),
          ),
        ),
      ),
      h("div", { class: "rail" },
        previewEl,
        h("h2", null, t("gradient.css")),
        codeEl,
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", "data-action": "copy", onClick: () => void copyCss() }, t("gradient.copy")),
          h("label", { class: "field grad-size" }, h("span", null, t("gradient.imageSize")), sizeEl),
          h("button", { type: "button", class: "btn ghost", "data-action": "png", onClick: () => void savePng() }, t("gradient.png")),
        ),
        statusEl,
      ),
    ),
  );
  paint();
}

export function unmountGradient(): void {
  previewEl = codeEl = stopsEl = statusEl = null;
  kindEl = shapeEl = sizeEl = null;
  angleEl = null;
  angleOut = null;
  angleField = shapeField = null;
  copyBtn = addBtn = null;
}

function setGradient(next: Gradient): void {
  g = cloneGradient(next);
  if (kindEl) kindEl.value = g.kind;
  if (shapeEl) shapeEl.value = g.shape;
  if (angleEl) angleEl.value = String(g.angle);
  paint();
}

function addStop(): void {
  if (g.stops.length >= MAX_STOPS) return;
  g.stops.push(newStop(g.stops));
  paint();
}

function removeStop(i: number): void {
  if (g.stops.length <= MIN_STOPS) return;
  g.stops.splice(i, 1);
  paint();
}

/** Redraws the preview and CSS; `rows` false keeps the stop rows (so a dragged slider or open colour picker stays). */
function paint(rows = true): void {
  if (!previewEl || !codeEl || !stopsEl) return;
  const css = gradientCss(g);
  previewEl.style.backgroundImage = css;
  codeEl.value = cssRule(g);
  if (angleOut) angleOut.textContent = `${g.angle}°`;
  if (angleField) angleField.hidden = g.kind === "radial";
  if (shapeField) shapeField.hidden = g.kind !== "radial";
  if (addBtn) addBtn.disabled = g.stops.length >= MAX_STOPS;
  if (rows) stopsEl.replaceChildren(...g.stops.map((_, i) => stopRow(i)));
}

function stopRow(i: number): HTMLElement {
  const s = g.stops[i];
  const picker = h("input", { type: "color", value: s.color, "aria-label": t("gradient.color", { n: i + 1 }), "data-field": "color" });
  const hex = h("input", { type: "text", value: s.color, maxlength: "7", spellcheck: "false", autocomplete: "off", class: "grad-hex", "aria-label": t("gradient.hex", { n: i + 1 }), "data-field": "hex" });
  const pos = h("input", { type: "range", min: "0", max: "100", step: "1", value: String(s.pos), "aria-label": t("gradient.position", { n: i + 1 }), "data-field": "pos" });
  const posOut = h("output", { class: "grad-pos" }, `${s.pos}%`);
  picker.addEventListener("input", () => {
    s.color = picker.value.toLowerCase();
    hex.value = s.color;
    hex.classList.remove("invalid");
    paint(false);
  });
  hex.addEventListener("input", () => {
    const c = normalizeHex(hex.value);
    hex.classList.toggle("invalid", !c);
    if (!c) return;
    s.color = c;
    picker.value = c;
    paint(false);
  });
  // Leaving a half-typed colour puts back the colour in use.
  hex.addEventListener("change", () => {
    hex.value = s.color;
    hex.classList.remove("invalid");
  });
  pos.addEventListener("input", () => {
    s.pos = clampPos(Number(pos.value));
    posOut.textContent = `${s.pos}%`;
    paint(false);
  });
  return h("div", { class: "grad-stop", "data-stop": String(i) },
    picker,
    hex,
    pos,
    posOut,
    h("button", { type: "button", class: "chip", "data-action": "remove-stop", "aria-label": t("gradient.removeStop", { n: i + 1 }), disabled: g.stops.length <= MIN_STOPS, onClick: () => removeStop(i) }, "×"),
  );
}

async function copyCss(): Promise<void> {
  await copyWithFlash(copyBtn, cssRule(g), { done: t("gradient.copied"), failed: t("gradient.copyFailed") });
}

/** Paints the gradient on a canvas with the same geometry CSS uses, and saves it as PNG. */
async function savePng(): Promise<void> {
  const [w, hh] = PNG_SIZES[Number(sizeEl?.value ?? 0)] ?? PNG_SIZES[0];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = hh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fail();
  let grad: CanvasGradient;
  // Radial: an ellipse is a circle squashed vertically by sy, so draw in a space stretched by 1 / sy.
  let sy = 1;
  if (g.kind === "linear") {
    const l = linearLine(g.angle, w, hh);
    grad = ctx.createLinearGradient(l.x0, l.y0, l.x1, l.y1);
  } else if (g.kind === "conic") {
    if (typeof ctx.createConicGradient !== "function") return fail();
    // CSS starts at the top and turns clockwise; canvas starts at 3 o'clock.
    grad = ctx.createConicGradient(((g.angle - 90) * Math.PI) / 180, w / 2, hh / 2);
  } else {
    const { rx, ry } = radialRadii(g.shape, w, hh);
    sy = ry / rx;
    ctx.setTransform(1, 0, 0, sy, 0, 0);
    grad = ctx.createRadialGradient(w / 2, hh / 2 / sy, 0, w / 2, hh / 2 / sy, rx);
  }
  for (const s of sortedStops(g.stops)) grad.addColorStop(s.pos / 100, s.color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, hh / sy);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return fail();
  downloadBlob(blob, `gradient-${w}x${hh}.png`);
  if (statusEl) statusEl.textContent = "";
}

function fail(): void {
  if (statusEl) statusEl.textContent = t("gradient.pngFailed");
}
