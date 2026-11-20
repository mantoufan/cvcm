import { blobFromBytes } from "../../shared/image-encode";
import { h, downloadBlob } from "../dom";
import { locale, t } from "../i18n";
import { copyWithFlash } from "../copy";
import { defaultPaper, paintLetter, printSheet, sheet } from "../doc-sheet";
import { docFilename, letterDocx, letterText, type Paper } from "../../shared/letter-doc";
import {
  COVER_SCENARIOS,
  SCENARIO_HIDES,
  blankData,
  bodyText,
  buildCover,
  charCount,
  restoreData,
  sampleData,
  todayIso,
  type CoverData,
  type CoverField,
  type CoverScenario,
  type CoverTemplate,
} from "../../shared/cover-letter";
import { COVER_TEMPLATES, KO_SECTIONS } from "../../shared/cover-letter-templates";

const S = "coverLetter";
export const STORAGE_KEY = "cvcm.cover-letter.v1";
/** Fields typed on several lines. */
const MULTILINE: ReadonlySet<CoverField> = new Set<CoverField>(["address", "companyAddress", "achievements", "why", "growth", "character", "motive", "plan"]);
/** Fields grouped under "The job" and "Your experience"; the rest are "About you". */
const JOB_FIELDS: ReadonlySet<CoverField> = new Set<CoverField>(["company", "manager", "companyAddress", "job", "source"]);
const EXP_FIELDS: ReadonlySet<CoverField> = new Set<CoverField>(["role", "years", "education", "achievements", "skills", "why", "availability"]);
const KO_FIELDS: ReadonlySet<CoverField> = new Set<CoverField>(KO_SECTIONS.map(([k]) => k));

let tpl: CoverTemplate;
let data: CoverData;
let paper: Paper = "a4";
let page: HTMLElement | null = null;
let saveTimer = 0;
let paintTimer = 0;
let dirty = false;
/** The language the unsaved edits belong to: a save at unmount can run after the locale already changed. */
let dirtyLoc = "";
let inputs = new Map<CoverField, HTMLInputElement | HTMLTextAreaElement>();
let wrappers = new Map<CoverField, HTMLElement>();
let counts = new Map<CoverField, HTMLElement>();
let scenarioSel: HTMLSelectElement | null = null;
let encBoxes: HTMLInputElement[] = [];
let editBox: HTMLInputElement | null = null;
let editArea: HTMLTextAreaElement | null = null;
let editWrap: HTMLElement | null = null;

/** The paper saved with this language's draft, if any. */
function savedPaper(): Paper | null {
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, { paper?: unknown } | undefined>;
    const p = all?.[locale()]?.paper;
    return p === "a4" || p === "letter" ? p : null;
  } catch {
    return null;
  }
}

function readDraft(): CoverData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, unknown>;
    return restoreData(all?.[locale()], tpl);
  } catch {
    return null;
  }
}

function saveDraft(): void {
  if (!dirty) return;
  dirty = false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    all[dirtyLoc || locale()] = { ...data, paper };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the letter still works for this visit */
  }
}

function changed(): void {
  dirty = true;
  dirtyLoc = locale();
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveDraft, 400);
  window.clearTimeout(paintTimer);
  paintTimer = window.setTimeout(paint, 60);
}

function control(f: CoverField): HTMLElement {
  const common = { "data-field": f, spellcheck: "false", autocomplete: "off" };
  const el = MULTILINE.has(f)
    ? h("textarea", { ...common, rows: KO_FIELDS.has(f) ? "6" : f === "achievements" ? "4" : "2", onInput: () => onField(f, el.value) })
    : h("input", { ...common, type: f === "date" ? "date" : f === "email" ? "email" : f === "phone" ? "tel" : "text", inputmode: f === "years" ? "decimal" : null, onInput: () => onField(f, el.value), onChange: () => onField(f, el.value) });
  inputs.set(f, el);
  const kids: HTMLElement[] = [el];
  if (f === "achievements") kids.push(h("small", { class: "hint" }, t(`${S}.achievementsHint`)));
  if (KO_FIELDS.has(f)) {
    const c = h("small", { class: "hint", "data-out": `count-${f}`, "aria-live": "polite" });
    counts.set(f, c);
    kids.push(c);
  }
  const wrap = h("label", { class: "field" }, h("span", null, t(`${S}.f_${f}`)), ...kids);
  wrappers.set(f, wrap);
  return wrap;
}

