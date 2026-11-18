import { h } from "../dom";
import { locale, t } from "../i18n";
import { copyRich, copyWithFlash } from "../copy";
import {
  SOURCE_TYPES, STYLES, editionNumber, normDate, numberLabel, emptyWork, type Person, formatInText, formatReference, html, isComplete, parseImport, parsePeople,
  personToText, plainText, sortedEntries, toBibtex, toRis, type SourceType, type Style, type Work,
} from "../../shared/citation";

const S = "cite";
const STORE = "cvcm.citations.v1";
/** Most references a list keeps (a long thesis bibliography fits). */
const MAX_LIST = 500;

/** The example the page opens with (rule 8: fixed, so the prerendered page shows a formatted reference). */
const EXAMPLE: Work = {
  ...emptyWork("article"),
  authors: [{ family: "LeCun", given: "Yann" }, { family: "Bengio", given: "Yoshua" }, { family: "Hinton", given: "Geoffrey" }],
  title: "Deep learning", container: "Nature", year: "2015", month: 5, day: 27, volume: "521", issue: "7553", pages: "436–444",
  doi: "10.1038/nature14539",
};

/** Fields shown per source type (title, authors and year are always shown). */
const FIELDS: Record<SourceType, readonly (keyof Work)[]> = {
  article: ["container", "month", "day", "volume", "issue", "pages", "doi", "url"],
  book: ["edited", "edition", "publisher", "place", "doi", "url"],
  chapter: ["editors", "container", "pages", "edition", "publisher", "place", "doi", "url"],
  webpage: ["container", "month", "day", "doi", "url", "accessed"],
};

/** One saved person, or null when the stored value is not a person (an old or damaged save). */
function storedPerson(p: unknown): Person | null {
  if (typeof p !== "object" || p === null) return null;
  const o = p as Record<string, unknown>;
  if (typeof o.literal === "string") return { literal: o.literal };
  if (typeof o.family !== "string" || typeof o.given !== "string") return null;
  return typeof o.suffix === "string" && o.suffix ? { family: o.family, given: o.given, suffix: o.suffix } : { family: o.family, given: o.given };
}

/**
 * The saved list, keeping only well-formed entries (a damaged save must never stop the page from mounting), or null
 * when storage cannot be read at all (private modes and blocked site data throw).
 */
function readList(): Work[] | null {
  let text: string | null;
  try {
    text = window.localStorage.getItem(STORE);
  } catch {
    return null;
  }
  try {
    const raw: unknown = JSON.parse(text ?? "[]");
    if (!Array.isArray(raw)) return [];
    const out: Work[] = [];
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const o = item as Record<string, unknown>;
      if (typeof o.title !== "string" || !(SOURCE_TYPES as readonly unknown[]).includes(o.type)) continue;
      const w = emptyWork(o.type as SourceType);
      for (const key of Object.keys(w) as (keyof Work)[]) {
        const v = o[key];
        if (key === "authors" || key === "editors") w[key] = Array.isArray(v) ? v.map(storedPerson).filter((p): p is Person => p !== null) : [];
        else if (key === "month" || key === "day") w[key] = typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 31 ? v : 0;
        else if (key === "edited") w.edited = v === true;
        else if (key !== "type" && typeof v === "string") (w as Record<string, unknown>)[key] = v;
      }
      if (w.month > 12) w.month = 0;
      out.push(w);
      if (out.length >= MAX_LIST) break;
    }
    return out;
  } catch {
    return [];
  }
}


/** Whether the last save failed (quota full): the list in memory then has changes storage does not. */
let unsaved = false;

function saveList(list: Work[]): void {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(list));
    unsaved = false;
  } catch {
    // Private mode or full storage: the list keeps working in memory for this visit.
    unsaved = true;
  }
}

let lookupSeq = 0;
let onStorage: ((e: StorageEvent) => void) | null = null;

/** Keys of Work the form shows only for some source types. */
const OPTIONAL: readonly (keyof Work)[] = ["editors", "container", "month", "day", "volume", "issue", "pages", "edition", "publisher", "place", "doi", "url", "accessed", "edited"];

/** A source with the fields its type does not show emptied, so what is formatted (and compared) is what the form shows. */
function visible(w: Work): Work {
  const out = { ...w };
  const blank = emptyWork(w.type);
  for (const key of OPTIONAL) if (!FIELDS[w.type].includes(key)) (out as Record<string, unknown>)[key] = blank[key];
  return out;
}

