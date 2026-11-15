/**
 * Business idea validator (/idea-validator/): an eight-question scorecard plus, when the idea matches one of the Ideas
 * channel's 40 ideas, that idea's search-data outlook score as a market benchmark. Runs in the page; no Keyword Planner
 * calls (live planner access for third parties would fall under Google Ads API RMF, and the data is monthly anyway).
 */
import keywords from "../../scripts/ideas/keywords.json";
import { IDEA_ENTRIES, type IdeaId } from "./ideas";
import { LOCALES, type Locale } from "./locale";

/** The eight questions, in page order. Each answer is worth 0-4 points (the reader answers all of them). */
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
  // Shrinking / not sure (unresearched, so a weak spot) / steady / growing
  trend: [0, 1, 2, 4],
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
  /** The matched idea's outlook score, if any: shown beside the score as a market benchmark, never mixed into it. */
  market: number | null;
  /** The score: readiness from the answers alone, so the same answers always grade the same. */
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
  // "Nobody does this yet" is weak only while demand is unproven: with people asking or paying, an empty market is
  // an opening, scored like weak competitors.
  const points = (q: ValidatorQuestion): number => q === "competition" && answers.competition === 4 && (answers.evidence ?? 0) >= 3 ? OPTION_POINTS.competition[3] : OPTION_POINTS[q][answers[q]!] ?? 0;
  const readiness = Math.round(VALIDATOR_QUESTIONS.reduce((sum, q) => sum + (QUESTION_WEIGHT[q] * points(q)) / 4, 0));
  const total = readiness;
  const grade: ValidatorGrade = total >= 75 ? "strong" : total >= 55 ? "promising" : total >= 35 ? "risky" : "rethink";
  const lost = (q: ValidatorQuestion): number => QUESTION_WEIGHT[q] * (4 - points(q));
  const strengths = VALIDATOR_QUESTIONS.filter((q) => points(q) >= 3).sort((a, b) => QUESTION_WEIGHT[b] * points(b) - QUESTION_WEIGHT[a] * points(a));
  const weaknesses = VALIDATOR_QUESTIONS.filter((q) => points(q) <= 1).sort((a, b) => lost(b) - lost(a));
  return { readiness, market, total, grade, strengths, weaknesses };
}

// ー (U+30FC; NFKC maps the halfwidth form to it) is Script=Common but belongs inside katakana words (コーヒー).
const CJK_RUN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u30fc]+/gu;

/**
 * Lowercased words with accents removed and English plurals folded; Han and Hangul runs become overlapping
 * two-character pieces (no spaces to split on), katakana words stay whole and hiragana is dropped.
 */
export function ideaTokens(text: string, locale: Locale | null = null): string[] {
  return tokenGroups(text, locale).flat();
}

/**
 * The text's tokens grouped by the word they come from: the pieces of one Hangul word (핸드메이드 → 핸드, 드메, 메이,
 * 이드) form one group, so one word counts once when scoring. Every other token is its own group.
 */
export function tokenGroups(text: string, locale: Locale | null = null): string[][] {
  const keep = locale ? KEEP[locale] : undefined;
  const out: string[][] = [];
  for (const part of text.toLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u)) {
    if (!part) continue;
    // One Latin letter fused to one Han character is a word of its own (t恤 = t-shirt).
    for (const m of part.matchAll(/(?<![a-z])[a-z]\p{Script=Han}/gu)) out.push([m[0]]);
    for (const run of part.match(CJK_RUN) ?? []) {
      // Katakana loanwords are whole words (キッチンカー, ペットシッター): pairs of them would match by chance (ネットショップ
      // and ペットシッター share トシ). Han and Hangul become overlapping pairs; hiragana (particles, endings) is dropped.
      for (const seg of run.match(/[\p{Script=Katakana}\u30fc]+|\p{Script=Han}+|\p{Script=Hangul}+|\p{Script=Hiragana}+/gu) ?? []) {
        // Hiragana is particles and endings; a lone kanji (開 in 開きたい) is too ambiguous to match on.
        if (/^\p{Script=Hiragana}/u.test(seg) || (/^\p{Script=Han}$/u.test(seg))) continue;
        const pieces = (/^[\p{Script=Katakana}\u30fc]/u.test(seg) || seg.length === 1 ? [seg] : Array.from({ length: seg.length - 1 }, (_, i) => seg.slice(i, i + 2))).filter((p) => !STOP_CJK.has(p));
        // The pieces of one Hangul word, or of one Han run (Chinese has no spaces: 开一家宠物店 is one run), count once.
        if (/^\p{Script=Hangul}|^\p{Script=Han}/u.test(seg) && pieces.length > 1) {
          out.push(pieces);
        } else for (const piece of pieces) out.push([piece]);
      }
    }
    const latin = part.replace(CJK_RUN, " ").normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();
    for (let word of latin.split(/\s+/)) {
      if (STOP.has(word) && !keep?.has(word)) continue;
      // English plurals: agencies → agency, washes → wash, cars → car; the plural of a filler word is filler
      // ("services"). Words that only look plural stay (news).
      // Spanish, Indonesian and Vietnamese plurals only drop "s" (peluches → peluche); English also folds -es and -ies,
      // and "-ies" keeps both readings (agencies → agency, cookies → cookie).
      // On es/id/vi pages people also type English business words, so both readings are kept there (washes → washe
      // and wash).
      const romance = locale !== null && ROMANCE.has(locale);
      const english = word.length > 4 && word.endsWith("ies") ? [`${word.slice(0, -3)}y`, word.slice(0, -1)]
        : word.length > 4 && /(sh|ch|x|ss)es$/.test(word) ? [word.slice(0, -2)]
        : word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word) ? [word.slice(0, -1)]
        : [];
      const plain = word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word) ? [word.slice(0, -1)] : [];
      const folds = romance ? [...new Set([...plain, ...english])] : english;
      if (folds.length && !NOT_PLURAL.has(word)) {
        if (folds.some((f) => STOP.has(f))) continue;
        out.push(folds);
        continue;
      }
      if (word.length >= 2) out.push([word]);
    }
  }
  return out;
}

