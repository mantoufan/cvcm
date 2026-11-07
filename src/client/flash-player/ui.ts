import { h } from "../dom";
import { locale, t } from "../i18n";
import { player } from "../games/player";
import { appHref, gamesHref } from "../../shared/path";

export function mountFlashPlayer(host: HTMLElement): void {
  const loc = locale();
  host.append(
    h("header", { class: "tool-head game-head" },
      h("a", { class: "back", href: appHref(loc, null), "data-nav": "home" }, t("flashPlayer.back")),
      h("h1", null, t("flashPlayer.title")),
      h("p", { class: "lede" }, t("flashPlayer.privacyNote")),
    ),
    player({
      console: "flash",
      core: "ruffle",
      accept: ".swf",
      name: t("flashPlayer.title"),
      romUrl: null,
      cheats: [],
    }),
    h("p", { class: "more" }, h("a", { href: gamesHref(loc, "flash"), "data-nav": "games-flash" }, t("flashPlayer.games"))),
  );
}
