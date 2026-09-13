import { mountAudio, unmountAudio } from "./audio/ui";
import { mountClip, unmountClip } from "./clip/ui";
import { unmountCollage, mountCollage } from "./collage/ui";
import { mountConvert, unmountConvert } from "./convert/ui";
import { mountData, unmountData } from "./data/ui";
import { mountColor, unmountColor } from "./color/ui";
import { mountCrop, unmountCrop } from "./crop/ui";
import { mountNames, unmountNames } from "./names/ui";
import { mountPassword, unmountPassword } from "./password/ui";
import { mountQr, unmountQr } from "./qr/ui";
import { mountResize, unmountResize } from "./resize/ui";
import { mountWordCount, unmountWordCount } from "./word-count/ui";
import { clear, h } from "./dom";
import { faqSection, syncPageJsonLd } from "./faq";
import { mountHome } from "./home";
import { mountLearn, mountLearnHub } from "./learn/ui";
import { mountImagePdf, unmountImagePdf } from "./image-pdf/ui";
import { COVER, LEARN_COVER } from "./covers";
import { LOCALES, locale, readStoredLocale, setLocale, t, type Locale } from "./i18n";
import { negotiateLocale } from "../shared/locale";
import {
  CATEGORIES,
  TUTORIAL_GROUPS,
  appHref,
  learnHref,
  parseAppPath,
  type ToolId,
  type TutorialId,
} from "../shared/path";
import { pageCanonical, pageDescription, pageTitle } from "../shared/seo";
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
let tutorial: TutorialId | null = null;
let learnHub = false;
let unmountPdfJpg = (): void => {};
let unmountMergePdf = (): void => {};
let unmountCompressPdf = (): void => {};
let unmountSplitPdf = (): void => {};

boot();
window.addEventListener("popstate", () => render());
document.addEventListener("click", onClick);

function boot(): void {
  const parsed = parseAppPath(location.pathname);
  const stored = readStoredLocale();
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    applyTool(parsed.tool, parsed.clipId ?? null);
    const canonical = appHref(parsed.locale, parsed.tool, parsed.clipId);
    if (location.pathname !== canonical) history.replaceState(null, "", canonical);
  } else if (parsed.kind === "learn") {
    setLocale(parsed.locale);
    applyLearn(parsed.tutorial);
    const canonical = learnHref(parsed.locale, parsed.tutorial);
    if (location.pathname !== canonical) history.replaceState(null, "", canonical);
  } else if (parsed.kind === "clip") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyTool("clip", parsed.id);
    history.replaceState(null, "", appHref(loc, "clip", parsed.id));
  } else if (parsed.kind === "bare-learn") {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    setLocale(loc);
    applyLearn(parsed.tutorial);
    history.replaceState(null, "", learnHref(loc, parsed.tutorial));
  } else {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    const nextTool = parsed.kind === "bare" ? parsed.tool : null;
    setLocale(loc);
    applyTool(nextTool, parsed.kind === "bare" ? parsed.clipId ?? null : null);
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

function applyTool(next: ToolId | null, nextClip: string | null): void {
  tool = next;
  clipId = nextClip;
  tutorial = null;
  learnHub = false;
}

function applyLearn(next: TutorialId | null): void {
  tool = null;
  clipId = null;
  tutorial = next;
  learnHub = next === null;
}

function unmountTools(): void {
  unmountWatermark();
  unmountCollage();
  unmountConvert();
  unmountImagePdf();
  unmountClip();
  unmountAudio();
  unmountData();
  unmountQr();
  unmountPassword();
  unmountWordCount();
  unmountNames();
  unmountColor();
  unmountResize();
  unmountCrop();
  unmountPdfJpg();
  unmountMergePdf();
  unmountCompressPdf();
  unmountSplitPdf();
  unmountPdfJpg = (): void => {};
  unmountMergePdf = (): void => {};
  unmountCompressPdf = (): void => {};
  unmountSplitPdf = (): void => {};
}

function render(): void {
  unmountTools();
  const parsed = parseAppPath(location.pathname);
  const loc: Locale = parsed.kind === "app" || parsed.kind === "learn" ? parsed.locale : locale();
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    applyTool(parsed.tool, parsed.clipId ?? null);
  } else if (parsed.kind === "learn") {
    setLocale(parsed.locale);
    applyLearn(parsed.tutorial);
  } else if (parsed.kind === "clip") {
    applyTool("clip", parsed.id);
  } else if (parsed.kind === "bare-learn") {
    applyLearn(parsed.tutorial);
  } else if (parsed.kind === "bare") {
    applyTool(parsed.tool, parsed.clipId ?? null);
  } else {
    applyTool(null, null);
  }

  const seo = learnHub || tutorial
    ? { learn: true as const, tutorial }
    : { tool, clipId };
  document.title = pageTitle(loc, seo);
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", pageDescription(loc, seo));
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", pageCanonical(loc, seo));
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", pageTitle(loc, seo));
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", pageDescription(loc, seo));
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute("content", pageCanonical(loc, seo));
  const ogImage = document.querySelector('meta[property="og:image"]');
  const image = tutorial ? LEARN_COVER[tutorial] : tool ? COVER[tool] : null;
  if (ogImage && image) ogImage.setAttribute("content", `https://cv.cm${image.split("?")[0]}`);
  syncPageJsonLd(loc, tool, tutorial);

  clear(app);
  app.append(shell(loc));
}