/** Words that say "business", "how to", "online", "I want" and the like in the eight languages (accents removed). */
const STOP = new Set([
  "business", "does", "was", "has", "idea", "how", "to", "start", "starting", "the", "my", "of", "for", "and", "online", "side", "hustle", "make", "money", "sell", "selling", "in", "on", "at", "with", "from", "want", "would", "like", "an", "is", "it", "me", "your", "you", "home", "shop", "store", "service", "company", "small", "open", "opening", "launch", "handmade", "homemade", "mobile", "portable", "custom", "big", "best", "good", "cheap", "run", "own", "new", "local", "near", "about", "some", "this", "that",
  "negocio", "de", "la", "el", "lo", "en", "como", "con", "por", "para", "un", "una", "quiero", "vender", "linea", "casa", "tienda", "servicio", "empresa", "mi", "abrir", "montar", "nuevo", "artesanal", "artesanale", "aromatica", "casero", "casera",
  "bisni", "bisnis", "usaha", "jasa", "di", "cara", "jualan", "jual", "rumah", "saya", "ingin", "mau", "dan", "yang", "toko", "buka", "membuka",
  "kinh", "doanh", "mo", "ban", "va", "cua", "hang", "tren", "mang", "toi", "muon", "nha", "dich", "vu", "cong", "ty", "lam",
]);
const NOT_PLURAL = new Set(["news", "canvas"]);
/** Locales whose plurals are a plain "s" (no English -es / -ies folding). */
const ROMANCE = new Set<Locale>(["es", "id", "vi"]);

/** Filler in one language can be a real word in another: Vietnamese "in" is "print" (in 3D). */
const KEEP: Partial<Record<Locale, Set<string>>> = { vi: new Set(["in"]) };

const STOP_CJK = new Set(["公司", "定制", "订制", "訂製", "客製", "手工", "手作", "自制", "自製", "创业", "創業", "开业", "開業", "副业", "副業", "生意", "加盟", "开店", "開店", "网上", "網上", "网店", "賺錢", "赚钱", "我想", "온라", "라인", "창업", "사업", "부업", "쇼핑", "핑몰", "ビジネス", "ショップ", "オンライン", "起業", "開発"]);

/** Every idea's search phrases in every language, tokenized once. */
const IDEA_POOLS: Record<IdeaId, Set<string>> = Object.fromEntries(
  IDEA_ENTRIES.map((id) => {
    const byLocale = (keywords as Record<string, Record<string, string[]>>)[id] ?? {};
    return [id, new Set(LOCALES.flatMap((loc) => (byLocale[loc] ?? []).flatMap((phrase) => ideaTokens(phrase, loc))))];
  }),
) as Record<IdeaId, Set<string>>;

const NO_NAMES: Partial<Record<IdeaId, string>> = {};

/** Per names table (one per locale): each idea's merged word pool and how many ideas use each word. */
type Pools = { pools: { id: IdeaId; name: Set<string>; words: Set<string> }[]; df: Map<string, number> };
/** Per names table (the page keeps one per mount) and locale. */
const poolCache = new WeakMap<object, Map<string, Pools>>();

