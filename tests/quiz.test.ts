import { describe, expect, it } from "vitest";
import en from "../src/locales/quiz/en.json";
import worker from "../src/worker";
import { LOCALES } from "../src/shared/locale";
import { quizMessages } from "../src/shared/messages";
import { parseAppPath, quizHref } from "../src/shared/path";
import {
  QUIZ_DEFS,
  QUIZZES,
  isComplete,
  maxTotal,
  resultKeys,
  scoreQuiz,
  type ChoiceItem,
  type QuizId,
} from "../src/shared/quiz";
import { quizCopy, quizStaticHtml } from "../src/shared/quiz-i18n";
import { applyHtmlSeo, pageCanonical, pageTitle } from "../src/shared/seo";
import { buildSitemapXml } from "../src/shared/sitemap";

const SHELL = `<!doctype html><html lang="en"><head><title>cv.cm</title><meta name="description" content="x" /><link rel="canonical" href="https://cv.cm/" /></head><body><div id="app"></div></body></html>`;

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

/** Answer every item with the same option index. */
function all(id: QuizId, answer: number): number[] {
  return QUIZ_DEFS[id].items.map(() => answer);
}

/** Answer so each likert item scores `points` toward its own dimension when that dimension is in `on`, else 0. */
function lean(id: QuizId, on: string[], top = 4): number[] {
  const def = QUIZ_DEFS[id];
  if (def.type !== "likert") throw new Error("likert only");
  return def.items.map((item) => {
    const want = on.includes(item.dim) ? top : 0;
    return item.rev ? top - want : want;
  });
}

describe("test pages: routes", () => {
  it("parses locale and bare paths", () => {
    expect(parseAppPath("/en/tests/")).toEqual({ kind: "quiz", locale: "en", quiz: null });
    expect(parseAppPath("/zh-cn/tests/mbti/")).toEqual({ kind: "quiz", locale: "zh-CN", quiz: "mbti" });
    expect(parseAppPath("/tests/")).toEqual({ kind: "bare-quiz", quiz: null });
    expect(parseAppPath("/tests/big-five")).toEqual({ kind: "bare-quiz", quiz: "big-five" });
    expect(parseAppPath("/en/tests/nope/")).toEqual({ kind: "unknown" });
    expect(parseAppPath("/en/tests/mbti/x/")).toEqual({ kind: "unknown" });
    expect(quizHref("zh-TW", "face-shape")).toBe("/zh-tw/tests/face-shape/");
    expect(quizHref("ja")).toBe("/ja/tests/");
  });

  it("redirects bare paths to a locale and 404s unknown tests", async () => {
    const assets = { fetch: async () => new Response(SHELL, { headers: { "Content-Type": "text/html; charset=utf-8" } }) };
    const bare = await worker.fetch(new Request("https://cv.cm/tests/mbti/", { headers: { "Accept-Language": "ko" } }), { ASSETS: assets });
    expect(bare.status).toBe(302);
    expect(bare.headers.get("Location")).toBe("https://cv.cm/ko/tests/mbti/");
    const slash = await worker.fetch(new Request("https://cv.cm/en/tests/mbti"), { ASSETS: assets });
    expect(slash.status).toBe(301);
    expect(slash.headers.get("Location")).toBe("https://cv.cm/en/tests/mbti/");
    const unknown = await worker.fetch(new Request("https://cv.cm/en/tests/nope/"), { ASSETS: assets });
    expect(unknown.status).toBe(404);
    const page = await worker.fetch(new Request("https://cv.cm/ja/tests/big-five/"), { ASSETS: assets });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(`<title>${pageTitle("ja", { quiz: true, quizId: "big-five" })}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/ja/tests/big-five/"');
  });

  it("lists every test in every locale in the sitemap", () => {
    const xml = buildSitemapXml("2026-10-13");
    for (const locale of LOCALES) {
      expect(xml).toContain(`<loc>https://cv.cm${quizHref(locale)}</loc>`);
      for (const id of QUIZZES) expect(xml).toContain(`<loc>https://cv.cm${quizHref(locale, id)}</loc>`);
    }
  });

  it("serves crawlable HTML with breadcrumb and FAQ JSON-LD", () => {
    const html = applyHtmlSeo(SHELL, "es", { quiz: true, quizId: "anxiety" });
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/es/tests/anxiety/"');
    expect(html).toContain('hreflang="zh-CN" href="https://cv.cm/zh-cn/tests/anxiety/"');
    expect(html).toContain('id="breadcrumb-jsonld"');
    expect(html).toContain('id="faq-jsonld"');
    expect(html).not.toContain('id="howto-jsonld"');
    expect(html).not.toContain('id="software-jsonld"');
    expect(pageCanonical("en", { quiz: true })).toBe("https://cv.cm/en/tests/");
    // The text fallback carries every question.
    const text = quizStaticHtml("en", "anxiety");
    for (const item of en.tests.anxiety.items) expect(text).toContain(item.replace(/&/g, "&amp;"));
  });
});