function shell(loc: Locale): HTMLElement {
  const main = h("main", { id: "main" });
  void mountPage(main, loc);

  return h("div", { class: "page" + (tool || tutorial || learnHub ? " is-tool" : "") },
    h("header", { class: "top" },
      h("a", { class: "brand", href: appHref(loc, null), "data-nav": "home" },
        h("span", { class: "mark", "aria-hidden": "true" }, "cv"),
        h("span", { class: "brand-name" }, t("brand")),
      ),
      h("nav", { class: "nav", "aria-label": t("nav.tools") },
        toolsMenu(loc, tool),
        learnMenu(loc, tutorial, learnHub),
      ),
      langSwitch(loc),
    ),
    main,
    h("footer", { class: "foot" }, t("footer.privacy")),
  );
}

async function mountPage(main: HTMLElement, loc: Locale): Promise<void> {
  if (tool === "clip") await mountClip(main, clipId);
  else if (tool === "watermark") await mountWatermark(main);
  else if (tool === "collage") await mountCollage(main);
  else if (tool === "convert") await mountConvert(main);
  else if (tool === "image-pdf") await mountImagePdf(main);
  else if (tool === "audio") await mountAudio(main);
  else if (tool === "data") mountData(main);
  else if (tool === "qr") mountQr(main);
  else if (tool === "password") mountPassword(main);
  else if (tool === "word-count") mountWordCount(main);
  else if (tool === "names") mountNames(main);
  else if (tool === "color") mountColor(main);
  else if (tool === "resize") await mountResize(main);
  else if (tool === "crop") await mountCrop(main);
  else if (tool === "pdf-jpg") {
    const mod = await import("./pdf-jpg/ui");
    unmountPdfJpg = mod.unmountPdfJpg;
    await mod.mountPdfJpg(main);
  } else if (tool === "merge-pdf") {
    const mod = await import("./merge-pdf/ui");
    unmountMergePdf = mod.unmountMergePdf;
    await mod.mountMergePdf(main);
  } else if (tool === "compress-pdf") {
    const mod = await import("./compress-pdf/ui");
    unmountCompressPdf = mod.unmountCompressPdf;
    await mod.mountCompressPdf(main);
  } else if (tool === "split-pdf") {
    const mod = await import("./split-pdf/ui");
    unmountSplitPdf = mod.unmountSplitPdf;
    await mod.mountSplitPdf(main);
  } else if (learnHub) mountLearnHub(main);
  else if (tutorial) mountLearn(main, tutorial);
  else mountHome(main, loc);
  if (tool && !(tool === "clip" && clipId)) main.append(faqSection(loc, tool));
}

function menuToggle(e: Event): void {
  e.stopPropagation();
  const menu = (e.currentTarget as HTMLElement).closest(".menu");
  const willOpen = !menu?.classList.contains("open");
  closeMenus();
  if (willOpen) menu?.classList.add("open");
}

function toolsMenu(loc: Locale, current: ToolId | null): HTMLElement {
  return h("div", { class: "menu" + (current ? " current" : "") },
    h("button", {
      type: "button",
      class: "menu-btn" + (current ? " on" : ""),
      "aria-haspopup": "true",
      "aria-expanded": "false",
      onClick: menuToggle,
    }, t("nav.tools")),
    h("div", { class: "menu-panel wide", role: "menu" },
      ...CATEGORIES.flatMap((cat) => [
        h("div", { class: "menu-group" }, t(`nav.${cat.id}`)),
        ...cat.tools.map((id) =>
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
      ]),
    ),
  );
}

function learnMenu(loc: Locale, current: TutorialId | null, hub: boolean): HTMLElement {
  const active = hub || Boolean(current);
  return h("div", { class: "menu" + (active ? " current" : "") },
    h("button", {
      type: "button",
      class: "menu-btn" + (active ? " on" : ""),
      "aria-haspopup": "true",
      onClick: menuToggle,
    }, t("nav.learn")),
    h("div", { class: "menu-panel", role: "menu" },
      h("a", {
        class: "menu-item plain" + (hub ? " on" : ""),
        href: learnHref(loc, null),
        role: "menuitem",
        "data-nav": "learn",
        "aria-current": hub ? "page" : undefined,
      },
        h("div", { class: "menu-copy" },
          h("strong", null, t("learn.hub.menu")),
          h("span", null, t("learn.hub.blurb")),
        ),
      ),
      ...TUTORIAL_GROUPS.flatMap((group) => [
        h("div", { class: "menu-group" }, t(`learn.groups.${group.id}`)),
        ...group.tutorials.map((id) =>
          h("a", {
            class: "menu-item" + (current === id ? " on" : ""),
            href: learnHref(loc, id),
            role: "menuitem",
            "data-nav": `learn-${id}`,
            "aria-current": current === id ? "page" : undefined,
          },
            h("img", { class: "menu-cover", src: LEARN_COVER[id], alt: "", width: "72", height: "40" }),
            h("div", { class: "menu-copy" },
              h("strong", null, t(`learn.${id}.name`)),
              h("span", null, t(`learn.${id}.blurb`)),
            ),
          ),
        ),
      ]),
    ),
  );
}

function langSwitch(current: Locale): HTMLElement {
  const sel = h("select", {
    class: "lang",
    "aria-label": t("lang.label"),
    onChange: (e: Event) => {
      const next = (e.target as HTMLSelectElement).value as Locale;
      setLocale(next);
      const href = learnHub || tutorial
        ? learnHref(next, tutorial)
        : appHref(next, tool, clipId);
      history.pushState(null, "", href);
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
