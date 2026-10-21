// Personality and self-check tests (`/{locale}/tests/{id}/`). Everything here is language-neutral:
// which trait each item scores, reverse keys, option weights and result rules. The copy lives in
// `src/locales/quiz/<locale>.json`, with items in the same order. Scoring runs in the page; answers never leave it.

export const QUIZ_GROUPS = [
  { id: "personality", quizzes: ["mbti", "big-five", "introvert", "enneagram"] },
  { id: "love", quizzes: ["love-language", "attachment", "marriage", "conflict-style"] },
  { id: "career", quizzes: ["career", "work-style", "money"] },
  { id: "games", quizzes: ["pokemon", "genshin", "sonic", "dnd-class"] },
  { id: "anime", quizzes: ["naruto", "demon-slayer", "jujutsu-kaisen", "avatar-element", "anime"] },
  { id: "fun", quizzes: ["chronotype", "pet", "face-shape"] },
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
 * top      — the highest dimension wins; all dimensions shown ranked. A tie goes to the earlier dimension, or with
 *            `tie: "spread"` to one picked by a hash of the answers that scored the tied results: with many results
 *            scored by small whole numbers, ties are common, and any fixed order would favor some results. The same
 *            answers always give the same result.
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
  | { kind: "top"; /** Choice quizzes only. */ tie?: "spread" }
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
 * negatively keyed items, alternated. Items and keys as listed at https://ipip.ori.org/newBigFive5broadKey.htm (Factor I,
 * 20-item scale); its 10-item subset is the Big Five test's E items. Total 0–80; the bands split the scale range at 40% and 60%, like `traitLevel`.
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
  // Hours away from home (hamsters sleep through the day).
  { options: [{ fish: 2, reptile: 2, hamster: 1 }, { cat: 2, hamster: 1, fish: 1 }, { dog: 2, bird: 2, rabbit: 1 }] },
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
  { options: [{ fish: 2, reptile: 1, hamster: 1 }, { cat: 2 }, { dog: 2, bird: 2 }, { hamster: 2, rabbit: 1, reptile: 1 }] },
  // Noise.
  { options: [{ fish: 2, reptile: 2, rabbit: 1 }, { cat: 2, hamster: 1 }, { dog: 2, bird: 2 }] },
  // Years of commitment.
  { options: [{ hamster: 2, fish: 1 }, { rabbit: 2, dog: 1, fish: 1 }, { cat: 2, dog: 1, bird: 1, reptile: 1 }, { bird: 2, reptile: 2 }] },
  // Least bad chore.
  { options: [{ dog: 2 }, { cat: 2, rabbit: 1 }, { fish: 2 }, { hamster: 2, rabbit: 1, bird: 1 }, { reptile: 2 }] },
  // Who lives with you. Hamsters and rabbits are fragile and easily dropped: not with young children.
  {
    options: [{ cat: 1, reptile: 1, fish: 1, hamster: 1 }, { rabbit: 1, bird: 1, dog: 1, cat: 1 }, { dog: 2, fish: 2, cat: 1 }],
    exclude: [undefined, undefined, ["rabbit", "hamster"]],
  },
  // Rental or building rules: "small caged or tank animals only" (birds and rabbits live in cages too) and "no dogs"
  // are hard limits. No points: what a lease allows says nothing about which pet suits you.
  {
    options: [{}, {}, {}],
    exclude: [["dog", "cat"], ["dog"]],
  },
  // A pet that follows you everywhere.
  { options: [{ dog: 2, bird: 1 }, { cat: 2, rabbit: 1 }, { fish: 2, reptile: 2, hamster: 1 }] },
  // A perfect evening together.
  { options: [{ hamster: 2 }, { rabbit: 2, bird: 2 }, { reptile: 2, fish: 1 }, { dog: 2, cat: 1 }] },
];

// Game and anime fan quizzes (unofficial). Each option scores 2 for its main result, sometimes 1 for a second;
// every result in a quiz has the same highest possible score.

