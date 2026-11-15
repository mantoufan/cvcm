/**
 * Business idea validator (/idea-validator/): an eight-question scorecard plus, when the idea matches one of the Ideas
 * channel's 40 ideas, that idea's search-data outlook score as a market benchmark. Runs in the page; no Keyword Planner
 * calls (live planner access for third parties would fall under Google Ads API RMF, and the data is monthly anyway).
 */
import keywords from "../../scripts/ideas/keywords.json";
import { IDEA_ENTRIES, type IdeaId } from "./ideas";

/** The eight questions, in page order. Each answer is worth 0-4 points; `trend` can also come from the matched idea. */
export const VALIDATOR_QUESTIONS = ["evidence", "price", "competition", "cost", "time", "edge", "channel", "trend"] as const;
export type ValidatorQuestion = (typeof VALIDATOR_QUESTIONS)[number];

/** Points per option, in the order the options are listed (copy: ideaValidator.<question>.o1…). */
export const OPTION_POINTS: Record<ValidatorQuestion, readonly number[]> = {
  // Nothing yet / people complain about the problem / others already sell something similar / people asked me for it / people paid me in advance
  evidence: [0, 1, 2, 3, 4],
  // Under $5 once / $5-50 once / $50-500 once / over $500 once / a monthly subscription or repeat orders
  price: [0, 1, 2, 3, 4],
  // Big brands own it / many similar sellers / a few competitors / competitors but weak / nobody does it (often no demand)
  competition: [0, 1, 3, 4, 1],
  // More than my savings / most of my savings / a few months of spare cash / under a month of spare cash / almost nothing
  cost: [0, 1, 2, 3, 4],
  // Over a year / 6-12 months / 1-6 months / 2-4 weeks / within 2 weeks
  time: [0, 1, 2, 3, 4],
  // Nothing yet / I would have to learn it / I have the skill or experience / I have an audience or customers / both
  edge: [0, 1, 2, 3, 4],
  // Not sure / paid ads / a marketplace (Amazon, Etsy, TikTok Shop) / local word of mouth or communities / my own audience or customers
  channel: [0, 1, 2, 3, 4],
  // Shrinking / not sure / steady / growing
  trend: [0, 2, 2, 4],
};

/** How much each question counts in the readiness score (sums to 100). */
export const QUESTION_WEIGHT: Record<ValidatorQuestion, number> = {
  evidence: 20,
  price: 10,
  competition: 10,
  cost: 10,
  time: 10,
  edge: 15,
  channel: 15,
  trend: 10,
};

export type ValidatorAnswers = Partial<Record<ValidatorQuestion, number>>;

export type ValidatorGrade = "strong" | "promising" | "risky" | "rethink";

export type ValidatorResult = {
  /** 0-100 from the answers alone. */
  readiness: number;
  /** The matched idea's outlook score, if any. */
  market: number | null;
  /** Readiness 75% + market 25% when there is a match, else readiness. */
  total: number;
  grade: ValidatorGrade;
  /** Questions answered with 3-4 points, best first. */
  strengths: ValidatorQuestion[];
  /** Questions answered with 0-1 points, weakest (most weight lost) first. */
  weaknesses: ValidatorQuestion[];
};

/** Null until every question has an answer. */
export function validateIdea(answers: ValidatorAnswers, market: number | null): ValidatorResult | null {
  if (VALIDATOR_QUESTIONS.some((q) => answers[q] === undefined)) return null;
  const points = (q: ValidatorQuestion): number => OPTION_POINTS[q][answers[q]!] ?? 0;
  const readiness = Math.round(VALIDATOR_QUESTIONS.reduce((sum, q) => sum + (QUESTION_WEIGHT[q] * points(q)) / 4, 0));
  const total = market === null ? readiness : Math.round(0.75 * readiness + 0.25 * market);
  const grade: ValidatorGrade = total >= 75 ? "strong" : total >= 55 ? "promising" : total >= 35 ? "risky" : "rethink";
  const lost = (q: ValidatorQuestion): number => QUESTION_WEIGHT[q] * (4 - points(q));
  const strengths = VALIDATOR_QUESTIONS.filter((q) => points(q) >= 3).sort((a, b) => QUESTION_WEIGHT[b] * points(b) - QUESTION_WEIGHT[a] * points(a));
  const weaknesses = VALIDATOR_QUESTIONS.filter((q) => points(q) <= 1).sort((a, b) => lost(b) - lost(a));
  return { readiness, market, total, grade, strengths, weaknesses };
}

/** The trend answer (index into the trend options) for an idea's momentum score: growing / steady / shrinking. */
export function trendAnswerFor(momentum: number): number {
  return momentum >= 58 ? 3 : momentum <= 42 ? 0 : 2;
}

/** Lowercased words; CJK runs become overlapping two-character pieces (Chinese and Japanese have no spaces). */
export function ideaTokens(text: string): string[] {
  const out: string[] = [];
  for (const part of text.toLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u)) {
    if (!part) continue;
    const cjk = part.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu) ?? [];
    for (const run of cjk) {
      if (run.length === 1) out.push(run);
      for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2));
    }
    const latin = part.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu, " ").trim();
    for (const word of latin.split(/\s+/)) if (word.length >= 2 && !STOP.has(word)) out.push(word);
  }
  return out;
}

/** Words that say "business" or "how to" in every language and would match every idea. */
const STOP = new Set([
  "business", "businesses", "ideas", "idea", "how", "to", "start", "starting", "a", "an", "the", "my", "of", "for", "and", "online", "side", "hustle", "make", "money", "sell", "selling",
  "negocio", "negocios", "de", "la", "el", "en", "como", "con", "bisnis", "usaha", "jasa", "di", "cara", "kinh", "doanh", "mở", "bán", "và",
]);
const STOP_CJK = new Set(["创业", "創業", "开业", "開業", "副业", "副業", "生意", "加盟", "창업", "사업", "ビジ", "ジネ", "ネス"]);

/** Every idea's search phrases in every language, tokenized once. */
const IDEA_TOKENS: Record<IdeaId, Set<string>> = Object.fromEntries(
  IDEA_ENTRIES.map((id) => {
    const phrases = Object.values((keywords as Record<string, Record<string, string[]>>)[id] ?? {}).flat();
    return [id, new Set(phrases.flatMap(ideaTokens).filter((t) => !STOP_CJK.has(t)))];
  }),
) as Record<IdeaId, Set<string>>;

/**
 * The idea whose search phrases share the most tokens with the text (names in the reader's language count too), or
 * null when nothing shares a meaningful token. `names` maps each idea to its name in the page's language.
 */
export function matchIdea(text: string, names: Partial<Record<IdeaId, string>> = {}): IdeaId | null {
  const tokens = new Set(ideaTokens(text).filter((t) => !STOP_CJK.has(t)));
  if (!tokens.size) return null;
  let best: IdeaId | null = null;
  let bestScore = 0;
  for (const id of IDEA_ENTRIES) {
    const pool = new Set([...IDEA_TOKENS[id], ...ideaTokens(names[id] ?? "").filter((t) => !STOP_CJK.has(t))]);
    let score = 0;
    for (const t of tokens) if (pool.has(t)) score += t.length >= 4 || /[^\x00-\x7f]/.test(t) ? 2 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return bestScore >= 2 ? best : null;
}
