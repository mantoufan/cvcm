// Personality and self-check tests (`/{locale}/tests/{id}/`). Everything here is language-neutral:
// which trait each item scores, reverse keys, option weights and result rules. The copy lives in
// `src/locales/quiz/<locale>.json`, with items in the same order. Scoring runs in the page; answers never leave it.

export const QUIZ_GROUPS = [
  { id: "personality", quizzes: ["mbti", "big-five", "introvert", "enneagram"] },
  { id: "love", quizzes: ["love-language", "attachment", "marriage", "conflict-style"] },
  { id: "career", quizzes: ["career", "work-style", "money"] },
  { id: "fun", quizzes: ["chronotype", "pet", "anime", "face-shape"] },
  { id: "wellbeing", quizzes: ["self-esteem", "anxiety", "depression"] },
] as const;

export type QuizGroupId = (typeof QUIZ_GROUPS)[number]["id"];

export const QUIZZES = QUIZ_GROUPS.flatMap((group) => [...group.quizzes]);
export type QuizId = (typeof QUIZ_GROUPS)[number]["quizzes"][number];

export function isQuizId(value: string): value is QuizId {
  return (QUIZZES as readonly string[]).includes(value);
}

export function quizGroupOf(id: QuizId): QuizGroupId {
  return QUIZ_GROUPS.find((group) => (group.quizzes as readonly string[]).includes(id))!.id;
}

/**
 * Answer scales, left to right. `agree5` and `agree4` run from "strongly disagree" (0) to "strongly agree";
 * `freq4` is the PHQ/GAD "not at all" (0) to "nearly every day" (3).
 */
export type Scale = "agree5" | "agree4" | "freq4";
export const SCALE_POINTS: Record<Scale, number> = { agree5: 5, agree4: 4, freq4: 4 };

/** A statement scored on the scale: it adds to `dim`, reversed when `rev`. */
export type LikertItem = { dim: string; rev?: boolean };
/**
 * A multiple-choice question: each option adds its weights to the named dimensions. `exclude[i]` lists results that
 * option i rules out whatever the scores (a fur allergy rules out furry pets); see `scoreQuiz`.
 */
export type ChoiceItem = { options: Record<string, number>[]; exclude?: readonly (readonly string[] | undefined)[] };

/**
 * profile  — every dimension as a percentage with a low / mid / high reading (Big Five).
 * types    — four opposite pairs; dims are pairs like "EI", agree scores the first letter (16 types).
 * top      — the highest dimension wins; all dimensions shown ranked. A tie goes to the earlier dimension.
 * code     — like top, but the result is the first three letters (Holland RIASEC).
 * quadrant — two dimensions, each high or low, give one of four results (attachment).
 * areas    — overall percentage picks a band (a band's `floor` also needs the weakest area that high);
 *            the lowest area gets a tip (marriage readiness).
 * band     — the raw total picks a band (Rosenberg, GAD-7, PHQ-9; extraversion; chronotype, where choice options
 *            add their weights to the total).
 */
export type ResultRule =
  | { kind: "profile" }
  | { kind: "types" }
  | { kind: "top" }
  | { kind: "code" }
  | { kind: "quadrant"; x: string; y: string; results: { lowLow: string; highLow: string; lowHigh: string; highHigh: string } }
  | { kind: "areas"; bands: readonly { min: number; key: string; floor?: number }[] }
  | { kind: "band"; bands: readonly { max: number; key: string }[] };

export type QuizDef =
  | { id: QuizId; type: "likert"; scale: Scale; dims: readonly string[]; items: readonly LikertItem[]; result: ResultRule }
  | { id: QuizId; type: "choice"; dims: readonly string[]; items: readonly ChoiceItem[]; result: ResultRule };

function likert(spec: string): LikertItem[] {
  // "E+ A- C+" → items in order; "-" marks a reverse-keyed statement.
  return spec.trim().split(/\s+/).map((token) => {
    const rev = token.endsWith("-");
    return { dim: token.slice(0, -1), ...(rev ? { rev: true } : {}) };
  });
}