/** Ten of the 18 Pokémon types, each result with a partner Pokémon in the copy. */
const POKEMON: ChoiceItem[] = [
  { options: [{ fighting: 2, fire: 1 }, { normal: 2 }, { water: 2 }, { ghost: 2 }] },
  { options: [{ grass: 2 }, { electric: 2, ghost: 1 }, { dragon: 2 }, { fairy: 2 }] },
  { options: [{ fire: 2 }, { water: 2, fairy: 1 }, { psychic: 2 }, { fighting: 2 }] },
  { options: [{ fighting: 2 }, { dragon: 2 }, { psychic: 2, water: 1 }, { grass: 2 }] },
  { options: [{ electric: 2 }, { grass: 2 }, { normal: 2 }, { ghost: 2 }] },
  { options: [{ fire: 2 }, { electric: 2 }, { water: 2, grass: 1 }, { ghost: 2, psychic: 1 }] },
  { options: [{ fairy: 2, grass: 1 }, { fire: 2, dragon: 1 }, { ghost: 2 }, { psychic: 2 }] },
  { options: [{ psychic: 2 }, { electric: 2, fighting: 1 }, { fairy: 2 }, { normal: 2, water: 1 }] },
  { options: [{ fire: 2 }, { grass: 2 }, { fairy: 2 }, { normal: 2 }] },
  { options: [{ fighting: 2 }, { water: 2 }, { dragon: 2 }, { psychic: 2 }] },
  { options: [{ fire: 2, electric: 1 }, { normal: 2, water: 1 }, { dragon: 2 }, { ghost: 2 }] },
  { options: [{ fighting: 2 }, { electric: 2, normal: 1 }, { fairy: 2, grass: 1 }, { dragon: 2 }] },
];

/** Genshin Impact's seven elements, one per nation and its ideal (freedom, contracts, eternity, wisdom, justice, war, love). */
const GENSHIN: ChoiceItem[] = [
  { options: [{ anemo: 2 }, { geo: 2, electro: 1 }, { dendro: 2 }, { hydro: 2 }] },
  { options: [{ anemo: 2, dendro: 1 }, { geo: 2, hydro: 1, pyro: 1 }, { electro: 2 }, { cryo: 2 }] },
  { options: [{ pyro: 2, anemo: 1 }, { cryo: 2 }, { geo: 2, dendro: 1 }, { hydro: 2, electro: 1 }] },
  { options: [{ geo: 2 }, { anemo: 2, pyro: 1 }, { electro: 2 }, { dendro: 2 }] },
  { options: [{ geo: 2 }, { pyro: 2, anemo: 1 }, { dendro: 2 }, { electro: 2 }] },
  { options: [{ hydro: 2 }, { cryo: 2, dendro: 1 }, { anemo: 2 }, { pyro: 2, electro: 1 }] },
  { options: [{ anemo: 2 }, { geo: 2 }, { electro: 2, pyro: 1 }, { cryo: 2, hydro: 1 }] },
  { options: [{ pyro: 2 }, { hydro: 2 }, { dendro: 2 }, { cryo: 2 }] },
  { options: [{ anemo: 2 }, { electro: 2 }, { dendro: 2 }, { hydro: 2 }] },
  { options: [{ geo: 2 }, { pyro: 2, electro: 1 }, { hydro: 2, dendro: 1 }, { cryo: 2 }] },
  { options: [{ geo: 2 }, { hydro: 2 }, { cryo: 2, pyro: 1 }, { anemo: 2 }] },
  { options: [{ electro: 2 }, { dendro: 2 }, { pyro: 2 }, { cryo: 2 }] },
];

/** Eight Sonic the Hedgehog characters. */
const SONIC: ChoiceItem[] = [
  { options: [{ sonic: 2 }, { tails: 2 }, { knuckles: 2 }, { amy: 2 }] },
  { options: [{ rouge: 2 }, { cream: 2 }, { tails: 2 }, { shadow: 2 }] },
  { options: [{ sonic: 2 }, { cream: 2 }, { rouge: 2 }, { silver: 2 }] },
  { options: [{ sonic: 2 }, { knuckles: 2 }, { amy: 2 }, { shadow: 2 }] },
  { options: [{ tails: 2 }, { knuckles: 2 }, { rouge: 2 }, { silver: 2 }] },
  { options: [{ sonic: 2 }, { knuckles: 2 }, { cream: 2 }, { silver: 2 }] },
  { options: [{ amy: 2 }, { tails: 2 }, { rouge: 2 }, { shadow: 2 }] },
  { options: [{ amy: 2 }, { cream: 2 }, { shadow: 2 }, { silver: 2 }] },
  { options: [{ sonic: 2 }, { knuckles: 2 }, { amy: 2 }, { shadow: 2 }] },
  { options: [{ rouge: 2 }, { cream: 2 }, { amy: 2 }, { tails: 2 }] },
  { options: [{ cream: 2 }, { rouge: 2 }, { knuckles: 2 }, { silver: 2 }] },
  { options: [{ sonic: 2 }, { tails: 2 }, { silver: 2 }, { shadow: 2 }] },
];

