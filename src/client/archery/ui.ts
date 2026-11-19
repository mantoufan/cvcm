import { approxNormal } from "../../shared/random";
import type { CanvasTexture, Group, Material } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { coarsePointer, createStage, gameShell, lostContext, type Stage } from "../three-stage";
import { creditLine, cryptoRand, readStore, typingTarget, writeStore } from "../game-input";
import {
  ARROWS_PER_END,
  BOSS_HALF,
  DISTANCES,
  ENDS,
  FACE_Y,
  RING_COLORS,
  addArrow,
  arrowsShot,
  better,
  cleanBests,
  currentEnd,
  drawOf,
  endTotal,
  faceRadius,
  fly,
  launch,
  newRound,
  roundDone,
  roundTotal,
  scoreLabel,
  sightFor,
  speedOf,
  swayOffset,
  windFor,
  xCount,
  type Best,
  type Distance,
  type Landing,
  type Round,
  type Score,
} from "../../shared/archery";

/**
 * Target archery on a 3D range (games3d group). Flight, scoring and the round live in src/shared/archery.ts; this
 * page draws the range from a spotting position beside the target (so the face fills the view at any distance),
 * the sight, the wind flag and the arrows, and keeps the score sheet. three.js loads on Play (three-stage.ts).
 * The distance and the best round per distance are kept in `cvcm.archery.v1`.
 */

const STORE_KEY = "cvcm.archery.v1";
/** Seconds after the last arrow of an end before the arrows are pulled and the next end starts. */
const END_PAUSE = 1.4;

interface Saved {
  distance: Distance;
  best: Partial<Record<Distance, Best>>;
}

let mounted: { cleanup: () => void } | null = null;

function loadSaved(): Saved {
  const raw = readStore<Record<string, unknown>>(STORE_KEY) ?? {};
  const distance = (DISTANCES as readonly number[]).includes(raw.distance as number) ? (raw.distance as Distance) : 18;
  return { distance, best: cleanBests(raw.best) };
}

/** Wind as text: an arrow for its direction and the speed ("→ 2.4 m/s"). */
function windText(w: number): string {
  if (Math.abs(w) < 0.05) return t("archery.calm");
  return t("archery.windValue", { dir: w > 0 ? "→" : "←", n: Math.abs(w).toFixed(1) });
}

