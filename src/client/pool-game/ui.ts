import type { Group as TGroup, Line, Mesh, Vector3 } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";
import { createStage, gameShell, lostContext, type Stage } from "../three-stage";
import {
  CUSHIONS,
  POCKETS,
  R,
  TABLE_L,
  TABLE_W,
  aimHit,
  canPlace,
  candidates,
  chooseShot,
  cloneBalls,
  emptyEvents,
  groupOf,
  legalTargets,
  moving,
  newGame,
  parseSaved,
  resolve,
  step,
  strike,
  type Ball,
  type Level,
  type Outcome,
  type PoolState,
  type ShotEvents,
} from "../../shared/pool-game";

/**
 * Pool (8-ball) against the computer or a friend on one device. Rules, physics and the computer's shot search are in
 * src/shared/pool-game.ts; this page draws the table with three.js (loaded on Play, three-stage.ts), takes the aim and
 * power, and renders only while balls roll or the aim changes (demand mode). Saved in `cvcm.poolgame.v1`.
 */

const STORE_KEY = "cvcm.poolgame.v1";
type Mode = "computer" | "friend";
interface Saved {
  game: PoolState;
  mode: Mode;
  level: Level;
  wins: number;
  losses: number;
}

const COLORS: Record<number, string> = {
  1: "#f2c12e", 2: "#2a5bd7", 3: "#d8343a", 4: "#6b3fa0", 5: "#f07f2a", 6: "#2a8f4a", 7: "#8a2a2a", 8: "#151515",
};
const colorOf = (id: number) => COLORS[id > 8 ? id - 8 : id] ?? "#ffffff";

function loadSaved(): Saved {
  const raw = readStore<Partial<Saved>>(STORE_KEY);
  const game = parseSaved(raw?.game) ?? newGame();
  const mode: Mode = raw?.mode === "friend" ? "friend" : "computer";
  const level: Level = raw?.level === 0 || raw?.level === 2 ? raw.level : 1;
  const count = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : 0);
  return { game, mode, level, wins: count(raw?.wins), losses: count(raw?.losses) };
}

let mounted: { cleanup: () => void } | null = null;