/** The 12 Dungeons & Dragons classes of the 5th-edition SRD. */
const DND: ChoiceItem[] = [
  { options: [{ barbarian: 2, fighter: 1 }, { bard: 2, sorcerer: 1 }, { rogue: 2 }, { wizard: 2 }] },
  { options: [{ barbarian: 2, fighter: 1 }, { rogue: 2 }, { wizard: 2 }, { bard: 2 }] },
  { options: [{ wizard: 2 }, { sorcerer: 2 }, { warlock: 2 }, { cleric: 2 }] },
  { options: [{ druid: 2 }, { ranger: 2 }, { monk: 2 }, { cleric: 2, paladin: 1 }] },
  { options: [{ paladin: 2 }, { druid: 2 }, { fighter: 2 }, { rogue: 2 }] },
  { options: [{ barbarian: 2 }, { cleric: 2, paladin: 1 }, { ranger: 2 }, { monk: 2 }] },
  { options: [{ sorcerer: 2 }, { warlock: 2 }, { paladin: 2 }, { barbarian: 2 }] },
  { options: [{ ranger: 2 }, { warlock: 2 }, { fighter: 2 }, { bard: 2 }] },
  { options: [{ fighter: 2 }, { monk: 2 }, { cleric: 2 }, { sorcerer: 2 }] },
  { options: [{ bard: 2, rogue: 1 }, { wizard: 2 }, { monk: 2 }, { fighter: 2 }] },
  { options: [{ paladin: 2 }, { warlock: 2 }, { druid: 2 }, { sorcerer: 2 }] },
  { options: [{ paladin: 2 }, { rogue: 2 }, { druid: 2 }, { monk: 2 }] },
  { options: [{ warlock: 2, sorcerer: 1 }, { cleric: 2 }, { ranger: 2, rogue: 1 }, { bard: 2 }] },
  { options: [{ wizard: 2 }, { druid: 2 }, { barbarian: 2 }, { ranger: 2 }] },
];

/** Ten Naruto characters. */
const NARUTO: ChoiceItem[] = [
  { options: [{ naruto: 2 }, { sasuke: 2 }, { sakura: 2 }, { jiraiya: 2 }] },
  { options: [{ lee: 2 }, { shikamaru: 2 }, { sakura: 2 }, { kakashi: 2 }] },
  { options: [{ naruto: 2 }, { shikamaru: 2 }, { gaara: 2 }, { itachi: 2, kakashi: 1 }] },
  { options: [{ naruto: 2 }, { sasuke: 2 }, { hinata: 2 }, { kakashi: 2 }] },
  { options: [{ gaara: 2, naruto: 1 }, { itachi: 2 }, { lee: 2 }, { kakashi: 2 }] },
  { options: [{ naruto: 2 }, { shikamaru: 2 }, { hinata: 2 }, { jiraiya: 2 }] },
  { options: [{ shikamaru: 2 }, { sakura: 2 }, { jiraiya: 2, kakashi: 1 }, { sasuke: 2 }] },
  { options: [{ lee: 2, naruto: 1 }, { sasuke: 2 }, { hinata: 2 }, { gaara: 2 }] },
  { options: [{ sakura: 2 }, { shikamaru: 2 }, { itachi: 2 }, { lee: 2 }] },
  { options: [{ gaara: 2 }, { kakashi: 2 }, { hinata: 2 }, { itachi: 2 }] },
  { options: [{ gaara: 2 }, { itachi: 2 }, { sasuke: 2 }, { jiraiya: 2 }] },
  { options: [{ lee: 2 }, { sakura: 2 }, { hinata: 2 }, { jiraiya: 2 }] },
];

