import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { h } from "./dom";
import { t } from "./i18n";
import { typingTarget } from "./game-input";

/**
 * Shared shell of the 3D games (games3d group). The page mounts plain DOM only: a stage box with a Play cover. Three.js
 * (~150 KB gzip) is imported and the WebGL renderer created when the player presses Play, never at mount, so the
 * prerender (happy-dom, no WebGL) and the first paint stay light and a phone WebView does not hold a GL context for a
 * page nobody is playing. Strings are under `game3d.*`.
 */

export type Three = typeof import("three");

export interface Stage {
  THREE: Three;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** Frame callback while the stage is on screen and the tab visible; dt in seconds, clamped to 0–0.05. */
  onFrame(cb: (dt: number) => void): void;
  /** Demand mode: draw once on the next animation frame (turn-based games). Loop mode draws every frame anyway. */
  invalidate(): void;
  /** CSS pixel size of the canvas. */
  size(): { width: number; height: number };
  dispose(): void;
}

export interface StageOptions {
  /** "loop" renders every visible frame (action games); "demand" only after invalidate() (board and puzzle games). */
  mode: "loop" | "demand";
  fov?: number;
  near?: number;
  far?: number;
  background?: number;
  /** Called when the browser drops the GL context (GPU reset, memory pressure); the shell shows a restart button. */
  onLost?: () => void;
  /** Loop mode: frames (callbacks and drawing) run only while this is true, e.g. not behind a game-over cover. */
  active?: () => boolean;
}

/** The stage built in each shell's stage box, so the shell can free it when a game's start() throws half-way. */
const stageOf = new WeakMap<HTMLElement, Stage>();


/** Coarse pointer (phone or tablet): lower pixel ratio and lighter scenes. */
export function coarsePointer(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}

/** Loads three.js and builds a renderer, scene and camera filling `host`. Null when WebGL is unavailable. */
export async function createStage(host: HTMLElement, opts: StageOptions): Promise<Stage | null> {
  // No separate probe context: WebGLRenderer throws when WebGL is unavailable, and that is caught below.
  if (typeof document === "undefined") return null;
  const THREE = await import("three");
  let renderer: WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !coarsePointer(), powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer() ? 1.5 : 2));
  const canvas = renderer.domElement;
  canvas.classList.add("g3d-canvas");
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);

  const scene = new THREE.Scene();
  if (opts.background !== undefined) scene.background = new THREE.Color(opts.background);
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 50, 1, opts.near ?? 0.1, opts.far ?? 1000);

  const callbacks: ((dt: number) => void)[] = [];
  let width = 1;
  let height = 1;
  let visible = true;
  let disposed = false;
  let dirty = true;
  let last = 0;
  let raf = 0;

  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
    // setSize clears the canvas; behind a cover no frame redraws it, so draw the scene once now.
    if (opts.active && !opts.active()) renderer.render(scene, camera);
    schedule();
  };

  const frame = (now: number) => {
    raf = 0;
    if (disposed) return;
    const running = visible && !document.hidden;
    if (!running) {
      last = 0;
      return;
    }
    if (opts.active && !opts.active()) {
      // Hidden behind a cover: stop until the shell uncovers (it calls invalidate()); the pause is not elapsed time.
      last = 0;
      return;
    }
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    for (const cb of callbacks) cb(dt);
    if (opts.mode === "loop" || dirty) {
      dirty = false;
      renderer.render(scene, camera);
    }
    if (opts.mode === "loop") schedule();
  };

  function schedule() {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) schedule();
    })
    : null;
  io?.observe(host);
  const onVisibility = () => {
    if (!document.hidden) schedule();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onLost = (e: Event) => {
    e.preventDefault();
    opts.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  resize();

  const stage: Stage = {
    THREE,
    renderer,
    scene,
    camera,
    canvas,
    onFrame(cb) {
      callbacks.push(cb);
      schedule();
    },
    invalidate() {
      dirty = true;
      schedule();
    },
    size: () => ({ width, height }),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      if (stageOf.get(host) === stage) stageOf.delete(host);
    },
  };
  stageOf.set(host, stage);
  return stage;
}

/** Frees every geometry, material and texture under `root` (three keeps GPU buffers until told). */
export function disposeScene(root: { traverse(cb: (o: unknown) => void): void }): void {
  root.traverse((o) => {
    // InstancedMesh keeps its own instance-matrix buffer.
    const inst = o as { isInstancedMesh?: boolean; dispose?: () => void };
    if (inst.isInstancedMesh) inst.dispose?.();
    const mesh = o as { geometry?: { dispose(): void }; material?: unknown };
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats as Record<string, unknown>[]) {
      for (const value of Object.values(m)) {
        if (value && typeof value === "object" && (value as { isTexture?: boolean }).isTexture) (value as { dispose(): void }).dispose();
      }
      (m as { dispose?: () => void }).dispose?.();
    }
  });
}