/** IPIP 50-item Big-Five Factor Markers (Goldberg, public domain), in the published order. N is scored as neuroticism. */
const BIG_FIVE = likert(`
  E+ A- C+ N+ O+  E- A+ C- N- O-  E+ A- C+ N+ O+  E- A+ C- N- O-  E+ A- C+ N+ O+
  E- A+ C- N+ O-  E+ A- C+ N+ O+  E- A+ C- N+ O+  E+ A+ C+ N+ O+  E- A+ C+ N+ O+
`);

const TYPES = likert(`
  EI+ SN+ TF+ JP+  EI+ SN+ TF+ JP+  EI+ SN+ TF+ JP+  EI+ SN+ TF+ JP+
  EI- SN- TF- JP-  EI- SN- TF- JP-  EI- SN- TF- JP-  EI- SN- TF- JP-
`);

const ENNEAGRAM = likert(`
  1+ 2+ 3+ 4+ 5+ 6+ 7+ 8+ 9+  1+ 2+ 3+ 4+ 5+ 6+ 7+ 8+ 9+
  1+ 2+ 3+ 4+ 5+ 6+ 7+ 8+ 9+  1+ 2+ 3+ 4+ 5+ 6+ 7+ 8+ 9+
`);

const RIASEC = likert(`
  R+ I+ A+ S+ E+ C+  R+ I+ A+ S+ E+ C+  R+ I+ A+ S+ E+ C+
  R+ I+ A+ S+ E+ C+  R+ I+ A+ S+ E+ C+  R+ I+ A+ S+ E+ C+
`);

const LOVE = likert(`
  words+ time+ gifts+ service+ touch+  words+ time+ gifts+ service+ touch+  words+ time+ gifts+ service+ touch+
  words+ time+ gifts+ service+ touch+  words+ time+ gifts+ service+ touch+
`);

const ATTACHMENT = likert(`
  anx+ avo+ anx+ avo+ anx+ avo- anx+ avo+  anx+ avo- anx- avo+ anx+ avo+ anx+ avo-
`);

const MARRIAGE = likert(`
  talk+ conflict+ money+ family+ future+  talk+ conflict- money+ family+ future+
  talk- conflict+ money+ family- future+  talk+ conflict+ money- family+ future+
`);

const MONEY = likert(`
  saver+ spender+ investor+ avoider+ giver+  saver+ spender+ investor+ avoider+ giver+
  saver+ spender+ investor+ avoider+ giver+  saver+ spender+ investor+ avoider+ giver+
`);

/**
 * Extraversion scale of the IPIP 100-item Big-Five Factor Markers (Goldberg, public domain): ten positively and ten
 * negatively keyed items, alternated. Total 0–80; the bands split the scale range at 40% and 60%, like `traitLevel`.
 */
const EXTRAVERSION = likert(`
  ext+ ext- ext+ ext- ext+ ext- ext+ ext- ext+ ext-
  ext+ ext- ext+ ext- ext+ ext- ext+ ext- ext+ ext-
`);

/** Five conflict-handling styles, four original statements each. */
const CONFLICT = likert(`
  compete+ collab+ compromise+ avoid+ accommodate+  compete+ collab+ compromise+ avoid+ accommodate+
  compete+ collab+ compromise+ avoid+ accommodate+  compete+ collab+ compromise+ avoid+ accommodate+
`);

/** Work preferences: place (home over office), people, structure and variety; five statements each, two reversed. */
const WORK = likert(`
  remote+ team+ structure+ variety+  remote- team- structure- variety-  remote+ team+ structure+ variety+
  remote- team- structure- variety-  remote+ team+ structure+ variety+
`);

/** Rosenberg Self-Esteem Scale: items 2, 5, 6, 8 and 9 are reverse-scored. Total 0–30. */
const ROSENBERG = likert("se+ se- se+ se+ se- se- se+ se- se- se+");