/** Ten Demon Slayer Breathing styles (Sun left out: hardly anyone uses it). */
const DEMON_SLAYER: ChoiceItem[] = [
  { options: [{ water: 2 }, { thunder: 2 }, { beast: 2 }, { mist: 2, stone: 1 }] },
  { options: [{ flame: 2 }, { insect: 2 }, { wind: 2, beast: 1 }, { sound: 2 }] },
  { options: [{ thunder: 2 }, { beast: 2 }, { stone: 2 }, { mist: 2 }] },
  { options: [{ love: 2 }, { flame: 2 }, { beast: 2 }, { water: 2 }] },
  { options: [{ love: 2 }, { wind: 2 }, { sound: 2 }, { stone: 2 }] },
  { options: [{ water: 2 }, { flame: 2 }, { insect: 2 }, { stone: 2 }] },
  { options: [{ thunder: 2 }, { mist: 2 }, { insect: 2 }, { sound: 2 }] },
  { options: [{ water: 2 }, { beast: 2 }, { insect: 2 }, { stone: 2 }] },
  { options: [{ water: 2 }, { flame: 2 }, { love: 2 }, { wind: 2, beast: 1 }] },
  { options: [{ love: 2 }, { thunder: 2 }, { sound: 2 }, { mist: 2 }] },
  { options: [{ flame: 2 }, { sound: 2 }, { wind: 2, stone: 1 }, { insect: 2 }] },
  { options: [{ thunder: 2 }, { love: 2 }, { wind: 2 }, { mist: 2 }] },
];

/** Eight Jujutsu Kaisen sorcerers. */
const JJK: ChoiceItem[] = [
  { options: [{ yuji: 2 }, { megumi: 2 }, { nobara: 2 }, { todo: 2 }] },
  { options: [{ nanami: 2 }, { gojo: 2 }, { maki: 2 }, { toge: 2 }] },
  { options: [{ gojo: 2 }, { nanami: 2 }, { todo: 2 }, { toge: 2 }] },
  { options: [{ yuji: 2 }, { nobara: 2 }, { maki: 2 }, { gojo: 2 }] },
  { options: [{ megumi: 2 }, { toge: 2 }, { nobara: 2 }, { nanami: 2 }] },
  { options: [{ yuji: 2 }, { megumi: 2 }, { gojo: 2 }, { todo: 2 }] },
  { options: [{ yuji: 2 }, { maki: 2 }, { megumi: 2 }, { toge: 2 }] },
  { options: [{ yuji: 2 }, { megumi: 2 }, { nanami: 2 }, { nobara: 2 }] },
  { options: [{ nobara: 2 }, { maki: 2 }, { todo: 2 }, { gojo: 2 }] },
  { options: [{ gojo: 2 }, { nanami: 2 }, { toge: 2 }, { megumi: 2 }] },
  { options: [{ maki: 2 }, { yuji: 2 }, { todo: 2 }, { toge: 2 }] },
  { options: [{ nanami: 2 }, { nobara: 2 }, { maki: 2 }, { todo: 2 }] },
];

