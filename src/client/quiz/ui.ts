import { h } from "../dom";
import { linkList } from "../links";
import type { Locale } from "../../shared/locale";
import { appHref, quizHref } from "../../shared/path";
import {
  QUIZ_DEFS,
  QUIZ_GROUPS,
  SCALE_POINTS,
  isComplete,
  maxTotal,
  questionCount,
  quizGroupOf,
  quizMinutes,
  scoreQuiz,
  traitLevel,
  type QuizId,
  type QuizResult,
} from "../../shared/quiz";
import {
  fill,
  quizCopy,
  quizFaqItems,
  quizHub,
  quizItemText,
  quizName,
  quizUi,
  type QuizCopy,
  type QuizResultCopy,
} from "../../shared/quiz-i18n";
import { messages, quizMessages } from "../../shared/messages";

function crumb(locale: Locale, id: QuizId | null): HTMLElement {
  const hub = quizHub(locale);
  const home = h("a", { href: appHref(locale, null), "data-nav": "home" }, quizMessages(locale).crumbHome);
  const sep = (): HTMLElement => h("span", { "aria-hidden": "true" }, "/");
  if (!id) return h("nav", { class: "device-crumb", "aria-label": hub.h1 }, home, sep(), h("span", null, hub.h1));
  return h("nav", { class: "device-crumb", "aria-label": hub.h1 },
    home, sep(),
    h("a", { href: quizHref(locale), "data-nav": "tests" }, hub.h1), sep(),
    h("span", null, quizName(locale, id).name),
  );
}

function faq(locale: Locale, id: QuizId | null): HTMLElement {
  return h("section", { class: "faq", "aria-labelledby": "faq-title" },
    h("h2", { id: "faq-title" }, quizUi(locale).faq),
    ...quizFaqItems(locale, id).map((item, index) =>
      h("details", index === 0 ? { open: true } : null, h("summary", null, item.q), h("p", null, item.a)),
    ),
  );
}

function testLinks(locale: Locale, ids: readonly QuizId[]): HTMLElement {
  const count = messages(locale).ui.quiz.questions;
  return linkList(ids.map((id) => {
    const name = quizName(locale, id);
    return { href: quizHref(locale, id), name: name.name, blurb: name.blurb, meta: fill(count, { n: questionCount(id) }), nav: `test-${id}` };
  }));
}

export function mountQuizHub(host: HTMLElement, locale: Locale): void {
  const hub = quizHub(locale);
  host.append(
    crumb(locale, null),
    h("h1", null, hub.h1),
    h("p", { class: "lede" }, hub.lede),
    h("section", { class: "wall quiz-hub" },
      ...QUIZ_GROUPS.map((group) => h("div", { class: "group" }, h("h2", null, hub.groups[group.id]), testLinks(locale, group.quizzes))),
    ),
    h("section", { class: "quiz-about" }, ...hub.about.map((p) => h("p", null, p))),
    faq(locale, null),
  );
}

