import { h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import { countText } from "../../shared/word-count";
import { debounce } from "../session";

const STATS = ["words", "chars", "charsNoSpace", "sentences", "paragraphs", "lines", "readingMinutes"] as const;

let inputEl: HTMLTextAreaElement | null = null;
let statsEl: HTMLElement | null = null;
const schedule = debounce(() => renderStats(), 80);

export function mountWordCount(host: HTMLElement): void {
  inputEl = h("textarea", {
    class: "clip-input",
    spellcheck: "true",
    "aria-label": t("wordCount.input"),
    placeholder: t("wordCount.placeholder"),
    onInput: () => schedule(),
  });
  statsEl = h("dl", { class: "stats-grid" });
  const file = h("input", {
    type: "file",
    class: "sr-only",
    id: "count-file-input",
    accept: ".txt,.md,.html,.csv,.json",
    onChange: (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) void loadFile(f);
      (e.target as HTMLInputElement).value = "";
    },
  });
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("wordCount.back")),
      h("h1", null, t("wordCount.title")),
      h("p", { class: "lede" }, t("wordCount.privacyNote")),
    ),
    h("div", { class: "data-tool" },
      h("aside", { class: "rail controls" },
        h("h2", null, t("wordCount.stats")),
        statsEl,
        h("div", { class: "stage-actions" },
          h("label", { class: "btn ghost", for: "count-file-input" }, t("wordCount.openFile"), file),
          h("button", { type: "button", class: "btn ghost", onClick: () => clearText() }, t("wordCount.clear")),
        ),
      ),
      h("div", { class: "rail" },
        h("h2", null, t("wordCount.input")),
        inputEl,
      ),
    ),
  );
  renderStats();
  inputEl.focus();
}

export function unmountWordCount(): void {
  inputEl = null;
  statsEl = null;
}

function renderStats(): void {
  if (!statsEl || !inputEl) return;
  const stats = countText(inputEl.value);
  statsEl.replaceChildren(
    ...STATS.flatMap((key) => [
      h("dt", null, t(`wordCount.${key}`)),
      h("dd", null, String(stats[key])),
    ]),
  );
}

function clearText(): void {
  if (!inputEl) return;
  inputEl.value = "";
  renderStats();
  inputEl.focus();
}

async function loadFile(file: File): Promise<void> {
  if (!inputEl) return;
  inputEl.value = await file.text();
  renderStats();
}