/** Avatar: The Last Airbender's four bending elements; every question offers all four, each element three times in each position. */
const AVATAR: ChoiceItem[] = [
  { options: [{ water: 2 }, { earth: 2 }, { fire: 2 }, { air: 2 }] },
  { options: [{ earth: 2 }, { air: 2 }, { water: 2 }, { fire: 2 }] },
  { options: [{ fire: 2 }, { earth: 2 }, { air: 2 }, { water: 2 }] },
  { options: [{ air: 2 }, { water: 2 }, { earth: 2 }, { fire: 2 }] },
  { options: [{ water: 2 }, { fire: 2 }, { air: 2 }, { earth: 2 }] },
  { options: [{ earth: 2 }, { water: 2 }, { fire: 2 }, { air: 2 }] },
  { options: [{ fire: 2 }, { air: 2 }, { water: 2 }, { earth: 2 }] },
  { options: [{ air: 2 }, { earth: 2 }, { fire: 2 }, { water: 2 }] },
  { options: [{ water: 2 }, { air: 2 }, { earth: 2 }, { fire: 2 }] },
  { options: [{ earth: 2 }, { fire: 2 }, { air: 2 }, { water: 2 }] },
  { options: [{ fire: 2 }, { water: 2 }, { earth: 2 }, { air: 2 }] },
  { options: [{ air: 2 }, { fire: 2 }, { water: 2 }, { earth: 2 }] },
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
  pokemon: {
    id: "pokemon",
    type: "choice",
    dims: ["fire", "water", "grass", "electric", "psychic", "fairy", "dragon", "ghost", "fighting", "normal"],
    items: POKEMON,
    result: { kind: "top", tie: "spread" },
  },
  genshin: {
    id: "genshin",
    type: "choice",
    dims: ["anemo", "geo", "electro", "dendro", "hydro", "pyro", "cryo"],
    items: GENSHIN,
    result: { kind: "top", tie: "spread" },
  },
  sonic: {
    id: "sonic",
    type: "choice",
    dims: ["sonic", "tails", "knuckles", "amy", "shadow", "rouge", "cream", "silver"],
    items: SONIC,
    result: { kind: "top", tie: "spread" },
  },
  "dnd-class": {
    id: "dnd-class",
    type: "choice",
    dims: ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"],
    items: DND,
    result: { kind: "top", tie: "spread" },
  },
  naruto: {
    id: "naruto",
    type: "choice",
    dims: ["naruto", "sasuke", "sakura", "kakashi", "hinata", "shikamaru", "gaara", "itachi", "lee", "jiraiya"],
    items: NARUTO,
    result: { kind: "top", tie: "spread" },
  },
  "demon-slayer": {
    id: "demon-slayer",
    type: "choice",
    dims: ["water", "flame", "thunder", "beast", "insect", "wind", "mist", "love", "sound", "stone"],
    items: DEMON_SLAYER,
    result: { kind: "top", tie: "spread" },
  },
  "jujutsu-kaisen": {
    id: "jujutsu-kaisen",
    type: "choice",
    dims: ["yuji", "megumi", "nobara", "gojo", "nanami", "maki", "toge", "todo"],
    items: JJK,
    result: { kind: "top", tie: "spread" },
  },
  "avatar-element": {
    id: "avatar-element",
    type: "choice",
    dims: ["water", "earth", "fire", "air"],
    items: AVATAR,
    result: { kind: "top", tie: "spread" },
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
  /** Highest to lowest, for top / code results, without the results an answer ruled out. */
  ranked: DimScore[];
  /** Results ruled out by an answer (choice options' `exclude`), left out of `ranked`. Empty if that would rule out all. */
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

/** 32-bit FNV-1a with the murmur3 finalizer (without it, ties between two results split about 40/60), for an even, repeatable tie-break. */
function tieHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Highest first; a tie keeps definition order. With `hits` (see `top`), each group of tied results is reordered by a
 * hash of the answers that scored them, so answers that only touch other results never change who wins the tie.
 */
function rank(scores: DimScore[], hits?: ReadonlyMap<string, readonly string[]>): DimScore[] {
  // With hits, compare exact shares: two results whose percentages only round to the same number are not tied.
  const exact = (a: DimScore, b: DimScore): number => (hits ? b.raw * a.max - a.raw * b.max : 0);
  const ranked = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s.pct - a.s.pct || exact(a.s, b.s) || a.i - b.i).map(({ s }) => s);
  if (!hits) return ranked;
  for (let start = 0; start < ranked.length; ) {
    let end = start + 1;
    while (end < ranked.length && exact(ranked[start], ranked[end]) === 0) end++;
    if (end - start > 1) {
      const group = ranked.slice(start, end);
      const seed = group.map((g) => `${g.dim}=${(hits.get(g.dim) ?? []).join(".")}`).join(";");
      const order = new Map(group.map((g) => [g.dim, tieHash(`${seed}|${g.dim}`)]));
      group.sort((a, b) => order.get(b.dim)! - order.get(a.dim)!);
      ranked.splice(start, group.length, ...group);
    }
    start = end;
  }
  return ranked;
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
  const rule = def.result;
  // `tie: "spread"` (choice quizzes): which questions, and weights, scored each dimension.
  const hits = rule.kind === "top" && rule.tie === "spread" && def.type === "choice" ? new Map<string, string[]>() : undefined;

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
      for (const [dim, weight] of Object.entries(item.options[answer] ?? {})) {
        const s = byDim.get(dim);
        if (!s) continue;
        s.raw += weight;
        total += weight;
        if (hits && weight > 0) {
          const list = hits.get(dim) ?? [];
          list.push(`${i}:${weight}`);
          hits.set(dim, list);
        }
      }
      for (const dim of item.exclude?.[answer] ?? []) excluded.add(dim);
    });
  }
  for (const s of scores) s.pct = pct(s.raw, s.min, s.max);
  // If the answers rule out every result, ignore the exclusions rather than show nothing.
  if (def.dims.every((dim) => excluded.has(dim))) excluded.clear();
  const ranked = rank(scores.filter((s) => !excluded.has(s.dim)), hits);
  const sumRaw = scores.reduce((a, s) => a + s.raw, 0);
  const sumMax = scores.reduce((a, s) => a + s.max, 0);
  const overall = pct(sumRaw, 0, sumMax);
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
  // Choice: the best option of each question, counting only the quiz's own dimensions (as `scoreQuiz` does).
  const weight = (o: Record<string, number>): number => def.dims.reduce((a, dim) => a + (o[dim] ?? 0), 0);
  return def.items.reduce((sum, item) => sum + Math.max(0, ...item.options.map(weight)), 0);
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
