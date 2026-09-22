import { h } from "./dom";
import { t } from "./i18n";
import { lessonsForTool } from "../shared/learn";
import type { Locale } from "../shared/locale";
import { learnHref, type ToolId } from "../shared/path";

export function toolLessonsSection(loc: Locale, tool: ToolId): HTMLElement | null {
  const ids = lessonsForTool(tool);
  if (ids.length === 0) return null;
  return h("section", { class: "learn-related tool-lessons" },
    h("h2", null, t("learn.guides")),
    h("ul", { class: "tool-lesson-list" },
      ...ids.map((id) =>
        h("li", null,
          h("a", {
            href: learnHref(loc, id),
            "data-nav": `learn-${id}`,
          }, t(`learn.${id}.name`)),
        ),
      ),
    ),
  );
}
