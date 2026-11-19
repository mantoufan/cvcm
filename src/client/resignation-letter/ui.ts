import { copyWithFlash } from "../copy";
import { defaultPaper, paintLetter, printSheet, sheet } from "../doc-sheet";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { docFilename, letterDocx, letterText, type LetterDoc, type Paper } from "../../shared/letter-doc";
import {
  buildLetter,
  daysBetween,
  defaultForm,
  serviceMonths,
  taiwanNoticeDays,
  type RlField,
  type RlForm,
  type RlTemplate,
} from "../../shared/resignation-letter";
import { RL_TEMPLATES } from "../../shared/resignation-letter-templates";

const S = "resignationLetter";
const STORE = "cvcm.resignation-letter.v1";

type Saved = { locale: string; form: RlForm; paper: Paper };

let form: RlForm | null = null;
let tpl: RlTemplate | null = null;
let paper: Paper = "a4";
let page: HTMLElement | null = null;
let doc: LetterDoc | null = null;
let saveTimer = 0;
let paintTimer = 0;
let mounted = false;

function readSaved(loc: string): Saved | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    return saved && saved.locale === loc && saved.form ? saved : null;
  } catch {
    return null;
  }
}

/** Keeps the draft (debounced). The snapshot is taken now, so a save still due after leaving the page holds it. */
function save(): void {
  if (!form) return;
  const data = JSON.stringify({ locale: locale(), form, paper } satisfies Saved);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORE, data);
    } catch {
      /* private mode or full: the draft just isn't kept */
    }
  }, 400);
}

const TEXT_FIELDS = ["place", "name", "title", "department", "company", "recipientTitle", "recipient"] as const;
const DATE_FIELDS = ["startDate", "lastDay", "date"] as const;
const LABEL: Record<RlField, string> = {
  kind: "kind", scenario: "scenario", vertical: "vertical", era: "era", place: "place", name: "name", title: "jobTitle",
  department: "department", company: "company", recipientTitle: "recipientTitle", recipient: "recipient",
  startDate: "startDate", lastDay: "lastDay", date: "date", thanks: "thanks", handover: "handover",
};

