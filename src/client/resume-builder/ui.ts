/**
 * Résumé builder: a form on the left, the paper on the right. One model (src/shared/resume.ts) drives every layout;
 * the page opens with the language's example (deterministic, so the prerender shows a whole résumé), or with this
 * browser's draft. The draft is saved to localStorage only after an edit, never at mount.
 */
import { decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { defaultPaper, printSheet, sheet } from "../doc-sheet";
import { appHref } from "../../shared/path";
import { docFilename, type Paper } from "../../shared/letter-doc";
import {
  MAX_ENTRIES,
  emptyCert,
  emptyEducation,
  emptyExperience,
  emptyResume,
  formatsFor,
  normalizeDate,
  normalizeYm,
  parseResume,
  type Resume,
  type ResumeFormat,
} from "../../shared/resume";
import { sampleResume } from "../../shared/resume-samples";
import { docLangOf, renderResume } from "./render";
import { cropPanel } from "./photo";

const S = "resumeBuilder";
export const STORE = "cvcm.resume-builder.v1";
/** Largest JSON file Open accepts (a draft with a photo is well under 1 MB). */
const MAX_FILE = 2 * 1024 * 1024;

let r: Resume = emptyResume("ats");
let paper: Paper = "a4";
let formEl: HTMLElement | null = null;
let page: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let paintTimer = 0;
let saveTimer = 0;
let dirty = false;
let clearArmed = 0;
/** The open photo crop panel (one at a time); it survives buildForm, which re-attaches it to the new photo field. */
let crop: { el: HTMLElement; close: () => void } | null = null;
let photoSeq = 0;

type Show = Partial<Record<ResumeFormat, true>>;
const shows = (show: Show) => Boolean(show[r.format]);
/** Which fields each layout prints (a field the layout ignores is hidden, so nothing typed goes missing unseen). */
const FIELDS = {
  kana: { rirekisho: true },
  title: { ats: true, photo: true, kr: true },
  birth: { photo: true, rirekisho: true, kr: true },
  gender: { rirekisho: true },
  asOf: { rirekisho: true, shokumu: true, kr: true },
  photo: { photo: true, rirekisho: true, kr: true },
  links: { ats: true, photo: true },
  era: { rirekisho: true, shokumu: true },
  summary: { ats: true, photo: true, shokumu: true, kr: true },
  skills: { ats: true, photo: true, shokumu: true, kr: true },
  extra: { ats: true, photo: true, kr: true },
  motivation: { rirekisho: true, shokumu: true },
  wishes: { rirekisho: true },
  place: { ats: true, photo: true },
  eduDetails: { ats: true, photo: true, kr: true },
} satisfies Record<string, Show>;

function readDraft(): { r: Resume; paper: Paper } | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const data = JSON.parse(raw) as { r?: unknown; paper?: unknown };
    const parsed = parseResume(data.r);
    if (!parsed) return null;
    return { r: parsed, paper: data.paper === "letter" ? "letter" : "a4" };
  } catch {
    return null;
  }
}

function saveNow(): void {
  window.clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  try {
    localStorage.setItem(STORE, JSON.stringify({ r, paper }));
  } catch {
    setStatus(t(`${S}.saveFailed`));
  }
}

/** After every edit: repaint the paper soon, save the draft a little later. */
function changed(): void {
  dirty = true;
  window.clearTimeout(paintTimer);
  paintTimer = window.setTimeout(paint, 120);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 600);
}

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

function paint(): void {
  window.clearTimeout(paintTimer);
  if (!page) return;
  const loc = locale();
  page.className = `doc-page doc-${paper} rs-sheet`;
  page.lang = docLangOf(r, loc);
  page.replaceChildren(renderResume(r, loc));
}

const field = (label: string, control: HTMLElement, cls = "") =>
  h("label", { class: `field${cls ? ` ${cls}` : ""}` }, h("span", null, label), control);