const GAD7 = likert("gad+ gad+ gad+ gad+ gad+ gad+ gad+");
const PHQ9 = likert("phq+ phq+ phq+ phq+ phq+ phq+ phq+ phq+ phq+");

const ANIME: ChoiceItem[] = [
  { options: [{ tsundere: 2 }, { kuudere: 2, dandere: 1 }, { deredere: 2, genki: 1 }, { himedere: 2 }] },
  { options: [{ senpai: 2, himedere: 1 }, { dandere: 2 }, { genki: 2 }, { chuuni: 2 }] },
  { options: [{ kuudere: 2, dandere: 1 }, { genki: 2, deredere: 1 }, { senpai: 2, deredere: 1 }, { chuuni: 2 }] },
  { options: [{ tsundere: 2 }, { himedere: 2, kuudere: 1 }, { dandere: 2 }, { deredere: 2 }] },
  { options: [{ senpai: 2, kuudere: 1 }, { genki: 2 }, { tsundere: 2 }, { dandere: 2 }] },
  { options: [{ kuudere: 2 }, { chuuni: 2 }, { deredere: 2, senpai: 1 }, { himedere: 2 }] },
  { options: [{ genki: 2, deredere: 1 }, { kuudere: 2 }, { dandere: 2 }, { tsundere: 2 }] },
  { options: [{ senpai: 2, kuudere: 1 }, { chuuni: 2 }, { deredere: 2, genki: 1 }, { himedere: 2, tsundere: 1 }] },
  { options: [{ himedere: 2 }, { chuuni: 2 }, { dandere: 2 }, { genki: 2 }] },
  { options: [{ tsundere: 2, kuudere: 1 }, { deredere: 2 }, { senpai: 2 }, { himedere: 2 }] },
  { options: [{ kuudere: 2 }, { genki: 2 }, { dandere: 2 }, { senpai: 2 }] },
  { options: [{ tsundere: 2 }, { himedere: 2 }, { genki: 2 }, { chuuni: 2 }] },
];

const FACE: ChoiceItem[] = [
  // Face length compared with width across the cheekbones.
  { options: [{ oblong: 3, oval: 1, diamond: 1 }, { oval: 2, heart: 1, diamond: 1, triangle: 1 }, { round: 2, square: 2 }] },
  // Widest part of the face.
  { options: [{ heart: 3 }, { diamond: 2, oval: 1, round: 1 }, { triangle: 3 }, { square: 2, oblong: 2, round: 1 }] },
  // Jawline.
  { options: [{ square: 3, oblong: 1, triangle: 1 }, { round: 3, oval: 1 }, { heart: 2, diamond: 2 }, { oval: 3 }] },
  // Forehead compared with jaw.
  { options: [{ heart: 3 }, { triangle: 3 }, { square: 1, round: 1, oblong: 1, oval: 1 }, { diamond: 3 }] },
  // Chin.
  { options: [{ heart: 2, diamond: 2 }, { round: 2, oval: 2 }, { square: 2, triangle: 2, oblong: 1 }] },
  // Cheekbones.
  { options: [{ diamond: 3, heart: 1 }, { round: 3 }, { oval: 2 }, { square: 1, oblong: 2 }] },
];

/**
 * One morning–evening axis: every answer runs from earliest (0) to latest (3), 14 questions, total 0–42. Banded at
 * 40% and 60% of the range, like the extraversion test.
 */
const EARLY_TO_LATE: ChoiceItem = { options: [{ eve: 0 }, { eve: 1 }, { eve: 2 }, { eve: 3 }] };
const CHRONOTYPE: ChoiceItem[] = Array.from({ length: 14 }, () => EARLY_TO_LATE);

