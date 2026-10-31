import { h } from "./dom";
import { t } from "./i18n";
import { lessonsForTool } from "../shared/learn";
import { kbForTool } from "../shared/kb";
import type { Locale } from "../shared/locale";
import { kbHref, learnHref, type ToolId } from "../shared/path";

export function toolLessonsSection(loc: Locale, tool: ToolId): HTMLElement | null {
  const ids = lessonsForTool(tool);
  const shelves = [
    { page: "hub" as const, nav: "knowledge", label: t("kb.label"), articles: kbForTool(tool) },
    { page: "code" as const, nav: "coding", label: t("kb.code.label"), articles: kbForTool(tool, "code") },
  ].filter((shelf) => shelf.articles.length);
  if (ids.length === 0 && shelves.length === 0) return null;
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
  );
}