export interface Shell {
  /** The whole game box (stage + cover); goes full screen. */
  root: HTMLElement;
  /** The element the canvas goes into; keyboard focus target. */
  stage: HTMLElement;
  /** Full screen toggle button, for the game's toolbar. */
  fullscreenButton: HTMLButtonElement;
  /**
   * Shows the cover again with a message (game over) and a button label. Ignored after a lost context until the
   * player restarts, so a game's delayed "game over" cover cannot hide that the 3D view stopped.
   */
  cover(message: string, button?: string): void;
  /** The lost-context cover (see lostContext); stays until the next Play. */
  coverLost(): void;
  /** Hides the cover. */
  uncover(): void;
  /** The cover is showing (before the first Play, game over, lost context): the game should not run or take keys. */
  covered(): boolean;
  /** Tears down the running game (stage, listeners) but keeps the shell usable: the next Play builds it again. */
  stop(): void;
  dispose(): void;
}

export interface ShellOptions {
  /** aria-label of the stage. */
  label: string;
  /** Text on the cover before the first start. */
  intro: string;
  /** Extra class on the root, e.g. "g3d-tall" for a portrait stage. */
  className?: string;
  /**
   * Builds the game on the first Play (and again after a lost context). Return a cleanup. A null stage means WebGL is
   * not available; the shell then shows `game3d.noWebgl` and keeps the Play button for a retry. If it throws after
   * creating a stage, it must dispose that stage itself.
   */
  start(stage: HTMLElement): Promise<(() => void) | null>;
  /** Later presses of the cover button (game over → play again) when the game is already built. */
  resume?(): void;
}

/**
 * Stage box with a Play cover and a full screen button. The game owns everything inside once started; the shell only
 * handles loading, WebGL errors and full screen.
 */
export function gameShell(opts: ShellOptions): Shell {
  let cleanup: (() => void) | null = null;
  let loading = false;
  let disposed = false;
  /** The GL context was lost: only the lost cover shows until the next Play. */
  let lost = false;
  /** Bumped by stop()/dispose(), so a start that resolves afterwards tears its own game down. */
  let generation = 0;
  const msg = h("p", { class: "g3d-msg", "aria-live": "polite" }, opts.intro);
  const btn = h("button", { type: "button", class: "btn g3d-play", "data-act": "play" }, t("game3d.play")) as HTMLButtonElement;
  const coverEl = h("div", { class: "g3d-cover" }, msg, btn);
  // Window-filling fallback (iPhone has no element full screen): the toolbar is under the box then, so it gets its
  // own exit button, and Esc works too.
  const exitBtn = h("button", { type: "button", class: "btn g3d-exit", "data-act": "exit-fullscreen", "aria-label": t("game3d.exitFullscreen") }, "✕") as HTMLButtonElement;
  const stage = h("div", { class: "g3d-stage", role: "application", tabindex: 0, "aria-label": opts.label, "data-out": "stage" });
  const root = h("div", { class: `g3d-root${opts.className ? ` ${opts.className}` : ""}` }, stage, coverEl, exitBtn);

  const fullscreenButton = h("button", { type: "button", class: "btn ghost", "data-act": "fullscreen", "aria-pressed": "false" }, t("game3d.fullscreen")) as HTMLButtonElement;
  const isFull = () => document.fullscreenElement === root || root.classList.contains("g3d-full");
  const syncFull = () => {
    const on = isFull();
    fullscreenButton.textContent = on ? t("game3d.exitFullscreen") : t("game3d.fullscreen");
    fullscreenButton.setAttribute("aria-pressed", String(on));
  };
  const leaveFull = () => {
    root.classList.remove("g3d-full");
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    syncFull();
  };
  exitBtn.addEventListener("click", leaveFull);
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape" && root.classList.contains("g3d-full")) leaveFull();
  };
  document.addEventListener("keydown", onEsc);
  fullscreenButton.addEventListener("click", () => {
    if (isFull()) {
      leaveFull();
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => root.classList.add("g3d-full")).finally(syncFull);
    } else {
      // iPhone Safari has no element full screen: cover the window instead.
      root.classList.add("g3d-full");
    }
    syncFull();
    stage.focus({ preventScroll: true });
  });
  document.addEventListener("fullscreenchange", syncFull);

  // Space or Enter on the focused stage while the cover is up presses its button (Play, Play again, Restart). The
  // event stops here so a game's own key handling (a held power key, say) never sees the same press.
  // It runs in the capture phase and stops the event outright (other stage listeners included). The key that pressed
  // the button is remembered until it comes up: its auto-repeats are swallowed too, so holding it a little long does
  // not start a power charge in the game that just began.
  let swallow: string | null = null;
  const onCoverKey = (e: KeyboardEvent) => {
    if (swallow !== null && e.code === swallow) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (coverEl.hidden || e.target !== stage || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat && !btn.disabled) {
      swallow = e.code;
      btn.click();
    }
  };
  const onCoverKeyUp = (e: KeyboardEvent) => {
    if (e.code === swallow) swallow = null;
  };
  const onWindowBlur = () => {
    swallow = null;
  };
  stage.addEventListener("keydown", onCoverKey, true);
  window.addEventListener("keyup", onCoverKeyUp);
  window.addEventListener("blur", onWindowBlur);
  const shell: Shell = {
    root,
    stage,
    fullscreenButton,
    cover(message, button) {
      if (lost) return;
      msg.textContent = message;
      btn.textContent = button ?? t("game3d.play");
      coverEl.hidden = false;
    },
    coverLost() {
      lost = false;
      shell.cover(t("game3d.lost"), t("game3d.restart"));
      lost = true;
    },
    uncover() {
      // The lost-context cover stays until the next Play (that path clears `lost` first).
      if (lost) return;
      coverEl.hidden = true;
      stage.focus({ preventScroll: true });
      // A loop stage stops drawing while covered; start it again.
      stageOf.get(stage)?.invalidate();
    },
    covered: () => !coverEl.hidden,
    stop() {
      generation++;
      const done = cleanup;
      cleanup = null;
      done?.();
    },
    dispose() {
      disposed = true;
      document.removeEventListener("fullscreenchange", syncFull);
      document.removeEventListener("keydown", onEsc);
      stage.removeEventListener("keydown", onCoverKey, true);
      window.removeEventListener("keyup", onCoverKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      shell.stop();
    },
  };

  btn.addEventListener("click", async () => {
    if (loading) return;
    if (cleanup) {
      shell.uncover();
      opts.resume?.();
      return;
    }
    loading = true;
    lost = false;
    btn.disabled = true;
    msg.textContent = t("game3d.loading");
    const gen = generation;
    let built: (() => void) | null = null;
    try {
      built = await opts.start(stage);
    } catch {
      built = null;
      // A start that threw after creating its stage would leave a live GL context behind.
      stageOf.get(stage)?.dispose();
    }
    loading = false;
    btn.disabled = false;
    // The page was left (or the game stopped) while three.js was loading: drop what was just built.
    if (disposed || gen !== generation) {
      built?.();
      if (!disposed) shell.cover(opts.intro);
      return;
    }
    cleanup = built;
    if (!cleanup) {
      shell.cover(t("game3d.noWebgl"), t("game3d.retry"));
      return;
    }
    shell.uncover();
  });
  return shell;
}