const PET: ChoiceItem[] = [
  // Daily time for care and company.
  { options: [{ fish: 2, reptile: 1 }, { cat: 2, hamster: 2, reptile: 1 }, { rabbit: 2, cat: 1, bird: 1 }, { dog: 2, bird: 2 }] },
  // Living space.
  { options: [{ fish: 2, hamster: 2, reptile: 1 }, { cat: 2, reptile: 1, bird: 1 }, { rabbit: 2, cat: 1, bird: 1 }, { dog: 2 }] },
  // Hours away from home.
  { options: [{ fish: 2, reptile: 2 }, { cat: 2, hamster: 1, fish: 1 }, { dog: 2, bird: 2, rabbit: 1 }] },
  // Travel.
  { options: [{ reptile: 2, fish: 1 }, { cat: 2, hamster: 1, rabbit: 1 }, { dog: 2, bird: 2, rabbit: 1 }] },
  // Allergies: a fur or dander allergy leaves only fish and reptiles (feather dust is a common allergen too).
  {
    options: [{ dog: 1, cat: 1, rabbit: 1, bird: 1, hamster: 1 }, { fish: 2, reptile: 2 }, { fish: 1, reptile: 1 }],
    exclude: [undefined, ["cat", "dog", "rabbit", "bird", "hamster"]],
  },
  // Monthly budget.
  { options: [{ fish: 2, hamster: 2 }, { cat: 2, rabbit: 1, bird: 1, reptile: 1 }, { dog: 2, rabbit: 1, bird: 1, reptile: 1 }] },
  // How you want to interact.
  { options: [{ fish: 2, reptile: 1 }, { cat: 2 }, { dog: 2, bird: 2 }, { hamster: 2, rabbit: 1, reptile: 1 }] },
  // Noise.
  { options: [{ fish: 2, reptile: 2, rabbit: 1 }, { cat: 2, hamster: 1 }, { dog: 2, bird: 2 }] },
  // Years of commitment.
  { options: [{ hamster: 2, fish: 1 }, { rabbit: 2, dog: 1, fish: 1 }, { cat: 2, dog: 1, bird: 1, reptile: 1 }, { bird: 2, reptile: 2 }] },
  // Least bad chore.
  { options: [{ dog: 2 }, { cat: 2, rabbit: 1 }, { fish: 2 }, { hamster: 2, rabbit: 1, bird: 1 }, { reptile: 2 }] },
  // Who lives with you.
  { options: [{ cat: 1, reptile: 1, fish: 1, hamster: 1 }, { rabbit: 1, bird: 1, dog: 1, cat: 1 }, { dog: 2, fish: 2, cat: 1 }] },
  // Rental or building rules: "small caged or tank animals only" and "no dogs" are hard limits.
  {
    options: [{ fish: 2, hamster: 2, reptile: 1 }, { cat: 2, rabbit: 1, bird: 1 }, { dog: 2, rabbit: 1, bird: 1 }],
    exclude: [["dog", "cat", "rabbit", "bird"], ["dog"]],
  },
  // A pet that follows you everywhere.
  { options: [{ dog: 2, bird: 1 }, { cat: 2, rabbit: 1 }, { fish: 2, reptile: 2, hamster: 1 }] },
  // A perfect evening together.
  { options: [{ hamster: 2 }, { rabbit: 2, bird: 2 }, { reptile: 2, fish: 1 }, { dog: 2, cat: 1 }] },
];

