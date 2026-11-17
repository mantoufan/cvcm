import { h } from "./dom";
import { t } from "./i18n";
import { lessonsForTool } from "../shared/learn";
import { KB_SHELVES, kbForTool } from "../shared/kb";
import type { Locale } from "../shared/locale";
import { caloriesHref, kbHref, learnHref, type ToolId } from "../shared/path";
import { CALORIES_FOCUS, CALORIES_TOOLS } from "../shared/calories";

export function toolLessonsSection(loc: Locale, tool: ToolId): HTMLElement | null {
  const ids = lessonsForTool(tool);
  const shelves = [
    { page: "hub" as const, nav: KB_SHELVES.knowledge.nav, label: t("kb.label"), articles: kbForTool(tool) },
    { page: "code" as const, nav: KB_SHELVES.code.nav, label: t("kb.code.label"), articles: kbForTool(tool, "code") },
    { page: "ai" as const, nav: KB_SHELVES.ai.nav, label: t("kb.ai.label"), articles: kbForTool(tool, "ai") },
    { page: "photo" as const, nav: KB_SHELVES.photo.nav, label: t("kb.photo.label"), articles: kbForTool(tool, "photo") },
  ].filter((shelf) => shelf.articles.length);
  // The health calculators that work with food energy also point to the food calorie chart.
  const calories = (CALORIES_TOOLS as readonly string[]).includes(tool);
  if (ids.length === 0 && shelves.length === 0 && !calories) return null;
  return h("section", { class: "learn-related tool-lessons" },
    ids.length ? h("h2", null, t("learn.guides")) : null,
    ids.length ? h("ul", { class: "tool-lesson-list" },
      ...ids.map((id) =>
        h("li", null,
          h("a", {
            href: learnHref(loc, id),
            "data-nav": `learn-${id}`,
          }, t(`learn.${id}.name`)),
        ),
      ),
    ) : null,
    ...shelves.flatMap((shelf) => [
      h("h2", null, h("a", { href: kbHref(loc, shelf.page), "data-nav": shelf.nav }, shelf.label)),
      h("ul", { class: "tool-lesson-list" },
        ...shelf.articles.map((id) =>
          h("li", null, h("a", { href: kbHref(loc, id), "data-nav": `kb-${id}` }, t(`kb.${id}.name`))),
        ),
      ),
    ]),
    calories ? h("h2", null, h("a", { href: caloriesHref(loc), "data-nav": "calories" }, t("nav.calories"))) : null,
    calories ? h("ul", { class: "tool-lesson-list" },
      ...CALORIES_FOCUS.map((id) => h("li", null, h("a", { href: caloriesHref(loc, id), "data-nav": `food-${id}` }, t(`caloriesFocus.${id}`)))),
    ) : null,
  );
}
