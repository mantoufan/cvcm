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

const CJK_RUN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;

/**
 * Lowercased words with accents removed and an English plural "s" dropped; CJK runs become overlapping two-character
 * pieces (Chinese and Japanese have no spaces), leaving out pieces that are only hiragana (particles and endings).
 */
export function ideaTokens(text: string): string[] {
  const out: string[] = [];
  for (const part of text.toLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u)) {
    if (!part) continue;
    for (const run of part.match(CJK_RUN) ?? []) {
      const pieces = run.length === 1 ? [run] : Array.from({ length: run.length - 1 }, (_, i) => run.slice(i, i + 2));
      for (const piece of pieces) if (!/^\p{Script=Hiragana}+$/u.test(piece) && !STOP_CJK.has(piece)) out.push(piece);
    }
    const latin = part.replace(CJK_RUN, " ").normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();
    for (let word of latin.split(/\s+/)) {
      if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) word = word.slice(0, -1);
      if (word.length >= 2 && !STOP.has(word)) out.push(word);
    }
  }
  return out;
}

/** Words that say "business", "how to", "online", "I want" and the like in the eight languages (accents removed). */
const STOP = new Set([
  "business", "busines", "idea", "how", "to", "start", "starting", "the", "my", "of", "for", "and", "online", "side", "hustle", "make", "money", "sell", "selling", "in", "on", "at", "with", "from", "want", "would", "like", "an", "is", "it", "me", "your", "you", "home", "shop", "store", "service", "company", "small",
  "negocio", "de", "la", "el", "lo", "lo", "en", "como", "con", "por", "para", "un", "una", "quiero", "vender", "linea", "casa", "tienda", "servicio", "empresa", "mi",
  "bisni", "bisnis", "usaha", "jasa", "di", "cara", "jualan", "jual", "rumah", "saya", "ingin", "mau", "dan", "yang", "toko",
  "kinh", "doanh", "mo", "ban", "va", "cua", "hang", "tren", "mang", "toi", "muon", "nha", "dich", "vu", "cong", "ty", "lam",
]);
const STOP_CJK = new Set(["创业", "創業", "开业", "開業", "副业", "副業", "生意", "加盟", "开店", "開店", "网上", "網上", "网店", "賺錢", "赚钱", "我想", "온라", "라인", "창업", "사업", "부업", "쇼핑", "핑몰", "ビジ", "ジネ", "ネス", "起業", "開発"]);

/** Every idea's search phrases in every language, tokenized once. */
const IDEA_POOLS: Record<IdeaId, Set<string>> = Object.fromEntries(
  IDEA_ENTRIES.map((id) => [id, new Set(Object.values((keywords as Record<string, Record<string, string[]>>)[id] ?? {}).flat().flatMap(ideaTokens))]),
) as Record<IdeaId, Set<string>>;

/** Name tokens per locale's names table, built once per table. */
const namePools = new WeakMap<object, Record<string, Set<string>>>();

/**
 * The idea whose search phrases (and name in the reader's language) best share the text's words, weighted by how few
 * ideas use each word. A match needs two shared words, or one long word only that idea uses, and a clear winner:
 * otherwise null (the reader can still pick one). `names` maps each idea to its name in the page's language.
 */
export function matchIdea(text: string, names: Partial<Record<IdeaId, string>> = {}): IdeaId | null {
  const tokens = [...new Set(ideaTokens(text))];
  if (!tokens.length) return null;
  let byName = namePools.get(names);
  if (!byName) {
    byName = Object.fromEntries(IDEA_ENTRIES.map((id) => [id, new Set(ideaTokens(names[id] ?? ""))]));
    namePools.set(names, byName);
  }
  const pool = (id: IdeaId): Set<string> => new Set([...IDEA_POOLS[id], ...byName![id]]);
  const pools = IDEA_ENTRIES.map((id) => ({ id, words: pool(id) }));
  const df = (t: string): number => pools.filter((p) => p.words.has(t)).length;
  const scored = pools.map(({ id, words }) => {
    const hits = tokens.filter((t) => words.has(t));
    return { id, hits, score: hits.reduce((sum, t) => sum + Math.log(IDEA_ENTRIES.length / df(t)), 0) };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score <= 0 || best.score === second?.score) return null;
  const strong = best.hits.length >= 2 || (best.hits.length === 1 && df(best.hits[0]) === 1 && (best.hits[0].length >= 4 || /[^\x00-\x7f]/.test(best.hits[0])));
  return strong ? best.id : null;
}