export const QUIZ_DEFS: Record<QuizId, QuizDef> = {
  mbti: { id: "mbti", type: "likert", scale: "agree5", dims: ["EI", "SN", "TF", "JP"], items: TYPES, result: { kind: "types" } },
  "big-five": { id: "big-five", type: "likert", scale: "agree5", dims: ["O", "C", "E", "A", "N"], items: BIG_FIVE, result: { kind: "profile" } },
  introvert: {
    id: "introvert",
    type: "likert",
    scale: "agree5",
    dims: ["ext"],
    items: EXTRAVERSION,
    // 40% and 60% of 0–80 are 32 and 48: below 32 is introvert, above 48 extrovert (the `traitLevel` split).
    result: { kind: "band", bands: [{ max: 31, key: "introvert" }, { max: 48, key: "ambivert" }, { max: 80, key: "extrovert" }] },
  },
  enneagram: { id: "enneagram", type: "likert", scale: "agree5", dims: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], items: ENNEAGRAM, result: { kind: "top" } },
  "love-language": { id: "love-language", type: "likert", scale: "agree5", dims: ["words", "time", "gifts", "service", "touch"], items: LOVE, result: { kind: "top" } },
  attachment: {
    id: "attachment",
    type: "likert",
    scale: "agree5",
    dims: ["anx", "avo"],
    items: ATTACHMENT,
    result: { kind: "quadrant", x: "anx", y: "avo", results: { lowLow: "secure", highLow: "anxious", lowHigh: "avoidant", highHigh: "fearful" } },
  },
  marriage: {
    id: "marriage",
    type: "likert",
    scale: "agree5",
    dims: ["talk", "conflict", "money", "family", "future"],
    items: MARRIAGE,
    result: { kind: "areas", bands: [{ min: 80, key: "ready", floor: 60 }, { min: 65, key: "close" }, { min: 45, key: "work" }, { min: 0, key: "early" }] },
  },
  "conflict-style": {
    id: "conflict-style",
    type: "likert",
    scale: "agree5",
    // Ties go to the earlier style, so a flat profile reads as compromising, never as competing.
    dims: ["compromise", "collab", "accommodate", "avoid", "compete"],
    items: CONFLICT,
    result: { kind: "top" },
  },
  career: { id: "career", type: "likert", scale: "agree5", dims: ["R", "I", "A", "S", "E", "C"], items: RIASEC, result: { kind: "code" } },
  "work-style": { id: "work-style", type: "likert", scale: "agree5", dims: ["remote", "team", "structure", "variety"], items: WORK, result: { kind: "profile" } },
  money: { id: "money", type: "likert", scale: "agree5", dims: ["saver", "spender", "investor", "avoider", "giver"], items: MONEY, result: { kind: "top" } },
  chronotype: {
    id: "chronotype",
    type: "choice",
    dims: ["eve"],
    items: CHRONOTYPE,
    result: { kind: "band", bands: [{ max: 16, key: "lark" }, { max: 25, key: "between" }, { max: 42, key: "owl" }] },
  },
  pet: {
    id: "pet",
    type: "choice",
    dims: ["cat", "dog", "rabbit", "fish", "bird", "hamster", "reptile"],
    items: PET,
    result: { kind: "top" },
  },
  anime: {
    id: "anime",
    type: "choice",
    dims: ["tsundere", "kuudere", "dandere", "deredere", "genki", "chuuni", "himedere", "senpai"],
    items: ANIME,
    result: { kind: "top" },
  },
  "face-shape": {
    id: "face-shape",
    type: "choice",
    dims: ["oval", "round", "square", "heart", "oblong", "diamond", "triangle"],
    items: FACE,
    result: { kind: "top" },
  },
  "self-esteem": {
    id: "self-esteem",
    type: "likert",
    scale: "agree4",
    dims: ["se"],
    items: ROSENBERG,
    result: { kind: "band", bands: [{ max: 14, key: "low" }, { max: 25, key: "normal" }, { max: 30, key: "high" }] },
  },
  anxiety: {
    id: "anxiety",
    type: "likert",
    scale: "freq4",
    dims: ["gad"],
    items: GAD7,
    result: { kind: "band", bands: [{ max: 4, key: "minimal" }, { max: 9, key: "mild" }, { max: 14, key: "moderate" }, { max: 21, key: "severe" }] },
  },
  depression: {
    id: "depression",
    type: "likert",
    scale: "freq4",
    dims: ["phq"],
    items: PHQ9,
    result: {
      kind: "band",
      bands: [{ max: 4, key: "minimal" }, { max: 9, key: "mild" }, { max: 14, key: "moderate" }, { max: 19, key: "modsevere" }, { max: 27, key: "severe" }],
    },
  },
};

