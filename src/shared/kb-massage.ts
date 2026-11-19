import type { MassageGroupId } from "./kb";
import type { ToolId } from "./path";

/** Massage shelf: `/{locale}/learn/massage/{id}/`, copy in src/locales/kb/<locale>/<id>.json, names in the core packs (`kb.<id>`). */
export const MASSAGE_ARTICLES = [
  "how-to-massage",
  "when-not-to-massage",
  "acupressure-points",
  "pressure-points-for-headache",
  "pressure-points-for-eye-strain",
  "foot-reflexology-chart",
  "foot-massage",
  "hand-massage",
  "neck-and-shoulder-massage",
  "back-massage",
  "facial-massage",
  "scalp-massage",
  "how-to-use-gua-sha",
  "how-to-use-a-massage-gun",
  "foam-rolling",
  "tennis-ball-massage",
] as const;

export type MassageId = (typeof MASSAGE_ARTICLES)[number];

export const MASSAGE_GROUPS: readonly { id: MassageGroupId; articles: readonly MassageId[] }[] = [
  { id: "basics", articles: ["how-to-massage", "when-not-to-massage"] },
  { id: "points", articles: ["acupressure-points", "pressure-points-for-headache", "pressure-points-for-eye-strain"] },
  { id: "feet-hands", articles: ["foot-reflexology-chart", "foot-massage", "hand-massage"] },
  { id: "neck-back", articles: ["neck-and-shoulder-massage", "back-massage"] },
  { id: "face-scalp", articles: ["facial-massage", "scalp-massage", "how-to-use-gua-sha"] },
  { id: "tools", articles: ["how-to-use-a-massage-gun", "foam-rolling", "tennis-ball-massage"] },
];

/** Tools a massage article puts to work (first is its call to action): the pressure points map and timers for holds and routines. */
export const MASSAGE_ARTICLE_TOOLS: Partial<Record<MassageId, readonly ToolId[]>> = {
  "how-to-massage": ["countdown", "stopwatch"],
  "acupressure-points": ["pressure-points-map", "countdown"],
  "pressure-points-for-headache": ["pressure-points-map", "countdown"],
  "pressure-points-for-eye-strain": ["pressure-points-map", "pomodoro"],
  "foot-reflexology-chart": ["pressure-points-map", "countdown"],
  "foot-massage": ["countdown"],
  "hand-massage": ["pomodoro", "pressure-points-map"],
  "neck-and-shoulder-massage": ["pomodoro", "pressure-points-map"],
  "back-massage": ["countdown"],
  "facial-massage": ["countdown"],
  "scalp-massage": ["countdown"],
  "how-to-use-gua-sha": ["countdown"],
  "how-to-use-a-massage-gun": ["countdown", "stopwatch"],
  "foam-rolling": ["countdown", "stopwatch"],
  "tennis-ball-massage": ["countdown"],
};