function onField(f: CoverField, value: string): void {
  if (data[f] === value) return;
  data[f] = value;
  if (KO_FIELDS.has(f)) paintCount(f);
  changed();
}

function paintCount(f: CoverField): void {
  const c = charCount(data[f]);
  counts.get(f)!.textContent = t(`${S}.count`, { with: c.withSpaces, without: c.withoutSpaces });
}

function fillForm(): void {
  for (const [f, el] of inputs) el.value = data[f];
  if (scenarioSel) scenarioSel.value = data.scenario;
  encBoxes.forEach((box, i) => { box.checked = data.enclosures.includes(i); });
  if (editBox && editArea && editWrap) {
    editBox.checked = data.custom !== null;
    editArea.value = data.custom ?? "";
    editWrap.hidden = data.custom === null;
  }
  for (const f of counts.keys()) paintCount(f);
  syncVisibility();
}

function syncVisibility(): void {
  if (!tpl.scenarios) return;
  const hide = SCENARIO_HIDES[data.scenario];
  for (const [f, wrap] of wrappers) wrap.hidden = hide.includes(f) && !tpl.keep.includes(f);
}

function current() {
  return buildCover(tpl, data);
}

function paint(): void {
  window.clearTimeout(paintTimer);
  if (!page) return;
  const built = current();
  paintLetter(page, built.doc);
  // The date defaults to today: keep it out of the prerendered HTML.
  if (built.dateLine >= 0 && data.date) page.children[built.dateLine]?.setAttribute("data-volatile", "");
}

function stem(): string {
  return `${data.name.trim()} ${t(`${S}.fileStem`)}`;
}

function downloadWord(): void {
  downloadBlob(blobFromBytes(letterDocx(current().doc, paper), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), docFilename(stem(), "docx", "cover-letter"));
}

function fieldset(legend: string, fields: CoverField[], extra: HTMLElement[] = []): HTMLElement | null {
  if (!fields.length && !extra.length) return null;
  return h("fieldset", null, h("legend", null, legend), ...extra, ...fields.map(control));
}

