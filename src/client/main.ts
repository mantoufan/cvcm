import { clear, h } from "./dom";
import { mountHome } from "./home";
import { LOCALES, locale, readStoredLocale, setLocale, t, type Locale } from "./i18n";
import { negotiateLocale } from "../shared/locale";
import { appHref, parseAppPath, type ToolId } from "../shared/path";
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

function render(): void {
  unmountWatermark();
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

  const page = tool === "watermark" ? "watermark" : "home";
  document.title = page === "watermark" ? t("meta.titleWatermark") : t("meta.title");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("meta.description"));
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", `https://cv.cm${appHref(loc, tool)}`);

  clear(app);
  app.append(shell(loc, page));
}

function shell(loc: Locale, page: "home" | "watermark"): HTMLElement {
  const main = h("main", { id: "main" });
  if (page === "watermark") mountWatermark(main);
  else mountHome(main, loc);

  return h("div", { class: "wrap" },
    h("header", { class: "top" },
      h("a", { class: "brand", href: appHref(loc, null), "data-nav": "home" },
        h("span", { class: "chop mini", "aria-hidden": "true" }, "印"),
        t("brand"),
      ),
      h("nav", { class: "nav" },
        h("a", { href: appHref(loc, null), "data-nav": "home" }, t("nav.tools")),
        h("span", { class: "badge" }, t("nav.privacy")),
        langSwitch(loc, page === "watermark" ? "watermark" : null),
      ),
    ),
    main,
    h("footer", { class: "foot" }, t("footer.privacy")),
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
