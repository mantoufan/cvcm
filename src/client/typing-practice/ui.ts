import { h } from "../dom";
import { locale, t } from "../i18n";
import { cryptoRand, onScreen, readStore, writeStore } from "../game-input";
import { seeded } from "../../shared/random";
import { shortClock } from "../../shared/subtitles";
import { matches } from "../../shared/typing-game";
import { wordsFor } from "../../shared/typing-game-words";
import {
  FINGER_OF, KEY_ROWS, LESSONS, PASS_ACCURACY, SPACE, WORD_ROUND, emptyStats, fromSavedProgress, keyLabel, makeDrill,
  newKeys, rates, recordResult, romajiHint, weakKeys, type DrillStats, type LessonId, type Progress,
} from "../../shared/typing-practice";

/**
 * Typing practice page: pick a lesson, type the drill on a focused practice area (judged by physical key, so an input
 * method can stay on), see the next key and its finger on a keyboard, then a result with the keys to work on. The
 * last lesson types real words in a text field, input methods welcome.
 */

const STORE_KEY = "cvcm.typingpractice.v1";
type Phase = "idle" | "running" | "done";
type Saved = { lesson: LessonId; progress: Progress };

let mounted: { cleanup: () => void } | null = null;

const shuffle = <T,>(list: readonly T[], rand: () => number): T[] => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