function input(name: string, value: string, set: (v: string) => void, opts: { normalize?: (v: string) => string; placeholder?: string; type?: string } = {}): HTMLInputElement {
  const el: HTMLInputElement = h("input", {
    type: opts.type ?? "text", value, "data-field": name, autocomplete: "off", placeholder: opts.placeholder ?? null,
    onInput: () => { set(el.value); changed(); },
    onChange: () => {
      if (!opts.normalize) return;
      const v = opts.normalize(el.value);
      if (v !== el.value) { el.value = v; set(v); changed(); }
    },
  });
  return el;
}

function area(name: string, value: string, set: (v: string) => void, rows = 4, placeholder = ""): HTMLTextAreaElement {
  const el: HTMLTextAreaElement = h("textarea", { rows: String(rows), "data-field": name, placeholder: placeholder || null, onInput: () => { set(el.value); changed(); } });
  el.value = value;
  return el;
}

const ym = (name: string, value: string, set: (v: string) => void) =>
  input(name, value, set, { normalize: normalizeYm, placeholder: t(`${S}.ymHint`) });

/** Move / remove buttons of one repeatable entry. */
function entryTools<T>(arr: T[], i: number): HTMLElement {
  const btn = (action: string, label: string, disabled: boolean, run: () => void) =>
    h("button", { type: "button", class: "btn ghost rs-mini", "data-action": action, disabled, onClick: () => { run(); changed(); buildForm(); } }, label);
  return h("div", { class: "rs-entry-tools" },
    btn("up", t(`${S}.up`), i === 0, () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }),
    btn("down", t(`${S}.down`), i === arr.length - 1, () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; }),
    btn("remove", t(`${S}.remove`), false, () => { arr.splice(i, 1); }));
}

function addButton<T>(action: string, arr: T[], make: () => T): HTMLButtonElement {
  return h("button", {
    type: "button", class: "btn ghost", "data-action": action, disabled: arr.length >= MAX_ENTRIES,
    onClick: () => {
      arr.push(make());
      changed();
      buildForm();
      formEl?.querySelector<HTMLElement>(`[data-list="${action}"] fieldset:last-of-type input`)?.focus();
    },
  }, t(`${S}.add`));
}

function photoField(): HTMLElement {
  const wrap = h("div", { class: "field rs-photo-field" });
  const fileInput: HTMLInputElement = h("input", {
    type: "file", accept: "image/*", class: "sr-only", id: "rs-photo-input", "data-field": "photoFile",
    onChange: () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (file) void openPhoto(file);
    },
  });
  const idLink = h("a", { href: appHref(locale(), "id-photo") }, t(`${S}.photoIdLink`));
  // A crop in progress moves into the rebuilt field instead of being dropped with the old one.
  if (crop) queueMicrotask(() => { if (crop) wrap.append(crop.el); });
  wrap.append(...[
    h("span", null, t(`${S}.photo`)),
    r.basics.photo ? h("img", { class: "rs-photo-thumb", src: r.basics.photo, alt: "" }) : null,
    h("div", { class: "stage-actions" },
      h("label", { class: "btn ghost", for: "rs-photo-input" }, t(`${S}.photoPick`)),
      r.basics.photo ? h("button", { type: "button", class: "btn ghost", "data-action": "photo-remove", onClick: () => { r.basics.photo = ""; changed(); buildForm(); } }, t(`${S}.photoRemove`)) : null,
      fileInput),
    h("p", { class: "hint" }, t(`${S}.photoHint`), " ", idLink),
  ].filter((x): x is HTMLElement => x !== null));
  return wrap;
}

