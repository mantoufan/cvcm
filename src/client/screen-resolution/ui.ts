import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { aspectRatio, physical, resolutionName } from "../../shared/screen";

let bigEl: HTMLElement | null = null;
let zoomEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
let dprQuery: MediaQueryList | null = null;
let frame = 0;

export function mountScreenResolution(host: HTMLElement): void {
  // Every value is this visitor's screen: the prerendered page keeps placeholders (data-volatile).
  bigEl = h("p", { class: "screen-big", "data-out": "resolution", "data-volatile": "" });
  outEl = h("dl", { class: "stats-grid", "data-out": "details" });
  zoomEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "zoom", "data-volatile": "", hidden: true });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("screenResolution.back")),
      h("h1", null, t("screenResolution.title")),
      h("p", { class: "lede" }, t("screenResolution.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "rail" },
        h("h2", null, t("screenResolution.yours")),
        bigEl,
        zoomEl,
        outEl,
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("screenResolution.copied"), failed: t("screenResolution.copyFailed") }) }, t("screenResolution.copy")),
        ),
        h("p", { class: "hint" }, t("screenResolution.hint")),
      ),
    ),
  );
  window.addEventListener("resize", schedule);
  screen.orientation?.addEventListener?.("change", schedule);
  watchDpr();
  paint();
}

export function unmountScreenResolution(): void {
  window.removeEventListener("resize", schedule);
  screen.orientation?.removeEventListener?.("change", schedule);
  dprQuery?.removeEventListener?.("change", onDpr);
  dprQuery = null;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  bigEl = zoomEl = outEl = null;
  copyBtn = null;
  last = "";
}

function schedule(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    paint();
  });
}

/** Zooming or moving the window to another monitor changes devicePixelRatio without a resize on some browsers. */
function watchDpr(): void {
  dprQuery?.removeEventListener?.("change", onDpr);
  dprQuery = typeof matchMedia === "function" ? matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
  dprQuery?.addEventListener?.("change", onDpr);
}

function onDpr(): void {
  watchDpr();
  schedule();
}

function paint(): void {
  if (!bigEl || !outEl || !zoomEl) return;
  const dpr = window.devicePixelRatio || 1;
  const sw = screen.width;
  const sh = screen.height;
  const pw = physical(sw, dpr);
  const ph = physical(sh, dpr);
  const name = resolutionName(pw, ph);
  bigEl.textContent = `${pw} × ${ph}`;
  const orient = sw >= sh ? t("screenResolution.landscape") : t("screenResolution.portrait");
  // Chromium keeps screen.width fixed but raises devicePixelRatio when the page is zoomed, which inflates the result.
  // outerWidth (window pixels) over innerWidth (CSS pixels) gives the zoom there; it stays near 1 elsewhere.
  // Only with a mouse: on phones pinch zoom and browser bars make the two widths differ for other reasons.
  const fine = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
  const zoom = fine && window.innerWidth > 0 && window.outerWidth > 0 ? window.outerWidth / window.innerWidth : 1;
  zoomEl.hidden = zoom < 1.09 && zoom > 0.92;
  zoomEl.textContent = zoomEl.hidden ? "" : t("screenResolution.zoomed", { n: Math.round(zoom * 100) });
  const rows: Array<[string, string]> = [
    [t("screenResolution.physical"), `${pw} × ${ph}${name ? ` — ${name}` : ""}`],
    [t("screenResolution.css"), `${sw} × ${sh}`],
    [t("screenResolution.dpr"), `${Number(dpr.toFixed(3))} (${Math.round(dpr * 100)}%)`],
    [t("screenResolution.viewport"), `${window.innerWidth} × ${window.innerHeight}`],
    [t("screenResolution.available"), `${screen.availWidth} × ${screen.availHeight}`],
    [t("screenResolution.aspect"), aspectRatio(sw, sh)],
    [t("screenResolution.orientation"), orient],
    [t("screenResolution.colorDepth"), t("screenResolution.bits", { n: screen.colorDepth })],
  ];
  outEl.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", { "data-volatile": "" }, v)]));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
}