/**
 * When a result shows the crisis-line box: PHQ-9 item 9 (thoughts of self-harm) above "not at all", whatever the
 * total, and the severe PHQ-9 band.
 */
export const SAFETY: Partial<Record<QuizId, { item: number; bands: readonly string[] }>> = {
  depression: { item: 8, bands: ["severe"] },
};

export function questionCount(id: QuizId): number {
  return QUIZ_DEFS[id].items.length;
}

/** Rough minutes to finish, for the page's summary line (about 8 seconds a question, at least 1). */
export function quizMinutes(id: QuizId): number {
  return Math.max(1, Math.round((questionCount(id) * 8) / 60));
}

export type DimScore = { dim: string; raw: number; min: number; max: number; pct: number };

export type QuizResult = {
  /** Result key in the copy: a type code ("INTJ", "RIA"), a dimension, a quadrant or a band. */
  key: string;
  /** Per-dimension scores in definition order (types: percentage toward the first letter). */
  scores: DimScore[];
  /** Raw total, for band results. */
  total: number;
  /** Highest to lowest, for top / code results; results an answer ruled out come last. */
  ranked: DimScore[];
  /** Results ruled out by an answer (choice options' `exclude`); never the key unless every result is ruled out. */
  excluded: string[];
  /** Areas result: the weakest area. */
  weakest?: string;
  /** Overall percentage (areas and profile). */
  overall: number;
  /** Show the crisis-line box (see `SAFETY`). */
  safety: boolean;
};

/** Points an answer is worth: `answer` is the option index, left to right. */
export function likertPoints(scale: Scale, item: LikertItem, answer: number): number {
  const top = SCALE_POINTS[scale] - 1;
  const value = Math.min(top, Math.max(0, answer));
  return item.rev ? top - value : value;
}

function pct(raw: number, min: number, max: number): number {
  return max === min ? 0 : Math.round(((raw - min) / (max - min)) * 100);
}

function rank(scores: DimScore[], excluded: ReadonlySet<string> = new Set()): DimScore[] {
  // Ruled-out results last; stable: a tie keeps definition order.
  const out = (s: DimScore): number => Number(excluded.has(s.dim));
  return scores.map((s, i) => ({ s, i }))
    .sort((a, b) => out(a.s) - out(b.s) || b.s.pct - a.s.pct || a.i - b.i)
    .map(({ s }) => s);
}

/** Every item answered with a valid option index. */
export function isComplete(id: QuizId, answers: readonly (number | null | undefined)[]): boolean {
  const def = QUIZ_DEFS[id];
  return def.items.every((item, i) => {
    const a = answers[i];
    if (typeof a !== "number" || !Number.isInteger(a) || a < 0) return false;
    const options = def.type === "likert" ? SCALE_POINTS[def.scale] : (item as ChoiceItem).options.length;
    return a < options;
  });
}

export function scoreQuiz(id: QuizId, answers: readonly number[]): QuizResult {
  const def = QUIZ_DEFS[id];
  const scores: DimScore[] = def.dims.map((dim) => ({ dim, raw: 0, min: 0, max: 0, pct: 0 }));
  const byDim = new Map(scores.map((s) => [s.dim, s]));
  let total = 0;
  const excluded = new Set<string>();

  if (def.type === "likert") {
    const top = SCALE_POINTS[def.scale] - 1;
    def.items.forEach((item, i) => {
      const s = byDim.get(item.dim)!;
      const points = likertPoints(def.scale, item, answers[i] ?? 0);
      s.raw += points;
      s.max += top;
      total += points;
    });
  } else {
    def.items.forEach((item, i) => {
      // The most each dimension could get from this question bounds its percentage.
      for (const dim of def.dims) {
        const best = Math.max(0, ...item.options.map((o) => o[dim] ?? 0));
        byDim.get(dim)!.max += best;
      }
      const answer = answers[i] ?? 0;
      const picked = item.options[answer] ?? {};
      for (const [dim, weight] of Object.entries(picked)) {
        const s = byDim.get(dim);
        if (!s) continue;
        s.raw += weight;
        total += weight;
      }
      for (const dim of item.exclude?.[answer] ?? []) excluded.add(dim);
    });
  }
  for (const s of scores) s.pct = pct(s.raw, s.min, s.max);
  // If the answers rule out every result, ignore the exclusions rather than show nothing.
  if (def.dims.every((dim) => excluded.has(dim))) excluded.clear();
  const ranked = rank(scores, excluded);
  const sumRaw = scores.reduce((a, s) => a + s.raw, 0);
  const sumMax = scores.reduce((a, s) => a + s.max, 0);
  const overall = pct(sumRaw, 0, sumMax);
  const rule = def.result;
  const key = resultKey(rule, scores, ranked, total, overall);
  const watch = SAFETY[id];
  const safety = Boolean(watch && ((answers[watch.item] ?? 0) > 0 || watch.bands.includes(key)));
  const weakest = rule.kind === "areas" ? lowest(scores).dim : undefined;
  return { key, scores, total, ranked, excluded: [...excluded], overall, safety, ...(weakest ? { weakest } : {}) };
}