async function openPhoto(file: File): Promise<void> {
  const seq = ++photoSeq;
  crop?.close();
  let decoded: Awaited<ReturnType<typeof decodeImage>>;
  try {
    decoded = await decodeImage(file);
  } catch {
    if (seq === photoSeq) setStatus(t(`${S}.photoFailed`));
    return;
  }
  // A newer photo was picked, or the page was left, while this one decoded.
  if (seq !== photoSeq || !formEl) {
    decoded.bitmap.close();
    return;
  }
  const close = () => {
    decoded.bitmap.close();
    panel.remove();
    if (crop?.el === panel) crop = null;
  };
  const panel = cropPanel(decoded.bitmap, {
    zoom: t(`${S}.photoZoom`), use: t(`${S}.photoUse`), cancel: t(`${S}.photoCancel`), hint: t(`${S}.photoCropHint`),
  }, (url) => { r.basics.photo = url; close(); changed(); buildForm(); }, close);
  crop = { el: panel, close };
  formEl.querySelector(".rs-photo-field")?.append(panel);
}

function buildForm(): void {
  if (!formEl) return;
  const L = (k: string) => t(`${S}.${k}`);
  const b = r.basics;
  const loc = locale();
  const options = formatsFor(loc);
  if (!options.includes(r.format)) options.push(r.format);

  const formatSel: HTMLSelectElement = h("select", { "data-field": "format", onChange: () => { r.format = formatSel.value as ResumeFormat; changed(); buildForm(); } },
    ...options.map((f) => h("option", { value: f, selected: f === r.format }, L(`f_${f}`))));
  const paperSel: HTMLSelectElement = h("select", { "data-field": "paper", onChange: () => { paper = paperSel.value === "letter" ? "letter" : "a4"; changed(); } },
    h("option", { value: "a4", selected: paper === "a4" }, L("p_a4")),
    h("option", { value: "letter", selected: paper === "letter" }, L("p_letter")));
  const eraSel: HTMLSelectElement = h("select", { "data-field": "era", onChange: () => { r.era = eraSel.value === "wareki" ? "wareki" : "seireki"; changed(); } },
    h("option", { value: "seireki", selected: r.era === "seireki" }, L("e_seireki")),
    h("option", { value: "wareki", selected: r.era === "wareki" }, L("e_wareki")));

  const basics = h("fieldset", null, h("legend", null, L("sBasics")),
    field(L("name"), input("name", b.name, (v) => { b.name = v; })),
    shows(FIELDS.kana) ? field(L("kana"), input("kana", b.kana, (v) => { b.kana = v; })) : null,
    shows(FIELDS.title) ? field(L("jobTitle"), input("title", b.title, (v) => { b.title = v; })) : null,
    field(L("email"), input("email", b.email, (v) => { b.email = v; }, { type: "email" })),
    field(L("phone"), input("phone", b.phone, (v) => { b.phone = v; }, { type: "tel" })),
    field(L("address"), input("address", b.address, (v) => { b.address = v; })),
    shows(FIELDS.links) ? field(L("links"), area("links", b.links, (v) => { b.links = v; }, 2)) : null,
    shows(FIELDS.birth) ? field(L("birth"), input("birth", b.birth, (v) => { b.birth = v; }, { normalize: normalizeDate, placeholder: L("dateHint") })) : null,
    shows(FIELDS.gender) ? field(L("gender"), input("gender", b.gender, (v) => { b.gender = v; }, { placeholder: L("genderHint") })) : null,
    shows(FIELDS.asOf) ? field(L("asOf"), input("asOf", b.asOf, (v) => { b.asOf = v; }, { normalize: normalizeDate, placeholder: L("asOfHint") })) : null,
    shows(FIELDS.photo) ? photoField() : null,
  );

  const exp = h("div", { class: "rs-list", "data-list": "add-experience" }, ...r.experience.map((e, i) => {
    const end = ym("end", e.end, (v) => { e.end = v; });
    end.disabled = e.current;
    const cur: HTMLInputElement = h("input", { type: "checkbox", checked: e.current, "data-field": "current", onChange: () => { e.current = cur.checked; end.disabled = cur.checked; changed(); } });
    return h("fieldset", { class: "rs-entry-form" }, h("legend", null, `${L("sExperience")} ${i + 1}`),
      field(L("role"), input("role", e.role, (v) => { e.role = v; })),
      field(L("org"), input("org", e.org, (v) => { e.org = v; })),
      shows(FIELDS.place) ? field(L("place"), input("place", e.place, (v) => { e.place = v; })) : null,
      h("div", { class: "rs-pair" }, field(L("start"), ym("start", e.start, (v) => { e.start = v; })), field(L("end"), end)),
      h("label", { class: "check" }, cur, " ", L("current")),
      field(L("details"), area("details", e.details, (v) => { e.details = v; }, 4, L("detailsHint"))),
      entryTools(r.experience, i));
  }));

  const edu = h("div", { class: "rs-list", "data-list": "add-education" }, ...r.education.map((e, i) =>
    h("fieldset", { class: "rs-entry-form" }, h("legend", null, `${L("sEducation")} ${i + 1}`),
      field(L("school"), input("school", e.school, (v) => { e.school = v; })),
      field(L("degree"), input("degree", e.degree, (v) => { e.degree = v; })),
      shows(FIELDS.place) ? field(L("place"), input("place", e.place, (v) => { e.place = v; })) : null,
      h("div", { class: "rs-pair" }, field(L("start"), ym("start", e.start, (v) => { e.start = v; })), field(L("end"), ym("end", e.end, (v) => { e.end = v; }))),
      shows(FIELDS.eduDetails) ? field(L("eduDetails"), input("details", e.details, (v) => { e.details = v; })) : null,
      entryTools(r.education, i))));

  const certs = h("div", { class: "rs-list", "data-list": "add-cert" }, ...r.certs.map((c, i) =>
    h("fieldset", { class: "rs-entry-form" }, h("legend", null, `${L("sCerts")} ${i + 1}`),
      h("div", { class: "rs-pair" }, field(L("certDate"), ym("certDate", c.date, (v) => { c.date = v; })), field(L("certName"), input("certName", c.name, (v) => { c.name = v; }))),
      entryTools(r.certs, i))));

  formEl.replaceChildren(...[
    h("fieldset", null, h("legend", null, L("sLayout")),
      field(L("format"), formatSel),
      field(L("paper"), paperSel),
      shows(FIELDS.era) ? field(L("era"), eraSel) : null,
      h("p", { class: "hint" }, L(`fh_${r.format}`))),
    basics,
    shows(FIELDS.summary) ? h("fieldset", null, h("legend", null, L(r.format === "shokumu" ? "summaryShokumu" : "summary")), area("summary", r.summary, (v) => { r.summary = v; }, 4)) : null,
    h("fieldset", null, h("legend", null, L("sExperience")), exp, addButton("add-experience", r.experience, emptyExperience)),
    h("fieldset", null, h("legend", null, L("sEducation")), edu, addButton("add-education", r.education, emptyEducation)),
    shows(FIELDS.skills) ? h("fieldset", null, h("legend", null, L("sSkills")),
      field(L("skills"), area("skills", r.skills, (v) => { r.skills = v; }, 4, L("listHint"))),
      field(L("languages"), area("languages", r.languages, (v) => { r.languages = v; }, 2))) : null,
    h("fieldset", null, h("legend", null, L("sCerts")), certs, addButton("add-cert", r.certs, emptyCert)),
    shows(FIELDS.motivation) ? h("fieldset", null, h("legend", null, L(r.format === "shokumu" ? "selfPr" : "motivation")), area("motivation", r.motivation, (v) => { r.motivation = v; }, 5)) : null,
    shows(FIELDS.wishes) ? h("fieldset", null, h("legend", null, L("wishes")), area("wishes", r.wishes, (v) => { r.wishes = v; }, 2)) : null,
    shows(FIELDS.extra) ? h("fieldset", null, h("legend", null, L("extra")), area("extra", r.extra, (v) => { r.extra = v; }, 3)) : null,
  ].filter((x): x is HTMLFieldSetElement => x !== null));
}

