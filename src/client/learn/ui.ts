import { COVER, LEARN_FIG } from "../covers";
import { h } from "../dom";
import { learnFaqSection } from "../faq";
import { locale, t } from "../i18n";
import { ALGO_SNIPPETS, ONE_PAGE_HTML, TUTORIAL_META, TUTORIAL_SOURCES, tutorialSteps } from "../../shared/learn";
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
  const count = tutorialSteps(id);
  const course = meta.kind === "course";
  const nums = Array.from({ length: count }, (_, i) => i + 1);
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: learnHref(loc, null), "data-nav": "learn" }, t("learn.back")),
      h("p", { class: "kicker" }, t(`learn.groups.${groupOf(id)}`)),
      h("h1", null, t(`learn.${id}.title`)),
      h("p", { class: "lede" }, t(`learn.${id}.lead`)),
    ),
    h("div", { class: "learn" + (course ? " is-course" : "") },
      h("div", { class: "learn-meta" },
        h("span", { class: "pill" }, t("learn.minutes", { n: meta.minutes })),
        course ? h("span", { class: "pill" }, t("learn.sitting")) : null,
        h("p", { class: "learn-result" },
          h("strong", null, t("learn.resultLabel")),
          " ",
          t(`learn.${id}.result`),
        ),
      ),
      h("aside", { class: "learn-note" }, t(`learn.${id}.note`)),
      toc(id, nums),
      h("ol", { class: "learn-steps" },
        ...nums.map((n) =>
          h("li", { id: `step-${n}`, class: "learn-step" },
            h("h2", null, t(`learn.${id}.s${n}t`)),
            h("p", null, t(`learn.${id}.s${n}b`)),
            stepMedia(id, n, figSrc),
            n === 1 && id === "one-page-site" ? siteSnippet() : null,
          ),
        ),
      ),
      h("section", { class: "learn-practice" },
        h("h2", null, t("learn.practiceLabel")),
        h("p", null, t(`learn.${id}.practice`)),
      ),
      TUTORIAL_SOURCES[id] ? h("section", { class: "learn-related" },
        h("h2", null, t("learn.sources")),
        h("ul", null, ...TUTORIAL_SOURCES[id]!.map((source) =>
          h("li", null, h("a", { href: source.href, target: "_blank", rel: "noopener noreferrer" }, source.title)),
        )),
      ) : null,
      meta.related.length ? h("section", { class: "learn-related" },
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
      ) : null,
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
    h("div", { class: "tile-body" },
      h("p", { class: "tile-time" },
        t("learn.minutes", { n: TUTORIAL_META[id].minutes }),
        TUTORIAL_META[id].kind === "course" ? ` · ${t("learn.sitting")}` : "",
      ),
      h("h3", null, t(`learn.${id}.name`)),
      h("p", null, t(`learn.${id}.blurb`)),
    ),
  );
}

function groupOf(id: TutorialId): string {
  for (const group of TUTORIAL_GROUPS) {
    if ((group.tutorials as readonly string[]).includes(id)) return group.id;
  }
  if (id.startsWith("badminton-")) return "court";
  if (id === "pool-safety") return "water";
  return "mind";
}

function toc(id: TutorialId, nums: number[]): HTMLElement {
  return h("nav", { class: "learn-toc", "aria-label": t("learn.toc") },
    h("h2", null, t("learn.toc")),
    h("ol", null,
      ...nums.map((n) =>
        h("li", null,
          h("a", { href: `#step-${n}` }, t(`learn.${id}.s${n}t`)),
        ),
      ),
    ),
  );
}

function stepMedia(id: TutorialId, n: number, fallback: string | undefined): HTMLElement | null {
  const meta = TUTORIAL_META[id];
  const src = meta.figByStep?.[n];
  if (src) return figure(id, src, n);
  const codeKey = meta.codeByStep?.[n];
  if (codeKey) return codeBlock(ALGO_SNIPPETS[codeKey]);
  if (n === 2) return stepFigure(id, fallback);
  return null;
}

function codeBlock(source: string): HTMLElement {
  return h("pre", { class: "learn-code" }, source.trim());
}

function stepFigure(id: TutorialId, src: string | undefined): HTMLElement | null {
  const kind = TUTORIAL_META[id].figure;
  if (kind === "court") return courtFigure(id);
  if (kind === "pool" || kind === "mind") return poolFigure(id);
  if (!src) return null;
  return figure(id, src);
}

function figure(id: TutorialId, src: string, n?: number): HTMLElement {
  const kind = TUTORIAL_META[id].figure;
  const capKey = n ? `learn.${id}.f${n}` : `learn.${id}.figCap`;
  const cap = t(capKey);
  const caption = cap === capKey ? t(`learn.${id}.figCap`) : cap;
  const img = h("img", {
    src,
    alt: caption,
    width: "1280",
    height: "720",
  });
  if (kind === "thirds") {
    return h("figure", { class: "learn-fig" },
      h("div", { class: "learn-fig-frame thirds" },
        img,
        h("span", { class: "thirds-grid", "aria-hidden": "true" }),
      ),
      h("figcaption", null, caption),
    );
  }
  if (kind === "crop") {
    return h("figure", { class: "learn-fig" },
      h("div", { class: "learn-fig-frame crop-demo" },
        img,
        h("span", { class: "crop-box", "aria-hidden": "true" }),
      ),
      h("figcaption", null, caption),
    );
  }
  return h("figure", { class: "learn-fig" },
    img,
    h("figcaption", null, caption),
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
        h("span", null, t(`learn.${id}.icon1`)),
      ),
      h("div", { class: "pool-card" },
        h("strong", null, "2"),
        h("span", null, t(`learn.${id}.icon2`)),
      ),
      h("div", { class: "pool-card" },
        h("strong", null, "3"),
        h("span", null, t(`learn.${id}.icon3`)),
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
