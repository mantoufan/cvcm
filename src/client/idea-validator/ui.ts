import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { hasIdeasMessages } from "../../shared/messages";
import { IDEA_ENTRIES, isIdeaId, type IdeaId } from "../../shared/ideas";
import { ideaData, ideaName } from "../../shared/ideas-i18n";
import { ideasHref } from "../../shared/path";
import { OPTION_POINTS, VALIDATOR_QUESTIONS, matchIdea, tipsFor, validateIdea, type ValidatorAnswers, type ValidatorQuestion } from "../../shared/idea-validator";

type State = {
  idea: HTMLTextAreaElement;
  match: HTMLSelectElement;
  selects: Record<ValidatorQuestion, HTMLSelectElement>;
  out: HTMLElement;
  copyBtn: HTMLButtonElement | null;
  /**
   * The match was picked by hand (or preset): typing keeps it unless a different idea matches confidently; a hand
   * pick of "Something else" is kept until the box is cleared.
   */
  pinned: boolean;
  /** The automatic match the reader overrode when pinning: typing only overrides the pick with a different one. */
  autoAtPin: string;
  /** Idea names in the page's language, for matching. */
  names: Partial<Record<IdeaId, string>>;
  /** What the result area shows (match + answers), so typing does not rebuild it needlessly. */
  signature: string;
  ready: boolean;
  last: string;
};

let state: State | null = null;

const NONE = "";

export function mountIdeaValidator(host: HTMLElement): void {
  unmountIdeaValidator();
  const loc = locale();
  const idea = h("textarea", {
    "data-field": "idea",
    rows: 3,
    maxlength: 500,
    placeholder: t("ideaValidator.describePh"),
    "aria-label": t("ideaValidator.describe"),
    onInput: () => onIdeaInput(),
  });
  const match = h("select", { "data-field": "match", "aria-label": t("ideaValidator.match"), onChange: () => onMatchChange() },
    h("option", { value: NONE }, t("ideaValidator.matchNone")),
  );
  const selects = Object.fromEntries(VALIDATOR_QUESTIONS.map((q) => [q, h("select", {
    "data-field": q,
    "aria-label": t(`ideaValidator.${q}.label`),
    onChange: () => paint(),
  },
    h("option", { value: "" }, t("ideaValidator.choose")),
    ...OPTION_POINTS[q].map((_, i) => h("option", { value: String(i) }, t(`ideaValidator.${q}.o${i + 1}`))),
  )])) as Record<ValidatorQuestion, HTMLSelectElement>;
  const out = h("div", { class: "iv-out", "aria-live": "polite", "data-out": "result" });
  state = { idea, match, selects, out, copyBtn: null, pinned: false, autoAtPin: NONE, names: {}, signature: "", ready: false, last: "" };
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("ideaValidator.title")),
      h("p", { class: "lede" }, t("ideaValidator.lede")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("ideaValidator.describe")),
          idea,
          h("label", { class: "iv-field" }, h("span", null, t("ideaValidator.match")), match),
          h("p", { class: "hint" }, t("ideaValidator.matchHint")),
        ),
        h("fieldset", { class: "iv-questions" },
          h("legend", null, t("ideaValidator.questions")),
          ...VALIDATOR_QUESTIONS.map((q) => h("label", { class: "iv-field" }, h("span", null, t(`ideaValidator.${q}.label`)), selects[q])),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("ideaValidator.result")),
        out,
        h("div", { class: "stage-actions" },
          state.copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(state?.copyBtn ?? null, state?.last ?? "", { done: t("ideaValidator.copied"), failed: t("ideaValidator.copyFailed") }) }, t("ideaValidator.copy")),
        ),
        h("p", { class: "hint" }, t("ideaValidator.disclaimer")),
      ),
    ),
  );
  // Idea names and the search-data snapshot come with the ideas pack, which the page loads with the tool's strings
  // (IDEAS_PACK_TOOLS); the guard only keeps a test mount without it from failing.
  if (hasIdeasMessages(loc)) fillIdeas(loc);
  else paint();
}

function fillIdeas(loc: ReturnType<typeof locale>): void {
  if (!state) return;
  state.ready = true;
  state.names = Object.fromEntries(IDEA_ENTRIES.map((id) => [id, ideaName(loc, id).name]));
  const sorted = IDEA_ENTRIES.map((id) => ({ id, name: state!.names[id] ?? id })).sort((a, b) => a.name.localeCompare(b.name, loc));
  state.match.append(...sorted.map(({ id, name }) => h("option", { value: id }, name)));
  // Opened from an idea page (?idea=<id>): start from that idea as the benchmark.
  const preset = new URLSearchParams(location.search).get("idea") ?? "";
  if (isIdeaId(preset)) {
    state.idea.value = state.names[preset] ?? "";
    state.match.value = preset;
    state.pinned = true;
    state.autoAtPin = matchIdea(state.idea.value, state.names, loc) ?? NONE;
    paint();
    return;
  }
  onIdeaInput();
}

export function unmountIdeaValidator(): void {
  state = null;
}

function matchedIdea(): IdeaId | null {
  const value = state?.match.value ?? NONE;
  return isIdeaId(value) ? value : null;
}

function onIdeaInput(): void {
  if (!state) return;
  if (state.ready) {
    const found = matchIdea(state.idea.value, state.names, locale());
    // A hand-picked (or preset) match stays through typo fixes and extra words; only a different confident match, or
    // clearing the box, replaces it.
    const cleared = !state.idea.value.trim();
    const optedOut = state.pinned && state.match.value === NONE;
    if (!state.pinned || cleared || (!optedOut && found && found !== state.match.value && found !== state.autoAtPin)) {
      state.match.value = found ?? NONE;
      state.pinned = false;
    }
  }
  paint();
}

