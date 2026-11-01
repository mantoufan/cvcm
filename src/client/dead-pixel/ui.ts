import { h } from "../dom";
import { enterFullscreen, exitFullscreen, fullscreenElement } from "../fullscreen";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { AUTO_ADVANCE, SCREEN_COLORS, labelInk, stepColor } from "../../shared/dead-pixel";

/** The colour name and exit button on the test screen fade after this long without input. */
const LABEL_MS = 2500;

let previewEl: HTMLElement | null = null;
let previewName: HTMLElement | null = null;
let autoEl: HTMLSelectElement | null = null;
let chips: HTMLButtonElement[] = [];
let screenEl: HTMLElement | null = null;
let screenLabel: HTMLElement | null = null;
let index = 0;
let open = false;
/** The page has no Fullscreen API (iPhone Safari): the test screen covers the window instead. */
let covering = false;
/** The test screen has been in full screen during this opening. */
let entered = false;
let autoTimer = 0;
let labelTimer = 0;

export function mountDeadPixel(host: HTMLElement): void {
  index = 0;
  chips = SCREEN_COLORS.map((c, i) =>
    h("button", { type: "button", class: "chip dp-chip", "data-color": c.id, "aria-pressed": i === 0 ? "true" : "false", onClick: () => pick(i) },
      h("span", { class: "dp-swatch", style: { background: c.hex } }),
      t(`deadPixel.color_${c.id}`),
    ),
  );
  autoEl = h("select", { "data-field": "auto" },
    ...AUTO_ADVANCE.map((s) => h("option", { value: String(s) }, s ? t("deadPixel.everySeconds", { n: s }) : t("deadPixel.autoOff"))),
  );
  previewName = h("span", { class: "dp-preview-name" });
  previewEl = h("div", { class: "dp-preview", "data-out": "preview" }, previewName);
  screenLabel = h("span", { class: "dp-label" });
  screenEl = h("div", {
    class: "dp-screen",
    hidden: true,
    tabindex: "-1",
    "data-out": "screen",
    onPointerdown: (e: PointerEvent) => tap(e),
    onPointermove: () => showLabel(),
    onKeydown: (e: KeyboardEvent) => key(e),
  },
    screenLabel,
    h("button", { type: "button", class: "dp-exit", "data-action": "exit", "aria-label": t("deadPixel.exit"), onPointerdown: (e: PointerEvent) => e.stopPropagation(), onClick: () => close() }, "×"),
  );
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("deadPixel.back")),
      h("h1", null, t("deadPixel.title")),
      h("p", { class: "lede" }, t("deadPixel.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("deadPixel.options")),
          h("div", { class: "dp-chips", role: "group", "aria-label": t("deadPixel.colors") }, ...chips),
          h("label", { class: "field" }, h("span", null, t("deadPixel.auto")), autoEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => void openScreen() }, t("deadPixel.start")),
        ),
        h("p", { class: "hint" }, t("deadPixel.hint")),
      ),
      h("div", { class: "rail dp-stage" },
        previewEl,
        h("ul", { class: "dp-tips" },
          h("li", null, t("deadPixel.tipDead")),
          h("li", null, t("deadPixel.tipStuck")),
          h("li", null, t("deadPixel.tipDust")),
        ),
      ),
      screenEl,
    ),
  );
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  paint();
}

export function unmountDeadPixel(): void {
  close();
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  previewEl = previewName = null;
  autoEl = null;
  chips = [];
  screenEl = screenLabel = null;
}

function pick(i: number): void {
  index = stepColor(i, 0);
  paint();
}

function paint(): void {
  const c = SCREEN_COLORS[index];
  const name = t(`deadPixel.color_${c.id}`);
  if (previewEl) previewEl.style.background = c.hex;
  if (previewName) {
    previewName.textContent = name;
    previewName.style.color = labelInk(c.hex);
  }
  chips.forEach((chip, i) => chip.setAttribute("aria-pressed", i === index ? "true" : "false"));
  if (screenEl) screenEl.style.background = c.hex;
  if (screenLabel) {
    screenLabel.textContent = t("deadPixel.screenLabel", { color: name, i: index + 1, n: SCREEN_COLORS.length });
    screenEl?.style.setProperty("--dp-ink", labelInk(c.hex));
  }
}

async function openScreen(): Promise<void> {
  const el = screenEl;
  if (!el || open) return;
  open = true;
  entered = false;
  el.hidden = false;
  covering = false;
  const full = await enterFullscreen(el);
  if (!open) return;
  if (!full) {
    // No Fullscreen API (iPhone) or refused: cover the window instead.
    covering = true;
    el.classList.add("covering");
    document.documentElement.classList.add("dp-lock");
  }
  el.focus({ preventScroll: true });
  paint();
  showLabel();
  restartAuto();
}

function close(): void {
  if (!open) return;
  open = false;
  window.clearInterval(autoTimer);
  window.clearTimeout(labelTimer);
  const el = screenEl;
  if (el) {
    el.hidden = true;
    el.classList.remove("covering", "idle");
  }
  document.documentElement.classList.remove("dp-lock");
  covering = false;
  if (el && fullscreenElement() === el) exitFullscreen();
}

function onFullscreenChange(): void {
  // Esc (or the browser's own exit) leaves full screen: close the test screen with it. While the request is still
  // pending (covering not yet decided) the element is not in full screen yet, so only act once it has been.
  if (open && !covering && entered && fullscreenElement() !== screenEl) close();
  if (open && fullscreenElement() === screenEl) entered = true;
}

function next(by: number): void {
  index = stepColor(index, by);
  paint();
  showLabel();
  restartAuto();
}

function tap(e: PointerEvent): void {
  if (e.button !== 0) return;
  // Left third goes back, the rest forward.
  const left = (e.currentTarget as HTMLElement).getBoundingClientRect().left;
  const width = (e.currentTarget as HTMLElement).clientWidth || window.innerWidth;
  next(e.clientX - left < width / 3 ? -1 : 1);
}

function key(e: KeyboardEvent): void {
  // Enter and Space on the × button press it.
  if ((e.target as HTMLElement | null)?.closest?.("[data-action=exit]") && e.key !== "Escape") return;
  // A held key repeats about 30 times a second: one press moves one colour, so the screen never flashes.
  if (e.repeat) {
    if (e.key !== "Escape") e.preventDefault();
    return;
  }
  if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
    e.preventDefault();
    next(1);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Backspace") {
    e.preventDefault();
    next(-1);
  } else if (e.key === "Escape") {
    // Browsers usually leave full screen on Esc themselves (fullscreenchange then closes); close here too in case one does not.
    close();
  }
}

function showLabel(): void {
  if (!screenEl || !open) return;
  screenEl.classList.remove("idle");
  window.clearTimeout(labelTimer);
  labelTimer = window.setTimeout(() => screenEl?.classList.add("idle"), LABEL_MS);
}

function restartAuto(): void {
  window.clearInterval(autoTimer);
  const secs = Number(autoEl?.value) || 0;
  if (secs > 0 && open) autoTimer = window.setInterval(() => {
    index = stepColor(index, 1);
    paint();
  }, secs * 1000);
}
