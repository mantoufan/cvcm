import { h } from "../dom";
import { locale, t } from "../i18n";
import { cryptoRand, readStore, writeStore } from "../game-input";
import { LIVES, TYPING_LEVELS, fallSeconds, matches, scoreOf, spawnSeconds, stageOf, summary, type TypingLevel, type TypingWord, isPrefixOf } from "../../shared/typing-game";
import { wordsFor } from "../../shared/typing-game-words";

/**
 * Typing game, written for cv.cm: words fall down the field and each one typed (Enter or Space, or as soon as it
 * matches) disappears before it reaches the bottom. Rules and matching in src/shared/typing-game.ts. Nothing moves
 * before Start, so the prerendered page is the idle field.
 */

const STORE_KEY = "cvcm.typinggame.v1";
type Falling = { word: TypingWord; x: number; y: number; el: HTMLElement };
type Saved = { level?: TypingLevel; best?: Record<string, number> };

let mounted: { cleanup: () => void } | null = null;

export function mountTypingGame(host: HTMLElement): void {
  unmountTypingGame();
  const loc = locale();
  const words = wordsFor(loc);
  const saved = readStore<Saved>(STORE_KEY) ?? {};
  const best: Record<string, number> = saved.best && typeof saved.best === "object" ? { ...saved.best } : {};
  let level: TypingLevel = TYPING_LEVELS.includes(saved.level as TypingLevel) ? saved.level! : "easy";
  let state: "idle" | "running" | "paused" | "over" = "idle";
  let falling: Falling[] = [];
  let lives = LIVES;
  let cleared = 0;
  let chars = 0;
  let hits = 0;
  let attempts = 0;
  let elapsed = 0;
  let sinceSpawn = 0;
  let last = 0;
  let frame = 0;
  let composing = false;
  let recent: TypingWord[] = [];

  const bestKey = () => `${loc}-${level}`;
  const save = () => writeStore(STORE_KEY, { level, best });

  const levelSel = h("select", { "data-field": "level", onChange: () => {
    level = TYPING_LEVELS[levelSel.selectedIndex]!;
    save();
    if (state !== "running") paint();
  } }, ...TYPING_LEVELS.map((l) => h("option", { value: l, selected: l === level }, t(`typingGame.l_${l}`))));
  const scoreEl = h("dd", { "data-out": "score" });
  const livesEl = h("dd", { "data-out": "lives" });
  const stageEl = h("dd", { "data-out": "stage" });
  const bestEl = h("dd", { "data-out": "best" });
  const statusEl = h("p", { class: "tg-status", "aria-live": "polite", "data-out": "status" });
  const idleEl = h("p", { class: "tg-idle" }, t("typingGame.idle"));
  const field = h("div", { class: "tg-field", "aria-hidden": "true", "data-out": "field" }, idleEl);
  const input = h("input", {
    type: "text",
    class: "tg-input",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    enterkeyhint: "done",
    "aria-label": t("typingGame.input"),
    placeholder: t("typingGame.placeholder"),
    disabled: true,
  }) as HTMLInputElement;
  const startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (state === "running" ? pause() : state === "paused" ? resume() : start()) });

  const paint = () => {
    scoreEl.textContent = String(chars);
    livesEl.textContent = "♥".repeat(lives) + "♡".repeat(Math.max(0, LIVES - lives));
    livesEl.setAttribute("aria-label", t("typingGame.livesLeft", { n: lives }));
    stageEl.textContent = String(stageOf(cleared));
    bestEl.textContent = best[bestKey()] ? String(best[bestKey()]) : "–";
    levelSel.disabled = state === "running" || state === "paused";
    startBtn.textContent = state === "running" ? t("typingGame.pause") : state === "paused" ? t("typingGame.resume") : state === "over" ? t("typingGame.again") : t("typingGame.start");
    input.disabled = state !== "running";
    idleEl.hidden = state === "running" || state === "paused";
    if (state === "over") {
      const { cpm, accuracy } = summary(chars, hits, attempts, elapsed);
      idleEl.textContent = t("typingGame.over", { score: chars, words: cleared, cpm, accuracy });
    } else idleEl.textContent = t("typingGame.idle");
  };

  /** A word not among the last few, so the same one does not come twice in a row. */
  const pickWord = (): TypingWord => {
    for (let k = 0; k < 8; k++) {
      const w = words[Math.floor(cryptoRand() * words.length)]!;
      if (!recent.includes(w) && !falling.some((f) => f.word === w)) {
        recent = [w, ...recent].slice(0, 6);
        return w;
      }
    }
    return words[Math.floor(cryptoRand() * words.length)]!;
  };

  const spawn = () => {
    const word = pickWord();
    const el = h("span", { class: "tg-word" }, word.text);
    // Readings help: kana under Japanese words, pinyin under Chinese ones.
    if (word.reading && word.reading !== word.text) el.append(h("small", null, word.reading));
    // Keep words away from the edges so long ones stay inside the field.
    let x = 4 + cryptoRand() * 62;
    el.style.left = `${x}%`;
    field.append(el);
    // A long word near the right edge would be cut off on a phone: pull it back inside the field.
    if (field.clientWidth) x = Math.max(2, Math.min(x, 98 - (el.offsetWidth / field.clientWidth) * 100));
    el.style.left = `${x}%`;
    falling.push({ word, x, y: 0, el });
  };

  const removeWord = (f: Falling, how: "hit" | "miss") => {
    falling = falling.filter((x) => x !== f);
    f.el.classList.add(how);
    window.setTimeout(() => f.el.remove(), 180);
  };

  const step = (now: number) => {
    frame = 0;
    if (state !== "running") return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    elapsed += dt;
    sinceSpawn += dt;
    const fall = fallSeconds(level, cleared);
    if (sinceSpawn >= spawnSeconds(level, cleared) || !falling.length) {
      sinceSpawn = 0;
      spawn();
    }
    for (const f of [...falling]) {
      f.y += dt / fall;
      f.el.style.top = `${Math.min(1, f.y) * 88}%`;
      if (f.y >= 1) {
        removeWord(f, "miss");
        lives--;
        if (lives <= 0) return end();
        paint();
      }
    }
    frame = window.requestAnimationFrame(step);
  };

  const check = (force: boolean) => {
    if (state !== "running" || composing) return;
    const typed = input.value;
    if (!typed.trim()) {
      input.value = "";
      return;
    }
    // The lowest word first: it is the one about to land.
    const target = [...falling].sort((a, b) => b.y - a.y).find((f) => matches(f.word, typed, loc));
    if (target) {
      hits++;
      attempts++;
      cleared++;
      chars += scoreOf(target.word);
      removeWord(target, "hit");
      input.value = "";
      paint();
    } else if (force) {
      attempts++;
      input.classList.remove("wrong");
      void input.offsetWidth;
      input.classList.add("wrong");
      input.select();
    }
  };

  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => {
    composing = false;
    check(false);
  });
  input.addEventListener("input", () => {
    if (composing) return;
    // Space submits (except inside a multi-word entry that is still being typed).
    if (/\s$/.test(input.value) && !falling.some((f) => f.word.text.includes(" ") && isPrefixOf(f.word, input.value, loc))) check(true);
    else check(false);
  });
  input.addEventListener("keydown", (e) => {
    // keyCode 229: the Enter that commits an input-method composition (Safari reports it after compositionend).
    if (e.key === "Enter" && !e.isComposing && !composing && e.keyCode !== 229) {
      e.preventDefault();
      check(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      pause();
    }
  });

  const run = () => {
    last = performance.now();
    if (!frame) frame = window.requestAnimationFrame(step);
  };

  const start = () => {
    for (const f of falling) f.el.remove();
    falling = [];
    lives = LIVES;
    cleared = 0;
    chars = 0;
    hits = 0;
    attempts = 0;
    elapsed = 0;
    sinceSpawn = 0;
    recent = [];
    state = "running";
    statusEl.textContent = "";
    input.value = "";
    paint();
    input.focus();
    run();
  };

  const pause = () => {
    if (state !== "running") return;
    state = "paused";
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    statusEl.textContent = t("typingGame.paused");
    paint();
  };

  const resume = () => {
    if (state !== "paused") return;
    state = "running";
    statusEl.textContent = "";
    paint();
    input.focus();
    run();
  };

  const end = () => {
    state = "over";
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    for (const f of falling) f.el.remove();
    falling = [];
    const key = bestKey();
    const isBest = chars > (best[key] ?? 0);
    if (isBest) {
      best[key] = chars;
      save();
    }
    statusEl.textContent = isBest && chars > 0 ? t("typingGame.newBest") : "";
    paint();
    startBtn.focus();
  };

  const onVisibility = () => { if (document.hidden) pause(); };
  document.addEventListener("visibilitychange", onVisibility);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("typingGame.title")),
      h("p", { class: "lede" }, t("typingGame.privacyNote")),
    ),
    h("div", { class: "tg-tool" },
      h("div", { class: "tg-main" },
        h("dl", { class: "stats-grid tg-stats" },
          h("dt", null, t("typingGame.score")), scoreEl,
          h("dt", null, t("typingGame.lives")), livesEl,
          h("dt", null, t("typingGame.stage")), stageEl,
          h("dt", null, t("typingGame.best")), bestEl,
        ),
        field,
        input,
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("label", { class: "field" }, h("span", null, t("typingGame.level")), levelSel),
        h("div", { class: "stage-actions" }, startBtn),
        h("p", { class: "hint" }, t("typingGame.hint")),
      ),
    ),
  );
  paint();
  mounted = {
    cleanup: () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      state = "idle";
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

export function unmountTypingGame(): void {
  mounted?.cleanup();
  mounted = null;
}
