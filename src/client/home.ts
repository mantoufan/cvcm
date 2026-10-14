import { h } from "./dom";
import { mountClipCompose, unmountClip } from "./clip/ui";
import { t } from "./i18n";
import { linkList } from "./links";
import type { Locale } from "../shared/locale";
import { GAMES } from "../shared/games";
import { gameName } from "../shared/games-i18n";
import { CATEGORIES, FEATURED_TUTORIALS, appHref, deviceHref, gamesHref, learnHref, quizHref, datasetHref } from "../shared/path";
import { QUIZZES } from "../shared/quiz";
import { DATASETS } from "../shared/datasets";
import { DEVICE_CHILD_PAGES } from "../shared/device";
import { deviceMessages, devicePageCopy } from "../shared/device-i18n";

/** Home: the clipboard, then every tool as a text link. Returns the clipboard's unmount. */
export function mountHome(host: HTMLElement, locale: Locale): () => void {
  const clipCard = h("div", { class: "home-clip" });
  mountClipCompose(clipCard);
  host.append(
    h("section", { class: "home-hero" },
      h("h1", null, t("tools.clip.name")),
      h("p", { class: "lede" }, `${t("clip.tagline")} · ${[t("clip.featRich"), t("clip.featLink"), t("clip.featFiles")].join(" · ")}`),
      clipCard,
      h("p", { class: "muted" },
        t("clip.privacyNote"), " ",
        h("a", { href: appHref(locale, "clip"), "data-nav": "clip" }, t("clip.more")),
      ),
    ),
    h("section", { class: "wall", id: "tools", "aria-labelledby": "tools-title" },
      h("h2", { id: "tools-title", class: "sr-only" }, t("nav.tools")),
      ...CATEGORIES.map((cat) =>
        h("div", { class: "group" },
          h("h3", null, t(`nav.${cat.id}`)),
          linkList(cat.tools.map((id) => ({ href: appHref(locale, id), name: t(`tools.${id}.name`), blurb: t(`tools.${id}.blurb`), nav: id }))),
        ),
      ),
      h("div", { class: "group" },
        h("h3", null, h("a", { href: deviceHref(locale, "hub"), "data-nav": "device" }, t("nav.device"))),
        linkList(DEVICE_CHILD_PAGES.map((id) => {
          const copy = devicePageCopy(locale, id);
          return { href: deviceHref(locale, id), name: copy.name, blurb: copy.blurb, nav: `device-${id}` };
        })),
        h("p", { class: "more" }, h("a", { href: deviceHref(locale, "hub"), "data-nav": "device" }, deviceMessages(locale).all)),
      ),
    ),
    h("section", { class: "wall" },
      h("h2", null, h("a", { href: quizHref(locale), "data-nav": "tests" }, t("nav.tests"))),
      linkList(QUIZZES.map((id) => ({ href: quizHref(locale, id), name: t(`quiz.${id}.name`), blurb: t(`quiz.${id}.blurb`), nav: `test-${id}` }))),
      h("p", { class: "more" }, h("a", { href: quizHref(locale), "data-nav": "tests" }, t("quiz.all"))),
    ),
    h("section", { class: "wall" },
      h("h2", null, h("a", { href: datasetHref(locale), "data-nav": "datasets" }, t("nav.data"))),
      linkList(DATASETS.map((id) => ({ href: datasetHref(locale, id), name: t(`dataset.${id}.name`), blurb: t(`dataset.${id}.blurb`), nav: `dataset-${id}` }))),
      h("p", { class: "more" }, h("a", { href: datasetHref(locale), "data-nav": "datasets" }, t("dataset.all"))),
    ),
    ...(FEATURED_TUTORIALS.length
      ? [h("section", { class: "wall" },
        h("h2", null, t("nav.learn")),
        linkList(FEATURED_TUTORIALS.map((id) => ({ href: learnHref(locale, id), name: t(`learn.${id}.name`), blurb: t(`learn.${id}.blurb`), nav: `learn-${id}` }))),
        h("p", { class: "more" }, h("a", { href: learnHref(locale, null), "data-nav": "learn" }, t("learn.hub.all"))),
      )]
      : []),
    h("section", { class: "wall" },
      h("h2", null, t("nav.games")),
      linkList(GAMES.slice(0, 8).map((game) => {
        const copy = gameName(locale, game.id);
        return { href: gamesHref(locale, game.console, game.id), name: copy.name, blurb: copy.blurb, nav: `game-${game.id}` };
      })),
      h("p", { class: "more" }, h("a", { href: gamesHref(locale, null), "data-nav": "games" }, t("games.hub.all"))),
    ),
  );
  return unmountClip;
}
