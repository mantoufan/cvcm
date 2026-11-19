import { h } from "../dom";
import { locale, t } from "../i18n";
import { player } from "../games/player";
import { FLASH_DEMOS } from "../../shared/demo-roms";
import { gamesHref } from "../../shared/path";

export function mountFlashPlayer(host: HTMLElement): void {
  const loc = locale();
  host.append(
    h("header", { class: "tool-head game-head" },
      h("h1", null, t("flashPlayer.title")),
      h("p", { class: "lede" }, t("flashPlayer.privacyNote")),
    ),
    player({
      name: t("flashPlayer.title"),
      demos: FLASH_DEMOS,
    }),
    h("p", { class: "more" }, h("a", { href: gamesHref(loc, null), "data-nav": "games" }, t("flashPlayer.games"))),
  );
}
