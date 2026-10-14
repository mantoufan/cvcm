import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  TYPING_DURATIONS,
  TYPING_METRIC,
  addStrokes,
  isFinished,
  markPassage,
  scoreTyping,
  type Strokes,
  type TypingDuration,
} from "../../shared/typing";
import { TYPING_PASSAGES } from "../../shared/typing-passages";

type Phase = "idle" | "running" | "done";

const state = {
  passage: 0,
  duration: 60 as TypingDuration,
  phase: "idle" as Phase,
  startedAt: 0,
  endedAt: 0,
  composing: false,
  /** Box text at the last scored edit, to count newly typed characters. */
  lastText: "",
  strokes: { typed: 0, wrong: 0 } as Strokes,
};

let timer: number | undefined;
let textEl: HTMLElement | null = null;
let inputEl: HTMLTextAreaElement | null = null;
let statsEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let durationEl: HTMLSelectElement | null = null;
let passageEl: HTMLSelectElement | null = null;

function passage(): string {
  const list = TYPING_PASSAGES[locale()] ?? TYPING_PASSAGES.en;
  return list[state.passage % list.length];
}

export function mountTyping(host: HTMLElement): void {
  state.passage = 0;
  state.duration = 60;
  state.phase = "idle";
  state.startedAt = state.endedAt = 0;
  state.composing = false;
  state.lastText = "";
  state.strokes = { typed: 0, wrong: 0 };
  const count = (TYPING_PASSAGES[locale()] ?? TYPING_PASSAGES.en).length;
  durationEl = h("select", { "data-field": "duration", onChange: () => restart() },
    ...TYPING_DURATIONS.map((s) => h("option", { value: String(s), selected: s === state.duration }, t("typing.seconds", { n: s }))),
  );
  passageEl = h("select", { "data-field": "passage", onChange: () => restart() },
    ...Array.from({ length: count }, (_, i) => h("option", { value: String(i), selected: i === 0 }, t("typing.passageN", { n: i + 1 }))),
  );
  textEl = h("p", { class: "typing-text", lang: locale(), "aria-hidden": "true" });
  inputEl = h("textarea", {
    class: "typing-input",
    rows: 4,
    spellcheck: "false",
    autocomplete: "off",
    autocorrect: "off",
    autocapitalize: "off",
    "aria-label": t("typing.inputLabel"),
    placeholder: t("typing.placeholder"),
    onInput: () => onType(),
    onCompositionstart: () => { state.composing = true; },
    onCompositionend: () => { state.composing = false; onType(); },
    onPaste: (e: Event) => e.preventDefault(),
    onDrop: (e: Event) => e.preventDefault(),
  });
  statsEl = h("dl", { class: "stats-grid timestamp-out" });
  resultEl = h("p", { class: "status", "aria-live": "polite" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("typing.back")),
      h("h1", null, t("typing.title")),
      h("p", { class: "lede" }, t("typing.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("div", { class: "row wrap" },
        labeled(t("typing.duration"), durationEl),
        labeled(t("typing.passage"), passageEl),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", onClick: () => restart() }, t("typing.restart")),
        ),
      ),
      h("section", { class: "typing-stage" },
        h("p", { class: "sr-only" }, t("typing.passageLabel")),
        textEl,
        inputEl,
        resultEl,
      ),
      h("div", { class: "rail" }, h("h2", null, t("typing.stats")), statsEl,
        h("p", { class: "hint" }, t(TYPING_METRIC[locale()] === "wpm" ? "typing.wpmNote" : "typing.cpmNote"))),
    ),
  );
  paint();
}

export function unmountTyping(): void {
  stopTimer();
  textEl = inputEl = null;
  statsEl = resultEl = null;
  durationEl = passageEl = null;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function stopTimer(): void {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}

function restart(): void {
  stopTimer();
  state.duration = (Number(durationEl?.value) as TypingDuration) || 60;
  state.passage = Number(passageEl?.value) || 0;
  state.phase = "idle";
  state.startedAt = state.endedAt = 0;
  state.composing = false;
  state.lastText = "";
  state.strokes = { typed: 0, wrong: 0 };
  if (inputEl) {
    inputEl.value = "";
    inputEl.readOnly = false;
    inputEl.focus();
  }
  if (resultEl) resultEl.textContent = "";
  paint();
}

function onType(): void {
  if (!inputEl || state.phase === "done") return;
  if (state.phase === "idle" && inputEl.value) {
    state.phase = "running";
    state.startedAt = performance.now();
    timer = window.setInterval(tick, 200);
  }
  if (state.composing) return;
  state.strokes = addStrokes(passage(), state.lastText, inputEl.value, state.strokes);
  state.lastText = inputEl.value;
  if (state.phase === "running" && isFinished(passage(), inputEl.value)) finish();
  else paint();
}

function elapsed(): number {
  if (state.phase === "idle") return 0;
  const end = state.phase === "done" ? state.endedAt : performance.now();
  return Math.min(end - state.startedAt, state.duration * 1000);
}

function tick(): void {
  if (state.phase !== "running") return;
  if (elapsed() >= state.duration * 1000) finish();
  else paintStats();
}

function finish(): void {
  stopTimer();
  state.phase = "done";
  state.endedAt = performance.now();
  if (inputEl) inputEl.readOnly = true;
  paint();
  const s = score();
  if (resultEl) {
    resultEl.textContent = t("typing.result", {
      speed: Math.round(s.speed),
      unit: unitLabel(),
      accuracy: Math.round(s.accuracy),
      seconds: Math.round(elapsed() / 1000),
    });
  }
}

function score() {
  return scoreTyping(passage(), state.composing ? state.lastText : inputEl?.value ?? "", elapsed(), TYPING_METRIC[locale()], state.strokes);
}

function unitLabel(): string {
  return t(TYPING_METRIC[locale()] === "wpm" ? "typing.wpm" : "typing.cpm");
}

function paint(): void {
  if (textEl) {
    const typed = state.composing ? state.lastText : inputEl?.value ?? "";
    textEl.replaceChildren(...markPassage(passage(), typed).map(({ ch, state: s }) => h("span", { class: `tc-${s}` }, ch)));
  }
  paintStats();
}

function paintStats(): void {
  if (!statsEl) return;
  const ms = elapsed();
  const s = score();
  // Under two seconds the per-minute rate swings wildly; hold it at 0 until there is something to measure.
  const speed = ms < 2000 && state.phase !== "done" ? 0 : Math.round(s.speed);
  const left = Math.max(0, Math.ceil((state.duration * 1000 - ms) / 1000));
  const rows: Array<[string, string]> = [
    [t("typing.timeLeft"), t("typing.seconds", { n: left })],
    [unitLabel(), String(speed)],
    [t("typing.accuracy"), `${Math.round(s.accuracy)}%`],
    [t("typing.errors"), String(s.errors)],
  ];
  statsEl.replaceChildren(...rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
}
