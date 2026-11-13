import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, onScreen, readStore, typingTarget, writeStore } from "../game-input";

/**
 * The dinosaur game from Chrome's offline page: The Chromium Authors' T-Rex runner (BSD-3-Clause), as extracted by
 * wayou/t-rex-runner, vendored in src/vendor/t-rex-runner/ with the changes listed at its top. The runner is loaded
 * as its own chunk and started after mount, so the prerendered page only holds the frame and the instructions.
 */

/** The runner's sprite sheets from the same Chromium page (public/assets/games/dinosaur/). */
const SPRITES = { LDPI: "/assets/games/dinosaur/sprite-1x.png", HDPI: "/assets/games/dinosaur/sprite-2x.png" };
const BEST_KEY = "cvcm.dino.best";
const MUTE_KEY = "cvcm.dino.mute";

type RunnerInstance = { press(): void; release(): void; destroy(): void; highestScore: number };
type RunnerClass = {
  new (el: HTMLElement): RunnerInstance;
  spriteUrls: { LDPI: string; HDPI: string };
  ignoreKey: (e: KeyboardEvent) => boolean;
  onGameOver: ((score: number, best: number) => void) | null;
  muted: boolean;
  initialBest: number;
  instance_: RunnerInstance | null;
};

let mounted: { cleanup: () => void } | null = null;

/** Keys the game must leave alone: typing in a field, Space or Enter on a button, link or select, or with modifiers. */
export function ignoreGameKey(e: KeyboardEvent): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return true;
  if (typingTarget(e.target)) return true;
  const el = e.target instanceof Element ? e.target : null;
  return !!el?.closest("button, a, summary, [role=button]");
}

export function mountDinosaurGame(host: HTMLElement): void {
  unmountDinosaurGame();
  let runner: RunnerInstance | null = null;
  let RunnerRef: RunnerClass | null = null;
  let alive = true;
  let frame = 0;
  let tries = 0;
  let starting = false;
  let best = Math.max(0, Math.floor(Number(readStore<number>(BEST_KEY)) || 0));
  let muted = readStore<boolean>(MUTE_KEY) === true;

  const lastEl = h("dd", { "data-out": "last" }, "–");
  const bestEl = h("dd", { "data-out": "best" });
  const stage = h("div", { class: "dino-stage", role: "application", "aria-label": t("dinosaurGame.stage"), "aria-describedby": "dino-help", "data-out": "stage" },
    h("p", { class: "dino-start" }, t("dinosaurGame.start")),
  );
  const muteBtn = h("button", { type: "button", class: "btn ghost", "data-action": "mute", "aria-pressed": String(muted), onClick: () => {
    muted = !muted;
    writeStore(MUTE_KEY, muted);
    if (RunnerRef) RunnerRef.muted = muted;
    paint();
  } });

  const paint = () => {
    // The runner keeps raw distance; it shows a hundredth (x 0.025, its DistanceMeter COEFFICIENT) as the score.
    bestEl.textContent = best ? String(Math.round(best * 0.025)) : "–";
    muteBtn.textContent = muted ? t("dinosaurGame.soundOff") : t("dinosaurGame.soundOn");
    muteBtn.setAttribute("aria-pressed", String(muted));
  };

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    stage.focus({ preventScroll: true });
    if (!runner) wait();
    runner?.press();
  });
  const release = () => runner?.release();
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  const start = async () => {
    if (starting) return;
    starting = true;
    const mod = await import("../../vendor/t-rex-runner/runner.js");
    if (!alive) return;
    const R = mod.Runner as unknown as RunnerClass;
    RunnerRef = R;
    R.spriteUrls = SPRITES;
    // Space and Up act only while the game is on screen, so the page still scrolls to the how-to and FAQ.
    R.ignoreKey = (e) => ignoreGameKey(e) || (document.activeElement !== stage && !onScreen(stage));
    R.initialBest = best;
    R.muted = muted;
    R.onGameOver = (score) => {
      lastEl.textContent = String(score);
      if (runner && runner.highestScore > best) {
        best = runner.highestScore;
        writeStore(BEST_KEY, best);
      }
      paint();
    };
    stage.querySelector(".dino-start")?.remove();
    runner = new R(stage);
  };

  // Start once the page is really on screen (the client mounts off-screen first, and the prerender has no canvas).
  const wait = () => {
    if (!alive) return;
    if (stage.isConnected && stage.offsetWidth > 0 && typeof HTMLCanvasElement !== "undefined" && document.createElement("canvas").getContext("2d")) {
      void start();
      return;
    }
    // About ten seconds; after that a tap or focus on the game starts it (see below).
    if (++tries < 600) frame = window.requestAnimationFrame(wait);
  };

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("dinosaurGame.title")),
      h("p", { class: "lede" }, t("dinosaurGame.privacyNote")),
    ),
    h("div", { class: "dino-tool" },
      h("div", { class: "dino-main" },
        stage,
        h("dl", { class: "stats-grid dino-score" }, h("dt", null, t("dinosaurGame.last")), lastEl, h("dt", null, t("dinosaurGame.best")), bestEl),
      ),
      h("aside", { class: "rail controls" },
        h("div", { class: "stage-actions" }, muteBtn),
        h("p", { class: "hint", id: "dino-help" }, t("dinosaurGame.hint")),
        creditLine("dinosaurGame.credit", "https://github.com/wayou/t-rex-runner", "t-rex-runner"),
      ),
    ),
  );
  stage.tabIndex = 0;
  stage.addEventListener("focus", () => { if (!runner) wait(); });
  paint();
  if (typeof window.requestAnimationFrame === "function") frame = window.requestAnimationFrame(wait);
  mounted = {
    cleanup: () => {
      alive = false;
      if (frame) window.cancelAnimationFrame(frame);
      runner?.destroy();
      runner = null;
      if (RunnerRef) {
        RunnerRef.onGameOver = null;
        RunnerRef.instance_ = null;
      }
    },
  };
}

export function unmountDinosaurGame(): void {
  mounted?.cleanup();
  mounted = null;
}