describe("test pages: copy", () => {
  it("has the same copy structure in every locale", () => {
    for (const locale of LOCALES) expect(shape(quizMessages(locale)), locale).toEqual(shape(en));
  });

  it("has an item, every option, a label and a result for everything the scoring uses", () => {
    for (const locale of LOCALES) {
      for (const id of QUIZZES) {
        const def = QUIZ_DEFS[id];
        const copy = quizCopy(locale, id);
        const where = `${locale} ${id}`;
        expect(copy.items.length, where).toBe(def.items.length);
        expect(copy.title.endsWith(" — cv.cm"), where).toBe(true);
        expect(copy.faq.length, where).toBeGreaterThanOrEqual(3);
        if (def.type === "choice") {
          def.items.forEach((item, i) => {
            const text = copy.items[i];
            expect(typeof text, where).toBe("object");
            expect((text as { options: string[] }).options.length, `${where} q${i + 1}`).toBe((item as ChoiceItem).options.length);
          });
        } else {
          for (const text of copy.items) expect(typeof text, where).toBe("string");
        }
        const keys = resultKeys(id);
        for (const key of keys) expect(copy.results?.[key]?.name, `${where} result ${key}`).toBeTruthy();
        if (def.result.kind !== "band" && def.result.kind !== "types") {
          for (const dim of def.dims) expect(copy.dims?.[dim], `${where} dim ${dim}`).toBeTruthy();
        }
        if (def.result.kind === "types") {
          for (const letter of def.dims.join("")) expect(copy.letters?.[letter], `${where} ${letter}`).toBeTruthy();
        }
        if (def.result.kind === "profile") {
          for (const dim of def.dims) expect(copy.levels?.[dim]?.high, `${where} level ${dim}`).toBeTruthy();
        }
        if (def.result.kind === "areas") {
          for (const dim of def.dims) expect(copy.tips?.[dim], `${where} tip ${dim}`).toBeTruthy();
        }
      }
    }
  });
});

