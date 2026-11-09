import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { MAX_NAMES, makeTeams, parseNames, requestedTeams, teamCount } from "../../shared/teams";

let namesEl: HTMLTextAreaElement | null = null;
let modeEl: HTMLSelectElement | null = null;
let valueEl: HTMLInputElement | null = null;
let countEl: HTMLElement | null = null;
let errorEl: HTMLElement | null = null;
let outEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountTeamGenerator(host: HTMLElement): void {
  namesEl = h("textarea", { rows: 10, "data-field": "names", spellcheck: "false", onInput: () => counted() });
  namesEl.value = t("teamGenerator.sample");
  modeEl = h("select", { "data-field": "mode", onChange: () => counted() },
    h("option", { value: "count", selected: true }, t("teamGenerator.byCount")),
    h("option", { value: "size" }, t("teamGenerator.bySize")),
  );
  valueEl = h("input", { type: "number", inputmode: "numeric", min: "1", max: String(MAX_NAMES), step: "1", value: "3", "data-field": "value", onInput: () => counted() });
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
  last = "";
}

/** Live "12 names → 3 teams of 4" line, so the split is clear before pressing Generate. */
function counted(): void {
  if (!namesEl || !modeEl || !valueEl || !countEl) return;
  const n = parseNames(namesEl.value).length;
  const mode = modeEl.value as "count" | "size";
  const value = Number(valueEl.value);
  const teams = teamCount(n, mode, value);
  // Only preview a split that Generate will make.
  if (!teams || n < 2 || n > MAX_NAMES) {
    countEl.textContent = t("teamGenerator.countNames", { n });
    return;
  }
  if (requestedTeams(n, mode, value) > teams) {
    countEl.textContent = t("teamGenerator.capped", { n: teams });
    return;
  }
  const small = Math.floor(n / teams);
  const big = Math.ceil(n / teams);
  countEl.textContent = t(small === big ? "teamGenerator.countEven" : "teamGenerator.countUneven", { n, teams, small, big });
}

function generate(): void {
  if (!namesEl || !modeEl || !valueEl || !errorEl || !outEl) return;
  errorEl.textContent = "";
  const names = parseNames(namesEl.value);
  const value = Number(valueEl.value);
  if (names.length < 2) {
    errorEl.textContent = t("teamGenerator.needTwo");
    return;
  }
  if (names.length > MAX_NAMES) {
    errorEl.textContent = t("teamGenerator.tooMany", { n: MAX_NAMES });
    return;
  }
  if (!Number.isInteger(value) || value < 1) {
    errorEl.textContent = t("teamGenerator.badNumber");
    return;
  }
  const mode = modeEl.value as "count" | "size";
  const count = teamCount(names.length, mode, value);
  // Both modes can ask for more teams than allowed (one per name, 50 at most): say what was made instead.
  if (requestedTeams(names.length, mode, value) > count) {
    errorEl.textContent = t("teamGenerator.capped", { n: count });
  }
  const teams = makeTeams(names, count);
  outEl.replaceChildren(...teams.map((team, i) => h("li", null,
    h("strong", null, t("teamGenerator.team", { n: i + 1 })),
    ` (${team.length})`,
    h("span", { class: "team-names" }, team.join(", ")),
  )));
  last = teams.map((team, i) => `${t("teamGenerator.team", { n: i + 1 })}: ${team.join(", ")}`).join("\n");
}
