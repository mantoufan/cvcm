import type { CanvasTexture, Group, Material, Vector2 } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";
import { coarsePointer, createStage, gameShell, lostContext, type Stage } from "../three-stage";
import {
  BULL_R,
  CLOCK_ORDER,
  CPU_SIGMA,
  DOUBLE_IN,
  DOUBLE_OUT,
  OUTER_BULL_R,
  PLAYER_SIGMA,
  SECTORS,
  TRIPLE_IN,
  TRIPLE_OUT,
  X01_START,
  applyHit,
  checkout,
  cleanStats,
  cpuTarget,
  hitLabel,
  newMatch,
  scoreAt,
  swayOffset,
  targetPoint,
  threeDartAverage,
  throwAt,
  type CpuLevel,
  type Hit,
  type Match,
  type Mode,
  type Stats,
  type Target,
} from "../../shared/darts";

/**
 * Darts on a 3D board (games3d group). Rules, scoring and the computer live in src/shared/darts.ts; this page draws
 * the board (a canvas texture on a disc), the aim reticle and the darts, and runs the turn order. three.js loads on
 * Play (three-stage.ts). Settings and best scores are kept in `cvcm.darts.v1`.
 */

const STORE_KEY = "cvcm.darts.v1";
/** World units per millimetre: the double ring's outer edge (170 mm) is 1.7 units from the centre. */
const MM = 0.01;
const BOARD_R = 2.25;
const FLIGHT_S = 0.32;
type Opponent = "solo" | "cpu0" | "cpu1" | "cpu2";
const MODES: Mode[] = ["x01", "clock", "practice"];
const OPPONENTS: Opponent[] = ["solo", "cpu0", "cpu1", "cpu2"];

interface Saved extends Stats {
  mode: Mode;
  opp: Opponent;
}

let mounted: { cleanup: () => void } | null = null;

function loadSaved(): Saved {
  const raw = readStore<Record<string, unknown>>(STORE_KEY) ?? {};
  const mode = MODES.includes(raw.mode as Mode) ? (raw.mode as Mode) : "x01";
  const opp = OPPONENTS.includes(raw.opp as Opponent) ? (raw.opp as Opponent) : "cpu1";
  return { ...cleanStats(raw), mode, opp };
}

/** Localized label of a hit or target ("T20", "Bull", "Miss"). */
function label(hit: Hit | Target): string {
  if (hit.sector === 25) return hit.mult === 2 ? t("darts.bull") : t("darts.outerBull");
  if (!hit.sector) return t("darts.miss");
  return hitLabel(hit);
}

