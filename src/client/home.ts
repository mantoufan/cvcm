import { h } from "./dom";
import { t } from "./i18n";
import type { Locale } from "../shared/locale";
import { appHref } from "../shared/path";

export function mountHome(host: HTMLElement, locale: Locale): void {
  host.append(
    h("section", { class: "hero" },
      h("p", { class: "kicker" }, t("home.kicker")),
      h("h1", null, t("home.title")),
      h("p", { class: "lede" }, t("home.lead")),
      h("a", { class: "btn", href: appHref(locale, "watermark"), "data-nav": "watermark" }, t("home.cta")),
    ),
    h("section", { class: "grid tools-grid" },
      h("a", { class: "card tool-card", href: appHref(locale, "watermark"), "data-nav": "watermark" },
        h("span", { class: "chop", "aria-hidden": "true" }, "印"),
        h("h2", null, t("tools.watermark.name")),
        h("p", null, t("tools.watermark.blurb")),
      ),
    ),
    h("section", { class: "points" },
      point("local"),
      point("nodb"),
      point("i18n"),
    ),
  );
}

function point(id: "local" | "nodb" | "i18n"): HTMLElement {
  return h("article", { class: "point" },
    h("h2", null, t(`home.points.${id}.title`)),
    h("p", null, t(`home.points.${id}.body`)),
  );
}
