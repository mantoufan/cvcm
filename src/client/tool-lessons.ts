import { h } from "./dom";
import { t } from "./i18n";
import { lessonsForTool } from "../shared/learn";
import { kbForTool } from "../shared/kb";
import type { Locale } from "../shared/locale";
import { kbHref, learnHref, type ToolId } from "../shared/path";

export function toolLessonsSection(loc: Locale, tool: ToolId): HTMLElement | null {
  const ids = lessonsForTool(tool);
  const articles = kbForTool(tool);
  if (ids.length === 0 && articles.length === 0) return null;
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
    articles.length ? h("h2", null, h("a", { href: kbHref(loc), "data-nav": "knowledge" }, t("kb.label"))) : null,
    articles.length ? h("ul", { class: "tool-lesson-list" },
      ...articles.map((id) =>
        h("li", null, h("a", { href: kbHref(loc, id), "data-nav": `kb-${id}` }, t(`kb.${id}.name`))),
      ),
    ) : null,
  );
}
