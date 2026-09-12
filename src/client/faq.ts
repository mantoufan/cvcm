import { h } from "./dom";
import { t } from "./i18n";
import { faqItems, faqJsonLd } from "../shared/seo";
import type { Locale } from "../shared/locale";
import type { ToolId } from "../shared/path";

export function faqSection(locale: Locale, tool: ToolId): HTMLElement {
  const items = faqItems(locale, tool);
  syncFaqJsonLd(locale, tool);
  if (items.length === 0) return h("section", { class: "faq", hidden: true });
  return h("section", { class: "faq", "aria-labelledby": "faq-title" },
    h("h2", { id: "faq-title" }, t("faq.title")),
    ...items.map((item, i) =>
      h("details", i === 0 ? { open: true } : null,
        h("summary", null, item.q),
        h("p", null, item.a),
      ),
    ),
  );
}

export function syncFaqJsonLd(locale: Locale, tool: ToolId | null): void {
  const existing = document.getElementById("faq-jsonld");
  if (!tool) {
    existing?.remove();
    return;
  }
  const ld = faqJsonLd(locale, tool);
  if (!ld) {
    existing?.remove();
    return;
  }
  const json = JSON.stringify(ld);
  if (existing) {
    existing.textContent = json;
    return;
  }
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "faq-jsonld";
  script.textContent = json;
  document.head.append(script);
}
