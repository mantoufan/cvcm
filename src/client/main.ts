import { mountAudio, unmountAudio } from "./audio/ui";
import { mountClip, unmountClip } from "./clip/ui";
import { unmountCollage, mountCollage } from "./collage/ui";
import { mountConvert, unmountConvert } from "./convert/ui";
import { mountData, unmountData } from "./data/ui";
import { clear, h } from "./dom";
import { mountHome } from "./home";
import { mountImagePdf, unmountImagePdf } from "./image-pdf/ui";
import { COVER } from "./covers";
import { LOCALES, locale, readStoredLocale, setLocale, t, type Locale } from "./i18n";
import { negotiateLocale } from "../shared/locale";
import {
  CATEGORIES,
  type CategoryId,
  appHref,
  categoryOf,
  parseAppPath,
  type ToolId,
} from "../shared/path";
import { mountWatermark, unmountWatermark } from "./watermark/ui";
import "./styles.css";

function requireApp(): HTMLElement {
  const el = document.getElementById("app");
  if (!el) throw new Error("#app");
  return el;
}
const app = requireApp();

let tool: ToolId | null = null;
let clipId: string | null = null;

boot();
window.addEventListener("popstate", () => render());
document.addEventListener("click", onClick);

function boot(): void {
  const parsed = parseAppPath(location.pathname);
  const stored = readStoredLocale();
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    tool = parsed.tool;
    clipId = parsed.clipId ?? null;
    const canonical = appHref(parsed.locale, parsed.tool, parsed.clipId);
    if (location.pathname !== canonical) history.replaceState(null, "", canonical);
  } else if (parsed.kind === "clip") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    tool = "clip";
    clipId = parsed.id;
    history.replaceState(null, "", appHref(loc, "clip", parsed.id));
  } else {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    const nextTool = parsed.kind === "bare" ? parsed.tool : null;
    setLocale(loc);
    tool = nextTool;
    clipId = parsed.kind === "bare" ? parsed.clipId ?? null : null;
    history.replaceState(null, "", appHref(loc, nextTool, clipId));
  }
  render();
}

function onClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  const a = target?.closest("a");
  if (a && a.target !== "_blank" && a.origin === location.origin) {
    const parsed = parseAppPath(a.pathname);
    if (parsed.kind !== "static") {
      e.preventDefault();
      closeMenus();
      history.pushState(null, "", a.href);
      render();
      return;
    }
  }
  if (!target?.closest(".menu")) closeMenus();
}

function closeMenus(): void {
  document.querySelectorAll(".menu.open").forEach((el) => el.classList.remove("open"));
}

function unmountTools(): void {
  unmountWatermark();
  unmountCollage();
  unmountConvert();
  unmountImagePdf();
  unmountClip();
  unmountAudio();
  unmountData();
}

function pageTitle(): string {
  if (tool === "clip") return t("meta.titleClip");
  if (tool === "watermark") return t("meta.titleWatermark");
  if (tool === "collage") return t("meta.titleCollage");
  if (tool === "convert") return t("meta.titleConvert");
  if (tool === "image-pdf") return t("meta.titleImagePdf");
  if (tool === "audio") return t("meta.titleAudio");
  if (tool === "data") return t("meta.titleData");
  return t("meta.title");
}

function pageDescription(): string {
  if (tool === "clip") return t("meta.descClip");
  if (tool === "convert") return t("meta.descConvert");
  if (tool === "image-pdf") return t("meta.descImagePdf");
  if (tool === "audio") return t("meta.descAudio");
  if (tool === "data") return t("meta.descData");
  if (tool === "watermark" || tool === "collage") return t(`tools.${tool}.blurb`);
  return t("meta.description");
}

function render(): void {
  unmountTools();
  const parsed = parseAppPath(location.pathname);
  const loc: Locale = parsed.kind === "app" ? parsed.locale : locale();
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    tool = parsed.tool;
    clipId = parsed.clipId ?? null;
  } else if (parsed.kind === "clip") {
    tool = "clip";
    clipId = parsed.id;
  } else if (parsed.kind === "bare") {
    tool = parsed.tool;
    clipId = parsed.clipId ?? null;
  } else {
    tool = null;
    clipId = null;
  }

  document.title = pageTitle();
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", pageDescription());
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", `https://cv.cm${appHref(loc, tool, clipId)}`);

  clear(app);
  app.append(shell(loc));
}

function shell(loc: Locale): HTMLElement {
  const main = h("main", { id: "main" });
  if (tool === "clip") void mountClip(main, clipId);
  else if (tool === "watermark") void mountWatermark(main);
  else if (tool === "collage") void mountCollage(main);
  else if (tool === "convert") void mountConvert(main);
  else if (tool === "image-pdf") void mountImagePdf(main);
  else if (tool === "audio") void mountAudio(main);
  else if (tool === "data") mountData(main);
  else mountHome(main, loc);

  return h("div", { class: "page" + (tool ? " is-tool" : "") },
    h("header", { class: "top" },
      h("a", { class: "brand", href: appHref(loc, null), "data-nav": "home" },
        h("span", { class: "mark", "aria-hidden": "true" }, "cv"),
        h("span", { class: "brand-name" }, t("brand")),
      ),
      h("nav", { class: "nav", "aria-label": t("nav.tools") },
        ...CATEGORIES.map((cat) => categoryMenu(loc, cat.id, tool)),
      ),
      langSwitch(loc, tool, clipId),
    ),
    main,
    h("footer", { class: "foot" }, t("footer.privacy")),
  );
}

function categoryMenu(loc: Locale, cat: CategoryId, current: ToolId | null): HTMLElement {
  const def = CATEGORIES.find((c) => c.id === cat)!;
  const active = current ? categoryOf(current) === cat : false;
  return h("div", { class: "menu" + (active ? " current" : "") },
    h("button", {
      type: "button",
      class: "menu-btn" + (active ? " on" : ""),
      "aria-haspopup": "true",
      onClick: (e: Event) => {
        e.stopPropagation();
        const menu = (e.currentTarget as HTMLElement).closest(".menu");
        const willOpen = !menu?.classList.contains("open");
        closeMenus();
        if (willOpen) menu?.classList.add("open");
      },
    }, t(`nav.${cat}`)),
    h("div", { class: "menu-panel", role: "menu" },
      ...def.tools.map((id) =>
        h("a", {
          class: "menu-item" + (current === id ? " on" : ""),
          href: appHref(loc, id),
          role: "menuitem",
          "data-nav": id,
          "aria-current": current === id ? "page" : undefined,
        },
          h("img", { class: "menu-cover", src: COVER[id], alt: "", width: "72", height: "40" }),
          h("div", { class: "menu-copy" },
            h("strong", null, t(`tools.${id}.name`)),
            h("span", null, t(`tools.${id}.blurb`)),
          ),
        ),
      ),
    ),
  );
}

function langSwitch(current: Locale, currentTool: ToolId | null, currentClip: string | null): HTMLElement {
  const sel = h("select", {
    class: "lang",
    "aria-label": t("lang.label"),
    onChange: (e: Event) => {
      const next = (e.target as HTMLSelectElement).value as Locale;
      setLocale(next);
      history.pushState(null, "", appHref(next, currentTool, currentClip));
      render();
    },
  });
  for (const code of LOCALES) {
    sel.append(
      h("option", {
        value: code,
        selected: code === current,
      }, t(`lang.${code}`)),
    );
  }
  return sel;
}
