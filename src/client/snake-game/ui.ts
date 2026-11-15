import { h } from "../dom";
import { t } from "../i18n";
import { seeded } from "../../shared/random";
import { COLS, ROWS, newSnake, step, turn, type Dir, type Snake } from "../../shared/snake";
import { cryptoRand, onScreen, readStore, swipeDirection, typingTarget, writeStore } from "../game-input";

const BEST_KEY = "cvcm.snake.best";
const SPEEDS = { slow: 180, normal: 120, fast: 75 } as const;
type Speed = keyof typeof SPEEDS;
const SPEED_IDS = Object.keys(SPEEDS) as Speed[];
/** The first food of a first visit, so the page is the same before and after mount. */
const START_SEED = 20;

const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left",
  KeyW: "up", KeyD: "right", KeyS: "down", KeyA: "left",
};

let mounted: { cleanup: () => void } | null = null;

export function mountSnakeGame(host: HTMLElement): void {
  unmountSnakeGame();
  let speed: Speed = "normal";
  let walls = true;
  let snake: Snake = newSnake(walls, seeded(START_SEED));
  let running = false;
  let started = false;
  let timer = 0;
  const best = (readStore<Record<string, number>>(BEST_KEY) ?? {}) as Record<string, number>;
  const mode = () => `${speed}-${walls ? "walls" : "wrap"}`;

  const scoreEl = h("dd", { "data-out": "score" });
  const bestEl = h("dd", { "data-out": "best" });
  const statusEl = h("p", { class: "snake-status", "aria-live": "polite", "data-out": "status" });
  const canvas = h("canvas", { class: "snake-canvas", width: COLS * 20, height: ROWS * 20, "aria-hidden": "true" });
  const startText = h("p", { class: "snake-start" }, t("snakeGame.pressStart"));
  const stage = h("div", { class: "snake-stage", role: "application", tabindex: 0, "aria-label": t("snakeGame.stage"), "aria-describedby": "snake-help", "data-out": "board" }, canvas, startText);
  const startBtn = h("button", { type: "button", class: "btn", "data-action": "start", onClick: () => (running ? pause() : snake.over || !started ? restart() : resume()) });
  const speedSel = h("select", { "data-field": "speed", onChange: () => { speed = speedSel.value as Speed; if (running) { stopTimer(); timer = window.setInterval(tick, SPEEDS[speed]); } paint(); } },
    ...SPEED_IDS.map((s) => h("option", { value: s, selected: s === speed }, t(`snakeGame.s_${s}`))));
  const wallsBox = h("input", { type: "checkbox", checked: walls, "data-field": "walls", onChange: () => { walls = wallsBox.checked; restartIdle(); } });

  const draw = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width / COLS;
    const ch = canvas.height / ROWS;
    // Cell edges on whole pixels, so neighbouring cells meet without anti-aliased seams.
    const X = (x: number) => Math.round(x * cw);
    const Y = (y: number) => Math.round(y * ch);
    ctx.fillStyle = "#fdf7fa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f2dbe5";
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2) ctx.fillRect(X(x), Y(y), X(x + 1) - X(x), Y(y + 1) - Y(y));
    ctx.fillStyle = "#e0453b";
    ctx.beginPath();
    ctx.arc((snake.food.x + 0.5) * cw, (snake.food.y + 0.5) * ch, cw * 0.38, 0, Math.PI * 2);
    ctx.fill();
    snake.body.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? "#a42a5b" : "#c2336c";
      ctx.fillRect(X(p.x) + 1, Y(p.y) + 1, X(p.x + 1) - X(p.x) - 2, Y(p.y + 1) - Y(p.y) - 2);
    });
    if (!walls) return;
    ctx.strokeStyle = "#2e2229";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  };

  const paint = () => {
    scoreEl.textContent = String(snake.score);
    bestEl.textContent = String(Math.max(best[mode()] ?? 0, snake.score));
    startBtn.textContent = running ? t("snakeGame.pause") : snake.over || !started ? t("snakeGame.start") : t("snakeGame.resume");
    statusEl.textContent = snake.over ? t("snakeGame.over", { score: snake.score }) : started && !running ? t("snakeGame.paused") : "";
    startText.hidden = started;
    if (started) draw();
  };

  const stopTimer = () => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const tick = () => {
    const r = step(snake, cryptoRand);
    snake = r.snake;
    if (snake.over) {
      running = false;
      stopTimer();
      if (snake.score > (best[mode()] ?? 0)) {
        best[mode()] = snake.score;
        writeStore(BEST_KEY, best);
      }
    }
    paint();
  };

  const resume = () => {
    if (snake.over) return;
    running = true;
    started = true;
    stopTimer();
    timer = window.setInterval(tick, SPEEDS[speed]);
    paint();
    stage.focus({ preventScroll: true });
  };

  const pause = () => {
    running = false;
    stopTimer();
    paint();
  };

  const restart = () => {
    snake = newSnake(walls, cryptoRand);
    resume();
  };

  /** A setting change starts over without moving until Start. */
  const restartIdle = () => {
    pause();
    snake = newSnake(walls, cryptoRand);
    started = true;
    paint();
  };

  const go = (dir: Dir) => {
    if (snake.over) return;
    if (!running) resume();
    snake = turn(snake, dir);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || typingTarget(e.target)) return;
    if (document.activeElement !== stage && !onScreen(stage)) return;
    if (e.code === "Space" || e.code === "KeyP") {
      // Space on a button or link keeps its own meaning.
      if ((e.target as Element | null)?.closest?.("button, a, select")) return;
      e.preventDefault();
      if (running) pause();
      else if (snake.over || !started) restart();
      else resume();
      return;
    }
    const dir = KEYS[e.code];
    if (!dir) return;
    // Before the first game and after one ends, arrow keys scroll the page as usual.
    if (snake.over || (!running && !started)) return;
    e.preventDefault();
    go(dir);
  };
  document.addEventListener("keydown", onKey);

  const onHidden = () => {
    if (document.hidden && running) pause();
  };
  document.addEventListener("visibilitychange", onHidden);

  let swipe: { x: number; y: number; id: number } | null = null;
  stage.addEventListener("pointerdown", (e) => {
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  stage.addEventListener("pointerup", (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dir = swipeDirection(e.clientX - swipe.x, e.clientY - swipe.y, 20);
    swipe = null;
    if (dir) go(dir);
    else if (!running) (snake.over || !started ? restart : resume)();
  });
  stage.addEventListener("pointercancel", () => { swipe = null; });

  const pad = h("div", { class: "snake-pad", role: "group", "aria-label": t("snakeGame.pad") },
    ...(["up", "left", "down", "right"] as const).map((dir) =>
      h("button", { type: "button", class: `btn ghost snake-${dir}`, "data-dir": dir, "aria-label": t(`snakeGame.d_${dir}`), onClick: () => go(dir) }, { up: "↑", right: "→", down: "↓", left: "←" }[dir])));

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("snakeGame.title")),
      h("p", { class: "lede" }, t("snakeGame.privacyNote")),
    ),
    h("div", { class: "snake-tool" },
      h("div", { class: "snake-main" },
        h("dl", { class: "stats-grid snake-score" }, h("dt", null, t("snakeGame.score")), scoreEl, h("dt", null, t("snakeGame.best")), bestEl),
        stage,
        statusEl,
      ),
      h("aside", { class: "rail controls" },
        h("div", { class: "stage-actions" }, startBtn),
        h("label", { class: "field" }, h("span", null, t("snakeGame.speed")), speedSel),
        h("label", { class: "check" }, wallsBox, h("span", null, t("snakeGame.walls"))),
        pad,
        h("p", { class: "hint", id: "snake-help" }, t("snakeGame.hint")),
      ),
    ),
  );
  paint();
  mounted = {
    cleanup: () => {
      stopTimer();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHidden);
    },
  };
}

export function unmountSnakeGame(): void {
  mounted?.cleanup();
  mounted = null;
}
