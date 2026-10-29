import { LEARN_FIG, localizedTutorialSrc } from "../covers";
import { linkList, type LinkItem } from "../links";
import { h } from "../dom";
import { learnFaqSection } from "../faq";
import { locale, t } from "../i18n";
import { ALGO_SNIPPETS, ONE_PAGE_HTML, TUTORIAL_META, TUTORIAL_DIAGRAMS, TUTORIAL_SOURCES, tutorialSteps } from "../../shared/learn";
import { KB_ARTICLES } from "../../shared/kb";
import { kbLinkItems } from "../../shared/kb-i18n";
import { appHref, isConvertJobId, kbHref, learnHref, TUTORIAL_GROUPS, type ToolId, type TutorialGroupId, type TutorialId } from "../../shared/path";

export function mountLearnHub(host: HTMLElement): void {
  const loc = locale();
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("learn.hub.title")),
      h("p", { class: "lede" }, t("learn.hub.lead")),
      TUTORIAL_GROUPS.length === 0 ? h("p", { class: "learn-empty" }, t("learn.hub.empty")) : null,
    ),
    ...TUTORIAL_GROUPS.map((group) =>
      h("section", { class: "wall" },
        h("h2", null, t(`learn.groups.${group.id}`)),
        linkList(group.tutorials.map((id) => learnLink(loc, id))),
      ),
    ),
    h("section", { class: "wall", id: "knowledge" },
      h("h2", null, h("a", { href: kbHref(loc), "data-nav": "knowledge" }, t("kb.label"))),
      h("p", { class: "lede" }, t("kb.lead")),
      linkList(kbLinkItems(loc, KB_ARTICLES)),
      h("p", { class: "more" }, h("a", { href: kbHref(loc), "data-nav": "knowledge" }, t("kb.all"))),
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
  const tool = meta.related[0];
  const openAt = meta.openAt ?? 2;
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
        h("p", { class: "learn-result" },
          h("strong", null, t("learn.resultLabel")),
          " ",
          t(`learn.${id}.result`),
        ),
      ),
      h("p", { class: "learn-intro" }, t(`learn.${id}.note`)),
      tool ? toolCta(loc, tool, id) : null,
      h("details", { class: "learn-contents" },
        h("summary", null, t("learn.toc")),
        toc(id, nums),
      ),
      h("ol", { class: "learn-steps" },
        ...nums.map((n) =>
          h("li", { id: `step-${n}`, class: "learn-step" },
            h("h2", null, t(`learn.${id}.s${n}t`)),
            h("p", null, t(`learn.${id}.s${n}b`)),
            stepMedia(id, n, figSrc),
            n === openAt && tool ? toolCta(loc, tool, id) : null,
            n === 1 && id === "one-page-site" ? siteSnippet() : null,
          ),
        ),
      ),
      TUTORIAL_SOURCES[id] ? h("section", { class: "learn-related" },
        h("h2", null, t("learn.sources")),
        h("ul", null, ...TUTORIAL_SOURCES[id]!.map((source) =>
          h("li", null, h("a", { href: source.href, target: "_blank", rel: "noopener noreferrer" }, source.title)),
        )),
      ) : null,
      meta.related.length ? h("section", { class: "learn-related" },
        h("h2", null, t("learn.related")),
        linkList(meta.related.map((tool) => ({ href: appHref(loc, tool), name: t(`tools.${tool}.name`), blurb: t(`tools.${tool}.blurb`), nav: tool }))),
      ) : null,
    ),
    learnFaqSection(loc, id),
  );
}

export function learnLink(loc: ReturnType<typeof locale>, id: TutorialId): LinkItem {
  return {
    href: learnHref(loc, id),
    name: t(`learn.${id}.name`),
    blurb: t(`learn.${id}.blurb`),
    meta: t("learn.minutes", { n: TUTORIAL_META[id].minutes }),
    nav: `learn-${id}`,
  };
}

function toolCta(loc: ReturnType<typeof locale>, tool: ToolId, id: TutorialId): HTMLElement {
  const job = isConvertJobId(id) ? id : null;
  const name = job ? t(`convert.jobs.${job}.title`) : t(`tools.${tool}.name`);
  return h("a", {
    class: "btn learn-tool-cta",
    href: job ? appHref(loc, "convert", null, job) : appHref(loc, tool),
    "data-nav": tool,
  }, t("learn.openTool", { name }));
}

function groupOf(id: TutorialId): TutorialGroupId {
  const published = TUTORIAL_GROUPS.find((group) => group.tutorials.includes(id))?.id;
  if (published) return published;
  // Legacy ids that still parse but are not in TUTORIAL_GROUPS.
  if (id === "phone-photos" || id === "window-light" || id === "crop-compose" || id === "portrait") return "photo";
  if (id === "algorithms" || id === "one-page-site") return "code";
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
  const diagrams = TUTORIAL_DIAGRAMS[id];
  const index = diagrams?.findIndex((diagram) => diagram.step === n) ?? -1;
  if (diagrams && index >= 0) {
    const caption = t(`learn.${id}.diagram${index + 1}`);
    return h("figure", { class: "learn-fig learn-diagram" },
      h("img", { src: localizedTutorialSrc(diagrams[index].src, locale()), alt: caption, width: "960", height: "540", loading: "lazy" }),
      h("figcaption", null, caption),
    );
  }
  const meta = TUTORIAL_META[id];
  const src = meta.figByStep?.[n];
  if (src) return figure(id, src, n);
  const codeKey = meta.codeByStep?.[n];
  if (codeKey) return codeBlock(ALGO_SNIPPETS[codeKey]);
  if (!diagrams && n === 2) return stepFigure(id, fallback);
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
    loading: "lazy",
    decoding: "async",
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
