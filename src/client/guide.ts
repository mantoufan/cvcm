import { h } from "./dom";
import { locale } from "./i18n";
import { guideImage, guideSteps, guideText } from "../shared/guide";
import type { ToolId } from "../shared/path";

export function guideSection(tool: ToolId): HTMLElement {
  const loc = locale();
  const count = guideSteps(tool);
  const nums = Array.from({ length: count }, (_, i) => i + 1);
  return h("section", { class: "tool-guide", "aria-labelledby": "guide-title" },
    h("h2", { id: "guide-title" }, guideText(loc, "title")),
    h("p", { class: "tool-guide-lead" }, guideText(loc, `tools.${tool}.lead`)),
    h("ol", { class: "learn-steps" },
      ...nums.map((n) =>
        h("li", { id: `guide-step-${n}`, class: "learn-step" },
          h("h3", null, guideText(loc, `tools.${tool}.s${n}t`)),
          h("p", null, guideText(loc, `tools.${tool}.s${n}b`)),
          h("figure", { class: "learn-fig learn-diagram" },
            h("img", {
              src: guideImage(tool, n),
              alt: guideText(loc, `tools.${tool}.s${n}t`),
              width: "1180",
              height: "720",
              loading: "lazy",
            }),
          ),
        ),
      ),
    ),
  );
}
