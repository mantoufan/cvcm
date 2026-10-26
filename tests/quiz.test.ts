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
import { isTrackedPath } from "../src/shared/analytics";

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

/** Seeded random integers below `n` (mulberry32), so random-answer checks are repeatable. */
function randomInts(seed: number): (n: number) => number {
  let state = seed >>> 0;
  return (n) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

const GAME_ANIME = ["pokemon", "genshin", "sonic", "dnd-class", "naruto", "demon-slayer", "jujutsu-kaisen", "avatar-element"] as const;

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
    const xml = buildSitemapXml();
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
    // Ties go to I, N, F, P, as in MBTI scoring.
    expect(neutral.key).toBe("INFP");
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

  it("keeps mental health self-checks out of analytics", () => {
    expect(isTrackedPath("/en/tests/depression/")).toBe(false);
    expect(isTrackedPath("/zh-cn/tests/anxiety/")).toBe(false);
    expect(isTrackedPath("/tests/self-esteem/")).toBe(false);
    expect(isTrackedPath("/en/tests/mbti/")).toBe(true);
    expect(isTrackedPath("/en/tests/")).toBe(true);
  });

  it("flags PHQ-9 item 9 whatever the total, and the severe band", () => {
    expect(scoreQuiz("depression", all("depression", 3)).safety).toBe(true);
    expect(scoreQuiz("anxiety", all("anxiety", 3)).safety).toBe(false);
    const answers = all("depression", 0);
    expect(scoreQuiz("depression", answers).safety).toBe(false);
    answers[8] = 1;
    const result = scoreQuiz("depression", answers);
    expect(result.key).toBe("minimal");
    expect(result.safety).toBe(true);
  });

  it("bands the IPIP extraversion score into introvert, ambivert and extrovert", () => {
    const def = QUIZ_DEFS.introvert;
    if (def.type !== "likert") throw new Error();
    expect(def.items).toHaveLength(20);
    expect(def.items.filter((i) => i.rev)).toHaveLength(10);
    expect(maxTotal("introvert")).toBe(80);
    expect(scoreQuiz("introvert", lean("introvert", [])).key).toBe("introvert");
    expect(scoreQuiz("introvert", lean("introvert", ["ext"])).total).toBe(80);
    expect(scoreQuiz("introvert", lean("introvert", ["ext"])).key).toBe("extrovert");
    // Neutral to everything is the middle of the scale.
    expect(scoreQuiz("introvert", all("introvert", 2))).toMatchObject({ total: 40, key: "ambivert" });
    // "Strongly agree" to everything cancels out: the reverse-keyed half scores 0.
    expect(scoreQuiz("introvert", all("introvert", 4))).toMatchObject({ total: 40, key: "ambivert" });
    // Cut-offs at 40% and 60% of the range: 31 / 32 and 48 / 49.
    const at = (total: number): string => {
      const answers: number[] = def.items.map((item) => (item.rev ? 4 : 0));
      let left = total;
      def.items.forEach((item, i) => {
        const points = Math.min(4, left);
        left -= points;
        answers[i] = item.rev ? 4 - points : points;
      });
      const result = scoreQuiz("introvert", answers);
      expect(result.total).toBe(total);
      return result.key;
    };
    expect([at(31), at(32), at(48), at(49)]).toEqual(["introvert", "ambivert", "ambivert", "extrovert"]);
  });

  it("lets every conflict style win and scores work style as a profile", () => {
    const conflict = QUIZ_DEFS["conflict-style"];
    if (conflict.type !== "likert") throw new Error();
    for (const dim of conflict.dims) {
      expect(conflict.items.filter((i) => i.dim === dim), dim).toHaveLength(4);
      expect(scoreQuiz("conflict-style", lean("conflict-style", [dim])).key).toBe(dim);
    }
    const work = QUIZ_DEFS["work-style"];
    if (work.type !== "likert") throw new Error();
    for (const dim of work.dims) {
      expect(work.items.filter((i) => i.dim === dim), dim).toHaveLength(5);
      expect(work.items.filter((i) => i.dim === dim && i.rev), dim).toHaveLength(2);
    }
    const result = scoreQuiz("work-style", lean("work-style", ["remote", "team"]));
    expect(result.key).toBe("profile");
    expect(result.scores.map((s) => s.pct)).toEqual([100, 100, 0, 0]);
    expect(scoreQuiz("work-style", all("work-style", 2)).scores.every((s) => s.pct === 50)).toBe(true);
  });

  it("scores chronotype on one early-to-late axis", () => {
    expect(maxTotal("chronotype")).toBe(42);
    expect(scoreQuiz("chronotype", all("chronotype", 0))).toMatchObject({ total: 0, key: "lark" });
    expect(scoreQuiz("chronotype", all("chronotype", 3))).toMatchObject({ total: 42, key: "owl" });
    // "Somewhat early" everywhere is still a lark, "somewhat late" an owl; a mix of the two is in between.
    expect(scoreQuiz("chronotype", all("chronotype", 1)).key).toBe("lark");
    expect(scoreQuiz("chronotype", all("chronotype", 2)).key).toBe("owl");
    expect(scoreQuiz("chronotype", QUIZ_DEFS.chronotype.items.map((_, i) => 1 + (i % 2))).key).toBe("between");
    // Clear larks and owls: the earliest answer on the first four questions, the next one after that.
    const lark = all("chronotype", 1).map((a, i) => (i < 4 ? 0 : a));
    expect(scoreQuiz("chronotype", lark).key).toBe("lark");
    const owl = all("chronotype", 2).map((a, i) => (i < 4 ? 3 : a));
    expect(scoreQuiz("chronotype", owl).key).toBe("owl");
    // Mostly late answers with a couple of middle ones still read as an owl.
    const owlish = all("chronotype", 3);
    owlish[0] = 2;
    owlish[5] = 2;
    expect(scoreQuiz("chronotype", owlish).key).toBe("owl");
    // Cut-offs at 40% and 60% of 0-42.
    const at = (total: number): string => {
      let left = total;
      return scoreQuiz("chronotype", QUIZ_DEFS.chronotype.items.map(() => {
        const points = Math.min(3, left);
        left -= points;
        return points;
      })).key;
    };
    expect([at(16), at(17), at(25), at(26)]).toEqual(["lark", "between", "between", "owl"]);
  });

  it("treats a pet allergy and lease rules as hard limits", () => {
    const def = QUIZ_DEFS.pet;
    if (def.type !== "choice") throw new Error();
    const ALLERGY = 4;
    const LEASE = 11;
    // Every other answer pushes toward a dog.
    const doggy = [3, 3, 2, 2, 1, 2, 2, 2, 2, 0, 2, 1, 0, 3];
    expect(scoreQuiz("pet", doggy).key).not.toBe("dog");
    expect(scoreQuiz("pet", doggy.map((a, i) => (i === ALLERGY ? 0 : i === LEASE ? 2 : a))).key).toBe("dog");
    const allergyOk = new Set(["fish", "reptile"]);
    const noCatOrDog = (key: string): boolean => key !== "cat" && key !== "dog";
    // Caged pets, birds and rabbits included, stay possible under a "small caged or tank animals" lease.
    const caged = new Set<string>();
    // Many random answer sets: the limits hold whatever else is picked.
    const next = randomInts(7);
    for (let run = 0; run < 3000; run++) {
      const answers = def.items.map((item) => next(item.options.length));
      const result = scoreQuiz("pet", answers);
      if (answers[ALLERGY] === 1) {
        expect(allergyOk.has(result.key), `${answers}`).toBe(true);
        expect(result.excluded).toEqual(expect.arrayContaining(["cat", "dog", "rabbit", "bird", "hamster"]));
      }
      if (answers[LEASE] === 0) expect(noCatOrDog(result.key), `${answers}`).toBe(true);
      if (answers[LEASE] === 0) caged.add(result.key);
      if (answers[LEASE] === 1) expect(result.key, `${answers}`).not.toBe("dog");
      // Ruled-out results are left out of the ranking.
      expect(result.ranked.some((s) => result.excluded.includes(s.dim))).toBe(false);
      expect(result.ranked.length + result.excluded.length).toBe(def.dims.length);
    }
    expect([...caged]).toEqual(expect.arrayContaining(["bird", "rabbit", "hamster", "fish", "reptile"]));
  });

  it("rules out hamsters and rabbits with young children", () => {
    // The answers that suit a hamster best, but with young children at home.
    const hamsterish = [1, 0, 0, 1, 0, 0, 3, 1, 0, 3, 2, 0, 1, 0];
    const result = scoreQuiz("pet", hamsterish);
    expect(result.excluded).toEqual(expect.arrayContaining(["rabbit", "hamster"]));
    expect(["rabbit", "hamster"]).not.toContain(result.key);
    expect(scoreQuiz("pet", hamsterish.map((a, i) => (i === 10 ? 0 : a))).key).toBe("hamster");
  });

  it("keeps birds and rabbits possible under a caged-animals-only lease", () => {
    expect(scoreQuiz("pet", [2, 2, 2, 2, 0, 2, 2, 2, 3, 3, 1, 0, 0, 1]).key).toBe("bird");
    expect(scoreQuiz("pet", [2, 2, 2, 1, 0, 1, 3, 0, 1, 1, 1, 0, 1, 1]).key).toBe("rabbit");
  });

  it("does not read a flat conflict profile as competing", () => {
    expect(scoreQuiz("conflict-style", all("conflict-style", 2)).key).toBe("compromise");
    expect(scoreQuiz("conflict-style", all("conflict-style", 4)).key).toBe("compromise");
    expect(scoreQuiz("conflict-style", all("conflict-style", 0)).key).toBe("compromise");
  });

  it("scores choice quizzes by weight and lets every result win", () => {
    const def = QUIZ_DEFS["face-shape"];
    expect(scoreQuiz("face-shape", [2, 3, 0, 2, 2, 3]).key).toBe("square");
    expect(scoreQuiz("face-shape", [1, 0, 2, 0, 0, 0]).key).toBe("heart");
    expect(scoreQuiz("face-shape", [0, 3, 0, 2, 2, 3]).key).toBe("oblong");
    for (const id of ["face-shape", "anime", "pet", ...GAME_ANIME] as const) {
      const quiz = QUIZ_DEFS[id];
      if (quiz.type !== "choice") throw new Error();
      // For each result, the answers that favor it most must make it win.
      for (const dim of quiz.dims) {
        const answers = quiz.items.map((item) => {
          // Never an option that rules the result out.
          const value = (i: number): number =>
            (item.exclude?.[i]?.includes(dim) ? -1000 : 0) + (item.options[i][dim] ?? 0) * 10 - Object.keys(item.options[i]).length;
          let best = 0;
          item.options.forEach((_, i) => {
            if (value(i) > value(best)) best = i;
          });
          return best;
        });
        expect(scoreQuiz(id, answers).key, `${id} ${dim}`).toBe(dim);
      }
    }
    expect(def.dims).toHaveLength(7);
  });

  it("gives every game and anime result the same best score and spreads ties evenly", () => {
    // The tie hash reads which questions scored each result, so it only makes sense on choice quizzes.
    for (const id of QUIZZES) {
      const def = QUIZ_DEFS[id];
      if (def.result.kind === "top" && def.result.tie === "spread") expect(def.type, id).toBe("choice");
    }
    for (const id of GAME_ANIME) {
      const def = QUIZ_DEFS[id];
      if (def.type !== "choice") throw new Error();
      // Highest possible score per result: equal, so no result is easier to reach.
      const best = def.dims.map((dim) => def.items.reduce((sum, item) => sum + Math.max(0, ...item.options.map((o) => o[dim] ?? 0)), 0));
      expect(new Set(best).size, id).toBe(1);
    }
    // Avatar offers all four elements in every question; each element sits in each position three times.
    const avatar = QUIZ_DEFS["avatar-element"];
    if (avatar.type !== "choice") throw new Error();
    for (const dim of avatar.dims) {
      for (let position = 0; position < 4; position++) {
        expect(avatar.items.filter((item) => (item.options[position][dim] ?? 0) > 0), `${dim} ${position}`).toHaveLength(3);
      }
    }
    // A water/earth tie is settled by the answers, not by list order: across different tied answer sets both
    // elements win, and the same answers always give the same result.
    const pick = (dims: string[]): number[] => avatar.items.map((item, i) => item.options.findIndex((o) => (o[dims[i]] ?? 0) > 0));
    const winners = new Set<string>();
    for (let shift = 0; shift < 12; shift++) {
      const answers = pick(avatar.items.map((_, i) => ((i + shift) % 12 < 6 ? "water" : "earth")));
      const result = scoreQuiz("avatar-element", answers);
      expect(result.ranked[0].pct).toBe(result.ranked[1].pct);
      expect(scoreQuiz("avatar-element", answers).key).toBe(result.key);
      winners.add(result.key);
    }
    expect([...winners].sort()).toEqual(["earth", "water"]);
    // Changing an answer between the two trailing elements leaves the water/earth tie, and its winner, alone.
    const before = pick(["water", "water", "water", "water", "water", "earth", "earth", "earth", "earth", "earth", "fire", "air"]);
    const after = pick(["water", "water", "water", "water", "water", "earth", "earth", "earth", "earth", "earth", "air", "air"]);
    expect(scoreQuiz("avatar-element", before).key).toBe(scoreQuiz("avatar-element", after).key);
    // Every way to split the 12 questions 6/6 between two elements ties them; each pair should split about evenly.
    const halves: number[][] = [];
    const choose = (start: number, picked: number[]): void => {
      if (picked.length === 6) halves.push(picked);
      else for (let i = start; i < 12; i++) choose(i + 1, [...picked, i]);
    };
    choose(0, []);
    for (const [a, b] of [["water", "earth"], ["water", "fire"], ["water", "air"], ["earth", "fire"], ["earth", "air"], ["fire", "air"]]) {
      const aWins = halves.filter((half) => scoreQuiz("avatar-element", pick(avatar.items.map((_, i) => (half.includes(i) ? a : b)))).key === a).length;
      expect(aWins / halves.length, `${a}/${b}`).toBeGreaterThan(0.44);
      expect(aWins / halves.length, `${a}/${b}`).toBeLessThan(0.56);
    }
  });

  // 160k scorings: about a second locally, more than the default 5 s on a slow CI runner.
  it("lets no game or anime result dominate random answers", () => {
    const next = randomInts(42);
    for (const id of GAME_ANIME) {
      const def = QUIZ_DEFS[id];
      if (def.type !== "choice") throw new Error();
      const counts = new Map<string, number>();
      // Ties at the top: how often each result was in one, weighted by 1 / tie size, and how often it won.
      const tiedIn = new Map<string, number>();
      const tiedWon = new Map<string, number>();
      const runs = 20000;
      for (let n = 0; n < runs; n++) {
        const result = scoreQuiz(id, def.items.map((item) => next(item.options.length)));
        counts.set(result.key, (counts.get(result.key) ?? 0) + 1);
        const tied = result.ranked.filter((s) => s.pct === result.ranked[0].pct);
        if (tied.length < 2) continue;
        for (const s of tied) tiedIn.set(s.dim, (tiedIn.get(s.dim) ?? 0) + 1 / tied.length);
        tiedWon.set(result.key, (tiedWon.get(result.key) ?? 0) + 1);
      }
      for (const dim of def.dims) {
        // A fair tie-break wins about as many ties as a coin (or die) would.
        const fair = (tiedWon.get(dim) ?? 0) / (tiedIn.get(dim) ?? 1);
        expect(fair, `${id} ${dim} ties`).toBeGreaterThan(0.85);
        expect(fair, `${id} ${dim} ties`).toBeLessThan(1.15);
        const share = ((counts.get(dim) ?? 0) * def.dims.length) / runs;
        expect(share, `${id} ${dim}`).toBeGreaterThan(0.8);
        expect(share, `${id} ${dim}`).toBeLessThan(1.2);
      }
    }
  }, 30_000);
});