/** One test: every question on the page, a result under them, then the explanation and FAQ. */
export function mountQuiz(host: HTMLElement, locale: Locale, id: QuizId): void {
  const ui = quizUi(locale);
  const copy = quizCopy(locale, id);
  const def = QUIZ_DEFS[id];
  const total = questionCount(id);
  const answers: (number | null)[] = Array.from({ length: total }, () => null);

  const progressText = h("span", { class: "quiz-count" }, fill(ui.progress, { n: 0, total }));
  const meter = h("span", { class: "quiz-meter-fill" });
  const note = h("p", { class: "quiz-note", role: "status", "aria-live": "polite" });
  const resultBox = h("section", { class: "quiz-result", id: "result", hidden: true, "aria-labelledby": "result-title", tabindex: "-1" });

  const questions = copy.items.map((item, i) => {
    const labels = def.type === "likert" ? ui.scale[def.scale] : (item as { options: string[] }).options;
    const name = `q${i + 1}`;
    const legendId = `${name}-text`;
    const li = h("li", { class: "quiz-q", id: name },
      h("p", { class: "quiz-q-text", id: legendId }, quizItemText(item)),
    );
    const group = h("div", {
      class: def.type === "likert" ? `quiz-scale n${SCALE_POINTS[def.scale]}` : "quiz-options",
      role: "radiogroup",
      "aria-labelledby": legendId,
    });
    labels.forEach((label, value) => {
      group.append(h("label", { class: "quiz-opt" },
        h("input", {
          type: "radio",
          name,
          value: String(value),
          onChange: () => {
            answers[i] = value;
            li.classList.add("done");
            li.classList.remove("need");
            // The selected option's look comes from a class, not :has(), for older in-app browsers.
            group.querySelectorAll(".quiz-opt").forEach((opt, j) => opt.classList.toggle("on", j === value));
            update();
          },
        }),
        h("span", null, label),
      ));
    });
    li.append(group);
    return li;
  });

  function answered(): number {
    return answers.filter((a) => a !== null).length;
  }

  function update(): void {
    const n = answered();
    progressText.textContent = fill(ui.progress, { n, total });
    meter.style.width = `${Math.round((n / total) * 100)}%`;
    // After a failed submit the note counts what is left; keep it current.
    if (note.textContent) note.textContent = n === total ? "" : fill(ui.missing, { n: total - n });
    // A result on screen follows the answers (an edited PHQ-9 item 9 must show the help box at once).
    if (!resultBox.hidden && isComplete(id, answers)) showResult(scoreQuiz(id, answers as number[]), false);
  }

  function submit(e: Event): void {
    e.preventDefault();
    if (!isComplete(id, answers)) {
      const missing = answers.map((a, i) => (a === null ? i : -1)).filter((i) => i >= 0);
      note.textContent = fill(ui.missing, { n: missing.length });
      for (const i of missing) questions[i].classList.add("need");
      const first = questions[missing[0]];
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      first.querySelector("input")?.focus({ preventScroll: true });
      return;
    }
    showResult(scoreQuiz(id, answers as number[]), true);
  }

  function reset(): void {
    form.reset();
    answers.fill(null);
    questions.forEach((q) => q.classList.remove("done", "need"));
    form.querySelectorAll(".quiz-opt.on").forEach((opt) => opt.classList.remove("on"));
    note.textContent = "";
    resultBox.hidden = true;
    resultBox.replaceChildren();
    update();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showResult(result: QuizResult, reveal: boolean): void {
    const view = resultView(locale, id, copy, result);
    const copyBtn = h("button", { type: "button", class: "btn ghost" }, ui.copy);
    copyBtn.addEventListener("click", () => {
      const text = `${quizName(locale, id).name}: ${view.summary}\n${location.origin}${quizHref(locale, id)}`;
      void navigator.clipboard?.writeText(text).then(() => {
        copyBtn.textContent = ui.copied;
        window.setTimeout(() => { copyBtn.textContent = ui.copy; }, 1500);
      }, () => {});
    });
    resultBox.replaceChildren(
      h("h2", { id: "result-title" }, ui.result),
      ...view.nodes,
      h("div", { class: "quiz-actions" },
        copyBtn,
        h("button", { type: "button", class: "btn ghost", onClick: reset }, ui.retake),
      ),
    );
    resultBox.hidden = false;
    if (!reveal) return;
    resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
    resultBox.focus({ preventScroll: true });
  }

  const form = h("form", { class: "quiz-form", novalidate: true, onSubmit: submit },
    h("p", { class: "quiz-hint" }, def.type === "likert" ? ui.scaleHint[def.scale] : ui.choiceHint),
    h("ol", { class: "quiz-list" }, ...questions),
    h("div", { class: "quiz-bar" },
      h("span", { class: "quiz-meter", "aria-hidden": "true" }, meter),
      progressText,
      h("button", { type: "submit", class: "btn" }, ui.submit),
    ),
    note,
  );

  const group = quizGroupOf(id);
  const siblings = QUIZ_GROUPS.flatMap((g) => g.quizzes).filter((q) => q !== id)
    // Same group first, then the rest.
    .sort((a, b) => Number(quizGroupOf(b) === group) - Number(quizGroupOf(a) === group));

  host.append(
    crumb(locale, id),
    h("div", { class: "tool-head" },
      h("p", { class: "kicker" }, fill(ui.kicker, { n: total, m: quizMinutes(id) })),
      h("h1", null, copy.h1),
      h("p", { class: "lede" }, copy.lede),
    ),
    h("p", { class: "muted quiz-privacy" }, ui.privacy, group === "wellbeing" ? ` ${ui.notDiagnosis}` : ""),
    form,
    resultBox,
    h("section", { class: "quiz-about" }, h("h2", null, ui.about), ...copy.about.map((p) => h("p", null, p))),
    h("section", { class: "wall" },
      h("h2", null, ui.more),
      testLinks(locale, siblings.slice(0, 6)),
      h("p", { class: "more" }, h("a", { href: quizHref(locale), "data-nav": "tests" }, ui.all)),
    ),
    faq(locale, id),
  );
}

function bar(label: string, value: number, detail?: string): HTMLElement {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return h("div", { class: "quiz-score" },
    h("div", { class: "quiz-score-head" }, h("span", null, label), h("strong", null, detail ?? `${pct}%`)),
    h("div", { class: "quiz-track", role: "img", "aria-label": `${label}: ${detail ?? `${pct}%`}` },
      h("span", { style: { width: `${pct}%` } }),
    ),
  );
}

function headline(result: QuizResultCopy | undefined, code?: string): HTMLElement[] {
  if (!result) return [];
  return [
    h("p", { class: "quiz-type" }, code ? h("span", { class: "quiz-code" }, code) : null, result.name),
    h("p", { class: "quiz-body" }, result.body),
  ];
}

function crisisBox(locale: Locale): HTMLElement {
  const ui = quizUi(locale);
  return h("div", { class: "quiz-crisis", role: "note" },
    h("strong", null, ui.crisisTitle),
    h("p", null, ui.crisisBody),
    h("p", null, ui.crisisLines),
  );
}

/** The result block for one test, plus a one-line summary for "Copy result". */
/** "A, B and C" in the page language; plain commas where Intl.ListFormat is missing (Safari before 14.1). */
function listNames(locale: Locale, names: string[]): string {
  try {
    return new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

function resultView(locale: Locale, id: QuizId, copy: QuizCopy, result: QuizResult): { nodes: HTMLElement[]; summary: string } {
  const ui = quizUi(locale);
  const def = QUIZ_DEFS[id];
  const dims = copy.dims ?? {};
  const results = copy.results ?? {};
  const label = (dim: string): string => dims[dim] ?? dim;

  switch (def.result.kind) {
    case "types": {
      const letters = copy.letters ?? {};
      const main = results[result.key];
      const pairs = result.scores.map((s) => {
        const [a, b] = s.dim;
        const lead = s.pct >= 50 ? a : b;
        const share = s.pct >= 50 ? s.pct : 100 - s.pct;
        return h("div", { class: "quiz-pair" },
          h("div", { class: "quiz-score-head" },
            h("span", { class: lead === a ? "on" : null }, `${a} · ${letters[a] ?? a}`),
            h("strong", null, `${lead} ${share}%`),
            h("span", { class: lead === b ? "on" : null }, `${letters[b] ?? b} · ${b}`),
          ),
          h("div", { class: "quiz-track split", role: "img", "aria-label": `${letters[lead] ?? lead} ${share}%` },
            h("span", { style: { width: `${s.pct}%` } }),
          ),
        );
      });
      return { nodes: [...headline(main), ...pairs], summary: main?.name ?? result.key };
    }
    case "profile": {
      const levels = copy.levels ?? {};
      const nodes = result.scores.map((s) => {
        const level = traitLevel(s.pct);
        return h("div", { class: "quiz-trait" },
          bar(label(s.dim), s.pct, `${s.pct} · ${ui.levels[level]}`),
          h("p", null, levels[s.dim]?.[level] ?? ""),
        );
      });
      const summary = result.scores.map((s) => `${label(s.dim)} ${s.pct}`).join(", ");
      return { nodes, summary };
    }
    case "top": {
      const [first, second] = result.ranked;
      const nodes = [...headline(results[first.dim])];
      const rule = QUIZ_DEFS[id].result;
      // Spread ties: name every result tied with the winner (the hash only picked which one leads).
      const tied = rule.kind === "top" && rule.tie === "spread" ? result.ranked.slice(1).filter((s) => s.raw === first.raw && results[s.dim]) : [];
      if (tied.length) {
        const names = listNames(locale, tied.map((s) => results[s.dim].name));
        nodes.push(h("p", { class: "muted" }, `${ui.tiedWith}: ${names}`));
      } else if (second && first.pct - second.pct <= 10 && results[second.dim]) {
        nodes.push(h("p", { class: "muted" }, `${ui.runnerUp}: ${results[second.dim].name}`));
      }
      if (result.excluded.length) {
        const names = listNames(locale, result.excluded.map((dim) => label(dim)));
        nodes.push(h("p", { class: "muted" }, `${ui.ruledOut}: ${names}`));
      }
      nodes.push(...result.ranked.map((s) => bar(label(s.dim), s.pct)));
      return { nodes, summary: results[first.dim]?.name ?? first.dim };
    }
    case "code": {
      const top3 = result.ranked.slice(0, 3);
      const nodes: HTMLElement[] = [
        h("p", { class: "quiz-type" }, h("span", { class: "quiz-code" }, result.key), copy.codeTitle ?? ""),
        h("h3", null, ui.top3),
        ...top3.map((s) => h("div", { class: "quiz-trait" },
          h("p", { class: "quiz-type small" }, h("span", { class: "quiz-code" }, s.dim), results[s.dim]?.name ?? s.dim),
          h("p", null, results[s.dim]?.body ?? ""),
        )),
        ...result.ranked.map((s) => bar(label(s.dim), s.pct)),
      ];
      return { nodes, summary: `${result.key} (${top3.map((s) => results[s.dim]?.name ?? s.dim).join(", ")})` };
    }
    case "quadrant": {
      const nodes = [...headline(results[result.key]), ...result.scores.map((s) => bar(label(s.dim), s.pct))];
      return { nodes, summary: results[result.key]?.name ?? result.key };
    }
    case "areas": {
      const nodes = [
        ...headline(results[result.key]),
        bar(ui.score, result.overall),
        ...result.scores.map((s) => bar(label(s.dim), s.pct)),
      ];
      if (result.weakest && copy.tips?.[result.weakest]) {
        nodes.push(h("div", { class: "learn-result" }, h("strong", null, `${ui.focus}: ${label(result.weakest)}`), copy.tips[result.weakest]));
      }
      return { nodes, summary: `${results[result.key]?.name ?? result.key} (${result.overall}%)` };
    }
    case "band": {
      const max = maxTotal(id);
      const nodes = [
        ...headline(results[result.key]),
        bar(copy.scoreLabel ?? ui.score, (result.total / max) * 100, `${result.total} / ${max}`),
      ];
      if (quizGroupOf(id) === "wellbeing") nodes.push(h("p", { class: "muted" }, ui.notDiagnosis));
      if (result.safety) nodes.unshift(crisisBox(locale));
      return { nodes, summary: `${results[result.key]?.name ?? result.key}, ${result.total} / ${max}` };
    }
  }
}
