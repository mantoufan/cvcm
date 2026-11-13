import { h } from "../dom";
import { t } from "../i18n";
import { halfWidth } from "../../shared/factors";
import { randomBelow } from "../../shared/random";
import { PLATE_COUNT, buildPlate, planTest, score, type Plate, type PlateSpec } from "../../shared/color-vision";

const SVG = "http://www.w3.org/2000/svg";
/** The test a first visit (and the prerendered page) shows, so the page is the same before and after mount. */
const START_SEED = 1;
const VIEW = 400;

let mounted: { cleanup: () => void } | null = null;

/** A random test (never the start seed). */
const freshSeed = () => randomBelow(1_000_000) + 2;

/** One plate as an SVG of circles (whole-pixel coordinates on a 400 × 400 view to keep the markup small). */
export function plateSvg(plate: Plate, label: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW} ${VIEW}`);
  svg.setAttribute("class", "cv-plate");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  const half = VIEW / 2;
  for (const d of plate.dots) {
    const c = document.createElementNS(SVG, "circle");
    c.setAttribute("cx", (half + d.x * half).toFixed(0));
    c.setAttribute("cy", (half + d.y * half).toFixed(0));
    c.setAttribute("r", Math.max(2, d.r * half).toFixed(1));
    c.setAttribute("fill", d.fill);
    svg.append(c);
  }
  return svg;
}

export function mountColorBlindnessTest(host: HTMLElement): void {
  unmountColorBlindnessTest();
  // Plates are drawn when shown (each one is a few thousand dart throws), not all at once.
  let plates: PlateSpec[] = planTest(START_SEED);
  let plateSeed = START_SEED;
  let answers: (number | null)[] = [];
  let index = 0;

  const stage = h("div", { class: "cv-stage", "data-out": "stage" });
  const progress = h("p", { class: "cv-progress", "data-out": "progress" });
  const answer = h("input", {
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    maxlength: 2,
    "data-field": "answer",
    "aria-label": t("colorBlindnessTest.answer"),
    onKeydown: (e: KeyboardEvent) => {
      // Not the Enter that confirms an input-method composition (full-width digits).
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        submit(false);
      }
    },
  });
  const errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  const form = h("div", { class: "cv-form", "data-out": "form" },
    h("label", { class: "field" }, h("span", null, t("colorBlindnessTest.answer")), answer),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "next", onClick: () => submit(false) }, t("colorBlindnessTest.next")),
      h("button", { type: "button", class: "btn ghost", "data-action": "none", onClick: () => submit(true) }, t("colorBlindnessTest.noNumber")),
    ),
    errorEl,
  );
  const result = h("div", { class: "cv-result", "data-out": "result", "aria-live": "polite" });
  result.hidden = true;

  const showPlate = () => {
    const plate = buildPlate(plates[index]!);
    stage.replaceChildren(plateSvg(plate, t("colorBlindnessTest.plateLabel", { n: index + 1 })));
    progress.textContent = t("colorBlindnessTest.progress", { n: index + 1, total: PLATE_COUNT });
    answer.value = "";
    errorEl.textContent = "";
  };

  const submit = (none: boolean) => {
    if (index >= plates.length) return;
    let value: number | null = null;
    if (!none) {
      const raw = halfWidth(answer.value.trim());
      if (!/^\d{1,2}$/.test(raw)) {
        errorEl.textContent = t("colorBlindnessTest.err_answer");
        answer.focus();
        return;
      }
      value = Number(raw);
    }
    answers[index] = value;
    // The page always opens on the same plan (prerender, rule 8); after the check plate the rest is drawn fresh,
    // so the numbers cannot be learned from another visit.
    if (index === 0 && plateSeed === START_SEED) {
      plates = planTest(freshSeed(), plates[0]);
      plateSeed = -1;
    }
    index++;
    if (index < plates.length) {
      showPlate();
      answer.focus();
    } else finish();
  };

  const finish = () => {
    form.hidden = true;
    stage.replaceChildren();
    progress.textContent = t("colorBlindnessTest.done");
    const verdicts = score(plates, answers);
    const demoOk = answers[0] === plates[0]!.number;
    const weak = verdicts.filter((v) => v.grade !== "normal");
    const summary = !demoOk
      ? t("colorBlindnessTest.r_demo")
      : weak.length === 0
        ? t("colorBlindnessTest.r_normal")
        : weak.length === 3
          ? t("colorBlindnessTest.r_all")
          : weak.map((v) => t(`colorBlindnessTest.r_${v.kind}_${v.grade}`)).join(" ");
    result.replaceChildren(
      h("p", { class: "shape-main", "data-out": "summary", tabindex: -1 }, summary),
      h("dl", { class: "stats-grid", "data-out": "scores" }, ...verdicts.flatMap((v) => [
        h("dt", null, t(`colorBlindnessTest.k_${v.kind}`)),
        h("dd", null, t("colorBlindnessTest.score", { correct: v.correct, total: v.total })),
      ])),
      h("h3", null, t("colorBlindnessTest.review")),
      h("div", { class: "table-wrap" },
        h("table", { class: "cv-table", "data-out": "review" },
          h("thead", null, h("tr", null,
            h("th", { scope: "col" }, "#"),
            h("th", { scope: "col" }, t("colorBlindnessTest.shown")),
            h("th", { scope: "col" }, t("colorBlindnessTest.yours")),
            h("th", { scope: "col" }, t("colorBlindnessTest.kind")),
          )),
          h("tbody", null, ...plates.map((p, i) => h("tr", { class: answers[i] === p.number ? "ok" : "miss" },
            h("td", null, String(i + 1)),
            h("td", null, String(p.number)),
            h("td", null, answers[i] == null ? t("colorBlindnessTest.nothing") : String(answers[i])),
            h("td", null, p.kind === "demo" ? t("colorBlindnessTest.k_demo") : `${t(`colorBlindnessTest.k_${p.kind}`)} · ${t(`colorBlindnessTest.lv_${p.level}`)}`),
          ))),
        ),
      ),
      h("p", { class: "hint" }, t("colorBlindnessTest.disclaimer")),
      h("div", { class: "stage-actions" },
        h("button", { type: "button", class: "btn", "data-action": "retake", onClick: () => restart(freshSeed()) }, t("colorBlindnessTest.retake")),
      ),
    );
    result.hidden = false;
    // The answer field just went away with the form: put focus on the result.
    result.querySelector<HTMLElement>("[data-out=summary]")?.focus();
  };

  const restart = (seed: number) => {
    plates = planTest(seed);
    plateSeed = seed;
    answers = [];
    index = 0;
    result.hidden = true;
    result.replaceChildren();
    form.hidden = false;
    showPlate();
    answer.focus();
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("colorBlindnessTest.title")),
      h("p", { class: "lede" }, t("colorBlindnessTest.privacyNote")),
    ),
    h("div", { class: "cv-tool" },
      h("div", { class: "cv-main" }, progress, stage),
      h("div", { class: "cv-side" },
        form,
        result,
        h("ul", { class: "cv-tips" },
          h("li", null, t("colorBlindnessTest.tip1")),
          h("li", null, t("colorBlindnessTest.tip2")),
          h("li", null, t("colorBlindnessTest.tip3")),
        ),
      ),
    ),
  );
  showPlate();
  mounted = { cleanup: () => {} };
}

export function unmountColorBlindnessTest(): void {
  mounted?.cleanup();
  mounted = null;
}
