import type { Group, Mesh, Object3D, Plane, Raycaster, Vector2, Vector3 } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, readStore, typingTarget, writeStore } from "../game-input";
import { createStage, disposeScene, gameShell, lostContext, type Stage } from "../three-stage";
import {
  BALL_R,
  COURSE_PAR,
  CUP_R,
  HOLES,
  MAX_STROKES,
  advanceInPlace,
  ballAt,
  cleanSaved,
  newRound,
  putt,
  roundTotal,
  scoreName,
  simulate,
  type Ball,
  type Hole,
  type Pt,
  type Round,
} from "../../shared/mini-golf";

/**
 * Mini golf (games3d group): nine original holes. Physics and the course are in src/shared/mini-golf.ts; this page
 * draws the current hole with three.js (loaded on Play, three-stage.ts). Drag back from the ball like a slingshot to
 * aim and set the power, or use the arrow keys and Space. The round in progress and the best round are saved in
 * `cvcm.minigolf.v1`.
 */

const STORE_KEY = "cvcm.minigolf.v1";
const NEXT_HOLE_MS = 1300;
/** Drag length (m) for full power. */
const FULL_DRAG = 1.6;

let mounted: { cleanup: () => void } | null = null;

interface View {
  setHole(i: number): void;
  dispose(): void;
}