export function mountPoolGame(host: HTMLElement): void {
  unmountPoolGame();
  const saved = loadSaved();
  let game: PoolState = saved.game;
  let mode: Mode = saved.mode;
  let level: Level = saved.level;
  let wins = saved.wins;
  let losses = saved.losses;
  /** Message about the last shot (foul, pot, win), shown before whose turn it is. */
  let note = "";
  let aim = 0;
  let power = 0.6;
  /** aim: waiting for a shot; rolling: balls moving; thinking: the computer's turn; over: game won. */
  let phase: "aim" | "rolling" | "thinking" | "over" = game.winner === null ? "aim" : "over";
  let view: View | null = null;
  let thinkTimer = 0;
  let aimTimer = 0;

  const isComputer = (p: 0 | 1) => mode === "computer" && p === 1;
  const who = (p: 0 | 1) => (mode === "computer" ? (p === 0 ? t("poolGame.you") : t("poolGame.computer")) : t("poolGame.player", { n: p + 1 }));
  const groupName = (p: 0 | 1) => {
    const g = game.groups[p];
    if (!g) return t("poolGame.open");
    const left = game.balls.filter((b) => b.on && groupOf(b.id) === g).length;
    return t("poolGame.groupLeft", { group: t(`poolGame.${g}`), n: left });
  };

  const save = () => writeStore(STORE_KEY, { game, mode, level, wins, losses } satisfies Saved);

  // ---- toolbar and text
  const statusEl = h("p", { class: "pl-status", "aria-live": "polite", "data-out": "status" });
  const groupsEl = h("p", { class: "pl-groups", "data-out": "groups" });
  const winsEl = h("dd", { "data-out": "wins" });
  const lossesEl = h("dd", { "data-out": "losses" });
  const record = h("dl", { class: "stats-grid pl-record" }, h("dt", null, t("poolGame.wins")), winsEl, h("dt", null, t("poolGame.losses")), lossesEl);
  const modeSel = h("select", { "data-in": "mode" },
    h("option", { value: "computer", selected: mode === "computer" }, t("poolGame.vsComputer")),
    h("option", { value: "friend", selected: mode === "friend" }, t("poolGame.twoPlayers"))) as HTMLSelectElement;
  const levelSel = h("select", { "data-in": "level" },
    ...([0, 1, 2] as const).map((l) => h("option", { value: String(l), selected: l === level }, t(`poolGame.l_${l}`)))) as HTMLSelectElement;
  const levelField = h("label", { class: "field" }, h("span", null, t("poolGame.level")), levelSel);
  const powerIn = h("input", { type: "range", min: "5", max: "100", step: "1", value: String(Math.round(power * 100)), "data-in": "power", "aria-label": t("poolGame.power") }) as HTMLInputElement;
  const powerOut = h("output", { class: "pl-power-out", "data-out": "power" }, `${Math.round(power * 100)}%`);
  const shootBtn = h("button", { type: "button", class: "btn", "data-act": "shoot" }, t("poolGame.shoot")) as HTMLButtonElement;
  const turnBtn = h("button", { type: "button", class: "btn ghost", "data-act": "turn-view" }, t("poolGame.turnView"));
  const newBtn = h("button", { type: "button", class: "btn ghost", "data-act": "new" }, t("poolGame.newGame"));

  let lastStatus = "";
  const paintText = () => {
    let text: string;
    if (game.winner !== null) text = note;
    else if (phase === "thinking") text = [note, t("poolGame.thinking")].filter(Boolean).join(" ");
    else if (phase === "rolling") text = "";
    else {
      const p = game.turn;
      const turnText = mode === "computer" && p === 0 ? t("poolGame.yourShot") : t("poolGame.playerShot", { who: who(p) });
      const extra = game.breakShot ? t("poolGame.breakShot") : game.ballInHand && !isComputer(p) ? t("poolGame.ballInHand") : "";
      text = [note, turnText, extra].filter(Boolean).join(" ");
    }
    if (text !== lastStatus) {
      lastStatus = text;
      statusEl.textContent = text;
    }
    const g = `${who(0)}: ${groupName(0)} · ${who(1)}: ${groupName(1)}`;
    if (groupsEl.textContent !== g) groupsEl.textContent = g;
    winsEl.textContent = String(wins);
    lossesEl.textContent = String(losses);
    levelField.hidden = mode !== "computer";
    record.hidden = mode !== "computer";
    shootBtn.disabled = phase !== "aim" || isComputer(game.turn) || !view;
  };

  const focusStage = () => {
    if (view) shell.stage.focus({ preventScroll: true });
  };

  // ---- game flow
  let before: PoolState | null = null;
  let live: Ball[] = [];
  let events: ShotEvents = emptyEvents();

  const shoot = (shotAngle: number, shotPower: number) => {
    if (phase === "rolling" || game.winner !== null) return;
    before = { ...game, balls: cloneBalls(game.balls) };
    live = cloneBalls(game.balls);
    events = emptyEvents();
    strike(live, { angle: shotAngle, power: shotPower });
    phase = "rolling";
    note = "";
    view?.showCue(false);
    view?.wake();
    paintText();
  };

  const finishShot = () => {
    if (!before) return;
    for (const b of live) {
      b.vx = 0;
      b.vy = 0;
    }
    const r = resolve(before, live, events);
    before = null;
    game = r.state;
    note = noteFor(r.outcome);
    if (r.outcome.kind === "win") {
      phase = "over";
      if (mode === "computer") {
        if (r.outcome.player === 0) wins++;
        else losses++;
      }
    } else {
      phase = "aim";
    }
    save();
    view?.sync(game.balls);
    paintText();
    if (phase === "over") {
      shell.cover(note, t("poolGame.again"));
      return;
    }
    afterTurnChange();
  };

  const noteFor = (o: Outcome): string => {
    if (o.kind === "win") return t(`poolGame.win_${o.reason}`, { who: who(o.player) });
    if (o.kind === "continue") return t("poolGame.again_shot");
    if (o.foul) return t(`poolGame.foul_${o.foul}`);
    return "";
  };

  /** Points the cue at something sensible for the player whose turn it is. */
  const defaultAim = () => {
    const cue = game.balls[0]!;
    const targets = legalTargets(game, game.turn);
    let best: Ball | null = null;
    let bd = Infinity;
    for (const id of targets) {
      const b = game.balls[id]!;
      const d = Math.hypot(b.x - cue.x, b.y - cue.y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    aim = best ? Math.atan2(best.y - cue.y, best.x - cue.x) : 0;
  };

  const afterTurnChange = () => {
    defaultAim();
    if (isComputer(game.turn) && view) {
      phase = "thinking";
      paintText();
      view.showCue(false);
      window.clearTimeout(thinkTimer);
      thinkTimer = window.setTimeout(computerMove, 700);
    } else {
      view?.showCue(true);
      view?.wake();
      paintText();
    }
  };

  const computerMove = () => {
    if (!view || phase !== "thinking" || game.winner !== null) return;
    if (game.ballInHand) {
      // Try a grid of places and keep the one with the most makeable shots.
      let bestPos: { x: number; y: number } | null = null;
      let bestN = -1;
      for (let ix = -5; ix <= 5; ix++) {
        for (let iy = -2; iy <= 2; iy++) {
          const x = (ix / 5.6) * (TABLE_L / 2), y = (iy / 2.6) * (TABLE_W / 2);
          if (!canPlace(game.balls, x, y)) continue;
          const balls = cloneBalls(game.balls);
          Object.assign(balls[0]!, { x, y });
          const n = candidates({ ...game, balls }, [0.5]).length;
          if (n > bestN) {
            bestN = n;
            bestPos = { x, y };
          }
        }
      }
      if (bestPos) Object.assign(game.balls[0]!, bestPos);
      view.sync(game.balls);
    }
    const shot = chooseShot(game, level, cryptoRand);
    // Swing the cue to the chosen line, then shoot.
    const from = aim;
    const delta = Math.atan2(Math.sin(shot.angle - from), Math.cos(shot.angle - from));
    const start = performance.now();
    view.showCue(true);
    const swing = () => {
      if (!view || phase !== "thinking") return;
      const k = Math.min(1, (performance.now() - start) / 650);
      aim = from + delta * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
      view.wake();
      if (k < 1) aimTimer = window.setTimeout(swing, 16);
      else shoot(shot.angle, shot.power);
    };
    swing();
  };

  const newGameNow = () => {
    window.clearTimeout(thinkTimer);
    window.clearTimeout(aimTimer);
    game = newGame();
    before = null;
    note = "";
    phase = "aim";
    save();
    view?.sync(game.balls);
    shell.uncover();
    afterTurnChange();
  };

  const shell = gameShell({
    label: t("poolGame.stage"),
    intro: t("poolGame.intro"),
    className: "pl-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "demand", fov: 42, near: 0.05, far: 30, background: 0xfdf0f5, onLost: () => { view = null; lostContext(shell); } });
      if (!stage) return null;
      try {
        view = buildView(stage);
      } catch (err) {
        stage.dispose();
        throw err;
      }
      view.sync(game.balls);
      if (game.winner !== null) {
        phase = "over";
        paintText();
        return () => teardown(stage);
      }
      phase = "aim";
      afterTurnChange();
      return () => teardown(stage);
    },
    resume: () => {
      if (game.winner !== null) newGameNow();
    },
  });

  const teardown = (stage: Stage) => {
    // Finish a rolling shot first (it may hand the turn to the computer), then stop every timer.
    if (phase === "rolling") settleNow();
    window.clearTimeout(thinkTimer);
    window.clearTimeout(aimTimer);
    view?.dispose();
    view = null;
    stage.dispose();
    if (phase === "thinking") phase = "aim";
    paintText();
  };

  /** Plays the rolling shot to its end at once (leaving the page mid-shot), so the saved table is at rest. */
  const settleNow = () => {
    for (let i = 0; i < 2000 && moving(live); i++) step(live, 0.05, events);
    finishShot();
  };

  // ---- 3D view
  interface View {
    sync(balls: readonly Ball[]): void;
    showCue(on: boolean): void;
    /** Ask for frames (aim changed, balls rolling, camera turned). */
    wake(): void;
    turn(): void;
    dispose(): void;
  }

  function buildView(stage: Stage): View {
    const { THREE, scene, camera } = stage;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfb6c4, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.6, 3, 0.8);
    scene.add(sun);

    const HL = TABLE_L / 2, HW = TABLE_W / 2;
    // Cloth, cushions along each cushion segment, a frame around, black pockets.
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(TABLE_L + 0.2, 0.02, TABLE_W + 0.2), new THREE.MeshStandardMaterial({ color: 0x2b8a8a, roughness: 0.95 }));
    cloth.position.y = -0.01;
    scene.add(cloth);
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x1f6f70, roughness: 0.9 });
    for (const s of CUSHIONS) {
      const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
      const horizontal = s.ay === s.by;
      const g = new THREE.BoxGeometry(horizontal ? len : 0.05, 0.04, horizontal ? 0.05 : len);
      const m = new THREE.Mesh(g, cushionMat);
      const cx = (s.ax + s.bx) / 2, cy = (s.ay + s.by) / 2;
      m.position.set(cx + (horizontal ? 0 : Math.sign(cx) * 0.025), 0.02, cy + (horizontal ? Math.sign(cy) * 0.025 : 0));
      scene.add(m);
    }
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a3a64, roughness: 0.6 });
    const F = 0.09;
    for (const [w, d, x, z] of [
      [TABLE_L + 0.1 + 2 * F, F, 0, -(HW + 0.05 + F / 2)],
      [TABLE_L + 0.1 + 2 * F, F, 0, HW + 0.05 + F / 2],
      [F, TABLE_W + 0.1, -(HL + 0.05 + F / 2), 0],
      [F, TABLE_W + 0.1, HL + 0.05 + F / 2, 0],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), frameMat);
      m.position.set(x, 0.03, z);
      scene.add(m);
    }
    const pocketMat = new THREE.MeshBasicMaterial({ color: 0x1a1016 });
    const pocketGeo = new THREE.CircleGeometry(1, 24);
    for (const p of POCKETS) {
      const m = new THREE.Mesh(pocketGeo, pocketMat);
      m.rotation.x = -Math.PI / 2;
      m.scale.setScalar(p.r * 1.15);
      m.position.set(p.x, 0.001, p.y);
      scene.add(m);
    }
    // Head string and foot spot, faint.
    const markMat = new THREE.MeshBasicMaterial({ color: 0x9fd3d3, transparent: true, opacity: 0.5 });
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), markMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(TABLE_L / 4, 0.001, 0);
    scene.add(spot);

    // Balls with painted canvas textures (number circles, stripe bands).
    const ballGeo = new THREE.SphereGeometry(R, 28, 18);
    const meshes: Mesh[] = [];
    for (let id = 0; id < 16; id++) {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 64;
      const g = c.getContext("2d")!;
      const col = id === 0 ? "#fbf7ef" : colorOf(id);
      if (id >= 9) {
        g.fillStyle = "#fbf7ef";
        g.fillRect(0, 0, 128, 64);
        g.fillStyle = col;
        g.fillRect(0, 18, 128, 28);
      } else {
        g.fillStyle = col;
        g.fillRect(0, 0, 128, 64);
      }
      if (id > 0) {
        for (const u of [32, 96]) {
          g.fillStyle = "#fbf7ef";
          g.beginPath();
          g.arc(u, 32, 11, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#151515";
          g.font = "bold 13px system-ui, sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(String(id), u, 33);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0 }));
      // Numbers face up at rest.
      mesh.rotation.set(0, Math.PI / 2, -Math.PI / 2);
      scene.add(mesh);
      meshes.push(mesh);
    }

    // Cue stick, aim line, ghost ball and the object ball's path.
    const cue: TGroup = new THREE.Group();
    const stickGeo = new THREE.CylinderGeometry(0.0065, 0.013, 1.3, 12);
    stickGeo.rotateZ(Math.PI / 2);
    stickGeo.translate(-0.65, 0, 0);
    const stick = new THREE.Mesh(stickGeo, new THREE.MeshStandardMaterial({ color: 0xe9cfa6, roughness: 0.5 }));
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0066, 0.0066, 0.012, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5aa0d8 }));
    tip.position.x = -0.006;
    cue.add(stick, tip);
    scene.add(cue);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const aimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const aimLine: Line = new THREE.Line(aimGeo, lineMat);
    const pathGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const pathLine: Line = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }));
    const ghost = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 }));
    scene.add(aimLine, pathLine, ghost);
    let cueOn = false;

    // Camera: a 3/4 view from one of the four sides, fitted to the stage's shape.
    let side = 0;
    let fitAspect = 0;
    const placeCamera = () => {
      fitAspect = camera.aspect;
      const along = side % 2 === 0;
      const span = along ? TABLE_L + 0.3 : TABLE_W + 0.3;
      const depth = along ? TABLE_W : TABLE_L;
      const fovH = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
      const dist = Math.max((span / 2) / Math.tan(fovH / 2), (depth + 0.4) / 2 / Math.tan((camera.fov * Math.PI) / 360)) * 1.02;
      const elev = 0.95;
      const a = (side * Math.PI) / 2;
      const ox = Math.sin(a), oz = Math.cos(a);
      camera.position.set(ox * dist * Math.cos(elev), dist * Math.sin(elev), oz * dist * Math.cos(elev));
      camera.lookAt(0, 0, 0);
    };

    const tmp: Vector3 = new THREE.Vector3();
    const axis: Vector3 = new THREE.Vector3();
    const placeAim = () => {
      const show = cueOn && phase !== "rolling" && game.winner === null;
      cue.visible = show;
      aimLine.visible = show && !isComputer(game.turn);
      ghost.visible = aimLine.visible;
      pathLine.visible = false;
      if (!show) return;
      const c = game.balls[0]!;
      cue.position.set(c.x, R, c.y);
      cue.rotation.set(0, -aim, 0);
      stick.position.x = -(R + 0.015 + power * 0.12);
      tip.position.x = stick.position.x - 0.006;
      if (!aimLine.visible) return;
      const hit = aimHit(game.balls, aim);
      const pos = aimGeo.attributes.position!;
      pos.setXYZ(0, c.x, R, c.y);
      pos.setXYZ(1, hit.x, R, hit.y);
      pos.needsUpdate = true;
      aimGeo.computeBoundingSphere();
      ghost.position.set(hit.x, R, hit.y);
      if (hit.ball !== null) {
        const b = game.balls[hit.ball]!;
        const dx = b.x - hit.x, dy = b.y - hit.y;
        const d = Math.hypot(dx, dy) || 1;
        const p = pathGeo.attributes.position!;
        p.setXYZ(0, b.x, R, b.y);
        p.setXYZ(1, b.x + (dx / d) * 0.3, R, b.y + (dy / d) * 0.3);
        p.needsUpdate = true;
        pathGeo.computeBoundingSphere();
        pathLine.visible = true;
      }
    };

    const sync = (balls: readonly Ball[]) => {
      for (const b of balls) {
        const m = meshes[b.id]!;
        m.visible = b.on;
        m.position.set(b.x, R, b.y);
      }
      placeAim();
      stage.invalidate();
    };

    stage.onFrame((dt) => {
      if (camera.aspect !== fitAspect) placeCamera();
      if (phase === "rolling") {
        const prev = live.map((b) => [b.x, b.y] as const);
        step(live, dt, events);
        for (const b of live) {
          const m = meshes[b.id]!;
          const [px, py] = prev[b.id]!;
          const dx = b.x - px, dy = b.y - py;
          const dist = Math.hypot(dx, dy);
          if (dist > 0) {
            // Rolling: turn about the horizontal axis across the motion.
            axis.set(dy, 0, -dx).normalize();
            m.rotateOnWorldAxis(axis, dist / R);
          }
          m.visible = b.on;
          m.position.set(b.x, R, b.y);
        }
        if (!moving(live)) finishShot();
        else stage.invalidate();
      }
      placeAim();
    });

    // Pointer: aim at the pointed spot (mouse hover or a drag); drag the cue ball while it is in hand.
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
    const ndc = new THREE.Vector2();
    const tablePoint = (e: PointerEvent): { x: number; y: number } | null => {
      const r = stage.canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, tmp) ? { x: tmp.x, y: tmp.z } : null;
    };
    const humanAim = () => phase === "aim" && !isComputer(game.turn) && game.winner === null;
    let dragging: "aim" | "cue" | null = null;
    const aimAt = (p: { x: number; y: number }) => {
      const c = game.balls[0]!;
      if (Math.hypot(p.x - c.x, p.y - c.y) < R * 0.5) return;
      aim = Math.atan2(p.y - c.y, p.x - c.x);
      stage.invalidate();
    };
    const onDown = (e: PointerEvent) => {
      if (!humanAim()) return;
      const p = tablePoint(e);
      if (!p) return;
      const c = game.balls[0]!;
      stage.canvas.setPointerCapture?.(e.pointerId);
      if (game.ballInHand && Math.hypot(p.x - c.x, p.y - c.y) < R * 3) {
        dragging = "cue";
        return;
      }
      dragging = "aim";
      aimAt(p);
    };
    const onMove = (e: PointerEvent) => {
      if (!humanAim()) return;
      const p = tablePoint(e);
      if (!p) return;
      if (dragging === "cue") {
        if (canPlace(game.balls, p.x, p.y)) {
          Object.assign(game.balls[0]!, { x: p.x, y: p.y });
          sync(game.balls);
        }
        return;
      }
      // A mouse aims by hovering; touch aims while dragging.
      if (dragging === "aim" || e.pointerType === "mouse") aimAt(p);
    };
    const onUp = () => {
      if (dragging === "cue") save();
      dragging = null;
    };
    stage.canvas.addEventListener("pointerdown", onDown);
    stage.canvas.addEventListener("pointermove", onMove);
    stage.canvas.addEventListener("pointerup", onUp);
    stage.canvas.addEventListener("pointercancel", onUp);

    placeCamera();
    return {
      sync,
      showCue(on) {
        cueOn = on;
        placeAim();
        stage.invalidate();
      },
      wake: () => stage.invalidate(),
      turn() {
        side = (side + 1) % 4;
        placeCamera();
        stage.invalidate();
      },
      dispose() {
        stage.canvas.removeEventListener("pointerdown", onDown);
        stage.canvas.removeEventListener("pointermove", onMove);
        stage.canvas.removeEventListener("pointerup", onUp);
        stage.canvas.removeEventListener("pointercancel", onUp);
        // Geometries, materials and the canvas textures are freed with the stage (disposeScene).
      },
    };
  }

  // ---- inputs
  const setPower = (p: number) => {
    power = Math.max(0.05, Math.min(1, p));
    powerIn.value = String(Math.round(power * 100));
    powerOut.textContent = `${Math.round(power * 100)}%`;
    view?.wake();
  };
  powerIn.addEventListener("input", () => setPower(Number(powerIn.value) / 100));
  powerIn.addEventListener("change", focusStage);
  shootBtn.addEventListener("click", () => {
    if (phase === "aim" && !isComputer(game.turn)) shoot(aim, power);
    focusStage();
  });
  turnBtn.addEventListener("click", () => {
    view?.turn();
    focusStage();
  });
  newBtn.addEventListener("click", () => {
    newGameNow();
    focusStage();
  });
  modeSel.addEventListener("change", () => {
    mode = modeSel.value === "friend" ? "friend" : "computer";
    newGameNow();
    focusStage();
  });
  levelSel.addEventListener("change", () => {
    const l = Number(levelSel.value);
    level = l === 0 || l === 2 ? l : 1;
    save();
    paintText();
    focusStage();
  });

  const onKey = (e: KeyboardEvent) => {
    if (!view || e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    if (!shell.root.contains(document.activeElement)) return;
    if (e.target instanceof Element && e.target.closest("button, a, summary")) return;
    if (phase !== "aim" || isComputer(game.turn) || game.winner !== null) return;
    const turnBy = e.shiftKey ? Math.PI / 1800 : Math.PI / 180;
    if (e.code === "ArrowLeft") aim -= turnBy;
    else if (e.code === "ArrowRight") aim += turnBy;
    else if (e.code === "ArrowUp") setPower(power + 0.05);
    else if (e.code === "ArrowDown") setPower(power - 0.05);
    else if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (!e.repeat) shoot(aim, power);
      return;
    } else return;
    e.preventDefault();
    view.wake();
  };
  window.addEventListener("keydown", onKey);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("poolGame.title")),
      h("p", { class: "lede" }, t("poolGame.privacyNote")),
    ),
    h("div", { class: "pl-tool" },
      shell.root,
      h("div", { class: "g3d-bar pl-bar" },
        h("label", { class: "field pl-power" }, h("span", null, t("poolGame.power")), powerIn, powerOut),
        shootBtn,
        turnBtn,
        shell.fullscreenButton,
      ),
      statusEl,
      groupsEl,
      h("div", { class: "g3d-bar pl-settings" },
        h("label", { class: "field" }, h("span", null, t("poolGame.players")), modeSel),
        levelField,
        newBtn,
      ),
      record,
      h("p", { class: "hint" }, t("poolGame.hint")),
      creditLine("game3d.credit", "https://threejs.org", "three.js"),
    ),
  );
  defaultAim();
  paintText();

  mounted = {
    cleanup: () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(thinkTimer);
      window.clearTimeout(aimTimer);
      shell.dispose();
    },
  };
}

export function unmountPoolGame(): void {
  mounted?.cleanup();
  mounted = null;
}
