import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { hasIdeasMessages } from "../../shared/messages";
import { IDEA_ENTRIES, isIdeaId, type IdeaId } from "../../shared/ideas";
import { ideaData, ideaName } from "../../shared/ideas-i18n";
import { ideasHref } from "../../shared/path";
import { OPTION_POINTS, VALIDATOR_QUESTIONS, matchIdea, validateIdea, type ValidatorAnswers, type ValidatorQuestion } from "../../shared/idea-validator";

type State = {
  idea: HTMLTextAreaElement;
  match: HTMLSelectElement;
  selects: Record<ValidatorQuestion, HTMLSelectElement>;
  out: HTMLElement;
  copyBtn: HTMLButtonElement | null;
  /** The text when the match was picked by hand (or preset): until the text changes, typing does not re-match. */
  pinnedText: string | null;
  /** Idea names in the page's language, for matching. */
  names: Partial<Record<IdeaId, string>>;
  /** What the result area shows (match + answers), so typing does not rebuild it needlessly. */
  signature: string;
  ready: boolean;
  last: string;
};

let state: State | null = null;
let alive = 0;

const NONE = "";

export function mountIdeaValidator(host: HTMLElement): void {
  unmountIdeaValidator();
  alive++;
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
  state = { idea, match, selects, out, copyBtn: null, pinnedText: null, names: {}, signature: "", ready: false, last: "" };
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
  // (main.ts render). Without it the scorecard still works, with no benchmark.
  if (hasIdeasMessages(loc)) fillIdeas(loc);
  else paint();
}

function fillIdeas(loc: ReturnType<typeof locale>): void {
  if (!state) return;
  state.ready = true;
  state.names = Object.fromEntries(IDEA_ENTRIES.map((id) => [id, ideaName(loc, id).name]));
  const sorted = IDEA_ENTRIES.map((id) => ({ id, name: state!.names[id] ?? id })).sort((a, b) => a.name.localeCompare(b.name, loc));
  state.match.append(...sorted.map(({ id, name }) => h("option", { value: id }, name)));
  // Opened from an idea page (?idea=<id>): start from that idea as the benchmark, keeping anything already typed.
  const preset = new URLSearchParams(location.search).get("idea") ?? "";
  if (isIdeaId(preset)) {
    if (!state.idea.value.trim()) state.idea.value = state.names[preset] ?? "";
    state.match.value = preset;
    state.pinnedText = state.idea.value;
    paint();
    return;
  }
  onIdeaInput();
}

export function unmountIdeaValidator(): void {
  alive++;
  state = null;
}

function matchedIdea(): IdeaId | null {
  const value = state?.match.value ?? NONE;
  return isIdeaId(value) ? value : null;
}

function onIdeaInput(): void {
  if (!state) return;
  // A hand-picked match holds until the description changes.
  if (state.pinnedText !== null && state.idea.value !== state.pinnedText) state.pinnedText = null;
  if (state.ready && state.pinnedText === null) state.match.value = matchIdea(state.idea.value, state.names) ?? NONE;
  paint();
}

function onMatchChange(): void {
  if (!state) return;
  state.pinnedText = state.idea.value;
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
    h("dl", { class: "iv-stats" },
      h("div", null, h("dt", null, t("ideaValidator.readiness")), h("dd", { "data-out": "readiness" }, String(result.readiness))),
      h("div", null, h("dt", null, t("ideaValidator.market")), h("dd", { "data-out": "market" }, result.market === null ? t("ideaValidator.noMarket") : String(result.market))),
    ),
  );
  const list = (title: string, items: ValidatorQuestion[], key: string) => h("section", { class: "iv-list" },
    h("h3", null, title),
    items.length ? h("ul", { "data-out": key }, ...items.map((q) => h("li", null, t(`ideaValidator.${q}.label`)))) : h("p", { class: "hint" }, t("ideaValidator.none")),
  );
  out.append(list(t("ideaValidator.strengths"), result.strengths, "strengths"), list(t("ideaValidator.weaknesses"), result.weaknesses, "weaknesses"));
  const focus = result.weaknesses[0];
  const tips = focus ? [1, 2, 3].map((n) => t(`ideaValidator.tip.${focus}.t${n}`)) : [];
  if (focus) {
    out.append(h("section", { class: "iv-list" },
      h("h3", null, t("ideaValidator.next", { item: t(`ideaValidator.${focus}.label`) })),
      h("ol", { "data-out": "tips" }, ...tips.map((tip) => h("li", null, tip))),
    ));
  }
  if (id && data) out.append(benchmark(id, data.scores.total));
  out.append(h("p", { class: "more" }, h("a", { href: ideasHref(loc), "data-nav": "ideas" }, t("ideaValidator.allIdeas"))));
  state.last = summary(result, answers, id);
}

/** The result as plain text for Copy. */
function summary(result: NonNullable<ReturnType<typeof validateIdea>>, answers: ValidatorAnswers, id: IdeaId | null): string {
  const loc = locale();
  const focus = result.weaknesses[0];
  const tips = focus ? [1, 2, 3].map((n) => t(`ideaValidator.tip.${focus}.t${n}`)) : [];
  const text = state?.idea.value.trim() ?? "";
  return [
    `${t("ideaValidator.title")}: ${result.total}/100 (${t(`ideaValidator.grade.${result.grade}`)})`,
    text ? `${t("ideaValidator.describe")}: ${text}` : "",
    `${t("ideaValidator.readiness")}: ${result.readiness}`,
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
