import { COVER, LEARN_COVER, LEARN_FIG } from "../covers";
import { h } from "../dom";
import { learnFaqSection } from "../faq";
import { locale, t } from "../i18n";
import { ONE_PAGE_HTML, TUTORIAL_META } from "../../shared/learn";
import { appHref, learnHref, TUTORIAL_GROUPS, type TutorialId } from "../../shared/path";

export function mountLearnHub(host: HTMLElement): void {
  const loc = locale();
  host.append(
    h("section", { class: "hero-band" },
      h("span", { class: "hero-ornament", "aria-hidden": "true" }, "୨୧"),
      h("p", { class: "kicker" }, t("learn.hub.kicker")),
      h("h1", null, t("learn.hub.title")),
      h("p", { class: "lede" }, t("learn.hub.lead")),
    ),
    ...TUTORIAL_GROUPS.map((group) =>
      h("section", { class: "wall" },
        h("div", { class: "wall-h" },
          h("h2", null, t(`learn.groups.${group.id}`)),
        ),
        h("div", { class: "tiles" },
          ...group.tutorials.map((id) => learnTile(loc, id)),
        ),
      ),
    ),
  );
}

export function mountLearn(host: HTMLElement, id: TutorialId): void {
  const loc = locale();
  const meta = TUTORIAL_META[id];
  const figSrc = LEARN_FIG[id];
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: learnHref(loc, null), "data-nav": "learn" }, t("learn.back")),
      h("p", { class: "kicker" }, t(`learn.groups.${groupOf(id)}`)),
      h("h1", null, t(`learn.${id}.title`)),
      h("p", { class: "lede" }, t(`learn.${id}.lead`)),
    ),
    h("div", { class: "learn" },
      h("div", { class: "learn-hero" },
        h("img", {
          src: LEARN_COVER[id],
          alt: t(`learn.${id}.name`),
          width: "1280",
          height: "720",
        }),
      ),
      h("div", { class: "learn-meta" },
        h("span", { class: "pill" }, t("learn.minutes", { n: meta.minutes })),
        h("p", { class: "learn-result" },
          h("strong", null, t("learn.resultLabel")),
          " ",
          t(`learn.${id}.result`),
        ),
      ),
      h("aside", { class: "learn-note" }, t(`learn.${id}.note`)),
      h("ol", { class: "learn-steps" },
        ...[1, 2, 3, 4, 5].map((n) =>
          h("li", { id: `step-${n}`, class: "learn-step" },
            h("h2", null, t(`learn.${id}.s${n}t`)),
            h("p", null, t(`learn.${id}.s${n}b`)),
            n === 2 ? stepFigure(id, figSrc) : null,
            n === 5 && id === "one-page-site" ? siteSnippet() : null,
          ),
        ),
      ),
      h("section", { class: "learn-practice" },
        h("h2", null, t("learn.practiceLabel")),
        h("p", null, t(`learn.${id}.practice`)),
      ),
      h("section", { class: "learn-related" },
        h("h2", null, t("learn.related")),
        h("div", { class: "learn-related-list" },
          ...meta.related.map((tool) =>
            h("a", {
              class: "menu-item",
              href: appHref(loc, tool),
              "data-nav": tool,
            },
              h("img", { class: "menu-cover", src: COVER[tool], alt: "", width: "72", height: "40" }),
              h("div", { class: "menu-copy" },
                h("strong", null, t(`tools.${tool}.name`)),
                h("span", null, t(`tools.${tool}.blurb`)),
              ),
            ),
          ),
        ),
      ),
    ),
    learnFaqSection(loc, id),
  );
}

export function learnTile(loc: ReturnType<typeof locale>, id: TutorialId): HTMLElement {
  return h("a", {
    class: "tile",
    href: learnHref(loc, id),
    "data-nav": `learn-${id}`,
  },
    h("div", { class: "tile-cover" },
      h("img", {
        src: LEARN_COVER[id],
        alt: t(`learn.${id}.name`),
        width: "640",
        height: "360",
      }),
    ),
    h("div", { class: "tile-body" },
      h("p", { class: "tile-time" }, t("learn.minutes", { n: TUTORIAL_META[id].minutes })),
      h("h3", null, t(`learn.${id}.name`)),
      h("p", null, t(`learn.${id}.blurb`)),
    ),
  );
}

