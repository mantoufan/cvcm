import { h } from "./dom";
import { locale, t, type Locale } from "./i18n";
import {
  isRecordableQuery,
  isValidEmail,
  normalizeQuery,
  searchEntries,
  SEARCH_CHANNEL_LABEL,
  SEARCH_QUERY_MAX,
  type SearchEntry,
} from "../shared/search";

/**
 * The header search panel. The index is one generated JSON chunk per locale (src/generated/search/, written by
 * scripts/emit-sitemap.ts from the sitemap pages), loaded the first time the panel opens, never at mount.
 * A query with no result is recorded (/api/search/miss) once it has stood still for MISS_DELAY_MS or on Enter,
 * and the visitor may leave an email to hear when it gets one (/api/search/notify).
 */

const MISS_DELAY_MS = 1200;
const indexes = new Map<Locale, Promise<SearchEntry[]>>();
/** Queries already recorded in this tab, so retyping one does not post again. */
const recorded = new Set<string>();

let testIndex: SearchEntry[] | null = null;
/** Tests hand in an index instead of the generated chunk. */
export function setSearchIndexForTest(entries: SearchEntry[] | null): void {
  testIndex = entries;
  indexes.clear();
}

function loadIndex(loc: Locale): Promise<SearchEntry[]> {
  if (testIndex) return Promise.resolve(testIndex);
  let pending = indexes.get(loc);
  if (!pending) {
    pending = import(`../generated/search/${loc}.json`).then((mod: { default: SearchEntry[] }) => mod.default);
    pending.catch(() => indexes.delete(loc));
    indexes.set(loc, pending);
  }
  return pending;
}

/** Warm the index on hover or focus of the search button, before the click. */
export function prefetchSearch(): void {
  void loadIndex(locale()).catch(() => undefined);
}

async function post(path: string, body: Record<string, string>): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
}

function recordMiss(q: string, loc: Locale): void {
  const key = `${loc}|${q}`;
  if (recorded.has(key)) return;
  recorded.add(key);
  void post("/api/search/miss", { q, locale: loc }).catch(() => undefined);
}

/** Single letters of a spaced script are still being typed; one CJK character can be a real query (梗). */
function worthRecording(q: string): boolean {
  return isRecordableQuery(q) && (q.length >= 2 || /[^\p{Script=Latin}\p{N}\s]/u.test(q));
}

type Panel = { el: HTMLElement; input: HTMLInputElement; close: () => void };

let open: Panel | null = null;

export function closeSearch(): void {
  open?.close();
}