export function mountCoverLetter(host: HTMLElement): void {
  // Closing the tab within the save delay would lose the last edit.
  window.addEventListener("pagehide", saveDraft);
  tpl = COVER_TEMPLATES[locale()];
  paper = savedPaper() ?? defaultPaper(locale());
  inputs = new Map();
  wrappers = new Map();
  counts = new Map();
  encBoxes = [];
  dirty = false;
  // A letter is dated the day it goes out: a reopened draft takes today's date, not the day it was last edited.
  const draft = readDraft();
  data = draft ? { ...draft, date: todayIso() } : { ...sampleData(tpl), date: todayIso() };

  const about = tpl.fields.filter((f) => !JOB_FIELDS.has(f) && !EXP_FIELDS.has(f) && !KO_FIELDS.has(f));
  const job = tpl.fields.filter((f) => JOB_FIELDS.has(f));
  const exp = tpl.fields.filter((f) => EXP_FIELDS.has(f));
  const ko = tpl.fields.filter((f) => KO_FIELDS.has(f));

  scenarioSel = tpl.scenarios
    ? h("select", { "data-field": "scenario", onChange: () => { data.scenario = scenarioSel!.value as CoverScenario; syncVisibility(); changed(); } },
      ...COVER_SCENARIOS.map((s) => h("option", { value: s, selected: s === data.scenario }, t(`${S}.sc_${s}`))))
    : null;
  const scenarioField = scenarioSel ? [h("label", { class: "field" }, h("span", null, t(`${S}.scenario`)), scenarioSel)] : [];

  const encSet = tpl.enclosures.length
    ? h("fieldset", null, h("legend", null, t(`${S}.enclosures`)),
      ...tpl.enclosures.map((label, i) => {
        const box = h("input", { type: "checkbox", "data-field": `enclosure-${i}`, checked: data.enclosures.includes(i), onChange: () => {
          data.enclosures = encBoxes.map((b, j) => (b.checked ? j : -1)).filter((j) => j >= 0);
          changed();
        } });
        encBoxes.push(box);
        return h("label", { class: "check" }, box, label);
      }))
    : null;

  let editSet: HTMLElement | null = null;
  if (tpl.editable) {
    editArea = h("textarea", { rows: "12", "data-field": "custom", spellcheck: "true", "aria-label": t(`${S}.edit`), onInput: () => { data.custom = editArea!.value; changed(); } });
    editWrap = h("div", { class: "cl-edit" }, editArea, h("small", { class: "hint" }, t(`${S}.editHint`)));
    editBox = h("input", { type: "checkbox", "data-field": "edit", onChange: () => {
      data.custom = editBox!.checked ? bodyText(tpl, data) : null;
      editArea!.value = data.custom ?? "";
      editWrap!.hidden = data.custom === null;
      changed();
    } });
    editSet = h("fieldset", null, h("legend", null, t(`${S}.editLegend`)), h("label", { class: "check" }, editBox, t(`${S}.edit`)), editWrap);
  } else {
    editBox = editArea = null;
    editWrap = null;
  }

  page = sheet(paper);
  const paperSel = h("select", { "data-field": "paper", onChange: () => {
    paper = paperSel.value === "letter" ? "letter" : "a4";
    changed();
    page!.classList.toggle("doc-a4", paper === "a4");
    page!.classList.toggle("doc-letter", paper === "letter");
  } },
  h("option", { value: "a4", selected: paper === "a4" }, t(`${S}.paper_a4`)),
  h("option", { value: "letter", selected: paper === "letter" }, t(`${S}.paper_letter`)));

  const copyBtn: HTMLButtonElement = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => {
    paint();
    void copyWithFlash(copyBtn, letterText(current().doc), { done: t(`${S}.copied`), failed: t(`${S}.copyFailed`) });
  } }, t(`${S}.copy`));

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`)),
    ),
    h("div", { class: "cl-tool" },
      h("aside", { class: "rail controls cl-form" },
        fieldset(t(`${S}.about`), about),
        fieldset(t(`${S}.job`), job),
        fieldset(t(`${S}.exp`), exp, scenarioField),
        fieldset(t(`${S}.sections`), ko),
        encSet,
        editSet,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "example", onClick: () => {
            data = { ...sampleData(tpl), date: todayIso() };
            fillForm();
            changed();
          } }, t(`${S}.example`)),
          h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => {
            data = { ...blankData(data.scenario, tpl.defaultEnclosures), date: todayIso() };
            fillForm();
            changed();
          } }, t(`${S}.clear`)),
        ),
      ),
      h("section", { class: "rail cl-stage" },
        h("div", { class: "rail-h" }, h("h2", null, t(`${S}.preview`)),
          h("label", { class: "cl-paper" }, h("span", { class: "sr-only" }, t(`${S}.paper`)), paperSel)),
        h("div", { class: "doc-wrap" }, page),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "print", onClick: () => { paint(); printSheet(page!, paper, stem()); } }, t(`${S}.print`)),
          h("button", { type: "button", class: "btn ghost", "data-action": "word", onClick: () => { paint(); downloadWord(); } }, t(`${S}.word`)),
          copyBtn,
        ),
        h("p", { class: "hint" }, t(`${S}.printHint`)),
      ),
    ),
  );
  fillForm();
  paint();
}

export function unmountCoverLetter(): void {
  window.removeEventListener("pagehide", saveDraft);
  window.clearTimeout(paintTimer);
  window.clearTimeout(saveTimer);
  saveDraft();
  page = null;
  scenarioSel = null;
  editBox = null;
  editArea = null;
  editWrap = null;
  inputs = new Map();
  wrappers = new Map();
  counts = new Map();
  encBoxes = [];
}
