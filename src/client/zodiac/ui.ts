import { copyWithFlash } from "../copy";
import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { ANIMALS, ANIMAL_EMOJI, SIGNS, SIGN_ELEMENT, SIGN_START, SIGN_SYMBOL, lunarYear, zodiacFor, type Sign } from "../../shared/zodiac";

let dateEl: HTMLInputElement | null = null;
let outEl: HTMLElement | null = null;
let noteEl: HTMLElement | null = null;
let copyBtn: HTMLButtonElement | null = null;
let last = "";

export function mountZodiac(host: HTMLElement): void {
  dateEl = h("input", { type: "date", min: "1900-01-01", max: "2100-12-31", value: "1995-08-15", "data-field": "birthday", "data-fixed-date": true, onInput: () => paint() });
  outEl = h("dl", { class: "stats-grid timestamp-out" });
  noteEl = h("p", { class: "hint" });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("zodiac.back")),
      h("h1", null, t("zodiac.title")),
      h("p", { class: "lede" }, t("zodiac.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("zodiac.options")),
          h("label", { class: "field" }, h("span", null, t("zodiac.birthday")), dateEl),
        ),
        h("div", { class: "stage-actions" },
          copyBtn = h("button", { type: "button", class: "btn", onClick: () => void copyOut() }, t("zodiac.copy")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("zodiac.result")),
        outEl,
        noteEl,
      ),
    ),
    h("section", { class: "zodiac-tables" },
      h("h2", null, t("zodiac.signsTable")),
      signTable(),
      h("h2", null, t("zodiac.animalsTable")),
      animalTable(),
      h("p", { class: "hint" }, t("zodiac.tableHint")),
    ),
  );
  paint();
}

export function unmountZodiac(): void {
  dateEl = null;
  outEl = noteEl = null;
  copyBtn = null;
  last = "";
}

const monthDay = (m: number, d: number) =>
  new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2001, m - 1, d)));

/** Last day of a sign = the day before the next sign starts. */
function signEnd(sign: Sign): readonly [number, number] {
  const next = SIGNS[(SIGNS.indexOf(sign) + 1) % SIGNS.length];
  const [m, d] = SIGN_START[next];
  const end = new Date(Date.UTC(2001, m - 1, d - 1));
  return [end.getUTCMonth() + 1, end.getUTCDate()];
}

function signRange(sign: Sign): string {
  const [m0, d0] = SIGN_START[sign];
  const [m1, d1] = signEnd(sign);
  return `${monthDay(m0, d0)} – ${monthDay(m1, d1)}`;
}

function signTable(): HTMLElement {
  return h("table", { class: "zodiac-table" },
    h("thead", null, h("tr", null, h("th", null, t("zodiac.sign")), h("th", null, t("zodiac.dates")), h("th", null, t("zodiac.element")))),
    h("tbody", null, ...SIGNS.map((s) => h("tr", null,
      h("td", null, `${SIGN_SYMBOL[s]} ${t(`zodiac.s_${s}`)}`),
      h("td", null, signRange(s)),
      h("td", null, t(`zodiac.e_${SIGN_ELEMENT[s]}`)),
    ))),
  );
}

function animalTable(): HTMLElement {
  // Years from 1960 to 2031 in rows of six cycles; 1960 is a Rat year.
  return h("table", { class: "zodiac-table" },
    h("thead", null, h("tr", null, h("th", null, t("zodiac.animal")), h("th", null, t("zodiac.years")))),
    h("tbody", null, ...ANIMALS.map((a, i) => h("tr", null,
      h("td", null, `${ANIMAL_EMOJI[a]} ${t(`zodiac.a_${a}`)}`),
      h("td", null, Array.from({ length: 6 }, (_, k) => 1960 + i + 12 * k).join(", ")),
    ))),
  );
}

function paint(): void {
  if (!outEl || !noteEl) return;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateEl?.value ?? "");
  const out = m ? zodiacFor(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  outEl.replaceChildren();
  noteEl.textContent = "";
  if (!out) {
    last = "";
    outEl.append(h("p", { class: "muted" }, t("zodiac.invalid")));
    return;
  }
  const element = t(`zodiac.el_${out.element}`);
  const rows: Array<[string, string]> = [
    [t("zodiac.sign"), `${SIGN_SYMBOL[out.sign]} ${t(`zodiac.s_${out.sign}`)}`],
    [t("zodiac.dates"), signRange(out.sign)],
    [t("zodiac.element"), t(`zodiac.e_${SIGN_ELEMENT[out.sign]}`)],
    [t("zodiac.animal"), `${ANIMAL_EMOJI[out.animal]} ${t(`zodiac.a_${out.animal}`)}`],
    [t("zodiac.fiveElement"), `${element} · ${t(out.yin ? "zodiac.yin" : "zodiac.yang")}`],
    [t("zodiac.ganzhi"), `${out.ganzhi} (${out.lunarYearStart})`],
  ];
  if (out.newYear) rows.push([t("zodiac.newYear", { year: Number(m![1]) }), monthDay(out.newYear[0], out.newYear[1])]);
  for (const [k, v] of rows) outEl.append(h("dt", null, k), h("dd", null, v));
  last = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  if (out.beforeNewYear) {
    noteEl.textContent = t("zodiac.beforeNewYear", { animal: t(`zodiac.a_${out.animal}`), year: out.lunarYearStart });
  } else if (out.uncertain) {
    noteEl.textContent = t("zodiac.uncertain", { prev: t(`zodiac.a_${lunarYear(out.lunarYearStart - 1).animal}`), animal: t(`zodiac.a_${out.animal}`) });
  }
}

async function copyOut(): Promise<void> {
  await copyWithFlash(copyBtn, last, { done: t("zodiac.copied"), failed: t("zodiac.copyFailed") });
}