const keyOf = (w: Work) => JSON.stringify(visible(w));
const sameWork = (a: Work, b: Work) => keyOf(a) === keyOf(b);

/** `variant` names the page (the general generator or one style's landing page); it picks the heading. */
export function mountCitation(host: HTMLElement, defaultStyle: Style = "apa", variant: "main" | "apa" | "mla" | "harvard" = "main"): void {
  let list = readList() ?? [];
  let listKeys: string[] = [];
  /** What a change starts from: storage (so another tab's additions survive), or the list in memory when storage is
   * blocked or the last save failed. */
  const base = () => (unsaved ? list : readList() ?? list);
  const change = (fn: (current: Work[]) => Work[], start: Work[] = base()) => {
    list = fn(start).slice(0, MAX_LIST);
    saveList(list);
    renderList();
  };
  // Another tab changed the list: show its version.
  if (onStorage) window.removeEventListener("storage", onStorage);
  onStorage = (e) => {
    // Entries this tab could not save live only in memory: keep them rather than take the other tab's list.
    if (e.key !== STORE || !host.isConnected || unsaved) return;
    list = readList() ?? [];
    renderList();
  };
  window.addEventListener("storage", onStorage);
  const labels = { done: t(`${S}.copied`), failed: t(`${S}.copyFailed`) };

  // ---- source form ----
  const text = (name: string, value = "", attrs: Record<string, string> = {}) =>
    h("input", { type: "text", autocomplete: "off", spellcheck: "false", "data-field": name, value, onInput: paint, ...attrs });
  const typeSel = h("select", { "data-field": "type", onChange: () => { sync(); paint(); } },
    ...SOURCE_TYPES.map((x) => h("option", { value: x }, t(`${S}.type_${x}`))));
  const authorsEl = h("textarea", { rows: "3", "data-field": "authors", spellcheck: "false", onInput: paint });
  const editorsEl = h("textarea", { rows: "2", "data-field": "editors", spellcheck: "false", onInput: paint });
  const titleEl = text("title");
  const containerEl = text("container");
  const yearEl = text("year", "", { inputmode: "numeric", maxlength: "9" });
  const monthFmt = new Intl.DateTimeFormat(locale(), { month: "long", timeZone: "UTC" });
  const monthNames = Array.from({ length: 12 }, (_, i) => monthFmt.format(Date.UTC(2020, i, 1)));
  const monthSel = h("select", { "data-field": "month", onChange: paint }, h("option", { value: "0" }, "—"), ...monthNames.map((m, i) => h("option", { value: String(i + 1) }, m)));
  const dayEl = text("day", "", { inputmode: "numeric", maxlength: "2" });
  const volumeEl = text("volume");
  const issueEl = text("issue");
  const pagesEl = text("pages", "", { placeholder: "12–34" });
  const editionEl = text("edition", "", { inputmode: "numeric", maxlength: "3" });
  const publisherEl = text("publisher");
  const placeEl = text("place");
  const doiEl = text("doi", "", { placeholder: "10.1000/xyz123" });
  const urlEl = text("url", "", { inputmode: "url", placeholder: "https://" });
  const accessedEl = h("input", { type: "date", "data-field": "accessed", onInput: paint, onChange: paint });
  const editedEl = h("input", { type: "checkbox", "data-field": "edited", onChange: paint });

  const fieldOf = (key: string, label: string, ...control: HTMLElement[]) => h("label", { class: "field", "data-for": key }, h("span", null, label), ...control);
  const containerLabel = h("span", null, "");
  const fields: Partial<Record<keyof Work, HTMLElement>> = {
    editors: fieldOf("editors", t(`${S}.editors`), editorsEl),
    container: h("label", { class: "field", "data-for": "container" }, containerLabel, containerEl),
    month: fieldOf("month", t(`${S}.month`), monthSel),
    day: fieldOf("day", t(`${S}.day`), dayEl),
    volume: fieldOf("volume", t(`${S}.volume`), volumeEl),
    issue: fieldOf("issue", t(`${S}.issue`), issueEl),
    pages: fieldOf("pages", t(`${S}.pages`), pagesEl),
    edition: fieldOf("edition", t(`${S}.edition`), editionEl),
    publisher: fieldOf("publisher", t(`${S}.publisher`), publisherEl),
    place: fieldOf("place", t(`${S}.place`), placeEl),
    doi: fieldOf("doi", "DOI", doiEl),
    url: fieldOf("url", "URL", urlEl),
    accessed: fieldOf("accessed", t(`${S}.accessed`), accessedEl),
    edited: h("label", { class: "field ac-check", "data-for": "edited" }, editedEl, h("span", null, t(`${S}.edited`))),
  };

  function sync(): void {
    const type = typeSel.value as SourceType;
    for (const [key, el] of Object.entries(fields)) el!.hidden = !FIELDS[type].includes(key as keyof Work);
    containerLabel.textContent = t(`${S}.container_${type}`);
  }

  /** The form as a Work. Fields hidden for the source type are left empty: a DOI or date typed for an article must not
   * leak into a web page's reference after the type changes. */
  function read(): Work {
    const day = Number(dayEl.value);
    const w: Work = {
      type: typeSel.value as SourceType,
      authors: parsePeople(authorsEl.value),
      editors: parsePeople(editorsEl.value),
      title: titleEl.value.trim(),
      container: containerEl.value.trim(),
      year: yearEl.value.trim(),
      month: Number(monthSel.value) || 0,
      day: Number.isInteger(day) && day >= 1 && day <= 31 ? day : 0,
      volume: volumeEl.value.trim(),
      issue: issueEl.value.trim(),
      pages: pagesEl.value.trim(),
      edition: editionNumber(editionEl.value),
      publisher: publisherEl.value.trim(),
      place: placeEl.value.trim(),
      doi: doiEl.value.trim(),
      url: urlEl.value.trim(),
      accessed: accessedEl.value,
      edited: editedEl.checked,
    };
    return visible(w);
  }

  function fill(w: Work): void {
    typeSel.value = w.type;
    authorsEl.value = w.authors.map(personToText).join("\n");
    editorsEl.value = w.editors.map(personToText).join("\n");
    titleEl.value = w.title;
    containerEl.value = w.container;
    yearEl.value = w.year;
    monthSel.value = String(w.month || 0);
    dayEl.value = w.day ? String(w.day) : "";
    volumeEl.value = w.volume;
    issueEl.value = w.issue;
    pagesEl.value = w.pages;
    editionEl.value = w.edition;
    publisherEl.value = w.publisher;
    placeEl.value = w.place;
    doiEl.value = w.doi;
    urlEl.value = w.url;
    accessedEl.value = normDate(w.accessed);
    editedEl.checked = w.edited;
    sync();
    paint();
  }

  // ---- lookup and import ----
  const lookupEl = h("input", { type: "text", autocomplete: "off", spellcheck: "false", "data-field": "lookup", placeholder: t(`${S}.lookupPlaceholder`), "aria-label": t(`${S}.lookupLabel`) });
  const lookupStatus = h("p", { class: "hint", "data-out": "lookup-status", "aria-live": "polite" });
  const findBtn: HTMLButtonElement = h("button", { type: "button", class: "btn", "data-action": "find", onClick: () => void find() }, t(`${S}.find`));
  // Enter that commits an IME composition (ja/zh/ko input) is not a Find.
  // A lookup already running (Find disabled) is not started again by more Enters.
  lookupEl.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); if (!findBtn.disabled) void find(); } });

  async function find(): Promise<void> {
    const seq = ++lookupSeq;
    findBtn.disabled = true;
    lookupStatus.textContent = t(`${S}.searching`);
    // Loaded on demand: the page itself makes no request until Find is pressed. A chunk that fails to load (a stale
    // tab after a deploy, a dropped connection) reads as a network failure and leaves Find usable.
    let r: import("./lookup").LookupResult;
    try {
      const { lookup } = await import("./lookup");
      r = await lookup(lookupEl.value);
    } catch {
      r = { ok: false, reason: "network" };
    }
    if (seq !== lookupSeq || !host.isConnected) return;
    findBtn.disabled = false;
    if (!r.ok) {
      lookupStatus.textContent = t(`${S}.lookup_${r.reason}`);
      return;
    }
    fill(r.work);
    lookupStatus.textContent = t(`${S}.found`);
  }

  const importEl = h("textarea", { rows: "4", class: "ac-matrix", "data-field": "import", spellcheck: "false", placeholder: "@article{key, author = {…}, title = {…}, …}", "aria-label": t(`${S}.importLabel`) });
  const importStatus = h("p", { class: "hint", "data-out": "import-status", "aria-live": "polite" });
  const importBtn = h("button", { type: "button", class: "btn ghost", "data-action": "import", onClick: () => {
    const works = parseImport(importEl.value).filter(isComplete);
    if (!works.length) { importStatus.textContent = t(`${S}.importNone`); return; }
    fill(works[0]!);
    // More than one entry: all of them go to the list, the first also into the form; a full list says what it left out.
    if (works.length === 1) {
      importStatus.textContent = t(`${S}.imported`, { n: 1 });
    } else {
      const start = base();
      const room = Math.max(0, MAX_LIST - start.length);
      const added = Math.min(room, works.length);
      if (added) change((current) => [...current, ...works.slice(0, added).map(visible)], start);
      const full = works.length - added ? t(`${S}.listFull`, { max: MAX_LIST, n: works.length - added }) : "";
      importStatus.textContent = added ? [t(`${S}.imported`, { n: added }), full].filter(Boolean).join(" ") : full;
    }
    importEl.value = "";
  } }, t(`${S}.import`));

  // ---- result ----
  // renderList repaints the reference too.
  const styleSel = h("select", { "data-field": "style", onChange: () => renderList() },
    ...STYLES.map((x) => h("option", { value: x, selected: x === defaultStyle }, t(`${S}.style_${x}`))));
  const refEl = h("p", { class: "cite-ref", "data-out": "reference" });
  const inTextEl = h("p", { class: "si-formula", "data-out": "intext" });
  const note = h("p", { class: "hint", "data-out": "note" });
  const copyBtn: HTMLButtonElement = h("button", { type: "button", class: "btn", "data-action": "copy", onClick: () => {
    const w = read();
    const segs = formatReference(w, styleSel.value as Style);
    void copyRich(copyBtn, html(segs), plainText(segs), labels);
  } }, t(`${S}.copy`));
  const addBtn: HTMLButtonElement = h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: () => {
    const start = base();
    if (start.length >= MAX_LIST) { note.textContent = t(`${S}.listFull`, { max: MAX_LIST, n: 1 }); return; }
    change((current) => [...current, read()], start);
  } }, t(`${S}.add`));

  function paint(): void {
    const w = read();
    const style = styleSel.value as Style;
    const ok = isComplete(w);
    copyBtn.disabled = addBtn.disabled = !ok;
    if (!ok) {
      refEl.replaceChildren(h("span", { class: "muted" }, t(`${S}.needTitle_${w.type === "article" || w.type === "chapter" ? "container" : "title"}`)));
      inTextEl.textContent = "";
      note.textContent = "";
      return;
    }
    refEl.innerHTML = html(formatReference(w, style));
    // A source already in the list keeps its own number ([n] in citation order); a new one would be next.
    // Keys of the list are computed when it changes, not on every keystroke.
    const key = keyOf(w);
    const at = listKeys.indexOf(key);
    const pos = at >= 0 ? at + 1 : list.length + 1;
    // A source already in the list (for example the first of an import) cannot be added twice.
    addBtn.disabled = at >= 0;
    inTextEl.textContent = `${t(style === "chicago" ? `${S}.note` : `${S}.inText`)} ${plainText(formatInText(w, style, pos))}`;
    // Title case is the writer's job in APA and Vancouver (sentence case) vs MLA, Chicago (title case).
    // Sentence case for article and book titles: APA, Harvard, IEEE, Vancouver. Title case: MLA, Chicago.
    note.textContent = style === "gbt" ? "" : t(style === "mla" || style === "chicago" ? `${S}.caseTitle` : `${S}.caseSentence`);
  }

  // ---- list ----
  const listEl = h("ol", { class: "cite-list", "data-out": "list" });
  const listHead = h("h3", null, "");
  const listActions = h("div", { class: "stage-actions" });
  const copyListBtn: HTMLButtonElement = h("button", { type: "button", class: "btn", "data-action": "copy-list", onClick: () => {
    const style = styleSel.value as Style;
    // Numbered styles carry their numbers into the copied list: [1] for IEEE and GB/T 7714, "1." for Vancouver.
    const lines = sortedEntries(list, style).map(({ segs }, i) => ({ h: html(segs), p: plainText(segs), n: numberLabel(style, i) }));
    void copyRich(copyListBtn, lines.map((l) => `<p>${l.n}${l.h}</p>`).join(""), lines.map((l) => l.n + l.p).join("\n"), labels);
  } }, t(`${S}.copyList`));
  const bibBtn: HTMLButtonElement = h("button", { type: "button", class: "btn ghost", "data-action": "copy-bibtex", onClick: () => void copyWithFlash(bibBtn, toBibtex(list), labels) }, t(`${S}.copyBibtex`));
  const risBtn: HTMLButtonElement = h("button", { type: "button", class: "btn ghost", "data-action": "copy-ris", onClick: () => void copyWithFlash(risBtn, toRis(list), labels) }, t(`${S}.copyRis`));
  let clearArmed = false;
  const clearBtn: HTMLButtonElement = h("button", { type: "button", class: "btn ghost", "data-action": "clear-list", onClick: () => {
    // Two taps, no confirm() dialog: the first arms, the second clears.
    if (!clearArmed) { clearArmed = true; clearBtn.textContent = t(`${S}.clearConfirm`); return; }
    change(() => []);
  } }, t(`${S}.clearList`));
  listActions.append(copyListBtn, bibBtn, risBtn, clearBtn);

  function renderList(): void {
    listKeys = list.map(keyOf);
    const style = styleSel.value as Style;
    clearArmed = false;
    clearBtn.textContent = t(`${S}.clearList`);
    listHead.textContent = t(`${S}.listTitle`, { n: list.length });
    listActions.hidden = list.length === 0;
    listEl.replaceChildren();
    // The numbered in-text citation ([n]) follows the list length: repaint whenever the list changes.
    paint();
    if (!list.length) {
      listEl.append(h("li", { class: "muted cite-empty" }, t(`${S}.listEmpty`)));
      return;
    }
    // Numbered styles show their own labels as text ([1] or 1.); the list itself has no markers.
    for (const [i, { w, segs }] of sortedEntries(list, style).entries()) {
      const ref = h("span", { class: "cite-ref" });
      ref.innerHTML = html(segs);
      listEl.append(h("li", null, numberLabel(style, i), ref, " ",
        h("button", { type: "button", class: "btn ghost cite-remove", "data-action": "remove", "aria-label": t(`${S}.remove`), onClick: () => {
          // By content, not identity: the list may have been reloaded from storage since it was drawn.
          change((current) => { const i = current.findIndex((x) => sameWork(x, w)); return i < 0 ? current : [...current.slice(0, i), ...current.slice(i + 1)]; });
        } }, "×")));
    }
  }

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title_${variant}`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`)),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t(`${S}.lookupTitle`)),
          h("div", { class: "cite-find" }, lookupEl, findBtn),
          lookupStatus,
          h("p", { class: "hint" }, t(`${S}.lookupPrivacy`)),
        ),
        h("fieldset", null,
          h("legend", null, t(`${S}.detailsTitle`)),
          fieldOf("type", t(`${S}.type`), typeSel),
          fieldOf("authors", t(`${S}.authors`), authorsEl),
          h("p", { class: "hint" }, t(`${S}.authorsHint`)),
          fieldOf("title", t(`${S}.titleField`), titleEl),
          fields.container!,
          fields.editors!,
          fieldOf("year", t(`${S}.year`), yearEl),
          fields.month!, fields.day!, fields.volume!, fields.issue!, fields.pages!, fields.edition!,
          fields.edited!, fields.publisher!, fields.place!, fields.doi!, fields.url!, fields.accessed!,
        ),
        h("details", { class: "cite-import" },
          h("summary", null, t(`${S}.importTitle`)),
          importEl,
          h("div", { class: "stage-actions" }, importBtn),
          importStatus,
        ),
      ),
      h("div", { class: "rail" },
        fieldOf("style", t(`${S}.style`), styleSel),
        h("h2", null, t(`${S}.result`)),
        refEl,
        inTextEl,
        note,
        h("div", { class: "stage-actions" }, copyBtn, addBtn),
        listHead,
        listEl,
        listActions,
      ),
    ),
  );
  fill(EXAMPLE);
  renderList();
}

export function unmountCitation(): void {
  if (onStorage) window.removeEventListener("storage", onStorage);
  onStorage = null;
  // A lookup still in flight is ignored when it returns.
  lookupSeq++;
}
