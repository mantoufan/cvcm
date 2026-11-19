import { h } from "../dom";
import { locale, t } from "../i18n";
import { player } from "../games/player";
import { DEMO_ROMS } from "../../shared/demo-roms";
import { gamesHref } from "../../shared/path";

export function mountFlashPlayer(host: HTMLElement): void {
  const loc = locale();
  host.append(
    h("header", { class: "tool-head game-head" },
      h("h1", null, t("flashPlayer.title")),
      h("p", { class: "lede" }, t("flashPlayer.privacyNote")),
    ),
    player({
      console: "flash",
      core: "ruffle",
      accept: ".swf",
      name: t("flashPlayer.title"),
      demos: DEMO_ROMS.filter((demo) => demo.console === "flash"),
    }),
    h("p", { class: "more" }, h("a", { href: gamesHref(loc, null), "data-nav": "games" }, t("flashPlayer.games"))),
  );
}