function docTitle(): string {
  const kind = r.format === "rirekisho" ? "履歴書" : r.format === "shokumu" ? "職務経歴書" : r.format === "kr" ? "이력서" : t(`${S}.docName`);
  return r.basics.name.trim() ? `${r.basics.name.trim()} ${kind}` : kind;
}

function saveJson(): void {
  const name = docFilename(docTitle(), "json", "resume");
  downloadBlob(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }), name);
}

async function openJson(file: File): Promise<void> {
  if (file.size > MAX_FILE) { setStatus(t(`${S}.loadFailed`)); return; }
  try {
    const parsed = parseResume(JSON.parse(await file.text()));
    if (!parsed) throw new Error("shape");
    r = parsed;
    changed();
    buildForm();
    paint();
    setStatus(t(`${S}.loaded`));
  } catch {
    setStatus(t(`${S}.loadFailed`));
  }
}

function onPageHide(): void {
  saveNow();
}

export function mountResumeBuilder(host: HTMLElement): void {
  const loc = locale();
  const draft = readDraft();
  r = draft?.r ?? sampleResume(loc);
  paper = draft?.paper ?? defaultPaper(loc);
  dirty = false;
  formEl = h("div", { class: "rs-form" });
  page = sheet(paper, "rs-sheet");
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  const jsonInput: HTMLInputElement = h("input", {
    type: "file", accept: "application/json,.json", class: "sr-only", id: "rs-json-input", "data-field": "jsonFile",
    onChange: () => { const f = jsonInput.files?.[0]; jsonInput.value = ""; if (f) void openJson(f); },
  });
  const clearBtn: HTMLButtonElement = h("button", {
    type: "button", class: "btn ghost", "data-action": "clear",
    onClick: () => {
      // Two presses: the first arms the button for 4 s, so a stray click never wipes a résumé.
      if (!clearArmed) {
        clearBtn.textContent = t(`${S}.clearConfirm`);
        clearArmed = window.setTimeout(() => { clearArmed = 0; clearBtn.textContent = t(`${S}.clear`); }, 4000);
        return;
      }
      window.clearTimeout(clearArmed);
      clearArmed = 0;
      clearBtn.textContent = t(`${S}.clear`);
      r = emptyResume(r.format);
      changed(); buildForm(); paint();
    },
  }, t(`${S}.clear`));
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`))),
    h("div", { class: "tool rs-tool" },
      h("aside", { class: "rail controls" }, formEl),
      h("section", { class: "stage" },
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", "data-action": "print", onClick: () => { saveNow(); paint(); printSheet(page!, paper, docTitle()); } }, t(`${S}.print`)),
          h("button", { type: "button", class: "btn ghost", "data-action": "save-json", onClick: saveJson }, t(`${S}.saveJson`)),
          h("label", { class: "btn ghost", for: "rs-json-input" }, t(`${S}.openJson`)),
          jsonInput,
          h("button", { type: "button", class: "btn ghost", "data-action": "example", onClick: () => { const f = r.format; r = sampleResume(loc); if (formatsFor(loc).includes(f)) r.format = f; changed(); buildForm(); paint(); } }, t(`${S}.example`)),
          clearBtn),
        h("p", { class: "hint" }, t(`${S}.printHint`)),
        statusEl,
        h("div", { class: "doc-wrap" }, page))),
  );
  buildForm();
  paint();
  window.addEventListener("pagehide", onPageHide);
}

export function unmountResumeBuilder(): void {
  photoSeq++;
  crop?.close();
  window.removeEventListener("pagehide", onPageHide);
  window.clearTimeout(paintTimer);
  if (clearArmed) window.clearTimeout(clearArmed);
  clearArmed = 0;
  saveNow();
  formEl = null;
  page = null;
  statusEl = null;
}