export function mountMiniGolf(host: HTMLElement): void {
  unmountMiniGolf();
  const saved = cleanSaved(readStore(STORE_KEY));
  let round: Round = saved.round;
  let best = saved.best;
  let hole: Hole = HOLES[round.hole]!;
  let ball: Ball = ballAt(round.x, round.z);
  let rest = { x: round.x, z: round.z };
  /** aim: waiting for a putt; rolling: ball moving; between: holed, next hole on its way; over: round finished. */
  let phase: "aim" | "rolling" | "between" | "over" = "aim";
  let aim = aimAtCup();
  let power = 0.5;
  let yaw = 0;
  let view: View | null = null;
  let nextTimer = 0;
  const resumed = round.hole > 0 || round.strokes[0]! > 0;

  function aimAtCup(): number {
    return Math.atan2(hole.cup[0] - ball.x, hole.cup[1] - ball.z);
  }

  const save = () => writeStore(STORE_KEY, { round, best });

  // ---- DOM
  const statusEl = h("p", { class: "mg-status", "aria-live": "polite", "data-out": "status" });
  const hudEl = h("div", { class: "g3d-hud mg-hud", "aria-hidden": "true" });
  const bestEl = h("p", { class: "mg-best", "data-out": "best" });
  const powerIn = h("input", { type: "range", min: 0, max: 100, step: 1, value: 50, "data-in": "power", "aria-label": t("miniGolf.power") }) as HTMLInputElement;
  const powerOut = h("output", { class: "mg-power-out" }, "50%");
  const puttBtn = h("button", { type: "button", class: "btn", "data-act": "putt" }, t("miniGolf.puttBtn")) as HTMLButtonElement;
  const newBtn = h("button", { type: "button", class: "btn ghost", "data-act": "new" }, t("miniGolf.newRound"));
  const leftBtn = h("button", { type: "button", class: "btn ghost", "data-act": "view-left", "aria-label": t("miniGolf.viewLeft") }, "⟲");
  const rightBtn = h("button", { type: "button", class: "btn ghost", "data-act": "view-right", "aria-label": t("miniGolf.viewRight") }, "⟳");
  const cardBody = h("tbody");
  const card = h("table", { class: "mg-card", "data-out": "card" },
    h("caption", null, t("miniGolf.scorecard")), cardBody);

  const diffText = (d: number) => (d === 0 ? t("miniGolf.even") : d > 0 ? t("miniGolf.overPar", { n: d }) : t("miniGolf.underPar", { n: -d }));

  let cardKey = "";
  const renderCard = () => {
    const key = `${round.hole}|${round.strokes.join(",")}`;
    if (key === cardKey) return;
    cardKey = key;
    const cells = (label: string, values: string[], total: string) =>
      h("tr", null, h("th", { scope: "row" }, label), ...values.map((v, i) => h("td", { class: i === round.hole ? "mg-now" : "" }, v)), h("td", { class: "mg-total" }, total));
    const played = round.strokes.filter((n, i) => i < round.hole || n > 0);
    cardBody.replaceChildren(
      h("tr", null, h("th", { scope: "col" }, t("miniGolf.colHole")), ...HOLES.map((_, i) => h("th", { scope: "col" }, String(i + 1))), h("th", { scope: "col" }, t("miniGolf.total"))),
      cells(t("miniGolf.colPar"), HOLES.map((x) => String(x.par)), String(COURSE_PAR)),
      cells(t("miniGolf.colYou"), round.strokes.map((n, i) => (i < round.hole || (i === round.hole && n > 0) ? String(n) : "")), played.length ? String(roundTotal(round)) : ""),
    );
    bestEl.textContent = best === null ? t("miniGolf.noBest") : t("miniGolf.best", { n: best, diff: diffText(best - COURSE_PAR) });
  };

  let hudKey = "";
  const renderHud = () => {
    puttBtn.disabled = phase !== "aim" || !view;
    const strokes = round.strokes[round.hole] ?? 0;
    const pct = Math.round(power * 100);
    const key = `${round.hole}|${strokes}|${pct}`;
    if (key === hudKey) return;
    hudKey = key;
    hudEl.textContent = round.hole < HOLES.length
      ? t("miniGolf.hud", { n: round.hole + 1, of: HOLES.length, par: hole.par, s: strokes, p: pct })
      : "";
    powerOut.textContent = `${pct}%`;
    if (Number(powerIn.value) !== pct) powerIn.value = String(pct);
  };

  const setPower = (p: number) => {
    power = Math.max(0, Math.min(1, p));
    renderHud();
    view && guide();
  };

  // ---- Game flow
  const goToHole = (i: number) => {
    round = { ...round, hole: i };
    if (i >= HOLES.length) return;
    hole = HOLES[i]!;
    ball = ballAt(hole.tee[0], hole.tee[1], ball.t);
    rest = { x: ball.x, z: ball.z };
    round = { ...round, x: ball.x, z: ball.z };
    aim = aimAtCup();
    phase = "aim";
    view?.setHole(i);
    renderCard();
    renderHud();
  };

  const finishRound = () => {
    const total = roundTotal(round);
    const record = best === null || total < best;
    if (record) best = total;
    phase = "over";
    const msg = record ? t("miniGolf.newBest", { total, diff: diffText(total - COURSE_PAR) }) : t("miniGolf.roundOver", { total, diff: diffText(total - COURSE_PAR) });
    statusEl.textContent = msg;
    renderCard();
    // Saved as a fresh round (a finished one is never resumed) with the best kept.
    const finished = round;
    round = newRound();
    save();
    round = finished;
    shell.cover(msg, t("miniGolf.again"));
  };

  const nextHole = () => {
    nextTimer = 0;
    if (round.hole + 1 >= HOLES.length) {
      round = { ...round, hole: HOLES.length };
      finishRound();
      return;
    }
    goToHole(round.hole + 1);
    save();
    statusEl.textContent = "";
  };

  /** The ball has stopped: holed, in the water, picked up, or ready for the next putt. `now` skips the pause. */
  const onRest = (now = false) => {
    const strokes = round.strokes;
    const i = round.hole;
    if (ball.holed) {
      const name = scoreName(strokes[i]!, hole.par);
      statusEl.textContent = name === "over" ? t("miniGolf.overHole", { n: strokes[i]! - hole.par }) : t(`miniGolf.${name}`);
      phase = "between";
      round = { ...round, x: hole.cup[0], z: hole.cup[1] };
      if (now) nextHole();
      else nextTimer = window.setTimeout(nextHole, NEXT_HOLE_MS);
      renderCard();
      return;
    }
    if (ball.wet) {
      // One penalty stroke, the ball goes back where it was played from.
      strokes[i] = Math.min(MAX_STROKES, strokes[i]! + 1);
      ball = ballAt(rest.x, rest.z, ball.t);
      statusEl.textContent = t("miniGolf.water");
    }
    round = { ...round, strokes, x: ball.x, z: ball.z };
    if (strokes[i]! >= MAX_STROKES) {
      statusEl.textContent = t("miniGolf.pickedUp", { n: MAX_STROKES });
      phase = "between";
      if (now) nextHole();
      else nextTimer = window.setTimeout(nextHole, NEXT_HOLE_MS);
      renderCard();
      return;
    }
    rest = { x: ball.x, z: ball.z };
    phase = "aim";
    aim = aimAtCup();
    save();
    renderCard();
    renderHud();
    view && guide();
  };

  const doPutt = () => {
    if (phase !== "aim" || !view || power <= 0.01) return;
    // A round resumed at the stroke limit (saved mid-putt) must not take one more: pick up instead.
    if ((round.strokes[round.hole] ?? 0) >= MAX_STROKES) {
      statusEl.textContent = t("miniGolf.pickedUp", { n: MAX_STROKES });
      phase = "between";
      window.clearTimeout(nextTimer);
      nextTimer = window.setTimeout(nextHole, NEXT_HOLE_MS);
      renderCard();
      return;
    }
    const strokes = round.strokes;
    strokes[round.hole] = strokes[round.hole]! + 1;
    round = { ...round, strokes };
    rest = { x: ball.x, z: ball.z };
    ball = putt(ball, aim, power);
    phase = "rolling";
    statusEl.textContent = "";
    save();
    renderCard();
    renderHud();
    view && guide();
  };

  const newRoundNow = () => {
    window.clearTimeout(nextTimer);
    nextTimer = 0;
    round = newRound();
    statusEl.textContent = "";
    goToHole(0);
    save();
    // Before Play the cover holds the only Play button: keep it until the 3D view exists.
    if (view) shell.uncover();
  };

  /** Leaving mid-putt: play the putt out so the saved ball is at rest. */
  const settle = () => {
    if (phase === "rolling") {
      ball = simulate(hole, ball);
      onRest(true);
    } else if (phase === "between" && nextTimer) {
      window.clearTimeout(nextTimer);
      nextHole();
    }
  };

  // ---- 3D view (built on Play)
  let guide: () => void = () => undefined;

  const shell = gameShell({
    label: t("miniGolf.stage"),
    intro: t("miniGolf.intro"),
    className: "mg-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 50, near: 0.05, far: 80, background: 0xfdf0f5, active: () => !shell.covered(), onLost: () => lostContext(shell) });
      if (!stage) return null;
      try {
        view = buildView(stage, el);
      } catch (err) {
        stage.dispose();
        throw err;
      }
      // A finished round (or one whose game-over cover was lost with the GL context) has nothing left to putt.
      if (phase === "over" || round.hole >= HOLES.length) newRoundNow();
      else view.setHole(round.hole);
      renderHud();
      return () => {
        view?.dispose();
        view = null;
        stage.dispose();
        renderHud();
      };
    },
    resume: () => newRoundNow(),
  });
  shell.root.insertBefore(hudEl, shell.stage.nextSibling);

  function buildView(stage: Stage, el: HTMLElement): View {
    const { THREE, scene, camera } = stage;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c6cf, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(3, 8, -2);
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: 0xf6e9ef }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.03;
    scene.add(floor);

    const mats = {
      green: new THREE.MeshLambertMaterial({ color: 0x9fd7a6 }),
      wall: new THREE.MeshLambertMaterial({ color: 0xe48aa9 }),
      block: new THREE.MeshLambertMaterial({ color: 0xc7a2d8 }),
      bumper: new THREE.MeshLambertMaterial({ color: 0xf2c46b }),
      slope: new THREE.MeshLambertMaterial({ color: 0x7fc4a0 }),
      arrow: new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
      water: new THREE.MeshLambertMaterial({ color: 0x8cc9ec }),
      cup: new THREE.MeshBasicMaterial({ color: 0x2d2430 }),
      pole: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      flag: new THREE.MeshLambertMaterial({ color: 0xc2336c, side: THREE.DoubleSide }),
      tee: new THREE.MeshLambertMaterial({ color: 0x6fb07a }),
      mover: new THREE.MeshLambertMaterial({ color: 0x8aa6e8 }),
      guide: new THREE.MeshBasicMaterial({ color: 0xc2336c, transparent: true, opacity: 0.75 }),
    };
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
    scene.add(ballMesh);
    const guideMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 1), mats.guide);
    guideMesh.geometry.translate(0, 0.5, 0);
    guideMesh.geometry.rotateX(-Math.PI / 2);
    scene.add(guideMesh);

    let holeGroup: Group | null = null;
    let moverMesh: Object3D | null = null;

    const shapeOf = (pts: readonly Pt[]) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const flat = (geo: import("three").BufferGeometry, mat: import("three").Material, y: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      return m;
    };

    const setHole = (i: number) => {
      if (holeGroup) {
        scene.remove(holeGroup);
        // Geometries only: the shared materials stay for the next hole.
        holeGroup.traverse((o) => (o as Mesh).geometry?.dispose());
      }
      if (i >= HOLES.length) return;
      const hl = HOLES[i]!;
      const g = new THREE.Group();
      g.add(flat(new THREE.ShapeGeometry(shapeOf(hl.green)), mats.green, 0));
      // Walls: boxes whose inner face lies on each edge of the counter-clockwise outline.
      const poly = hl.green;
      for (let k = 0; k < poly.length; k++) {
        const [ax, az] = poly[k]!, [bx, bz] = poly[(k + 1) % poly.length]!;
        const dx = bx - ax, dz = bz - az;
        const len = Math.hypot(dx, dz);
        const ox = dz / len, oz = -dx / len;
        const w = new THREE.Mesh(new THREE.BoxGeometry(len + 0.08, 0.12, 0.08), mats.wall);
        w.position.set((ax + bx) / 2 + ox * 0.04, 0.06, (az + bz) / 2 + oz * 0.04);
        w.rotation.y = -Math.atan2(dz, dx);
        g.add(w);
      }
      for (const b of hl.blocks) {
        const geo = new THREE.ExtrudeGeometry(shapeOf(b), { depth: 0.12, bevelEnabled: false });
        const m = new THREE.Mesh(geo, mats.block);
        m.rotation.x = -Math.PI / 2;
        g.add(m);
      }
      for (const p of hl.bumpers) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 32), mats.bumper);
        m.position.set(p.x, 0.06, p.z);
        g.add(m);
      }
      for (const s of hl.slopes) {
        const w = s.x1 - s.x0, d = s.z1 - s.z0;
        const pane = flat(new THREE.PlaneGeometry(w, d), mats.slope, 0.002);
        pane.position.set((s.x0 + s.x1) / 2, 0.002, (s.z0 + s.z1) / 2);
        g.add(pane);
        // Arrows downhill.
        const dir = Math.atan2(s.ax, s.az);
        for (let k = 0; k < 3; k++) {
          const tri = new THREE.Shape([new THREE.Vector2(-0.08, 0), new THREE.Vector2(0.08, 0), new THREE.Vector2(0, 0.16)]);
          const a = flat(new THREE.ShapeGeometry(tri), mats.arrow, 0.004);
          // Arrow tip toward (sin dir, cos dir), the way the slope pushes the ball.
          a.rotation.z = dir + Math.PI;
          a.position.set(s.x0 + (w * (k + 1)) / 4, 0.004, s.z0 + d / 2);
          g.add(a);
        }
      }
      for (const r of hl.water) {
        const pane = flat(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mats.water, 0.003);
        pane.position.set((r.x0 + r.x1) / 2, 0.003, (r.z0 + r.z1) / 2);
        g.add(pane);
      }
      const cup = flat(new THREE.CircleGeometry(CUP_R, 32), mats.cup, 0.005);
      cup.position.set(hl.cup[0], 0.005, hl.cup[1]);
      g.add(cup);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 8), mats.pole);
      pole.position.set(hl.cup[0], 0.3, hl.cup[1]);
      g.add(pole);
      const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.18, -0.06), new THREE.Vector2(0, -0.12)]);
      const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), mats.flag);
      flag.position.set(hl.cup[0], 0.6, hl.cup[1]);
      g.add(flag);
      const tee = flat(new THREE.PlaneGeometry(0.3, 0.3), mats.tee, 0.004);
      tee.position.set(hl.tee[0], 0.004, hl.tee[1]);
      g.add(tee);
      moverMesh = null;
      if (hl.mover) {
        const m = new THREE.Group();
        const bar = new THREE.Mesh(new THREE.BoxGeometry(hl.mover.half * 2, 0.1, 0.06), mats.mover);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16), mats.pole);
        hub.position.y = 0.1;
        m.add(bar, hub);
        m.position.set(hl.mover.x, 0.06, hl.mover.z);
        g.add(m);
        moverMesh = m;
      }
      scene.add(g);
      holeGroup = g;
      snapCamera = true;
      guide();
    };

    // Aim guide: a line from the ball, as long as the power.
    guide = () => {
      const show = phase === "aim";
      guideMesh.visible = show;
      if (!show) return;
      guideMesh.position.set(ball.x, 0.006, ball.z);
      guideMesh.rotation.y = aim + Math.PI;
      guideMesh.scale.set(1, 1, 0.15 + power * 1.6);
    };

    // Camera: a 3/4 view behind the ball (by the view angle), eased; pulled back on narrow stages.
    const look = new THREE.Vector3();
    const want = new THREE.Vector3();
    let snapCamera = true;
    let fitAspect = 0;
    let reach = 2.6;
    const placeCamera = (dt: number) => {
      if (camera.aspect !== fitAspect) {
        fitAspect = camera.aspect;
        reach = 2.6 * Math.max(1, 1 / (fitAspect || 1));
      }
      const dir = Math.atan2(hole.cup[0] - hole.tee[0], hole.cup[1] - hole.tee[1]) + yaw;
      want.set(ball.x - Math.sin(dir) * reach, 0.9 * reach, ball.z - Math.cos(dir) * reach);
      const k = snapCamera ? 1 : 1 - Math.exp(-dt * 3);
      snapCamera = false;
      camera.position.lerp(want, k);
      look.set(ball.x + Math.sin(dir) * 0.6, 0, ball.z + Math.cos(dir) * 0.6);
      camera.lookAt(look);
    };

    stage.onFrame((dt) => {
      if (phase === "rolling" || phase === "aim") {
        const was = ball.moving;
        advanceInPlace(hole, ball, dt);
        // The blocker swept a resting ball along: it rolls, but that is no stroke.
        if (!was && ball.moving && phase === "aim") {
          phase = "rolling";
          guide();
        }
        if (phase === "rolling" && !ball.moving) onRest();
      }
      ballMesh.position.set(ball.x, ball.holed ? -BALL_R : BALL_R, ball.z);
      if (moverMesh && hole.mover) moverMesh.rotation.y = -hole.mover.speed * ball.t;
      placeCamera(dt);
    });

    // Pointer: drag back from the ball (slingshot) to aim and set the power; release to putt.
    const ray: Raycaster = new THREE.Raycaster();
    const ndc: Vector2 = new THREE.Vector2();
    const ground: Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit: Vector3 = new THREE.Vector3();
    let drag: { id: number; moved: boolean } | null = null;
    const toGround = (e: PointerEvent): boolean => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(ground, hit) !== null;
    };
    const onDown = (e: PointerEvent) => {
      if (phase !== "aim" || shell.covered()) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      el.setPointerCapture?.(e.pointerId);
      drag = { id: e.pointerId, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId || phase !== "aim" || !toGround(e)) return;
      const dx = ball.x - hit.x, dz = ball.z - hit.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.08) return;
      drag.moved = true;
      aim = Math.atan2(dx, dz);
      setPower(len / FULL_DRAG);
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const fire = drag.moved;
      drag = null;
      if (fire) doPutt();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    // A gesture the browser or OS cancels (edge swipe, palm rejection, a call) is dropped, never putted.
    const onCancel = (e: PointerEvent) => {
      if (drag && drag.id === e.pointerId) drag = null;
    };
    el.addEventListener("pointercancel", onCancel);

    return {
      setHole,
      dispose() {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onCancel);
        disposeScene(scene);
        holeGroup = null;
        moverMesh = null;
        guide = () => undefined;
      },
    };
  }

  // ---- Keys: only with focus inside the game, never on buttons, links or fields.
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    if (!shell.root.contains(document.activeElement)) return;
    if (e.target instanceof Element && e.target !== shell.stage && e.target.closest("button, a, summary, select")) return;
    // Space / Enter on the covered stage is handled by gameShell (it presses Play / Play again).
    if (shell.covered()) return;
    if (phase !== "aim") return;
    const step = e.shiftKey ? Math.PI / 360 : Math.PI / 90;
    switch (e.code) {
      case "ArrowLeft":
        aim += step;
        break;
      case "ArrowRight":
        aim -= step;
        break;
      case "ArrowUp":
        setPower(power + 0.05);
        break;
      case "ArrowDown":
        setPower(power - 0.05);
        break;
      case "Space":
      case "Enter":
        e.preventDefault();
        if (!e.repeat) doPutt();
        return;
      default:
        return;
    }
    e.preventDefault();
    guide();
  };
  window.addEventListener("keydown", onKey);

  const focusStage = () => shell.stage.focus({ preventScroll: true });
  powerIn.addEventListener("input", () => setPower(Number(powerIn.value) / 100));
  puttBtn.addEventListener("click", () => {
    doPutt();
    focusStage();
  });
  newBtn.addEventListener("click", () => {
    newRoundNow();
    focusStage();
  });
  leftBtn.addEventListener("click", () => {
    yaw += Math.PI / 4;
    focusStage();
  });
  rightBtn.addEventListener("click", () => {
    yaw -= Math.PI / 4;
    focusStage();
  });

  const onHide = () => {
    settle();
    save();
  };
  const onVisibility = () => {
    if (document.hidden) onHide();
  };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onVisibility);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("miniGolf.title")),
      h("p", { class: "lede" }, t("miniGolf.privacyNote")),
    ),
    h("div", { class: "g3d-bar mg-bar" }, newBtn, leftBtn, rightBtn, shell.fullscreenButton),
    shell.root,
    h("div", { class: "g3d-bar mg-putt" },
      h("label", { class: "field mg-power" }, h("span", null, t("miniGolf.power")), powerIn, powerOut),
      puttBtn,
    ),
    statusEl,
    h("div", { class: "mg-card-wrap" }, card),
    bestEl,
    h("p", { class: "hint" }, t("miniGolf.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );
  if (resumed) statusEl.textContent = t("miniGolf.resumed", { n: round.hole + 1 });
  renderCard();
  renderHud();

  mounted = {
    cleanup: () => {
      settle();
      save();
      window.clearTimeout(nextTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      shell.dispose();
    },
  };
}

export function unmountMiniGolf(): void {
  mounted?.cleanup();
  mounted = null;
}