/** Call from a stage's onLost: drops the dead game and offers a fresh start. */
export function lostContext(shell: Shell): void {
  shell.stop();
  shell.coverLost();
}

/**
 * Held keys by action, read each frame (driving, flight). Keys count only while the stage has focus or is on screen
 * and nothing is being typed; arrow keys and Space stop scrolling the page then.
 */
export function heldKeys<A extends string>(map: Record<string, A>, active: () => boolean): { held: Set<A>; dispose(): void } {
  const held = new Set<A>();
  // Keys down per code, so releasing W does not cut the gas while ArrowUp (same action) is still held.
  const codes = new Set<string>();
  const down = (e: KeyboardEvent) => {
    if (typingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    // Space or Enter on a focused button or link is that control's own key.
    if (e.target instanceof Element && e.target.closest("button, a, summary")) return;
    const action = map[e.code];
    if (!action || !active()) return;
    e.preventDefault();
    codes.add(e.code);
    held.add(action);
  };
  const up = (e: KeyboardEvent) => {
    const action = map[e.code];
    if (!action) return;
    codes.delete(e.code);
    if (![...codes].some((c) => map[c] === action)) held.delete(action);
  };
  const blur = () => {
    held.clear();
    codes.clear();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return {
    held,
    dispose() {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    },
  };
}

/**
 * On-screen hold buttons for phones: pressing adds the action to `held`, lifting or leaving removes it. Buttons never
 * take focus (pointerdown default prevented), so the stage keeps the keyboard.
 */
export function holdPad<A extends string>(buttons: { action: A; label: string; aria: string }[], held: Set<A>, className = ""): HTMLElement {
  return h("div", { class: `g3d-pad${className ? ` ${className}` : ""}`, role: "group", "aria-label": t("game3d.pad") },
    ...buttons.map((b) => {
      const el = h("button", { type: "button", class: `btn ghost g3d-key g3d-${b.action}`, "aria-label": b.aria, "data-hold": b.action }, b.label);
      const off = () => held.delete(b.action);
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        held.add(b.action);
      });
      el.addEventListener("pointerup", off);
      el.addEventListener("pointercancel", off);
      el.addEventListener("lostpointercapture", off);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      return el;
    }),
  );
}
