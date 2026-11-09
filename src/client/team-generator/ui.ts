import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_NAMES, makeTeams, parseNames, planTeams, type TeamPlan } from "../../shared/teams";

let namesEl: HTMLTextAreaElement | null = null;
let modeEl: HTMLSelectElement | null = null;
let valueEl: HTMLInputElement | null = null;
let countEl: HTMLElement | null = null;
let errorEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";
/** The names and settings of the shown draw, to tell a real change from an extra space or blank line. */
let drawKey = "";

export function mountTeamGenerator(host: HTMLElement): void {
  namesEl = h("textarea", { rows: 10, "data-field": "names", spellcheck: "false", onInput: () => onSettings() });
  namesEl.value = t("teamGenerator.sample");
  modeEl = h("select", { "data-field": "mode", onChange: () => onSettings() },
    h("option", { value: "count", selected: true }, t("teamGenerator.byCount")),
    h("option", { value: "size" }, t("teamGenerator.bySize")),
  );
  valueEl = h("input", { type: "number", inputmode: "numeric", min: "1", max: String(MAX_NAMES), step: "1", value: "3", "data-field": "value", onInput: () => onSettings() });
  countEl = h("p", { class: "hint", "data-out": "count" });
  errorEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "error" });
  outEl = h("ol", { class: "team-list", "aria-live": "polite", "data-out": "teams" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("teamGenerator.back")),
      h("h1", null, t("teamGenerator.title")),
      h("p", { class: "lede" }, t("teamGenerator.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("teamGenerator.options")),
          h("label", { class: "field" }, h("span", null, t("teamGenerator.names", { n: MAX_NAMES })), namesEl),
          countEl,
          h("label", { class: "field" }, h("span", null, t("teamGenerator.split")), modeEl),
          h("label", { class: "field" }, h("span", null, t("teamGenerator.number")), valueEl),
        ),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "generate", onClick: () => generate() }, t("teamGenerator.generate")),
          copyBtn = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, last, { done: t("teamGenerator.copied"), failed: t("teamGenerator.copyFailed") }) }, t("teamGenerator.copy")),
        ),
        h("p", { class: "hint" }, t("teamGenerator.hint")),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("teamGenerator.result")),
        errorEl,
        outEl,
      ),
    ),
  );
  counted();
  outEl.append(h("li", { class: "muted" }, t("teamGenerator.empty")));
}

export function unmountTeamGenerator(): void {
  namesEl = null;
  modeEl = null;
  valueEl = null;
  countEl = errorEl = outEl = null;
  copyBtn = null;
  last = drawKey = "";
}

/** New names or numbers make the last draw out of date: clear it, so Copy teams never copies teams that no longer match. */
function onSettings(): void {
  counted();
  if (!outEl || !errorEl) return;
  // An error belongs to the settings it was about.
  errorEl.textContent = "";
  if (!last || settingsKey() === drawKey) return;
  last = drawKey = "";
  outEl.replaceChildren(h("li", { class: "muted" }, t("teamGenerator.empty")));
}

function settingsKey(): string {
  return JSON.stringify([parseNames(namesEl?.value ?? ""), modeEl?.value, Number(valueEl?.value)]);
}

/** Live "12 names → 3 teams of 4" line, so the split is clear before pressing Generate teams. */
function counted(): void {
  if (!namesEl || !modeEl || !valueEl || !countEl) return;
  const n = parseNames(namesEl.value).length;
  const plan = planTeams(n, modeEl.value as "count" | "size", Number(valueEl.value));
  if (!plan.ok) {
    countEl.textContent = plan.error === "needTwo" ? t("teamGenerator.countNames", { n }) : planError(plan);
    return;
  }
  if (plan.capped) {
    countEl.textContent = t("teamGenerator.capped", { n: plan.teams });
    return;
  }
  const small = Math.floor(n / plan.teams);
  const big = Math.ceil(n / plan.teams);
  countEl.textContent = t(small === big ? "teamGenerator.countEven" : "teamGenerator.countUneven", { n, teams: plan.teams, small, big });
}

function planError(plan: Extract<TeamPlan, { ok: false }>): string {
  return plan.error === "tooMany" ? t("teamGenerator.tooMany", { n: MAX_NAMES }) : t(`teamGenerator.${plan.error}`);
}

function generate(): void {
  if (!namesEl || !modeEl || !valueEl || !errorEl || !outEl) return;
  errorEl.textContent = "";
  const names = parseNames(namesEl.value);
  const plan = planTeams(names.length, modeEl.value as "count" | "size", Number(valueEl.value));
  if (!plan.ok) {
    // Clear the last draw too, so Copy teams never copies teams that no longer match the settings.
    errorEl.textContent = planError(plan);
    outEl.replaceChildren(h("li", { class: "muted" }, t("teamGenerator.empty")));
    last = drawKey = "";
    return;
  }
  // Both modes can ask for more teams than allowed (one per name, 50 at most): say what was made instead.
  if (plan.capped) errorEl.textContent = t("teamGenerator.capped", { n: plan.teams });
  const teams = makeTeams(names, plan.teams);
  outEl.replaceChildren(...teams.map((team, i) => h("li", null,
    h("strong", null, t("teamGenerator.team", { n: i + 1 })),
    ` (${team.length})`,
    h("span", { class: "team-names" }, team.join(", ")),
  )));
  drawKey = settingsKey();
  last = teams.map((team, i) => `${t("teamGenerator.team", { n: i + 1 })}: ${team.join(", ")}`).join("\n");
}