export function mountResignationLetter(host: HTMLElement): void {
  mounted = true;
  const loc = locale();
  tpl = RL_TEMPLATES[loc];
  const saved = readSaved(loc);
  form = { ...defaultForm(tpl), ...(saved?.form ?? {}) };
  if (!tpl.kinds.some(([k]) => k === form!.kind)) form.kind = tpl.kinds[0][0];
  if (tpl.scenarios.length && !tpl.scenarios.some(([k]) => k === form!.scenario)) form.scenario = tpl.scenarios[0][0];
  paper = saved?.paper === "letter" || saved?.paper === "a4" ? saved.paper : defaultPaper(loc);
  const f = form;
  const template = tpl;

  const changed = (repaintNow = false) => {
    save();
    window.clearTimeout(paintTimer);
    if (repaintNow) paint();
    else paintTimer = window.setTimeout(paint, 60);
  };

  const controls: HTMLElement[] = [];
  for (const id of template.fields) {
    const label = t(`${S}.${LABEL[id]}`);
    if (id === "kind" || id === "scenario") {
      const options = id === "kind" ? template.kinds : template.scenarios;
      if (options.length < 2) continue;
      const sel = h("select", {
        "data-field": id,
        onChange: () => { f[id] = sel.value; changed(true); },
      }, ...options.map(([v, name]) => h("option", { value: v, selected: f[id] === v }, name)));
      controls.push(h("label", { class: "field" }, h("span", null, label), sel));
    } else if (id === "era") {
      const sel = h("select", {
        "data-field": "era",
        onChange: () => { f.era = sel.value === "seireki" ? "seireki" : "wareki"; changed(true); },
      },
      h("option", { value: "wareki", selected: f.era === "wareki" }, t(`${S}.eraWareki`)),
      h("option", { value: "seireki", selected: f.era === "seireki" }, t(`${S}.eraSeireki`)));
      controls.push(h("label", { class: "field" }, h("span", null, label), sel));
    } else if (id === "vertical" || id === "thanks" || id === "handover") {
      const box = h("input", { type: "checkbox", "data-field": id, checked: f[id], onChange: () => { f[id] = box.checked; changed(true); } });
      controls.push(h("label", { class: "check" }, box, h("span", null, label)));
    } else if ((DATE_FIELDS as readonly string[]).includes(id)) {
      const key = id as (typeof DATE_FIELDS)[number];
      const input = h("input", { type: "date", value: f[key], "data-field": id, onInput: () => { f[key] = input.value; changed(); }, onChange: () => { f[key] = input.value; changed(); } });
      const kids: HTMLElement[] = [input];
      if (id === "date") {
        kids.push(h("button", {
          type: "button",
          class: "btn ghost",
          "data-action": "today",
          onClick: () => { input.value = todayIso(); f.date = input.value; changed(true); },
        }, t(`${S}.today`)));
      }
      controls.push(h("label", { class: "field" }, h("span", null, label), id === "date" ? h("span", { class: "rl-date" }, ...kids) : input));
    } else if ((TEXT_FIELDS as readonly string[]).includes(id)) {
      const key = id as (typeof TEXT_FIELDS)[number];
      const input = h("input", { type: "text", value: f[key], "data-field": id, autocomplete: "off", maxlength: "120", onInput: () => { f[key] = input.value; changed(); } });
      controls.push(h("label", { class: "field" }, h("span", null, label), input));
    }
  }

  const bodyArea = h("textarea", {
    class: "average-input",
    rows: "10",
    "data-field": "body",
    "aria-label": t(`${S}.body`),
    hidden: !f.custom,
    onInput: () => { f.body = bodyArea.value; changed(); },
  });
  bodyArea.value = f.body;
  const customBox = h("input", {
    type: "checkbox",
    "data-field": "custom",
    checked: f.custom,
    onChange: () => {
      f.custom = customBox.checked;
      // Start from the letter as it reads now, so switching keeps the wording.
      if (f.custom && !f.body.trim()) f.body = template.build({ ...f, custom: false }).body;
      bodyArea.value = f.body;
      bodyArea.hidden = !f.custom;
      changed(true);
    },
  });
  const resetBtn = h("button", {
    type: "button",
    class: "btn ghost",
    "data-action": "reset-body",
    onClick: () => { f.body = template.build({ ...f, custom: false }).body; bodyArea.value = f.body; changed(true); },
  }, t(`${S}.resetBody`));

  const paperSel = h("select", {
    "data-field": "paper",
    onChange: () => { paper = paperSel.value === "letter" ? "letter" : "a4"; changed(true); },
  },
  h("option", { value: "a4", selected: paper === "a4" }, t(`${S}.paperA4`)),
  h("option", { value: "letter", selected: paper === "letter" }, t(`${S}.paperLetter`)));

  page = sheet(paper);
  const notice = h("p", { class: "hint", "data-out": "notice" });
  const copyBtn: HTMLButtonElement = h("button", {
    type: "button",
    class: "btn ghost",
    "data-action": "copy",
    onClick: () => { flush(); void copyWithFlash(copyBtn, doc ? letterText(doc) : "", { done: t(`${S}.copied`), failed: t(`${S}.copyFailed`) }); },
  }, t(`${S}.copy`));

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`)),
    ),
    h("div", { class: "tool rl-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null, h("legend", null, t(`${S}.form`)), ...controls),
        h("fieldset", null,
          h("legend", null, t(`${S}.body`)),
          h("label", { class: "check" }, customBox, h("span", null, t(`${S}.editText`))),
          bodyArea,
          h("p", { class: "hint" }, t(`${S}.editHint`)),
          resetBtn,
        ),
        h("label", { class: "field" }, h("span", null, t(`${S}.paper`)), paperSel),
      ),
      h("section", { class: "stage" },
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "print", onClick: () => { flush(); if (page) printSheet(page, paper, stem()); } }, t(`${S}.print`)),
          h("button", { type: "button", class: "btn ghost", "data-action": "docx", onClick: () => downloadDocx() }, t(`${S}.docx`)),
          copyBtn,
        ),
        notice,
        h("div", { class: "doc-wrap" }, page),
      ),
    ),
  );
  paint();

  function stem(): string {
    return docFilename(template.fileStem(f), "x", "resignation-letter").slice(0, -2);
  }

  function downloadDocx(): void {
    flush();
    if (!doc) return;
    const bytes = letterDocx(doc, paper);
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    downloadBlob(new Blob([copy], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `${stem()}.docx`);
  }

  function flush(): void {
    if (paintTimer) {
      window.clearTimeout(paintTimer);
      paint();
    }
  }

  function paint(): void {
    paintTimer = 0;
    if (!mounted || !page) return;
    resetBtn.hidden = !f.custom;
    doc = buildLetter(template, f);
    page.className = `doc-page doc-${paper}`;
    paintLetter(page, doc);
    notice.replaceChildren(...noticeLines(f, loc).map((line) => h("span", { class: "rl-notice" }, line)));
    notice.hidden = notice.childElementCount === 0;
  }
}

/** How much notice the dates give, and for Taiwan what the Labor Standards Act asks for. */
function noticeLines(f: RlForm, loc: string): string[] {
  const out: string[] = [];
  const days = daysBetween(f.date, f.lastDay);
  if (days !== null && days >= 0) out.push(t(`${S}.noticeDays`, { n: days }));
  if (loc === "zh-TW") {
    const months = serviceMonths(f.startDate, f.date);
    if (months !== null && months >= 0) {
      const need = taiwanNoticeDays(months);
      out.push(need === null
        ? t(`${S}.noticeShort`, { months })
        : t(`${S}.noticeLaw`, { months, days: need }));
    }
  }
  return out;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function unmountResignationLetter(): void {
  mounted = false;
  window.clearTimeout(paintTimer);
  // A pending draft save still runs: it holds what was typed just before leaving.
  form = null;
  tpl = null;
  page = null;
  doc = null;
}
