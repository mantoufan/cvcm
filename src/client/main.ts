import { unmountCollage, mountCollage } from "./collage/ui";
import { clear, h } from "./dom";
import { mountHome } from "./home";
import { LOCALES, locale, readStoredLocale, setLocale, t, type Locale } from "./i18n";
import { negotiateLocale } from "../shared/locale";
import { TOOLS, appHref, parseAppPath, type ToolId } from "../shared/path";
import { mountWatermark, unmountWatermark } from "./watermark/ui";
import "./styles.css";

function requireApp(): HTMLElement {
  const el = document.getElementById("app");
  if (!el) throw new Error("#app");
  return el;
}
const app = requireApp();

let tool: ToolId | null = null;

boot();
window.addEventListener("popstate", () => render());
document.addEventListener("click", onClick);

function boot(): void {
  const parsed = parseAppPath(location.pathname);
  const stored = readStoredLocale();
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    tool = parsed.tool;
    const canonical = appHref(parsed.locale, parsed.tool);
    if (location.pathname !== canonical) history.replaceState(null, "", canonical);
  } else {
    const loc = stored ?? negotiateLocale(navigator.languages?.join(",") || navigator.language, null);
    const nextTool = parsed.kind === "bare" ? parsed.tool : null;
    setLocale(loc);
    tool = nextTool;
    history.replaceState(null, "", appHref(loc, nextTool));
  }
  render();
}

function onClick(e: MouseEvent): void {
  const a = (e.target as HTMLElement | null)?.closest("a");
  if (!a || a.target === "_blank" || a.origin !== location.origin) return;
  const parsed = parseAppPath(a.pathname);
  if (parsed.kind === "static") return;
  e.preventDefault();
  history.pushState(null, "", a.href);
  render();
}

function unmountTools(): void {
  unmountWatermark();
  unmountCollage();
}

function pageTitle(): string {
  if (tool === "watermark") return t("meta.titleWatermark");
  if (tool === "collage") return t("meta.titleCollage");
  return t("meta.title");
}

function render(): void {
  unmountTools();
  const parsed = parseAppPath(location.pathname);
  const loc: Locale = parsed.kind === "app" ? parsed.locale : locale();
  if (parsed.kind === "app") {
    setLocale(parsed.locale);
    tool = parsed.tool;
  } else if (parsed.kind === "bare") {
    tool = parsed.tool;
  } else {
    tool = null;
  }

  document.title = pageTitle();
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("meta.description"));
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", `https://cv.cm${appHref(loc, tool)}`);

  clear(app);
  app.append(shell(loc));
}

function shell(loc: Locale): HTMLElement {
  const main = h("main", { id: "main" });
  if (tool === "watermark") mountWatermark(main);
  else if (tool === "collage") mountCollage(main);
  else mountHome(main, loc);

  return h("div", { class: "page" + (tool ? " is-tool" : "") },
    h("header", { class: "top" },
      h("a", { class: "brand", href: appHref(loc, null), "data-nav": "home" },
        h("span", { class: "mark", "aria-hidden": "true" }, "cv"),
        h("span", { class: "brand-name" }, t("brand")),
      ),
      h("nav", { class: "nav" },
        toolMap(loc, tool),
        h("span", { class: "badge" }, t("nav.privacy")),
        langSwitch(loc, tool),
      ),
    ),
    main,
    h("footer", { class: "foot" }, t("footer.privacy")),
  );
}

function toolMap(loc: Locale, current: ToolId | null): HTMLElement {
  return h("div", { class: "tool-map", "aria-label": t("nav.tools") },
    ...TOOLS.map((id) =>
      h("a", {
        class: "nav-tool" + (current === id ? " on" : ""),
        href: appHref(loc, id),
        "data-nav": id,
        "aria-current": current === id ? "page" : undefined,
      }, t(`tools.${id}.name`)),
    ),
  );
}

function langSwitch(current: Locale, currentTool: ToolId | null): HTMLElement {
  const sel = h("select", {
    class: "lang",
    "aria-label": t("lang.label"),
    onChange: (e: Event) => {
      const next = (e.target as HTMLSelectElement).value as Locale;
      setLocale(next);
      history.pushState(null, "", appHref(next, currentTool));
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
