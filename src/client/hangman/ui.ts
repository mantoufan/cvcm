import { h, onScreen } from "../dom";
import { locale, t } from "../i18n";
import { randomBelow } from "../../shared/random";
import { physicalLetter, readStore, typingTarget, writeStore } from "../game-input";
import {
  ALPHABET, CATEGORIES, MAX_MISSES, WORDS, WORD_LANGS, canHint, cleanWord, guess, letterKey, lettersOf, misses, newGame, pool,
  reveal, status, strikes, takeHint, type Category, type Game, type WordLang,
} from "../../shared/hangman";

const STORE = "cvcm.hangman.v1";
const LANG_NAME: Record<WordLang, string> = { en: "English", es: "Español", id: "Bahasa Indonesia" };
/** Recent words are not drawn again until this many others have come up. */
const RECENT = 12;
const SVG = "http://www.w3.org/2000/svg";

/** A list game in progress, kept so a reload resumes it instead of dealing a new word (and dodging a loss). */
type SavedGame = { word: string; guessed: string[]; hints: number; category: Category; lang?: WordLang };
type Saved = { lang: WordLang; category: Category | "all"; won: number; lost: number; streak: number; game?: SavedGame };

let mounted: { cleanup: () => void } | null = null;

/** Whether a write sticks (blocked site data, a full quota or old Safari private mode throw or drop it). */
function storageWorks(): boolean {
  try {
    const probe = `${STORE}.probe`;
    window.localStorage.setItem(probe, "1");
    const ok = window.localStorage.getItem(probe) === "1";
    window.localStorage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

function defaultLang(): WordLang {
  const l = locale();
  return l === "es" ? "es" : l === "id" ? "id" : "en";
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export function mountHangman(host: HTMLElement): void {
  unmountHangman();
  const stored = readStore<Partial<Saved>>(STORE);
  const saved: Partial<Saved> = stored && typeof stored === "object" ? stored : {};
  let lang: WordLang = WORD_LANGS.includes(saved.lang as WordLang) ? saved.lang! : defaultLang();
  let category: Category | "all" = saved.category === "all" || CATEGORIES.includes(saved.category as Category) ? saved.category! : "all";
  const score = { won: Number(saved.won) || 0, lost: Number(saved.lost) || 0, streak: Number(saved.streak) || 0 };
  // A first visit mounts a fixed word (rule 8); with storage blocked every visit would look like the first, so draw then.
  const firstVisit = !stored && storageWorks();
  const recent: string[] = [];
  let game: Game = newGame("");
  /** The word list the board's word was dealt from (its keyboard), which the menu may have moved on from. */
  let wordLang: WordLang = "en";
  let wordCategory: Category | null = null;
  /** A word typed by a friend: the category line says so and the score is not counted. */
  let custom = false;

  /** A list game set aside for a friend's word: it is kept (and saved) and comes back with New word. */
  let suspended: { game: Game; category: Category; lang: WordLang } | null = null;
  const listOpen = () => !custom && !!wordCategory && game.guessed.length > 0 && status(game) === "playing";

  const persist = () => {
    const keep = listOpen() ? { game, category: wordCategory!, lang: wordLang } : custom ? suspended : null;
    const kept: SavedGame | undefined = keep ? { word: keep.game.word, guessed: [...keep.game.guessed], hints: keep.game.hints, category: keep.category, lang: keep.lang } : undefined;
    writeStore(STORE, { lang, category, ...score, game: kept } satisfies Saved);
  };

  const langSel = h("select", { "data-field": "lang", onChange: () => { lang = langSel.value as WordLang; changed(); } },
    ...WORD_LANGS.map((l) => h("option", { value: l, selected: l === lang }, LANG_NAME[l])));
  const catSel = h("select", { "data-field": "category", onChange: () => { category = catSel.value as Category | "all"; changed(); } },
    h("option", { value: "all", selected: category === "all" }, t("hangman.c_all")),
    ...CATEGORIES.map((c) => h("option", { value: c, selected: c === category }, t(`hangman.c_${c}`))));
  // A text field masked by CSS, not type=password: password managers would offer to save or fill it. Where CSS
  // cannot mask it, it turns into a password field on focus (not at mount, so the prerender and the client agree).
  const secretEl = h("input", { type: "text", onFocus: () => {
    if (typeof CSS === "undefined" || !CSS.supports?.("-webkit-text-security", "disc")) secretEl.type = "password";
  }, class: "hm-secret", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "data-1p-ignore": "", "data-lpignore": "true", maxlength: 40, "data-field": "secret", placeholder: t("hangman.secretPlaceholder") });
  const secretMsg = h("p", { class: "hint", "aria-live": "polite", "data-out": "secret-msg" });
  const newBtn = h("button", { type: "button", class: "btn", "data-action": "new", onClick: () => askNew() }, t("hangman.newWord"));
  const hintBtn = h("button", { type: "button", class: "btn ghost", "data-action": "hint", onClick: () => hint() }, t("hangman.hint"));

  const parts = [
    svg("circle", { cx: 80, cy: 40, r: 11 }),
    svg("line", { x1: 80, y1: 51, x2: 80, y2: 88 }),
    svg("line", { x1: 80, y1: 60, x2: 66, y2: 75 }),
    svg("line", { x1: 80, y1: 60, x2: 94, y2: 75 }),
    svg("line", { x1: 80, y1: 88, x2: 68, y2: 108 }),
    svg("line", { x1: 80, y1: 88, x2: 92, y2: 108 }),
  ];
  const drawing = svg("svg", { viewBox: "0 0 120 130", class: "hm-drawing", role: "img", "data-out": "drawing" });
  for (const d of ["M10 122 H70", "M30 122 V8 H80 V29"]) drawing.append(svg("path", { d, class: "hm-frame" }));
  for (const p of parts) {
    p.setAttribute("class", "hm-part");
    drawing.append(p);
  }

  const catEl = h("p", { class: "hm-category", "data-out": "category" });
  const wordEl = h("p", { class: "hm-word", "data-out": "word" });
  const statusEl = h("p", { class: "hm-status", "aria-live": "polite", "data-out": "status" });
  const missEl = h("p", { class: "hm-misses", "data-out": "misses" });
  /** Shown from a mid-game menu change until the next word is dealt. */
  const pendingEl = h("p", { class: "hint", hidden: true, "data-out": "pending" }, t("hangman.pending"));
  const keysEl = h("div", { class: "hm-keys", role: "group", "aria-label": t("hangman.keyboard"), "data-out": "keys" });
  const scoreEl = h("dl", { class: "stats-grid", "data-out": "score" });
  let keyEls = new Map<string, HTMLButtonElement>();

  /** The keyboard of the word's own list (a resumed English word keeps English keys under a Spanish menu). */
  const keysLang = (): WordLang => (custom ? lang : wordLang);
  /** Whether the menus now point at another list than the word on the board (their change waits for the next word). */
  const menuAhead = () => !custom && !!wordCategory && (lang !== wordLang || (category !== "all" && category !== wordCategory));

  const buildKeys = () => {
    const alphabet = ALPHABET[keysLang()];
    // A friend's word may use a letter this alphabet lacks (Ñ on the English keys): it gets a key too.
    const extra = [...lettersOf(game.word)].filter((k) => !alphabet.includes(k));
    keyEls = new Map([...alphabet, ...extra].map((k) => [k, h("button", { type: "button", class: "hm-key", "data-key": k, onClick: () => press(k) }, k)]));
    keysEl.replaceChildren(...keyEls.values());
  };

  const paint = () => {
    const st = status(game);
    const shown = reveal(game, st === "lost");
    const got = new Set(game.guessed);
    const chars = [...game.word];
    // Letters are grouped per word, so a phrase wraps between words, never inside one.
    const groups: HTMLElement[] = [];
    let group: HTMLElement | null = null;
    shown.forEach((c, i) => {
      const ch = chars[i]!;
      if (ch === " ") {
        group = null;
        return;
      }
      if (!group) groups.push(group = h("span", { class: "hm-group" }));
      if (!letterKey(ch)) group.append(h("span", { class: "hm-sym" }, ch));
      else group.append(h("span", { class: `hm-letter${st === "lost" && !got.has(letterKey(ch)) ? " missed" : ""}` }, c ?? " "));
    });
    wordEl.replaceChildren(...groups);
    // A screen reader reads the pattern, not a row of empty boxes.
    wordEl.setAttribute("aria-label", t("hangman.wordLabel", { word: shown.map((c) => c ?? "_").join(" ") }));
    const n = strikes(game);
    parts.forEach((p, i) => p.classList.toggle("on", i < n));
    drawing.setAttribute("aria-label", t("hangman.drawingLabel", { n, max: MAX_MISSES }));
    catEl.textContent = custom ? t("hangman.customWord") : wordCategory ? t("hangman.category", { name: t(`hangman.c_${wordCategory}`) }) : "";
    const wrong = misses(game);
    // Hints cost a strike too; each shows as 💡 so the list adds up to the count.
    const marks = [...wrong, ...Array<string>(game.hints).fill("💡")];
    missEl.textContent = t("hangman.wrong", { letters: marks.join(" ") || "—", n, max: MAX_MISSES });
    statusEl.className = `hm-status${st === "playing" ? "" : ` ${st}`}`;
    statusEl.textContent = st === "won" ? t("hangman.won") : st === "lost" ? t("hangman.lost", { word: game.word }) : t("hangman.left", { n: MAX_MISSES - n });
    for (const [k, el] of keyEls) {
      const used = got.has(k);
      el.disabled = used || st !== "playing";
      el.classList.toggle("hit", used && !wrong.includes(k));
      el.classList.toggle("miss", wrong.includes(k));
    }
    hintBtn.disabled = !canHint(game);
    scoreEl.replaceChildren(
      h("dt", null, t("hangman.wins")), h("dd", null, String(score.won)),
      h("dt", null, t("hangman.losses")), h("dd", null, String(score.lost)),
      h("dt", null, t("hangman.streak")), h("dd", null, String(score.streak)),
    );
  };

  const settle = (before: Game) => {
    const was = status(before);
    const now = status(game);
    if (was === "playing" && now !== "playing" && !custom) {
      if (now === "won") {
        score.won++;
        score.streak++;
      } else {
        score.lost++;
        score.streak = 0;
      }
    }
    // Every move is saved, so a reload resumes the game (and leaving it still counts).
    persist();
    paint();
  };

  const press = (ch: string) => {
    disarmNew();
    const before = game;
    game = guess(game, ch);
    if (game !== before) settle(before);
  };

  const hint = () => {
    disarmNew();
    const before = game;
    game = takeHint(game, (n) => randomBelow(n));
    if (game !== before) settle(before);
  };

  /**
   * A new language or category deals at once when no letter has been tried; mid-game it waits for New word (as sudoku
   * does with its level), so a stray arrow key on a menu cannot throw the game away and count a loss.
   */
  const changed = () => {
    persist();
    // A set-aside list game comes back with New word before the new choice, so the choice waits for it too.
    if ((status(game) === "playing" && game.guessed.length) || (custom && suspended)) {
      pendingEl.hidden = false;
      return;
    }
    next();
  };

  /** Walking away from a started list game counts as a loss, so a streak cannot be kept by skipping a bad game. */
  const abandon = () => {
    if (custom || status(game) !== "playing" || !game.guessed.length) return;
    score.lost++;
    score.streak = 0;
  };

  /** `save` is false only for the word dealt at mount: writing then would leak into the prerender's next page. */
  const start = (word: string, cat: Category | null, isCustom: boolean, save = true) => {
    disarmNew();
    // A friend's word sets a started list game aside (New word brings it back); a new list word gives it up.
    if (isCustom && listOpen()) suspended = { game, category: wordCategory!, lang: wordLang };
    else if (!isCustom) abandon();
    pendingEl.hidden = true;
    game = newGame(word);
    wordCategory = cat;
    wordLang = lang;
    custom = isCustom;
    buildKeys();
    if (save) persist();
    paint();
  };

  /** New word: with a list game started it asks once (the button says so), as giving up counts as a loss. */
  let confirmNew = false;
  const askNew = () => {
    if (listOpen() && !confirmNew) {
      confirmNew = true;
      newBtn.textContent = t("hangman.newConfirm");
      return;
    }
    next();
  };
  function disarmNew() {
    if (!confirmNew) return;
    confirmNew = false;
    newBtn.textContent = t("hangman.newWord");
  }

  /** A new word from the list, not one of the last few; a list game set aside for a friend's word comes back first. */
  const next = (fixed = false, atMount = false) => {
    if (suspended && custom) {
      const back = suspended;
      suspended = null;
      disarmNew();
      secretMsg.textContent = "";
      game = back.game;
      wordCategory = back.category;
      wordLang = back.lang;
      custom = false;
      pendingEl.hidden = !menuAhead();
      buildKeys();
      persist();
      paint();
      return;
    }
    const words = pool(lang, category);
    const fresh = words.filter((w) => !recent.includes(w.word));
    const from = fresh.length ? fresh : words;
    const pick = fixed ? from[7 % from.length]! : from[randomBelow(from.length)]!;
    recent.push(pick.word);
    if (recent.length > RECENT) recent.shift();
    secretMsg.textContent = "";
    start(pick.word, pick.category, false, !atMount);
  };

  const useSecret = () => {
    const word = cleanWord(secretEl.value);
    if (!word) {
      secretMsg.textContent = t("hangman.secretBad");
      return;
    }
    secretEl.value = "";
    secretMsg.textContent = t("hangman.secretOk");
    start(word, null, true);
  };
  secretEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      useSecret();
    }
  });

  const onKey = (e: KeyboardEvent) => {
    // An IME (Korean, Japanese) reports its keys as "Process" while composing: those still map by position.
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || (e.isComposing && e.key !== "Process")) return;
    // A letter on our own (closed) menu is a guess, not the menu's type-ahead, which would deal a new word.
    const ownMenu = e.target instanceof HTMLSelectElement && host.contains(e.target);
    if (typingTarget(e.target) && !ownMenu) return;
    if (!host.isConnected || !onScreen(keysEl)) return;
    // The letter typed, or the physical key when another layout is active (a Korean or Russian keyboard).
    const k = (e.key.length === 1 ? letterKey(e.key) : "") || physicalLetter(e);
    if (!k || !keyEls.has(k)) {
      // Any other letter on our own menu would still pick an option by type-ahead (and deal a new word).
      if (ownMenu && e.key.length === 1) e.preventDefault();
      return;
    }
    e.preventDefault();
    press(k);
  };
  document.addEventListener("keydown", onKey);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("hangman.title")),
      h("p", { class: "lede" }, t("hangman.privacyNote")),
    ),
    h("div", { class: "data-tool hm-tool" },
      h("div", { class: "rail hm-stage" },
        drawing,
        h("div", { class: "hm-board" }, catEl, wordEl, statusEl, missEl),
        keysEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("hangman.lang")), langSel),
        h("label", { class: "field" }, h("span", null, t("hangman.categoryLabel")), catSel),
        h("div", { class: "stage-actions" },
          newBtn,
          hintBtn,
        ),
        pendingEl,
        h("fieldset", null,
          h("legend", null, t("hangman.friend")),
          h("label", { class: "field" }, h("span", null, t("hangman.secretLabel")), secretEl),
          h("button", { type: "button", class: "btn ghost", "data-action": "secret", onClick: () => useSecret() }, t("hangman.secretPlay")),
          secretMsg,
        ),
        scoreEl,
        h("p", { class: "hint" }, t("hangman.tip")),
      ),
    ),
  );
  // A list game left mid-way is resumed (it must still be a word from that list and unfinished).
  const g = saved.game;
  // From any language's list (the language may have changed mid-game), and in the category it was saved with.
  const resumable = g && typeof g.word === "string" && Array.isArray(g.guessed) && CATEGORIES.includes(g.category)
    && WORD_LANGS.some((l) => WORDS[l][g.category].includes(g.word));
  if (resumable) {
    let back: Game = newGame(g.word);
    for (const k of g.guessed) if (typeof k === "string") back = guess(back, k);
    back = { ...back, hints: Math.max(0, Math.min(MAX_MISSES, Number(g.hints) || 0)) };
    if (status(back) === "playing") {
      game = back;
      wordCategory = g.category;
      // The list it was dealt from (older saves lack it: the first list holding the word).
      wordLang = WORD_LANGS.includes(g.lang as WordLang) && WORDS[g.lang!][g.category].includes(g.word)
        ? g.lang!
        : WORD_LANGS.find((l) => WORDS[l][g.category].includes(g.word))!;
      recent.push(g.word);
      // The menus already show a language or category picked mid-game: say it starts with the next word.
      pendingEl.hidden = !menuAhead();
      buildKeys();
      paint();
    } else next(false, true);
  } else next(firstVisit, true);
  mounted = { cleanup: () => document.removeEventListener("keydown", onKey) };
}

export function unmountHangman(): void {
  mounted?.cleanup();
  mounted = null;
}
