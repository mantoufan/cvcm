import type { LoveGroupId } from "./kb";
import type { QuizId } from "./quiz";

/** Relationships shelf: `/{locale}/learn/relationships/{id}/`, copy in src/locales/kb/<locale>/<id>.json, names in the core packs (`kb.<id>`). */
export const LOVE_ARTICLES = [
  "what-is-love-bombing",
  "what-is-breadcrumbing",
  "silent-treatment",
  "gaslighting-in-relationships",
  "red-flags-in-a-relationship",
  "attachment-styles",
  "signs-he-likes-you",
  "signs-she-likes-you",
  "mixed-signals",
  "signs-someone-likes-you-over-text",
  "what-girls-mean-when-they-say",
  "what-guys-mean-when-they-say",
  "talking-stage",
  "how-to-text-your-crush",
  "how-to-confess-your-feelings",
  "rejected-after-confessing",
  "how-to-ask-someone-out",
  "first-date-tips",
  "what-to-text-after-a-first-date",
  "how-to-get-your-ex-back",
  "no-contact-rule",
  "should-you-get-back-together",
  "how-to-get-over-a-breakup",
  "being-ghosted",
  "how-to-break-up-with-someone",
  "long-distance-relationship",
  "how-to-make-up-after-a-fight",
  "how-to-apologize-to-your-partner",
  "relationship-slump",
  "emotional-value",
] as const;

export type LoveId = (typeof LOVE_ARTICLES)[number];

export const LOVE_GROUPS: readonly { id: LoveGroupId; articles: readonly LoveId[] }[] = [
  { id: "concepts", articles: ["what-is-love-bombing", "what-is-breadcrumbing", "silent-treatment", "gaslighting-in-relationships", "red-flags-in-a-relationship", "attachment-styles"] },
  { id: "signs", articles: ["signs-he-likes-you", "signs-she-likes-you", "mixed-signals", "signs-someone-likes-you-over-text", "what-girls-mean-when-they-say", "what-guys-mean-when-they-say"] },
  { id: "dating", articles: ["talking-stage", "how-to-text-your-crush", "how-to-confess-your-feelings", "rejected-after-confessing", "how-to-ask-someone-out", "first-date-tips", "what-to-text-after-a-first-date"] },
  { id: "breakups", articles: ["how-to-get-your-ex-back", "no-contact-rule", "should-you-get-back-together", "how-to-get-over-a-breakup", "being-ghosted", "how-to-break-up-with-someone"] },
  { id: "together", articles: ["long-distance-relationship", "how-to-make-up-after-a-fight", "how-to-apologize-to-your-partner", "relationship-slump", "emotional-value"] },
];

/** Tests an article points to (first is its call to action); test pages list these, so they ship with the ids. */
export const LOVE_ARTICLE_QUIZZES: Partial<Record<LoveId, readonly QuizId[]>> = {
  "what-is-love-bombing": ["codependency", "attachment"],
  "what-is-breadcrumbing": ["attachment", "self-esteem"],
  "silent-treatment": ["conflict-style", "communication-style"],
  "gaslighting-in-relationships": ["self-esteem", "codependency"],
  "red-flags-in-a-relationship": ["codependency", "attachment"],
  "attachment-styles": ["attachment", "love-style"],
  "signs-he-likes-you": ["crush"],
  "signs-she-likes-you": ["crush"],
  "mixed-signals": ["attachment", "crush"],
  "signs-someone-likes-you-over-text": ["crush"],
  "what-girls-mean-when-they-say": ["crush", "communication-style"],
  "what-guys-mean-when-they-say": ["crush", "communication-style"],
  "talking-stage": ["attachment", "crush"],
  "how-to-text-your-crush": ["crush", "communication-style"],
  "how-to-confess-your-feelings": ["crush", "love-language"],
  "rejected-after-confessing": ["self-esteem", "attachment"],
  "how-to-ask-someone-out": ["crush"],
  "first-date-tips": ["communication-style", "love-language"],
  "what-to-text-after-a-first-date": ["crush"],
  "how-to-get-your-ex-back": ["attachment", "conflict-style"],
  "no-contact-rule": ["attachment"],
  "should-you-get-back-together": ["conflict-style", "attachment"],
  "how-to-get-over-a-breakup": ["self-esteem", "anxiety"],
  "being-ghosted": ["attachment", "self-esteem"],
  "how-to-break-up-with-someone": ["communication-style", "conflict-style"],
  "long-distance-relationship": ["attachment", "love-language"],
  "how-to-make-up-after-a-fight": ["conflict-style", "communication-style"],
  "how-to-apologize-to-your-partner": ["conflict-style", "codependency"],
  "relationship-slump": ["love-language", "love-style"],
  "emotional-value": ["eq", "codependency"],
};

/** Relationship articles that point to this test, in hub order: test pages link to them. */
export function loveForQuiz(quiz: QuizId): LoveId[] {
  return LOVE_ARTICLES.filter((id) => LOVE_ARTICLE_QUIZZES[id]?.includes(quiz));
}