describe("test pages: scoring", () => {
  it("needs every question answered with a real option", () => {
    expect(isComplete("anxiety", all("anxiety", 0))).toBe(true);
    const missing: (number | null)[] = all("anxiety", 1);
    missing[3] = null;
    expect(isComplete("anxiety", missing)).toBe(false);
    expect(isComplete("anxiety", all("anxiety", 4))).toBe(false);
    expect(isComplete("face-shape", [0, 0, 0, 0, 0, 0])).toBe(true);
    expect(isComplete("face-shape", [3, 0, 0, 0, 0, 0])).toBe(false);
  });

  it("scores the 16 types from each pair", () => {
    expect(scoreQuiz("mbti", lean("mbti", ["EI", "SN", "TF", "JP"])).key).toBe("ESTJ");
    expect(scoreQuiz("mbti", lean("mbti", [])).key).toBe("INFP");
    expect(scoreQuiz("mbti", lean("mbti", ["EI", "TF"])).key).toBe("ENTP");
    const neutral = scoreQuiz("mbti", all("mbti", 2));
    expect(neutral.scores.every((s) => s.pct === 50)).toBe(true);
    expect(resultKeys("mbti")).toHaveLength(16);
  });

  it("scores the Big Five with the IPIP reverse keys", () => {
    const high = scoreQuiz("big-five", lean("big-five", ["O", "C", "E", "A", "N"]));
    expect(high.scores.map((s) => s.pct)).toEqual([100, 100, 100, 100, 100]);
    const low = scoreQuiz("big-five", lean("big-five", []));
    expect(low.scores.map((s) => s.pct)).toEqual([0, 0, 0, 0, 0]);
    // Ten items per trait; neuroticism has two reverse-keyed ("relaxed", "seldom feel blue").
    const def = QUIZ_DEFS["big-five"];
    if (def.type !== "likert") throw new Error();
    for (const dim of def.dims) expect(def.items.filter((i) => i.dim === dim)).toHaveLength(10);
    expect(def.items.filter((i) => i.dim === "N" && i.rev)).toHaveLength(2);
  });

  it("picks the top dimension, the Holland code and the attachment quadrant", () => {
    expect(scoreQuiz("love-language", lean("love-language", ["time"])).key).toBe("time");
    expect(scoreQuiz("enneagram", lean("enneagram", ["5"])).key).toBe("5");
    expect(scoreQuiz("career", lean("career", ["S", "A", "E"])).key).toBe("ASE");
    expect(scoreQuiz("attachment", lean("attachment", [])).key).toBe("secure");
    expect(scoreQuiz("attachment", lean("attachment", ["anx"])).key).toBe("anxious");
    expect(scoreQuiz("attachment", lean("attachment", ["avo"])).key).toBe("avoidant");
    expect(scoreQuiz("attachment", lean("attachment", ["anx", "avo"])).key).toBe("fearful");
  });

  it("scores marriage areas and names the weakest", () => {
    const strong = scoreQuiz("marriage", lean("marriage", ["talk", "conflict", "money", "family", "future"]));
    expect(strong.key).toBe("ready");
    const money = scoreQuiz("marriage", lean("marriage", ["talk", "conflict", "family", "future"]));
    expect(money.weakest).toBe("money");
    expect(money.key).toBe("close");
    expect(scoreQuiz("marriage", lean("marriage", [])).key).toBe("early");
  });

  it("uses the published cut-offs for Rosenberg, GAD-7 and PHQ-9", () => {
    expect(maxTotal("self-esteem")).toBe(30);
    expect(maxTotal("anxiety")).toBe(21);
    expect(maxTotal("depression")).toBe(27);
    // Rosenberg: "strongly agree" to everything gives 15 (five items reversed).
    expect(scoreQuiz("self-esteem", all("self-esteem", 3)).total).toBe(15);
    expect(scoreQuiz("self-esteem", lean("self-esteem", ["se"], 3)).total).toBe(30);
    expect(scoreQuiz("self-esteem", lean("self-esteem", ["se"], 3)).key).toBe("high");
    expect(scoreQuiz("anxiety", [1, 1, 1, 1, 1, 0, 0]).key).toBe("mild");
    expect(scoreQuiz("anxiety", [2, 2, 2, 2, 2, 0, 0]).key).toBe("moderate");
    expect(scoreQuiz("anxiety", all("anxiety", 3)).key).toBe("severe");
    expect(scoreQuiz("depression", all("depression", 0)).key).toBe("minimal");
    expect(scoreQuiz("depression", [3, 3, 3, 3, 3, 0, 0, 0, 0]).key).toBe("modsevere");
    expect(scoreQuiz("depression", all("depression", 3)).key).toBe("severe");
  });

  it("flags PHQ-9 item 9 whatever the total", () => {
    const answers = all("depression", 0);
    expect(scoreQuiz("depression", answers).safety).toBe(false);
    answers[8] = 1;
    const result = scoreQuiz("depression", answers);
    expect(result.key).toBe("minimal");
    expect(result.safety).toBe(true);
  });

  it("scores choice quizzes by weight and lets every result win", () => {
    const def = QUIZ_DEFS["face-shape"];
    expect(scoreQuiz("face-shape", [2, 3, 0, 2, 2, 3]).key).toBe("square");
    expect(scoreQuiz("face-shape", [1, 0, 2, 0, 0, 0]).key).toBe("heart");
    expect(scoreQuiz("face-shape", [0, 3, 0, 2, 2, 3]).key).toBe("oblong");
    for (const id of ["face-shape", "anime"] as const) {
      const quiz = QUIZ_DEFS[id];
      if (quiz.type !== "choice") throw new Error();
      // For each result, the answers that favor it most must make it win.
      for (const dim of quiz.dims) {
        const answers = quiz.items.map((item) => {
          let best = 0;
          item.options.forEach((o, i) => {
            const score = (o[dim] ?? 0) * 10 - Object.keys(o).length;
            const prev = item.options[best];
            if (score > (prev[dim] ?? 0) * 10 - Object.keys(prev).length) best = i;
          });
          return best;
        });
        expect(scoreQuiz(id, answers).key, `${id} ${dim}`).toBe(dim);
      }
    }
    expect(def.dims).toHaveLength(7);
  });
});