function onMatchChange(): void {
  if (!state) return;
  state.pinned = true;
  state.autoAtPin = state.ready ? matchIdea(state.idea.value, state.names, locale()) ?? NONE : NONE;
  paint();
}

function paint(): void {
  if (!state) return;
  const loc = locale();
  const answers: ValidatorAnswers = {};
  for (const q of VALIDATOR_QUESTIONS) {
    const v = state.selects[q].value;
    if (v !== "") answers[q] = Number(v);
  }
  const id = matchedIdea();
  const data = id && state.ready ? ideaData(loc, id) : null;
  const result = validateIdea(answers, data ? data.scores.total : null);
  // Typing in the description repaints only when the match or the answers change, so the live region is not re-read
  // on every key; the copied text still follows the description.
  const signature = `${id ?? ""}|${JSON.stringify(answers)}|${state.ready}`;
  if (signature === state.signature) {
    if (result) state.last = summary(result, answers, id);
    return;
  }
  state.signature = signature;
  const out = state.out;
  out.replaceChildren();
  state.last = "";
  if (state.copyBtn) state.copyBtn.disabled = !result;
  if (!result) {
    const left = VALIDATOR_QUESTIONS.filter((q) => answers[q] === undefined).length;
    out.append(h("p", { class: "hint", "data-out": "pending" }, t("ideaValidator.answerAll", { n: left })));
    if (id && data) out.append(benchmark(id, data.scores.total));
    return;
  }
  const gradeLabel = t(`ideaValidator.grade.${result.grade}`);
  out.append(
    h("p", { class: `iv-score iv-${result.grade}`, "data-out": "total" },
      h("strong", null, String(result.total)),
      h("span", null, t("ideaValidator.outOf")),
      h("small", null, gradeLabel),
    ),
    h("p", { class: "iv-verdict" }, t(`ideaValidator.verdict.${result.grade}`)),
  );
  const list = (title: string, items: ValidatorQuestion[], key: string) => h("section", { class: "iv-list" },
    h("h3", null, title),
    items.length ? h("ul", { "data-out": key }, ...items.map((q) => h("li", null, t(`ideaValidator.${q}.label`)))) : h("p", { class: "hint" }, t("ideaValidator.none")),
  );
  out.append(list(t("ideaValidator.strengths"), result.strengths, "strengths"), list(t("ideaValidator.weaknesses"), result.weaknesses, "weaknesses"));
  const { focus, tips } = nextSteps(result, answers);
  if (focus) {
    out.append(h("section", { class: "iv-list" },
      h("h3", null, t("ideaValidator.next", { item: t(`ideaValidator.${focus}.label`) })),
      h("ol", { "data-out": "tips" }, ...tips.map((tip) => h("li", null, tip))),
    ));
  }
  if (id && data) out.append(benchmark(id, data.scores.total));
  out.append(h("p", { class: "more" }, h("a", { href: ideasHref(loc), "data-nav": "ideas" }, t("ideaValidator.allIdeas", { n: IDEA_ENTRIES.length }))));
  state.last = summary(result, answers, id);
}

/** The weak spot to test first and its three tips; "nobody competes" is tested as proof of demand. */
function nextSteps(result: NonNullable<ReturnType<typeof validateIdea>>, answers: ValidatorAnswers): { focus: ValidatorQuestion | null; tips: string[] } {
  const weakest = result.weaknesses[0];
  if (!weakest) return { focus: null, tips: [] };
  const focus = tipsFor(weakest, answers);
  return { focus, tips: [1, 2, 3].map((n) => t(`ideaValidator.tip.${focus}.t${n}`)) };
}

/** The result as plain text for Copy. */
function summary(result: NonNullable<ReturnType<typeof validateIdea>>, answers: ValidatorAnswers, id: IdeaId | null): string {
  const loc = locale();
  const { focus, tips } = nextSteps(result, answers);
  const text = state?.idea.value.trim() ?? "";
  return [
    `${t("ideaValidator.title")}: ${result.total}/100 (${t(`ideaValidator.grade.${result.grade}`)})`,
    text ? `${t("ideaValidator.describe")}: ${text}` : "",
    `${t("ideaValidator.market")}: ${result.market === null ? t("ideaValidator.noMarket") : `${result.market}${id ? ` (${ideaName(loc, id).name})` : ""}`}`,
    ...VALIDATOR_QUESTIONS.map((q) => `${t(`ideaValidator.${q}.label`)}: ${t(`ideaValidator.${q}.o${(answers[q] ?? 0) + 1}`)}`),
    ...(focus ? [`${t("ideaValidator.next", { item: t(`ideaValidator.${focus}.label`) })}:`, ...tips.map((tip, i) => `${i + 1}. ${tip}`)] : []),
  ].filter(Boolean).join("\n");
}

/** The matched idea's market numbers and a link to its page. */
function benchmark(id: IdeaId, score: number): HTMLElement {
  const loc = locale();
  const name = ideaName(loc, id).name;
  return h("p", { class: "iv-bench", "data-out": "benchmark" },
    t("ideaValidator.benchmark", { name, score }),
    " ",
    h("a", { href: ideasHref(loc, id), "data-nav": `ideas-${id}` }, t("ideaValidator.seeIdea", { name })),
  );
}