export function mountDarts(host: HTMLElement): void {
  unmountDarts();
  const saved = loadSaved();
  let mode: Mode = saved.mode;
  let opp: Opponent = saved.opp;
  let stats: Stats = { bestAvg: saved.bestAvg, bestLeg: saved.bestLeg, bestClock: saved.bestClock };
  let match: Match = newMatch(mode, opp !== "solo");
  const save = () => writeStore(STORE_KEY, { mode, opp, ...stats });
  const level = (): CpuLevel => (opp === "cpu0" ? 0 : opp === "cpu2" ? 2 : 1);

  const statusEl = h("p", { class: "dt-status", "aria-live": "polite", "data-out": "status" });
  const boardEl = h("table", { class: "dt-score", "data-out": "scoreboard" });
  const turnEl = h("p", { class: "dt-turn", "data-out": "turn" });
  const bestEl = h("p", { class: "hint dt-best", "data-out": "best" });
  const hudEl = h("div", { class: "g3d-hud dt-hud", "aria-hidden": "true" });

  const modeSel = h("select", { "data-in": "mode" }, ...MODES.map((m) => h("option", { value: m }, t(`darts.m_${m}`)))) as HTMLSelectElement;
  modeSel.value = mode;
  const oppSel = h("select", { "data-in": "opponent" }, ...OPPONENTS.map((o) => h("option", { value: o }, t(`darts.o_${o}`)))) as HTMLSelectElement;
  oppSel.value = opp;

  /** The running 3D game, set while a stage exists. */
  let game: { reset(): void; nudge(dx: number, dy: number): void; hold(): void; release(): void; dispose(): void } | null = null;

  const shell = gameShell({
    label: t("darts.stage"),
    intro: t("darts.intro"),
    className: "g3d-square dt-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 40, near: 0.1, far: 60, background: 0xfdf0f5, active: () => !shell.covered(), onLost: () => { game = null; lostContext(shell); } });
      if (!stage) return null;
      try {
        game = build(stage);
      } catch (err) {
        stage.dispose();
        throw err;
      }
      return () => {
        game?.dispose();
        game = null;
        stage.dispose();
      };
    },
    resume: () => {
      newGame();
    },
  });
  shell.root.insertBefore(hudEl, shell.stage.nextSibling);

  // ---------------------------------------------------------------- text

  let lastBoard = "";
  let lastHud = "";
  const render = () => {
    const rows = match.players.map((p, i) => {
      const name = p.cpu ? t("darts.cpu") : t("darts.you");
      const next = CLOCK_ORDER[Math.min(p.clock, CLOCK_ORDER.length - 1)]!;
      const value = match.mode === "x01" ? String(p.remaining) : match.mode === "clock" ? (next === 25 ? t("darts.bull") : String(next)) : String(p.points);
      return { i, name, value, darts: p.darts, avg: threeDartAverage(p).toFixed(1) };
    });
    const key = JSON.stringify([match.mode, match.current, rows]);
    if (key !== lastBoard) {
      lastBoard = key;
      const head = match.mode === "x01" ? t("darts.remaining") : match.mode === "clock" ? t("darts.target") : t("darts.points");
      boardEl.replaceChildren(
        h("thead", null, h("tr", null, h("th", null, t("darts.player")), h("th", null, head), h("th", null, t("darts.darts")), h("th", null, t("darts.avg")))),
        h("tbody", null, ...rows.map((r) => h("tr", { class: r.i === match.current && match.winner === null ? "dt-now" : "" },
          h("th", { scope: "row" }, r.name), h("td", null, r.value), h("td", null, String(r.darts)), h("td", null, r.avg)))),
      );
    }
    const p = match.players[match.current]!;
    const thrown = match.turn.map(label).join(" · ");
    const route = match.mode === "x01" && !p.cpu ? checkout(p.remaining, 3 - match.turn.length) : null;
    const routeText = match.mode === "x01" && !p.cpu && p.remaining <= 170
      ? (route ? t("darts.checkout", { route: route.map(label).join(" ") }) : t("darts.noCheckout"))
      : "";
    const who = p.cpu ? t("darts.turnCpu") : t("darts.turnYou");
    turnEl.textContent = [who, thrown ? `${t("darts.thisTurn")}: ${thrown}` : "", routeText].filter(Boolean).join(" — ");
    const hud = [match.mode === "x01" ? `${p.cpu ? t("darts.cpu") : t("darts.you")} ${p.remaining}` : "", thrown, routeText].filter(Boolean).join("  ·  ");
    if (hud !== lastHud) {
      lastHud = hud;
      hudEl.textContent = hud;
    }
    const best: string[] = [];
    if (stats.bestAvg) best.push(t("darts.bestAvg", { n: stats.bestAvg.toFixed(1) }));
    if (stats.bestLeg) best.push(t("darts.bestLeg", { n: stats.bestLeg }));
    if (stats.bestClock) best.push(t("darts.bestClock", { n: stats.bestClock }));
    bestEl.textContent = best.join(" · ");
  };

  const focusStage = () => {
    if (game) shell.stage.focus({ preventScroll: true });
  };

  const newGame = () => {
    match = newMatch(mode, opp !== "solo");
    statusEl.textContent = "";
    game?.reset();
    render();
  };

  modeSel.addEventListener("change", () => {
    mode = modeSel.value as Mode;
    oppSel.disabled = mode === "practice";
    save();
    newGame();
    if (game) shell.uncover();
    focusStage();
  });
  oppSel.disabled = mode === "practice";
  oppSel.addEventListener("change", () => {
    opp = oppSel.value as Opponent;
    save();
    newGame();
    if (game) shell.uncover();
    focusStage();
  });
  const newBtn = h("button", { type: "button", class: "btn", "data-act": "new" }, t("darts.newGame"));
  newBtn.addEventListener("click", () => {
    newGame();
    if (game) shell.uncover();
    focusStage();
  });

  /** After each dart: status line, stats and the end of a leg. */
  const afterHit = (hit: Hit, thrower: number, events: string[]) => {
    const p = match.players[thrower]!;
    const name = p.cpu ? t("darts.cpu") : t("darts.you");
    if (events.includes("bust")) statusEl.textContent = t("darts.bust", { name, n: p.remaining });
    else statusEl.textContent = t("darts.scored", { name, hit: label(hit), n: hit.score });
    if (!events.includes("win")) return;
    let msg: string;
    if (p.cpu) msg = t("darts.cpuWins");
    else if (match.mode === "x01") {
      const avg = (X01_START / p.darts) * 3;
      const record = !stats.bestLeg || p.darts < stats.bestLeg;
      stats = { ...stats, bestAvg: Math.max(stats.bestAvg, Math.round(avg * 10) / 10), bestLeg: record ? p.darts : stats.bestLeg };
      save();
      msg = t("darts.youWin", { n: p.darts, avg: avg.toFixed(1) });
    } else {
      if (!stats.bestClock || p.darts < stats.bestClock) stats = { ...stats, bestClock: p.darts };
      save();
      msg = t("darts.clockDone", { n: p.darts });
    }
    statusEl.textContent = msg;
    render();
    // Let the winning dart land on screen before the cover.
    window.clearTimeout(coverTimer);
    coverTimer = window.setTimeout(() => shell.cover(msg, t("darts.again")), 900);
  };
  let coverTimer = 0;

  // ---------------------------------------------------------------- 3D

  function build(stage: Stage) {
    const { THREE, scene, camera } = stage;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf4d6e4, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(2, 3, 6);
    scene.add(sun);

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: 0xf6dbe7 }));
    wall.position.z = -0.12;
    scene.add(wall);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(BOARD_R + 0.08, BOARD_R + 0.08, 0.1, 96), new THREE.MeshLambertMaterial({ color: 0x2a2026 }));
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.06;
    scene.add(back);
    const texture = boardTexture(THREE);
    const face = new THREE.Mesh(new THREE.CircleGeometry(BOARD_R, 128), new THREE.MeshLambertMaterial({ map: texture }));
    face.position.z = 0.001;
    scene.add(face);

    // Reticle: a ring and a dot, always drawn on top.
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0xc2336c, depthTest: false, transparent: true, opacity: 0.9 });
    const reticle = new THREE.Group();
    reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.07, 0.095, 40), reticleMat));
    reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), reticleMat));
    reticle.renderOrder = 10;
    reticle.position.z = 0.05;
    scene.add(reticle);

    // Dart parts, shared by every dart.
    const tipGeo = new THREE.ConeGeometry(0.014, 0.14, 10).rotateX(-Math.PI / 2).translate(0, 0, 0.07);
    const barrelGeo = new THREE.CylinderGeometry(0.034, 0.03, 0.34, 14).rotateX(-Math.PI / 2).translate(0, 0, 0.31);
    const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8).rotateX(-Math.PI / 2).translate(0, 0, 0.59);
    const flightShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.13, 0.05), new THREE.Vector2(0.13, 0.24), new THREE.Vector2(0, 0.2)]);
    const flightGeo = new THREE.ShapeGeometry(flightShape).rotateY(-Math.PI / 2).translate(0, 0, 0.56);
    const metal = new THREE.MeshStandardMaterial({ color: 0xc9c4c8, metalness: 0.7, roughness: 0.35 });
    const shaftMat = new THREE.MeshLambertMaterial({ color: 0x3a2f36 });
    const flightMats = [
      new THREE.MeshLambertMaterial({ color: 0xe85d93, side: THREE.DoubleSide }),
      new THREE.MeshLambertMaterial({ color: 0x5b8bd6, side: THREE.DoubleSide }),
    ];
    const makeDart = (player: number): Group => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(tipGeo, metal), new THREE.Mesh(barrelGeo, metal), new THREE.Mesh(shaftGeo, shaftMat));
      for (let k = 0; k < 4; k++) {
        const f = new THREE.Mesh(flightGeo, flightMats[player % 2]!);
        f.rotation.z = (k * Math.PI) / 2;
        g.add(f);
      }
      return g;
    };

    let onBoard: Group[] = [];
    const clearDarts = () => {
      for (const d of onBoard) scene.remove(d);
      onBoard = [];
    };

    // Turn engine, run on the stage clock so it pauses off screen and behind the cover.
    let clock = 0;
    let aim = targetPoint({ sector: 20, mult: 3 });
    let holdFrom: number | null = null;
    let flight: { dart: Group; from: { x: number; y: number; z: number }; to: { x: number; y: number }; t: number; thrower: number; hit: Hit } | null = null;
    let wait: { at: number; fn: () => void } | null = null;
    let cpuAim: { from: { x: number; y: number }; to: { x: number; y: number }; t: number } | null = null;
    const humanTurn = () => match.winner === null && !match.players[match.current]!.cpu && !flight && !wait;

    const later = (seconds: number, fn: () => void) => {
      wait = { at: clock + seconds, fn };
    };

    const launch = (to: { x: number; y: number }, thrower: number) => {
      const hit = scoreAt(to.x, to.y);
      const dart = makeDart(thrower);
      const from = { x: to.x * MM * 0.3, y: -1.6, z: 6.2 };
      dart.position.set(from.x, from.y, from.z);
      scene.add(dart);
      flight = { dart, from, to, t: 0, thrower, hit };
    };

    const land = () => {
      const f = flight!;
      flight = null;
      const r = Math.hypot(f.to.x, f.to.y) * MM;
      // Off the board darts stay in the surround or the wall a little behind it.
      f.dart.position.set(f.to.x * MM, f.to.y * MM, r > BOARD_R + 0.08 ? -0.12 : 0);
      f.dart.rotation.set(0.12 + cryptoRand() * 0.12, (cryptoRand() - 0.5) * 0.2, 0);
      onBoard.push(f.dart);
      const res = applyHit(match, f.hit);
      match = res.match;
      afterHit(f.hit, f.thrower, res.events);
      render();
      if (res.events.includes("win")) return;
      if (res.events.includes("turnEnd")) {
        later(1.1, () => {
          clearDarts();
          nextTurn();
        });
      } else nextTurn();
    };

    /** Starts the computer's next dart, or waits for the player. */
    const nextTurn = () => {
      const p = match.players[match.current]!;
      if (match.winner !== null || !p.cpu) return;
      const target = cpuTarget(match);
      const to = targetPoint(target);
      const from = { x: reticle.position.x / MM, y: reticle.position.y / MM };
      later(0.35, () => {
        cpuAim = { from, to, t: 0 };
      });
    };

    const reset = () => {
      clearDarts();
      if (flight) scene.remove(flight.dart);
      flight = null;
      wait = null;
      cpuAim = null;
      holdFrom = null;
      aim = targetPoint({ sector: 20, mult: 3 });
      nextTurn();
    };

    stage.onFrame((dt) => {
      clock += dt;
      if (wait && clock >= wait.at) {
        const fn = wait.fn;
        wait = null;
        fn();
      }
      // Reticle: the player's aim with sway, or the computer gliding to its target.
      if (cpuAim) {
        cpuAim.t += dt / 0.55;
        const k = Math.min(1, cpuAim.t);
        const e = k * k * (3 - 2 * k);
        const x = cpuAim.from.x + (cpuAim.to.x - cpuAim.from.x) * e;
        const y = cpuAim.from.y + (cpuAim.to.y - cpuAim.from.y) * e;
        reticle.position.set(x * MM, y * MM, 0.05);
        if (k >= 1) {
          const to = cpuAim.to;
          cpuAim = null;
          launch(throwAt(to.x, to.y, CPU_SIGMA[level()], cryptoRand), match.current);
        }
      } else if (humanTurn()) {
        const held = holdFrom === null ? 0 : clock - holdFrom;
        const s = swayOffset(clock, held);
        reticle.position.set((aim.x + s.x) * MM, (aim.y + s.y) * MM, 0.05);
      }
      reticle.visible = !flight && match.winner === null;
      if (flight) {
        flight.t += dt / FLIGHT_S;
        const k = Math.min(1, flight.t);
        const tx = flight.to.x * MM, ty = flight.to.y * MM;
        flight.dart.position.set(
          flight.from.x + (tx - flight.from.x) * k,
          flight.from.y + (ty - flight.from.y) * k + Math.sin(Math.PI * k) * 0.5,
          flight.from.z * (1 - k),
        );
        flight.dart.rotation.set(0.35 * (1 - k), 0, 0);
        if (k >= 1) land();
      }
      // Fit the board on narrow stages (portrait phones, full screen).
      const { width, height } = stage.size();
      const z = 7.4 * Math.max(1, (height / width) * 0.95);
      if (camera.position.z !== z) {
        camera.position.set(0, 0, z);
        camera.lookAt(0, 0, 0);
      }
    });

    // Pointer: press to steady, move to aim, release to throw. On touch the reticle sits above the finger.
    const ndc = { x: 0, y: 0 } as Vector2;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hitPoint = new THREE.Vector3();
    const toBoard = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hitPoint)) return null;
      const lift = e.pointerType === "touch" ? 0.55 : 0;
      const x = hitPoint.x / MM, y = (hitPoint.y + lift) / MM;
      const r2 = Math.hypot(x, y), max = BOARD_R / MM;
      return r2 > max ? { x: (x / r2) * max, y: (y / r2) * max } : { x, y };
    };
    let pointer: number | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button > 0 || !humanTurn() || shell.covered()) return;
      e.preventDefault();
      shell.stage.focus({ preventScroll: true });
      shell.stage.setPointerCapture?.(e.pointerId);
      pointer = e.pointerId;
      const p = toBoard(e);
      if (p) aim = p;
      holdFrom = clock;
    };
    const onMove = (e: PointerEvent) => {
      if (pointer === null) {
        // A mouse aims while hovering too.
        if (e.pointerType === "mouse" && humanTurn() && holdFrom === null) {
          const p = toBoard(e);
          if (p) aim = p;
        }
        return;
      }
      if (e.pointerId !== pointer) return;
      const p = toBoard(e);
      if (p) aim = p;
    };
    const onUp = (e: PointerEvent) => {
      if (pointer === null || e.pointerId !== pointer) return;
      pointer = null;
      release();
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      holdFrom = null;
    };
    const el = shell.stage;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);

    const hold = () => {
      if (humanTurn() && holdFrom === null) holdFrom = clock;
    };
    function release() {
      if (holdFrom === null) return;
      const held = clock - holdFrom;
      holdFrom = null;
      if (!humanTurn()) return;
      const s = swayOffset(clock, held);
      launch(throwAt(aim.x + s.x, aim.y + s.y, PLAYER_SIGMA, cryptoRand), match.current);
    }
    const nudge = (dx: number, dy: number) => {
      const max = DOUBLE_OUT + 40;
      const x = aim.x + dx, y = aim.y + dy, r = Math.hypot(x, y);
      aim = r > max ? { x: (x / r) * max, y: (y / r) * max } : { x, y };
    };

    reset();
    return {
      reset,
      nudge,
      hold,
      release,
      dispose() {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onCancel);
        // Darts off the board (and the one in flight) are not in the scene graph the stage frees.
        clearDarts();
        if (flight) scene.remove(flight.dart);
        for (const g of [tipGeo, barrelGeo, shaftGeo, flightGeo]) g.dispose();
        for (const m of [metal, shaftMat, ...flightMats] as Material[]) m.dispose();
      },
    };
  }

  // ---------------------------------------------------------------- keys

  const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  const ownKey = (e: KeyboardEvent) => {
    if (!game || shell.covered() || e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return false;
    if (e.target instanceof Element && e.target.closest("button, a, summary, select")) return false;
    // Only with focus inside the game: the arrows keep scrolling the page otherwise.
    return shell.root.contains(document.activeElement);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!ownKey(e)) return;
    const arrow = KEYS[e.code];
    if (arrow) {
      e.preventDefault();
      const step = e.shiftKey ? 12 : 4;
      game!.nudge(arrow[0] * step, arrow[1] * step);
    } else if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      if (!e.repeat) game!.hold();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!game || (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter")) return;
    if (!shell.root.contains(document.activeElement)) return;
    e.preventDefault();
    game.release();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("darts.title")),
      h("p", { class: "lede" }, t("darts.privacyNote")),
    ),
    h("div", { class: "g3d-bar dt-bar" },
      h("label", { class: "field" }, h("span", null, t("darts.mode")), modeSel),
      h("label", { class: "field" }, h("span", null, t("darts.opponent")), oppSel),
      newBtn,
      shell.fullscreenButton,
    ),
    shell.root,
    turnEl,
    statusEl,
    boardEl,
    bestEl,
    h("p", { class: "hint", id: "dt-help" }, coarsePointer() ? t("darts.hintTouch") : t("darts.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );
  shell.stage.setAttribute("aria-describedby", "dt-help");
  render();

  mounted = {
    cleanup() {
      window.clearTimeout(coverTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      shell.dispose();
      game = null;
    },
  };
}

export function unmountDarts(): void {
  mounted?.cleanup();
  mounted = null;
}

// ---------------------------------------------------------------- board texture

/** The dartboard drawn on a 2D canvas: beds, wires and the number ring, mapped onto a disc of radius BOARD_R. */
function boardTexture(THREE: Stage["THREE"]): CanvasTexture {
  const size = coarsePointer() ? 1024 : 2048;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const px = size / 2 / (BOARD_R / MM); // canvas pixels per mm
  const cx = size / 2;
  const dark = "#2b2328", light = "#f3e6d0", red = "#d6336c", green = "#2f9e6a";
  g.fillStyle = "#231a20";
  g.fillRect(0, 0, size, size);
  const ring = (r0: number, r1: number, idx: number, color: string) => {
    // Sector idx spans -9°..+9° around idx·18° clockwise from the top; canvas angles start at +x, clockwise.
    const a0 = ((idx * 18 - 9 - 90) * Math.PI) / 180, a1 = ((idx * 18 + 9 - 90) * Math.PI) / 180;
    g.beginPath();
    g.arc(cx, cx, r1 * px, a0, a1);
    g.arc(cx, cx, r0 * px, a1, a0, true);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  for (let i = 0; i < 20; i++) {
    const even = i % 2 === 0;
    ring(OUTER_BULL_R, TRIPLE_IN, i, even ? dark : light);
    ring(TRIPLE_IN, TRIPLE_OUT, i, even ? red : green);
    ring(TRIPLE_OUT, DOUBLE_IN, i, even ? dark : light);
    ring(DOUBLE_IN, DOUBLE_OUT, i, even ? red : green);
  }
  g.beginPath();
  g.arc(cx, cx, OUTER_BULL_R * px, 0, Math.PI * 2);
  g.fillStyle = green;
  g.fill();
  g.beginPath();
  g.arc(cx, cx, BULL_R * px, 0, Math.PI * 2);
  g.fillStyle = red;
  g.fill();
  // Wires.
  g.strokeStyle = "#cfc8cc";
  g.lineWidth = Math.max(1, 0.9 * px);
  for (const r of [BULL_R, OUTER_BULL_R, TRIPLE_IN, TRIPLE_OUT, DOUBLE_IN, DOUBLE_OUT]) {
    g.beginPath();
    g.arc(cx, cx, r * px, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 - 9) * Math.PI) / 180;
    g.beginPath();
    g.moveTo(cx + Math.sin(a) * OUTER_BULL_R * px, cx - Math.cos(a) * OUTER_BULL_R * px);
    g.lineTo(cx + Math.sin(a) * DOUBLE_OUT * px, cx - Math.cos(a) * DOUBLE_OUT * px);
    g.stroke();
  }
  // Numbers.
  g.fillStyle = "#ffffff";
  g.font = `600 ${Math.round(17 * px)}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  SECTORS.forEach((n, i) => {
    const a = (i * 18 * Math.PI) / 180;
    const r = 193 * px;
    g.save();
    g.translate(cx + Math.sin(a) * r, cx - Math.cos(a) * r);
    g.fillText(String(n), 0, 0);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