function poolsFor(names: Partial<Record<IdeaId, string>>, locale: Locale | null): Pools {
  let byLocale = poolCache.get(names);
  if (!byLocale) {
    byLocale = new Map();
    poolCache.set(names, byLocale);
  }
  let entry = byLocale.get(locale ?? "");
  if (!entry) {
    const pools = IDEA_ENTRIES.map((id) => {
      const name = new Set(ideaTokens(names[id] ?? "", locale));
      return { id, name, words: new Set([...IDEA_POOLS[id], ...name]) };
    });
    const df = new Map<string, number>();
    for (const { words } of pools) for (const w of words) df.set(w, (df.get(w) ?? 0) + 1);
    entry = { pools, df };
    byLocale.set(locale ?? "", entry);
  }
  return entry;
}

/**
 * The idea whose search phrases (and name in the reader's language) best share the text's words, weighted by how few
 * ideas use each word. A match needs two shared words, or one word only that idea uses when it is the whole text or a
 * specific word (8+ Latin letters, or CJK).
 * Equal scores go to the idea whose pool the text covers most (its own name beats a longer name containing it); a
 * remaining tie is no match. `names` maps each idea to its name in the page's language.
 */
export function matchIdea(text: string, names: Partial<Record<IdeaId, string>> = NO_NAMES, locale: Locale | null = null): IdeaId | null {
  const groups = tokenGroups(text, locale);
  if (!groups.length) return null;
  const tokens = new Set(groups.flat());
  const { pools, df } = poolsFor(names, locale);
  const weight = (t: string): number => Math.log(IDEA_ENTRIES.length / (df.get(t) ?? IDEA_ENTRIES.length));
  const scored = pools.map(({ id, name, words }) => {
    // Each word counts once by its best piece not already used by another word: a word typed twice counts once
    // ("coffee mugs and coffee cups"), while two words that share a piece still count as two (社群小編接案（社群代操）).
    const hits: string[] = [];
    for (const g of groups) {
      const best = g.filter((t) => words.has(t) && !hits.includes(t)).sort((a, b) => weight(b) - weight(a))[0];
      if (best) hits.push(best);
    }
    // How much of the idea's own name the text covers: "AI agency" covers all of AI agency, half of AI automation agency.
    const cover = name.size ? [...name].filter((t) => tokens.has(t)).length / name.size : 0;
    // Last resort when no name is covered (English words on a Spanish page): the smaller pool is the narrower idea.
    const focus = hits.length / Math.max(1, words.size);
    return { id, hits, cover, focus, score: hits.reduce((sum, t) => sum + weight(t), 0) };
  }).sort((a, b) => (Math.abs(b.score - a.score) < 1e-9 ? b.cover - a.cover || b.focus - a.focus : b.score - a.score));
  const [best] = scored;
  if (!best || best.score <= 0) return null;
  // Scores are sums of logs: compare with a tolerance, since the same weights added in another order can differ.
  const tied = scored.filter((s) => Math.abs(s.score - best.score) < 1e-9).slice(1);
  for (const other of tied) {
    // Ideas sharing different words with the text equally ("t-shirt printing": shirt vs printing) are ambiguous; the
    // same words go to the idea the text covers most (its own name beats a longer name containing it).
    const same = best.hits.length === other.hits.length && best.hits.every((t) => other.hits.includes(t));
    if (!same || (best.cover === other.cover && best.focus === other.focus)) return null;
  }
  // Two shared words match. One shared word matches when it is the whole text (a name like "Pet services", 洗车): in
  // a longer text a single shared word ("coffee" in "selling coffee mugs") is too often a passing mention.
  if (best.hits.length >= 2) return best.id;
  const only = best.hits[0];
  const short = groups.length === 1;
  const distinct = only.length >= 3 || /[^\x00-\x7f]/.test(only);
  const sharedButCloser = df.get(only) === 2 && tied.length > 0;
  // In a longer text, one word still matches when only this idea uses it and it is not a short Latin word: a long word
  // (laundromat) or a CJK word (奶茶 in 我想开一家奶茶店，在学校附近; カフェ in 東京でカフェを開きたい). Common Latin words
  // ("coffee", "truck") are too often a passing mention. A wrong suggestion only shows a benchmark the reader can change.
  const specific = df.get(only) === 1 && (only.length >= 8 || /[^\x00-\x7f]/.test(only));
  return (short && distinct && (df.get(only) === 1 || sharedButCloser)) || specific ? best.id : null;
}