function groupOf(id: TutorialId): string {
  for (const group of TUTORIAL_GROUPS) {
    if ((group.tutorials as readonly string[]).includes(id)) return group.id;
  }
  return "photo";
}

function stepFigure(id: TutorialId, src: string | undefined): HTMLElement | null {
  const kind = TUTORIAL_META[id].figure;
  if (kind === "court") return courtFigure(id);
  if (kind === "pool" || kind === "mind") return poolFigure(id);
  if (!src) return null;
  return figure(id, src);
}

function figure(id: TutorialId, src: string): HTMLElement {
  const kind = TUTORIAL_META[id].figure;
  const img = h("img", {
    src,
    alt: t(`learn.${id}.figAlt`),
    width: "1280",
    height: "720",
  });
  if (kind === "thirds") {
    return h("figure", { class: "learn-fig" },
      h("div", { class: "learn-fig-frame thirds" },
        img,
        h("span", { class: "thirds-grid", "aria-hidden": "true" }),
      ),
      h("figcaption", null, t(`learn.${id}.figCap`)),
    );
  }
  if (kind === "crop") {
    return h("figure", { class: "learn-fig" },
      h("div", { class: "learn-fig-frame crop-demo" },
        img,
        h("span", { class: "crop-box", "aria-hidden": "true" }),
      ),
      h("figcaption", null, t(`learn.${id}.figCap`)),
    );
  }
  return h("figure", { class: "learn-fig" },
    img,
    h("figcaption", null, t(`learn.${id}.figCap`)),
  );
}

function siteSnippet(): HTMLElement {
  const pre = h("pre", { class: "learn-code" }, ONE_PAGE_HTML.trim());
  return h("div", { class: "learn-snippet" },
    h("div", { class: "stage-actions" },
      h("button", {
        type: "button",
        class: "btn",
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(ONE_PAGE_HTML.trim() + "\n");
            const btn = document.querySelector(".learn-snippet .btn");
            if (btn) btn.textContent = t("learn.copied");
          } catch {
            /* ignore */
          }
        },
      }, t("learn.copy")),
    ),
    pre,
  );
}

function courtFigure(id: TutorialId): HTMLElement {
  return h("figure", { class: "learn-fig" },
    courtSvg(),
    h("figcaption", null, t(`learn.${id}.figCap`)),
  );
}

function poolFigure(id: TutorialId): HTMLElement {
  return h("figure", { class: "learn-fig" },
    h("div", { class: "pool-cards", "aria-hidden": "true" },
      h("div", { class: "pool-card" },
        h("strong", null, "1"),
        h("span", null, t("learn.pool-safety.icon1")),
      ),
      h("div", { class: "pool-card" },
        h("strong", null, "2"),
        h("span", null, t("learn.pool-safety.icon2")),
      ),
      h("div", { class: "pool-card" },
        h("strong", null, "3"),
        h("span", null, t("learn.pool-safety.icon3")),
      ),
    ),
    h("figcaption", null, t(`learn.${id}.figCap`)),
  );
}

function courtSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 1340 610");
  svg.setAttribute("class", "court-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `
    <rect x="20" y="20" width="1300" height="570" fill="#fff7fb" stroke="#d9548c" stroke-width="8" rx="8"/>
    <rect x="20" y="66" width="1300" height="478" fill="none" stroke="#f3b6cc" stroke-width="4"/>
    <line x1="670" y1="20" x2="670" y2="590" stroke="#c83f79" stroke-width="6"/>
    <line x1="472" y1="20" x2="472" y2="590" stroke="#e38aaa" stroke-width="4"/>
    <line x1="868" y1="20" x2="868" y2="590" stroke="#e38aaa" stroke-width="4"/>
    <line x1="96" y1="20" x2="96" y2="590" stroke="#f3b6cc" stroke-width="4"/>
    <line x1="1244" y1="20" x2="1244" y2="590" stroke="#f3b6cc" stroke-width="4"/>
    <line x1="20" y1="305" x2="472" y2="305" stroke="#e38aaa" stroke-width="4"/>
    <line x1="868" y1="305" x2="1320" y2="305" stroke="#e38aaa" stroke-width="4"/>
    <circle cx="670" cy="305" r="10" fill="#c83f79"/>
  `;
  return svg;
}