export function mountTypingPractice(host: HTMLElement): void {
  unmountTypingPractice();
  const loc = locale();
  const saved = readStore<Saved>(STORE_KEY);
  let progress: Progress = fromSavedProgress(saved?.progress);
  let lesson: LessonId = saved && LESSONS.includes(saved.lesson) ? saved.lesson : "home";
  let phase: Phase = "idle";
  // The first drill is seeded so the prerendered page matches the mounted one.
  let drill: string[] = lesson === "words" ? [] : makeDrill(lesson, seeded(1));
  let words = shuffle(wordsFor(loc), seeded(1)).slice(0, WORD_ROUND);
  let pos = 0;
  let stats: DrillStats = emptyStats();
  let startedAt = 0;
  let timer = 0;
  let composing = false;
  let flash = 0;

  const save = () => writeStore(STORE_KEY, { lesson, progress });

  // ---- elements
  const lessonList = h("ol", { class: "tp-lessons" });
  const lineEl = h("div", { class: "tp-line", tabindex: 0, role: "application", "aria-label": t("typingPractice.drillArea"), "aria-describedby": "tp-help", "data-out": "line" });
  /** On-screen keys never take focus (Space or Enter would press them again and the real keyboard would stop counting). */
  const keepLineFocus = (el: HTMLElement) => {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      lineEl.focus({ preventScroll: true });
    });
  };
  const fingerEl = h("p", { class: "tp-finger", "aria-live": "polite", "data-out": "finger" });
  const keyEls = new Map<string, HTMLElement>();
  const keyboard = h("div", { class: "tp-kb", role: "group", "aria-label": t("typingPractice.keyboard") },
    ...KEY_ROWS.map((row, r) => h("div", { class: `tp-kb-row r${r}` }, ...row.map((code) => {
      const el = h("button", { type: "button", tabindex: -1, class: `tp-key f-${FINGER_OF[code]}`, "data-code": code }, keyLabel(code, loc));
      keepLineFocus(el);
      el.addEventListener("click", () => press(code));
      keyEls.set(code, el);
      return el;
    }))),
    h("div", { class: "tp-kb-row r3" }, (() => {
      const el = h("button", { type: "button", tabindex: -1, class: "tp-key space f-th", "data-code": SPACE }, t("typingPractice.space"));
      keepLineFocus(el);
      el.addEventListener("click", () => press(SPACE));
      keyEls.set(SPACE, el);
      return el;
    })()),
  );
  const drillBox = h("div", { class: "tp-drill" }, lineEl, fingerEl, keyboard);

  const wordEl = h("p", { class: "tp-word", "data-out": "word", lang: loc });
  const readingEl = h("p", { class: "tp-reading" });
  const input = h("input", { type: "text", class: "tp-input", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": t("typingPractice.typeWord"), enterkeyhint: "next" }) as HTMLInputElement;
  const wordBox = h("div", { class: "tp-words" }, wordEl, readingEl, input);

  const statsEl = h("dl", { class: "stats-grid tp-stats", "data-out": "stats" });
  const timeEl = h("dd", { "data-volatile": "" });
  const statusEl = h("p", { class: "tp-status", "aria-live": "polite", "data-out": "status" });
  const startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => begin() });
  const nextBtn = h("button", { type: "button", class: "btn ghost", "data-action": "next", hidden: true, onClick: () => { const n = nextLesson(); if (n) { lesson = n; save(); reset(); begin(); } } }, t("typingPractice.nextLesson"));

  const passed = () => rates(stats).accuracy >= PASS_ACCURACY;
  const nextLesson = (): LessonId | null => LESSONS[LESSONS.indexOf(lesson) + 1] ?? null;
  // Once a run is over its time is fixed in `stats.seconds`.
  const elapsed = () => (phase === "done" ? stats.seconds : startedAt ? (performance.now() - startedAt) / 1000 : 0);

  // ---- painting
  const paintLessons = () => {
    lessonList.replaceChildren(...LESSONS.map((id) => {
      const best = progress[id];
      return h("li", null, h("button", {
        type: "button",
        class: `tp-lesson${id === lesson ? " on" : ""}${best?.passed ? " passed" : ""}`,
        "data-lesson": id,
        "aria-pressed": String(id === lesson),
        onClick: () => {
          if (phase !== "running") { lesson = id; save(); reset(); }
          // Mid-run the lesson stays; give the keys back to the practice line.
          else if (lesson !== "words") lineEl.focus({ preventScroll: true });
        },
      },
        h("strong", null, t(`typingPractice.l_${id}`)),
        h("span", null, id === "words" ? t("typingPractice.ld_words") : newKeys(id).length ? newKeys(id).map((c) => keyLabel(c, loc)).join(" ") : loc === "ko" ? "ㄱ–ㅣ" : "a–z"),
        best ? h("small", null, t("typingPractice.best", { kpm: best.kpm, accuracy: best.accuracy })) : null,
      ));
    }));
  };

  const paintDrill = () => {
    const target = drill[pos];
    lineEl.replaceChildren(...drill.map((code, i) => h("span", {
      class: `tp-ch${i < pos ? " done" : ""}${i === pos ? " cur" : ""}${code === SPACE ? " sp" : ""}`,
    }, code === SPACE ? " " : keyLabel(code, loc))));
    for (const [code, el] of keyEls) el.classList.toggle("target", phase !== "done" && code === target);
    fingerEl.textContent = target && phase !== "done" ? t("typingPractice.useFinger", { finger: t(`typingPractice.f_${FINGER_OF[target]}`) }) : "";
    // Keep the current key in view on narrow screens.
    if (phase === "running" && document.activeElement === lineEl) lineEl.querySelector(".cur")?.scrollIntoView?.({ block: "nearest", inline: "center" });
  };

  const paintWords = () => {
    const w = words[pos];
    wordEl.textContent = w?.text ?? "";
    const reading = w?.reading && w.reading !== w.text ? w.reading : "";
    readingEl.textContent = loc === "ja" && w?.reading ? `${w.reading} · ${romajiHint(w.reading)}` : reading;
    readingEl.hidden = !readingEl.textContent;
  };

  const paint = () => {
    paintLessons();
    const isWords = lesson === "words";
    drillBox.hidden = isWords;
    wordBox.hidden = !isWords;
    if (isWords) paintWords();
    else paintDrill();
    const r = rates({ ...stats, seconds: elapsed() || stats.seconds });
    const total = isWords ? words.length : drill.length;
    statsEl.replaceChildren(
      h("dt", null, t("typingPractice.lesson")), h("dd", null, t(`typingPractice.l_${lesson}`)),
      h("dt", null, t("typingPractice.progress")), h("dd", null, `${Math.min(pos, total)} / ${total}`),
      h("dt", null, isWords ? t("typingPractice.cpm") : t("typingPractice.kpm")), h("dd", null, String(r.kpm)),
      h("dt", null, t("typingPractice.accuracy")), h("dd", null, `${r.accuracy}%`),
      h("dt", null, t("typingPractice.time")), timeEl,
    );
    timeEl.textContent = shortClock(Math.floor(elapsed() || stats.seconds));
    startBtn.textContent = phase === "running" ? t("typingPractice.restart") : phase === "done" ? t("typingPractice.again") : t("typingPractice.start");
    nextBtn.hidden = !(phase === "done" && passed() && nextLesson());
    input.disabled = phase !== "running";
    if (phase === "done") {
      const r2 = rates(stats);
      const weak = weakKeys(stats).map((c) => keyLabel(c, loc)).join(" ");
      statusEl.textContent = [
        t(isWords ? "typingPractice.resultWords" : "typingPractice.result", { kpm: r2.kpm, accuracy: r2.accuracy }),
        r2.accuracy >= PASS_ACCURACY ? t("typingPractice.passed") : t("typingPractice.notPassed", { n: PASS_ACCURACY }),
        !isWords && weak ? t("typingPractice.weak", { keys: weak }) : "",
      ].filter(Boolean).join(" ");
    } else if (phase === "idle") statusEl.textContent = isWords ? t("typingPractice.readyWords") : t("typingPractice.ready");
    else statusEl.textContent = "";
  };

  // ---- flow
  const reset = () => {
    phase = "idle";
    pos = 0;
    stats = emptyStats();
    startedAt = 0;
    window.clearInterval(timer);
    timer = 0;
    drill = lesson === "words" ? [] : makeDrill(lesson, cryptoRand);
    words = shuffle(wordsFor(loc), cryptoRand).slice(0, WORD_ROUND);
    input.value = "";
    paint();
  };

  const begin = () => {
    if (phase !== "idle") reset();
    phase = "running";
    paint();
    if (lesson === "words") input.focus();
    else lineEl.focus();
  };

  const tick = () => {
    if (phase !== "running" || !startedAt) return;
    timeEl.textContent = shortClock(Math.floor(elapsed()));
  };

  const firstKey = () => {
    if (startedAt) return;
    startedAt = performance.now();
    timer = window.setInterval(tick, 500);
  };

  const finish = () => {
    stats.seconds = startedAt ? (performance.now() - startedAt) / 1000 : 0;
    phase = "done";
    window.clearInterval(timer);
    timer = 0;
    progress = recordResult(progress, lesson, rates(stats));
    save();
    paint();
  };

  /** One key press in a drill (from the keyboard or a tap on the on-screen key). */
  const press = (code: string) => {
    if (lesson === "words") return;
    if (phase === "idle") begin();
    if (phase !== "running") return;
    const target = drill[pos];
    if (!target) return;
    firstKey();
    if (code === target) {
      stats.keys++;
      pos++;
      if (pos >= drill.length) return finish();
    } else {
      stats.misses++;
      stats.missedKeys[target] = (stats.missedKeys[target] ?? 0) + 1;
      const el = keyEls.get(code);
      if (el) {
        for (const k of keyEls.values()) k.classList.remove("miss");
        el.classList.add("miss");
        window.clearTimeout(flash);
        flash = window.setTimeout(() => el.classList.remove("miss"), 250);
      }
    }
    paint();
  };

  const onKey = (e: KeyboardEvent) => {
    if (lesson === "words" || e.ctrlKey || e.metaKey || e.altKey) return;
    // Only while the practice area has focus, or is on screen with nothing else focused.
    const active = document.activeElement;
    if (active !== lineEl && !(onScreen(lineEl) && (!active || active === document.body))) return;
    if (!(e.code in FINGER_OF) || phase === "done") return;
    // Before a run, a key pressed with nothing focused (Space to scroll, say) is not a practice key.
    if (phase === "idle" && active !== lineEl) return;
    e.preventDefault();
    if (e.repeat) return;
    press(e.code);
  };
  document.addEventListener("keydown", onKey);

  // ---- word round
  const checkWord = (submit: boolean) => {
    if (phase !== "running" || composing) return;
    const w = words[pos];
    if (!w) return;
    const typed = input.value.trim();
    if (!typed) return;
    if (matches(w, typed, loc)) {
      firstKey();
      stats.keys += [...w.text].length;
      pos++;
      input.value = "";
      if (pos >= words.length) return finish();
      paint();
    } else if (submit) {
      firstKey();
      // A wrong word costs as many characters as it has, so accuracy is per character in every language.
      stats.misses += [...w.text].length;
      input.classList.add("miss");
      window.setTimeout(() => input.classList.remove("miss"), 300);
      input.select();
      paint();
    }
  };
  input.addEventListener("compositionstart", () => { composing = true; if (phase === "running") firstKey(); });
  input.addEventListener("compositionend", () => { composing = false; checkWord(false); });
  input.addEventListener("input", () => {
    if (phase === "running") firstKey();
    if (composing) return;
    // A space at the end submits, except inside a word that has a space in it.
    const w = words[pos];
    if (/\s$/.test(input.value) && !(w && w.text.includes(" "))) checkWord(true);
    else checkWord(false);
  });
  input.addEventListener("keydown", (e) => {
    // keyCode 229: the Enter that commits an input-method composition.
    if (e.key === "Enter" && !e.isComposing && !composing && e.keyCode !== 229) {
      e.preventDefault();
      checkWord(true);
    }
  });

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("typingPractice.title")),
      h("p", { class: "lede" }, t("typingPractice.privacyNote")),
    ),
    h("div", { class: "tp-tool" },
      h("div", { class: "tp-main" }, statsEl, drillBox, wordBox, statusEl),
      h("aside", { class: "rail controls" },
        h("h2", null, t("typingPractice.lessons")),
        lessonList,
        h("div", { class: "stage-actions" }, startBtn, nextBtn),
        h("p", { class: "hint", id: "tp-help" }, t("typingPractice.help")),
        loc === "ko" ? h("p", { class: "hint" }, t("typingPractice.koNote")) : null,
        loc === "ja" ? h("p", { class: "hint" }, t("typingPractice.jaNote")) : null,
      ),
    ),
  );
  paint();
  mounted = {
    cleanup: () => {
      document.removeEventListener("keydown", onKey);
      window.clearInterval(timer);
      window.clearTimeout(flash);
    },
  };
}

export function unmountTypingPractice(): void {
  mounted?.cleanup();
  mounted = null;
}