/** Open the panel under the header (or focus it if it is open). `button` gets focus back on Escape. */
export function openSearch(header: HTMLElement, button: HTMLElement): void {
  if (open && header.contains(open.el)) {
    open.input.focus();
    return;
  }
  open?.close();
  const loc = locale();
  const listId = "search-results";
  let active = -1;
  let hits: SearchEntry[] = [];
  let missTimer = 0;
  /** The "nothing found" query on screen, recorded after the pause, on Enter, or when the panel closes. */
  let pendingMiss = "";
  let seq = 0;

  const input = h("input", {
    type: "search",
    class: "search-input",
    placeholder: t("search.placeholder"),
    "aria-label": t("search.label"),
    role: "combobox",
    "aria-expanded": "false",
    "aria-controls": listId,
    "aria-autocomplete": "list",
    autocomplete: "off",
    enterkeyhint: "search",
    maxlength: SEARCH_QUERY_MAX,
  });
  const list = h("ul", { class: "search-list", id: listId, role: "listbox", "aria-label": t("search.results") });
  const status = h("p", { class: "search-status", role: "status", "aria-live": "polite" });
  const empty = h("div", { class: "search-empty" });
  empty.hidden = true;
  const el = h("div", { class: "search-pop" }, input, status, list, empty);

  function setActive(next: number): void {
    const items = [...list.querySelectorAll<HTMLElement>("[role=option]")];
    active = items.length ? (next + items.length) % items.length : -1;
    items.forEach((item, i) => item.setAttribute("aria-selected", String(i === active)));
    const current = items[active];
    if (current) {
      input.setAttribute("aria-activedescendant", current.id);
      current.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }

  function renderHits(q: string): void {
    list.replaceChildren(
      ...hits.map(([channel, href, name, blurb], i) =>
        h("li", { id: `search-hit-${i}`, role: "option", "aria-selected": "false" },
          h("a", { class: "search-hit", href, tabindex: "-1", onClick: () => close() },
            h("span", { class: "search-ch" }, t(SEARCH_CHANNEL_LABEL[channel])),
            h("span", { class: "search-name" }, name),
            blurb ? h("span", { class: "search-blurb" }, blurb) : null,
          ),
        ),
      ),
    );
    input.setAttribute("aria-expanded", String(hits.length > 0));
    active = -1;
    if (hits.length) setActive(0);
    status.textContent = q && hits.length ? t("search.count", { n: hits.length }) : "";
  }

  function renderEmpty(q: string): void {
    const email = h("input", {
      type: "email",
      class: "search-email",
      placeholder: t("search.emailPlaceholder"),
      "aria-label": t("search.emailLabel"),
      autocomplete: "email",
      required: true,
      maxlength: 254,
    });
    const send = h("button", { type: "submit", class: "btn" }, t("search.notify"));
    const note = h("p", { class: "search-note" }, t("search.privacy"));
    const form = h("form", {
      class: "search-form",
      onSubmit: async (e: Event) => {
        e.preventDefault();
        const address = email.value.trim().toLowerCase();
        if (!isValidEmail(address)) {
          note.textContent = t("search.badEmail");
          email.focus();
          return;
        }
        send.disabled = true;
        note.textContent = t("search.sending");
        try {
          const res = await post("/api/search/notify", { q, locale: loc, email: address });
          if (res.ok) {
            form.replaceChildren(h("p", { class: "search-done" }, t("search.done", { email: address })));
            recorded.add(`${loc}|${q}`);
            return;
          }
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          note.textContent = t(data.error === "rate" ? "search.rate" : data.error === "email" ? "search.badEmail" : "search.failed");
        } catch {
          note.textContent = t("search.failed");
        }
        send.disabled = false;
      },
    }, h("div", { class: "search-form-row" }, email, send), note);
    empty.replaceChildren(h("p", { class: "search-none" }, t("search.none", { q })));
    if (worthRecording(q)) empty.append(h("p", null, t("search.ask")), form);
    empty.hidden = false;
  }

  async function update(): Promise<void> {
    const q = normalizeQuery(input.value);
    const mine = ++seq;
    window.clearTimeout(missTimer);
    pendingMiss = "";
    if (!q) {
      hits = [];
      renderHits(q);
      empty.hidden = true;
      return;
    }
    let index: SearchEntry[];
    try {
      if (!indexes.has(loc) && !testIndex) status.textContent = t("search.loading");
      index = await loadIndex(loc);
    } catch {
      if (mine === seq) status.textContent = t("search.failed");
      return;
    }
    if (mine !== seq) return;
    hits = searchEntries(index, q);
    renderHits(q);
    if (hits.length) {
      empty.hidden = true;
      return;
    }
    renderEmpty(q);
    if (worthRecording(q)) {
      pendingMiss = q;
      missTimer = window.setTimeout(flushMiss, MISS_DELAY_MS);
    }
  }

  // While an IME composes (pinyin, kana, Hangul jamo) the text is not final: search when it is committed.
  input.addEventListener("input", (e) => {
    if ((e as InputEvent).isComposing) return;
    void update();
  });
  input.addEventListener("compositionend", () => void update());
  input.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const q = normalizeQuery(input.value);
      const link = list.querySelectorAll<HTMLAnchorElement>("a.search-hit")[Math.max(active, 0)];
      if (link) link.click();
      else if (q && !hits.length && worthRecording(q)) {
        flushMiss();
        empty.querySelector<HTMLInputElement>(".search-email")?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      button.focus();
    }
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && e.target !== input) {
      close();
      button.focus();
    }
  });

  function onOutside(e: Event): void {
    const target = e.target as Node | null;
    if (target && (el.contains(target) || button.contains(target))) return;
    close();
  }

  function flushMiss(): void {
    window.clearTimeout(missTimer);
    if (pendingMiss) recordMiss(pendingMiss, loc);
    pendingMiss = "";
  }

  function close(): void {
    flushMiss();
    document.removeEventListener("pointerdown", onOutside, true);
    el.remove();
    button.setAttribute("aria-expanded", "false");
    if (open?.el === el) open = null;
  }

  header.append(el);
  button.setAttribute("aria-expanded", "true");
  document.addEventListener("pointerdown", onOutside, true);
  open = { el, input, close };
  input.focus();
  prefetchSearch();
}