function lowest(scores: DimScore[]): DimScore {
  return [...scores].sort((a, b) => a.pct - b.pct)[0];
}

function resultKey(rule: ResultRule, scores: DimScore[], ranked: DimScore[], total: number, overall: number): string {
  const byDim = new Map(scores.map((s) => [s.dim, s]));
  switch (rule.kind) {
    case "profile":
      return "profile";
    case "types":
      // Each pair leans to its first letter above 50%. A tie goes to the second letter (I, N, F, P), as in MBTI scoring.
      return scores.map((s) => (s.pct > 50 ? s.dim[0] : s.dim[1])).join("");
    case "top":
      return ranked[0].dim;
    case "code":
      return ranked.slice(0, 3).map((s) => s.dim).join("");
    case "quadrant": {
      const high = (dim: string): boolean => (byDim.get(dim)?.pct ?? 0) > 50;
      const x = high(rule.x);
      const y = high(rule.y);
      return x ? (y ? rule.results.highHigh : rule.results.highLow) : y ? rule.results.lowHigh : rule.results.lowLow;
    }
    case "areas": {
      const low = lowest(scores);
      const band = rule.bands.find((b) => overall >= b.min && low.pct >= (b.floor ?? 0)) ?? rule.bands[rule.bands.length - 1];
      return band.key;
    }
    case "band": {
      const band = rule.bands.find((b) => total <= b.max) ?? rule.bands[rule.bands.length - 1];
      return band.key;
    }
  }
}

/** Big Five reading for one trait percentage. */
export function traitLevel(value: number): "low" | "mid" | "high" {
  if (value < 40) return "low";
  if (value > 60) return "high";
  return "mid";
}

/** Highest possible raw total (band results show "12 / 27"). */
export function maxTotal(id: QuizId): number {
  const def = QUIZ_DEFS[id];
  if (def.type === "likert") return def.items.length * (SCALE_POINTS[def.scale] - 1);
  // Choice: the best-weighted option of each question.
  return def.items.reduce((sum, item) => sum + Math.max(0, ...item.options.map((o) => Object.values(o).reduce((a, w) => a + w, 0))), 0);
}

/** Result keys the copy must define, per quiz (tests check every locale has them all). */
export function resultKeys(id: QuizId): string[] {
  const def = QUIZ_DEFS[id];
  const rule = def.result;
  switch (rule.kind) {
    case "profile":
      return [];
    case "types": {
      const out: string[] = [];
      const [a, b, c, d] = def.dims;
      for (const x of a) for (const y of b) for (const z of c) for (const w of d) out.push(x + y + z + w);
      return out;
    }
    case "top":
    case "code":
      return [...def.dims];
    case "quadrant":
      return Object.values(rule.results);
    case "areas":
    case "band":
      return rule.bands.map((band) => band.key);
  }
}
