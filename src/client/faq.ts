import { h } from "./dom";
import { t } from "./i18n";
import { toolHowToJsonLd } from "../shared/guide";
import {
  convertJobFaqItems,
  faqItems,
  resizeJobFaqItems,
  faqJsonLd,
  gameHowToJsonLd,
  gameVideoGameJsonLd,
  howToJsonLd,
  learnFaqItems,
  type FaqItem,
} from "../shared/seo";
import type { Locale } from "../shared/locale";
import type { GameId } from "../shared/games";
import type { ConvertJobId, ResizeJobId, ToolId, TutorialId } from "../shared/path";

function renderFaq(items: FaqItem[]): HTMLElement {
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

export function faqSection(
  locale: Locale,
  tool: ToolId,
  convertJob?: ConvertJobId | null,
  resizeJob?: ResizeJobId | null,
): HTMLElement {
  syncPageJsonLd(locale, tool, null, null, false, convertJob, resizeJob);
  const items = tool === "convert" && convertJob
    ? convertJobFaqItems(locale, convertJob)
    : tool === "resize" && resizeJob
      ? resizeJobFaqItems(locale, resizeJob)
      : faqItems(locale, tool);
  return renderFaq(items);
}

export function learnFaqSection(locale: Locale, tutorial: TutorialId): HTMLElement {
  syncPageJsonLd(locale, null, tutorial);
  return renderFaq(learnFaqItems(locale, tutorial));
}

export function syncFaqJsonLd(locale: Locale, tool: ToolId | null): void {
  syncPageJsonLd(locale, tool, null);
}

export function syncPageJsonLd(
  locale: Locale,
  tool: ToolId | null,
  tutorial: TutorialId | null,
  game: GameId | null = null,
  gamesHub = false,
  convertJob: ConvertJobId | null = null,
  resizeJob: ResizeJobId | null = null,
): void {
  const faq = faqJsonLd(locale, tool, tutorial, game, gamesHub, convertJob, resizeJob);
  writeJsonLd("faq-jsonld", faq);
  writeJsonLd(
    "howto-jsonld",
    game
      ? gameHowToJsonLd(locale, game)
      : tutorial
        ? howToJsonLd(locale, tutorial)
        : tool
          ? toolHowToJsonLd(locale, tool)
          : null,
  );
  writeJsonLd("game-jsonld", game ? gameVideoGameJsonLd(locale, game) : null);
}

function writeJsonLd(id: string, data: Record<string, unknown> | null): void {
  const existing = document.getElementById(id);
  if (!data) {
    existing?.remove();
    return;
  }
  const json = JSON.stringify(data);
  if (existing) {
    existing.textContent = json;
    return;
  }
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = id;
  script.textContent = json;
  document.head.append(script);
}