export function mountArchery(host: HTMLElement): void {
  unmountArchery();
  const saved = loadSaved();
  /** Delayed covers and end changes (see afterArrow); declared first so every handler can clear them. */
  let coverTimer = 0;
  let distance: Distance = saved.distance;
  let best = saved.best;
  // The first round after mount uses a fixed seed (the page is the same before and after mount); later ones are random.
  let round: Round = newRound(distance, 1);
  let wind = windFor(round.seed, 0, distance);
  const save = () => writeStore(STORE_KEY, { distance, best });

  const statusEl = h("p", { class: "ar-status", "aria-live": "polite", "data-out": "status" });
  const sheetEl = h("table", { class: "ar-sheet", "data-out": "sheet" });
  const totalEl = h("p", { class: "ar-total", "data-out": "total" });
  const bestEl = h("p", { class: "hint ar-best", "data-out": "best" });
  const faceCanvas = h("canvas", { class: "ar-face", width: 220, height: 220, role: "img", "aria-label": t("archery.faceLabel") }) as HTMLCanvasElement;
  const hudEl = h("div", { class: "g3d-hud ar-hud", "aria-hidden": "true" });
  const drawBar = h("span", { class: "ar-draw-fill" });
  const drawEl = h("div", { class: "ar-draw", "aria-hidden": "true" }, drawBar);

  const distSel = h("select", { "data-in": "distance" }, ...DISTANCES.map((d) => h("option", { value: String(d) }, t("archery.meters", { n: d })))) as HTMLSelectElement;
  distSel.value = String(distance);

  /** The running 3D game, set while a stage exists. */
  let game: { reset(): void; setDistance(): void; nudge(dx: number, dy: number): void; hold(): void; release(): void; drop(): void; dispose(): void } | null = null;

  const shell = gameShell({
    label: t("archery.stage"),
    intro: t("archery.intro"),
    className: "ar-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 40, near: 0.05, far: 400, background: 0xdff0fa, active: () => !shell.covered(), onLost: () => lostContext(shell) });
      if (!stage) return null;
      try {
        game = build(stage);
      } catch (err) {
        stage.dispose();
        throw err;
      }
      // A finished round (its cover may have been lost with the GL context) has no arrows left, and a round not yet
      // started still has the mount's fixed seed (rule 8): either way, start one with fresh random winds.
      if (roundDone(round) || (round.ends.length === 1 && round.ends[0]!.length === 0)) newRound_();
      return () => {
        game?.dispose();
        game = null;
        stage.dispose();
      };
    },
    resume: () => newRound_(),
  });
  shell.root.insertBefore(hudEl, shell.stage.nextSibling);
  shell.root.insertBefore(drawEl, hudEl.nextSibling);

  // ---------------------------------------------------------------- text

  let lastHud = "";
  let lastSheet = "";
  const render = () => {
    const end = currentEnd(round);
    const shotInEnd = round.ends[end]!.length;
    const done = roundDone(round);
    const hud = [
      t("archery.meters", { n: distance }),
      t("archery.endOf", { n: end + 1, of: ENDS }),
      done ? "" : t("archery.arrowOf", { n: Math.min(ARROWS_PER_END, shotInEnd + 1), of: ARROWS_PER_END }),
      `${t("archery.wind")} ${windText(wind)}`,
      t("archery.totalShort", { n: roundTotal(round) }),
    ].filter(Boolean).join("  ·  ");
    if (hud !== lastHud) {
      lastHud = hud;
      hudEl.textContent = hud;
    }
    const sheetKey = JSON.stringify(round.ends);
    if (sheetKey !== lastSheet) {
      lastSheet = sheetKey;
      let running = 0;
      sheetEl.replaceChildren(
        h("thead", null, h("tr", null,
          h("th", null, t("archery.end")),
          ...Array.from({ length: ARROWS_PER_END }, (_, i) => h("th", null, String(i + 1))),
          h("th", null, t("archery.endScore")),
          h("th", null, t("archery.running")))),
        h("tbody", null, ...round.ends.filter((e, i) => e.length || i === 0).map((e, i) => {
          running += endTotal(e);
          return h("tr", null,
            h("th", { scope: "row" }, String(i + 1)),
            ...Array.from({ length: ARROWS_PER_END }, (_, k) => h("td", null, e[k] ? scoreLabel(e[k]!) : "")),
            h("td", null, e.length ? String(endTotal(e)) : ""),
            h("td", null, e.length ? String(running) : ""));
        })),
      );
      totalEl.textContent = t("archery.total", { n: roundTotal(round), x: xCount(round), arrows: arrowsShot(round) });
      drawFace();
    }
    const b = best[distance];
    bestEl.textContent = b ? t("archery.best", { d: distance, n: b.score, x: b.x }) : t("archery.noBest", { d: distance });
  };

  /** The small 2D face under the stage: the arrows of the current end (or the last full end). */
  const drawFace = () => {
    const ctx = faceCanvas.getContext?.("2d");
    if (!ctx) return;
    const size = faceCanvas.width;
    const c = size / 2;
    const px = (c - 6) / faceRadius(distance);
    ctx.clearRect(0, 0, size, size);
    for (let ring = 0; ring < 10; ring++) {
      ctx.beginPath();
      ctx.arc(c, c, (10 - ring) * (c - 6) / 10, 0, Math.PI * 2);
      ctx.fillStyle = `#${RING_COLORS[ring]!.toString(16).padStart(6, "0")}`;
      ctx.fill();
      ctx.strokeStyle = ring === 2 || ring === 3 ? "#f5f5f0" : "#2a2a2e";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(c, c, (c - 6) / 20, 0, Math.PI * 2);
    ctx.stroke();
    for (const p of facePoints) {
      ctx.beginPath();
      ctx.arc(c + p.x * px, c - p.y * px, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#c2336c";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };
  /** Where this end's arrows hit the face (metres from its centre). */
  let facePoints: { x: number; y: number }[] = [];

  const focusStage = () => {
    if (game) shell.stage.focus({ preventScroll: true });
  };

  function newRound_() {
    window.clearTimeout(coverTimer);
    round = newRound(distance, Math.floor(cryptoRand() * 1e9) + 2);
    wind = windFor(round.seed, 0, distance);
    facePoints = [];
    lastSheet = "";
    statusEl.textContent = "";
    game?.reset();
    render();
  }

  distSel.addEventListener("change", () => {
    const n = Number(distSel.value);
    distance = (DISTANCES as readonly number[]).includes(n) ? (n as Distance) : 18;
    save();
    newRound_();
    game?.setDistance();
    if (game) shell.uncover();
    focusStage();
  });
  const newBtn = h("button", { type: "button", class: "btn", "data-act": "new" }, t("archery.newRound"));
  newBtn.addEventListener("click", () => {
    newRound_();
    if (game) shell.uncover();
    focusStage();
  });

  /** After each arrow: the score, the sheet, the end change and the end of the round. */
  const afterArrow = (land: Landing) => {
    const score: Score = land.kind === "face" ? land.score : { value: 0, x: false };
    if (land.kind === "face") facePoints.push({ x: land.x, y: land.y });
    round = addArrow(round, score);
    statusEl.textContent = land.kind === "face"
      ? t("archery.hit", { s: scoreLabel(score) })
      : land.kind === "boss" ? t("archery.boss") : t("archery.miss");
    render();
    if (roundDone(round)) {
      const total = roundTotal(round), x = xCount(round);
      const record = better({ score: total, x }, best[distance]);
      if (record) {
        best = { ...best, [distance]: { score: total, x } };
        save();
      }
      const msg = record ? t("archery.newBest", { n: total, x }) : t("archery.roundDone", { n: total, x });
      statusEl.textContent = msg;
      render();
      window.clearTimeout(coverTimer);
      coverTimer = window.setTimeout(() => shell.cover(msg, t("archery.again")), 1200);
      return "done" as const;
    }
    return round.ends[currentEnd(round)]!.length === 0 ? ("endDone" as const) : ("next" as const);
  };

  // ---------------------------------------------------------------- 3D

  function build(stage: Stage) {
    const { THREE, scene, camera } = stage;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9cc48a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(-3, 8, 4);
    scene.add(sun);
    scene.fog = new THREE.Fog(0xdff0fa, 60, 260);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x9fd08a }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -60;
    scene.add(ground);

    // Target: straw boss on legs, the face as a canvas texture, the wind flag beside it.
    const range = new THREE.Group();
    scene.add(range);
    const bossMat = new THREE.MeshLambertMaterial({ color: 0xd8c48a });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const boss = new THREE.Mesh(new THREE.BoxGeometry(BOSS_HALF * 2, BOSS_HALF * 2, 0.3), bossMat);
    boss.position.set(0, FACE_Y, -0.16);
    range.add(boss);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, FACE_Y + 0.4, 0.06), legMat);
      leg.position.set(sx * (BOSS_HALF - 0.1), (FACE_Y + 0.4) / 2 - 0.1, -0.35);
      leg.rotation.x = -0.18;
      range.add(leg);
    }
    const faceTex = faceTexture(THREE);
    const face = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshLambertMaterial({ map: faceTex }));
    face.position.set(0, FACE_Y, 0.001);
    range.add(face);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), legMat);
    pole.position.set(BOSS_HALF + 0.5, 1.3, -0.2);
    range.add(pole);
    const flagGeo = new THREE.PlaneGeometry(1, 0.3).translate(0.5, 0, 0);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: 0xe85d93, side: THREE.DoubleSide }));
    flag.position.set(BOSS_HALF + 0.5, 2.45, -0.2);
    range.add(flag);

    // Sight: a ring and a dot on the face plane, drawn on top.
    const sightMat = new THREE.MeshBasicMaterial({ color: 0x1f8a4c, depthTest: false, transparent: true, opacity: 0.9 });
    const sight = new THREE.Group();
    const sightRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), sightMat);
    const sightDot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), sightMat);
    sight.add(sightRing, sightDot);
    sight.renderOrder = 10;
    scene.add(sight);

    // Arrow parts, shared by every arrow (drawn twice the real thickness so they show at range).
    const shaftGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.72, 8).rotateX(Math.PI / 2).translate(0, 0, 0.36);
    const pointGeo = new THREE.ConeGeometry(0.009, 0.05, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.02);
    const vaneGeo = new THREE.PlaneGeometry(0.035, 0.09).translate(0.02, 0, 0.62);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x3a2f36, roughness: 0.5, metalness: 0.3 });
    const pointMat = new THREE.MeshStandardMaterial({ color: 0xc9c4c8, roughness: 0.35, metalness: 0.7 });
    const vaneMat = new THREE.MeshLambertMaterial({ color: 0xe85d93, side: THREE.DoubleSide });
    const makeArrow = (): Group => {
      // Points along -z from its tip at the origin (the flight direction is -z).
      const g = new THREE.Group();
      g.add(new THREE.Mesh(shaftGeo, shaftMat), new THREE.Mesh(pointGeo, pointMat));
      for (let k = 0; k < 3; k++) {
        const v = new THREE.Mesh(vaneGeo, vaneMat);
        v.rotation.z = (k * Math.PI * 2) / 3;
        g.add(v);
      }
      return g;
    };

    let arrows: Group[] = [];
    const clearArrows = () => {
      for (const a of arrows) a.parent?.remove(a);
      arrows = [];
    };

    // Placing the range for the distance: the target at z = -distance, the camera beside it.
    let faceR = faceRadius(distance);
    const place = () => {
      faceR = faceRadius(distance);
      range.position.z = -distance;
      face.scale.setScalar(faceR);
      sight.scale.setScalar(faceR * 0.06);
      fitAspect = 0;
    };
    let fitAspect = 0;
    const fitCamera = () => {
      if (camera.aspect === fitAspect) return;
      fitAspect = camera.aspect;
      // Far enough that the face fills most of the height, further on a narrow stage; a little to the right and
      // above, so arrows fly in past the camera instead of through it.
      const fov = (camera.fov * Math.PI) / 180;
      const span = faceR * 2.6 * Math.max(1, 1 / camera.aspect);
      const L = span / 2 / Math.tan(fov / 2);
      camera.position.set(L * 0.28, FACE_Y + L * 0.06, -distance + L);
      camera.lookAt(0, FACE_Y, -distance);
      camera.far = distance + L + 200;
      camera.updateProjectionMatrix();
    };

    // Turn engine on the stage clock (pauses off screen and behind the cover).
    let clock = 0;
    let aim = { x: 0, y: 0 };
    let holdFrom: number | null = null;
    let flight: { arrow: Group; path: { x: number; y: number; z: number; t: number }[]; i: number; t: number; land: Landing } | null = null;
    let wait: { at: number; fn: () => void } | null = null;
    const ready = () => !flight && !wait && !roundDone(round) && !shell.covered();
    let lastDraw = -1;

    // Standard deviation 0.0015 at 18 m, growing with distance.
    const releaseNoise = () => approxNormal(cryptoRand) * 0.0015 * (distance / 18);

    const shoot = (held: number) => {
      const s = swayOffset(clock, held, distance);
      const tx = aim.x + s.x + releaseNoise(), ty = aim.y + s.y + releaseNoise();
      const dir = sightFor(tx, ty, distance);
      const path: { x: number; y: number; z: number; t: number }[] = [];
      const land = fly(launch(dir.yaw, dir.pitch, speedOf(drawOf(held))), distance, wind, path);
      const arrow = makeArrow();
      scene.add(arrow);
      flight = { arrow, path, i: 0, t: 0, land };
    };

    const tmp = new THREE.Vector3();
    const land = () => {
      const f = flight!;
      flight = null;
      const last = f.path[f.path.length - 1]!;
      f.arrow.position.set(last.x, last.y, last.z);
      if (f.land.kind === "face" || f.land.kind === "boss") {
        // Stuck in the target: the point sinks into the face and boss, the shaft sticks out toward the archer.
        f.arrow.position.z -= 0.04;
      }
      if (f.land.kind === "lost") scene.remove(f.arrow);
      else arrows.push(f.arrow);
      const next = afterArrow(f.land);
      if (next === "endDone") {
        wait = {
          at: clock + END_PAUSE,
          fn: () => {
            clearArrows();
            facePoints = [];
            wind = windFor(round.seed, currentEnd(round), distance);
            lastSheet = "";
            render();
            setFlag();
          },
        };
      }
    };

    const setFlag = () => {
      const w = Math.abs(wind);
      flag.visible = w >= 0.05;
      flag.rotation.y = wind >= 0 ? -0.15 : Math.PI + 0.15;
      flag.scale.set(0.4 + Math.min(1, w / 4) * 0.8, 1, 1);
      flag.rotation.z = -0.9 + Math.min(1, w / 4) * 0.85;
    };

    const reset = () => {
      clearArrows();
      if (flight) scene.remove(flight.arrow);
      flight = null;
      wait = null;
      holdFrom = null;
      aim = { x: 0, y: 0 };
      // The end-change step runs from the stage clock; if the view was torn down during the pause, do it here: the
      // wind belongs to the current end, and an end with no arrows yet shows a clean face.
      wind = windFor(round.seed, currentEnd(round), distance);
      if ((round.ends[currentEnd(round)]?.length ?? 0) === 0) facePoints = [];
      lastSheet = "";
      render();
      setFlag();
    };

    stage.onFrame((dt) => {
      clock += dt;
      fitCamera();
      if (wait && clock >= wait.at) {
        const fn = wait.fn;
        wait = null;
        fn();
      }
      const held = holdFrom === null ? 0 : clock - holdFrom;
      if (!flight) {
        const s = swayOffset(clock, held, distance);
        sight.position.set(aim.x + s.x, FACE_Y + aim.y + s.y, -distance + 0.03);
      }
      sight.visible = ready();
      const d = holdFrom === null ? 0 : Math.round(drawOf(held) * 20) * 5;
      if (d !== lastDraw) {
        lastDraw = d;
        drawBar.style.width = `${d}%`;
        drawEl.classList.toggle("ar-full", d >= 100);
      }
      if (flight) {
        flight.t += dt;
        const p = flight.path;
        while (flight.i < p.length - 2 && p[flight.i + 1]!.t <= flight.t) flight.i++;
        const a = p[flight.i]!, b = p[flight.i + 1] ?? a;
        const span = b.t - a.t || 1;
        const k = Math.min(1, Math.max(0, (flight.t - a.t) / span));
        flight.arrow.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
        // Point along the path: the arrow's -z faces the direction of travel.
        tmp.set(flight.arrow.position.x - (b.x - a.x), flight.arrow.position.y - (b.y - a.y), flight.arrow.position.z - (b.z - a.z));
        flight.arrow.lookAt(tmp);
        if (flight.t >= p[p.length - 1]!.t) land();
      }
    });

    // Pointer: aim at the pointed spot on the face plane; press to draw, release to shoot.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    const toFace = (e: PointerEvent): { x: number; y: number } | null => {
      const r = stage.canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      plane.constant = distance;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      return clampAim(hit.x, hit.y - FACE_Y);
    };
    const clampAim = (x: number, y: number) => {
      const lim = BOSS_HALF;
      return { x: Math.max(-lim, Math.min(lim, x)), y: Math.max(-lim, Math.min(lim, y)) };
    };
    let pointer: number | null = null;
    const el = shell.stage;
    const onDown = (e: PointerEvent) => {
      if (e.button > 0 || !ready()) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
      el.setPointerCapture?.(e.pointerId);
      pointer = e.pointerId;
      const p = toFace(e);
      if (p) aim = p;
      holdFrom = clock;
    };
    const onMove = (e: PointerEvent) => {
      if (pointer === null) {
        if (e.pointerType === "mouse" && ready()) {
          const p = toFace(e);
          if (p) aim = p;
        }
        return;
      }
      if (e.pointerId !== pointer) return;
      const p = toFace(e);
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
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    // Space held while the window loses focus: its keyup may never come, so drop the draw instead of leaving it.
    const onBlur = () => {
      holdFrom = null;
    };
    window.addEventListener("blur", onBlur);

    const hold = () => {
      if (ready() && holdFrom === null) holdFrom = clock;
    };
    function release() {
      if (holdFrom === null) return;
      const held = clock - holdFrom;
      holdFrom = null;
      if (!ready()) return;
      shoot(held);
    }
    const nudge = (dx: number, dy: number) => {
      aim = clampAim(aim.x + dx * faceR, aim.y + dy * faceR);
    };

    place();
    reset();
    return {
      reset,
      setDistance() {
        place();
        reset();
      },
      nudge,
      hold,
      release,
      drop: onBlur,
      dispose() {
        // An arrow still in flight counts where it was going to land (its landing is worked out at release), so a
        // lost context or a reload is not a free re-shot.
        if (flight) {
          const f = flight;
          flight = null;
          scene.remove(f.arrow);
          afterArrow(f.land);
        }
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("blur", onBlur);
        // Arrows in flight or lost are not in the scene graph the stage frees.
        clearArrows();
        for (const g of [shaftGeo, pointGeo, vaneGeo]) g.dispose();
        for (const m of [shaftMat, pointMat, vaneMat] as Material[]) m.dispose();
        faceTex.dispose();
      },
    };
  }

  // ---------------------------------------------------------------- keys

  const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  const SHOOT = new Set(["Space", "Enter", "NumpadEnter"]);
  const ownKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return false;
    if (e.target instanceof Element && e.target.closest("button, a, summary, select")) return false;
    // Only with focus inside the game: the arrows keep scrolling the page otherwise.
    return shell.root.contains(document.activeElement);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!ownKey(e)) return;
    // Space / Enter on the covered stage is handled by gameShell (it presses Play / Play again).
    if (shell.covered()) return;
    if (!game) return;
    const arrow = KEYS[e.code];
    if (arrow) {
      e.preventDefault();
      const step = e.shiftKey ? 0.1 : 0.025;
      game.nudge(arrow[0] * step, arrow[1] * step);
    } else if (SHOOT.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) game.hold();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!game || !SHOOT.has(e.code) || shell.covered()) return;
    // Released after the focus left the game (a click elsewhere while drawing): drop the draw rather than keep it.
    if (!shell.root.contains(document.activeElement)) {
      game.drop();
      return;
    }
    e.preventDefault();
    game.release();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("archery.title")),
      h("p", { class: "lede" }, t("archery.privacyNote")),
    ),
    h("div", { class: "g3d-bar ar-bar" },
      h("label", { class: "field" }, h("span", null, t("archery.distance")), distSel),
      newBtn,
      shell.fullscreenButton,
    ),
    shell.root,
    statusEl,
    h("div", { class: "ar-sheet-wrap" }, faceCanvas, h("div", { class: "ar-sheet-col" }, sheetEl, totalEl, bestEl)),
    h("p", { class: "hint", id: "ar-help" }, coarsePointer() ? t("archery.hintTouch") : t("archery.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );
  shell.stage.setAttribute("aria-describedby", "ar-help");
  render();

  mounted = {
    cleanup() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      // Disposing scores an arrow still in flight, which may start the round-over cover timer: clear it after.
      shell.dispose();
      game = null;
      window.clearTimeout(coverTimer);
    },
  };
}

export function unmountArchery(): void {
  mounted?.cleanup();
  mounted = null;
}

/** The WA ten-ring face on a canvas, mapped onto a unit disc (scaled to the face radius in the scene). */
function faceTexture(THREE: typeof import("three")): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  for (let ring = 0; ring < 10; ring++) {
    ctx.beginPath();
    ctx.arc(c, c, ((10 - ring) * c) / 10, 0, Math.PI * 2);
    ctx.fillStyle = `#${RING_COLORS[ring]!.toString(16).padStart(6, "0")}`;
    ctx.fill();
    ctx.strokeStyle = ring === 2 || ring === 3 ? "#f5f5f0" : "#2a2a2e";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(c, c, c / 20, 0, Math.PI * 2);
  ctx.strokeStyle = "#2a2a2e";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 6, c);
  ctx.lineTo(c + 6, c);
  ctx.moveTo(c, c - 6);
  ctx.lineTo(c, c + 6);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
