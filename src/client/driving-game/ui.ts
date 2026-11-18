import type { Group, Mesh, Object3D } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, onScreen, readStore, writeStore } from "../game-input";
import { coarsePointer, createStage, disposeScene, gameShell, heldKeys, holdPad, lostContext, type Stage, type Three } from "../three-stage";
import {
  DRIFT_SECONDS,
  LAPS,
  RUNOFF,
  SAMPLES,
  TRACK_COUNT,
  advance,
  buildTrack,
  carAt,
  cleanBests,
  driftScore,
  driftStep,
  formatLap,
  forwardSpeed,
  lastCheckpoint,
  slipAngle,
  speedOf,
  startDrift,
  startLaps,
  startWorld,
  updateLaps,
  type Bests,
  type Drift,
  type Input,
  type Laps,
  type Track,
  type World,
} from "../../shared/driving-game";

const STORE_KEY = "cvcm.drivinggame.v1";
type Mode = "time" | "drift";
type Action = "gas" | "brake" | "left" | "right" | "handbrake" | "reset";
const KEYS: Record<string, Action> = {
  ArrowUp: "gas", KeyW: "gas",
  ArrowDown: "brake", KeyS: "brake",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "handbrake",
  KeyR: "reset",
};
const COUNTDOWN = 3;

let mounted: { cleanup: () => void } | null = null;

/** Flat ribbon between two offsets from the centre line, at height y. Colours per vertex (r, g, b in 0–1). */
function ribbon(THREE: Three, track: Track, inner: number, outer: number, y: number, color: (s: number) => [number, number, number]) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let s = 0; s < SAMPLES; s++) {
    const p = track.points[s]!, tg = track.tangents[s]!;
    for (const off of [inner, outer]) pos.push(p.x + tg.z * off, y, p.z - tg.x * off);
    const c = color(s);
    col.push(...c, ...c);
    const a = s * 2, b = ((s + 1) % SAMPLES) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Vertical wall following the centre line at `off`. */
function wall(THREE: Three, track: Track, off: number, height: number) {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let s = 0; s < SAMPLES; s++) {
    const p = track.points[s]!, tg = track.tangents[s]!;
    const x = p.x + tg.z * off, z = p.z - tg.x * off;
    pos.push(x, 0, z, x, height, z);
    const c: [number, number, number] = Math.floor(s / 4) % 2 ? [0.96, 0.66, 0.78] : [1, 1, 1];
    col.push(...c, ...c);
    const a = s * 2, b = ((s + 1) % SAMPLES) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildTrackGroup(THREE: Three, track: Track): Group {
  const group = new THREE.Group();
  const flat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const half = track.width / 2;
  const grey: [number, number, number] = [0.42, 0.42, 0.46];
  const road = new THREE.Mesh(ribbon(THREE, track, -half, half, 0.02, () => grey), flat);
  group.add(road);
  // Kerbs: red and white blocks on both edges.
  const kerb = (s: number): [number, number, number] => (Math.floor(s / 2) % 2 ? [0.86, 0.2, 0.33] : [1, 1, 1]);
  group.add(new THREE.Mesh(ribbon(THREE, track, half, half + 1.1, 0.04, kerb), flat));
  group.add(new THREE.Mesh(ribbon(THREE, track, -half - 1.1, -half, 0.04, kerb), flat));
  // Tyre walls.
  // advance() stops the car's centre at half + RUNOFF; the body is 1.9 m wide, so the tyres sit a car's half-width out.
  group.add(new THREE.Mesh(wall(THREE, track, half + RUNOFF + 1.05, 1), flat));
  group.add(new THREE.Mesh(wall(THREE, track, -half - RUNOFF - 1.05, 1), flat));
  // Start / finish line: a white strip across the road at sample 0, with a checker row.
  const p0 = track.points[0]!, t0 = track.tangents[0]!;
  const line = new THREE.Mesh(new THREE.BoxGeometry(track.width, 0.05, 1.6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  line.position.set(p0.x, 0.05, p0.z);
  line.rotation.y = Math.atan2(t0.x, t0.z);
  group.add(line);
  const checks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.8), new THREE.MeshLambertMaterial({ color: 0x2e2229 }), 12);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(t0.x, t0.z));
  for (let i = 0; i < 12; i++) {
    const across = -half + 0.5 + i;
    const along = i % 2 ? 0.4 : -0.4;
    m.compose(new THREE.Vector3(p0.x + t0.z * across + t0.x * along, 0.06, p0.z - t0.x * across + t0.z * along), q, new THREE.Vector3(1, 1, 1));
    checks.setMatrixAt(i, m);
  }
  group.add(checks);
  // Cones.
  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 0.9, 8), new THREE.MeshLambertMaterial({ color: 0xff8a3d }), track.cones.length);
  track.cones.forEach((c, i) => {
    m.makeTranslation(c.x, 0.45, c.z);
    cones.setMatrixAt(i, m);
  });
  group.add(cones);
  // Trees outside the walls, spaced along the loop.
  const treeCount = 70;
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 6, 7), new THREE.MeshLambertMaterial({ color: 0x5c9e6a }), treeCount);
  for (let i = 0; i < treeCount; i++) {
    const s = Math.floor((i * SAMPLES) / treeCount);
    const p = track.points[s]!, tg = track.tangents[s]!;
    const off = (i % 2 ? 1 : -1) * (half + RUNOFF + 8 + ((i * 7) % 11));
    m.makeTranslation(p.x + tg.z * off, 3, p.z - tg.x * off);
    trees.setMatrixAt(i, m);
  }
  group.add(trees);
  return group;
}

function buildCar(THREE: Three): { car: Group; frontWheels: Object3D[]; wheels: Mesh[] } {
  const car = new THREE.Group();
  const pink = new THREE.MeshLambertMaterial({ color: 0xf4a9c6 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e2229 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.2), pink);
  body.position.y = 0.6;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2), white);
  cabin.position.set(0, 1.15, -0.25);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 4.22), white);
  stripe.position.y = 0.61;
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.4), dark);
  spoiler.position.set(0, 1.05, -2);
  car.add(body, cabin, stripe, spoiler);
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: Mesh[] = [];
  const frontWheels: Object3D[] = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.4, z);
    const w = new THREE.Mesh(wheelGeo, dark);
    pivot.add(w);
    car.add(pivot);
    wheels.push(w);
    if (z > 0) frontWheels.push(pivot);
  }
  return { car, frontWheels, wheels };
}

export function mountDrivingGame(host: HTMLElement): void {
  unmountDrivingGame();
  let trackIndex = 0;
  let mode: Mode = "time";
  let bests: Bests = cleanBests(readStore(STORE_KEY));

  const statusEl = h("p", { class: "dg-status", "aria-live": "polite", "data-out": "status" });
  const trackSel = h("select", { "data-in": "track" },
    ...Array.from({ length: TRACK_COUNT }, (_, i) => h("option", { value: String(i) }, t(`drivingGame.track${i + 1}`)))) as HTMLSelectElement;
  const modeSel = h("select", { "data-in": "mode" },
    h("option", { value: "time" }, t("drivingGame.modeTime")),
    h("option", { value: "drift" }, t("drivingGame.modeDrift"))) as HTMLSelectElement;
  const bestEl = h("dd", { "data-out": "best" });

  const showBest = () => {
    const k = String(trackIndex);
    bestEl.textContent = mode === "time"
      ? (bests.lap[k] ? formatLap(bests.lap[k]!) : "—")
      : (bests.drift[k] ? String(Math.floor(bests.drift[k]!)) : "—");
  };

  // Built on Play.
  let game: {
    setTrack(i: number): void;
    restart(): void;
    dispose(): void;
  } | null = null;

  const shell = gameShell({
    label: t("drivingGame.stage"),
    intro: t("drivingGame.intro"),
    async start(stageEl) {
      const stage = await createStage(stageEl, { mode: "loop", fov: 62, near: 0.3, far: 1200, background: 0xdfeefa, active: () => !shell.covered(), onLost: () => lostContext(shell) });
      if (!stage) return null;
      game = buildGame(stage, stageEl);
      return () => {
        game?.dispose();
        game = null;
      };
    },
    resume() {
      game?.restart();
    },
  });

  function buildGame(stage: Stage, stageEl: HTMLElement) {
    const { THREE, scene, camera } = stage;
    const fine = !coarsePointer();
    scene.fog = new THREE.Fog(0xdfeefa, 160, 520);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7fae7a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(40, 80, 20);
    scene.add(sun, sun.target);
    if (fine) {
      stage.renderer.shadowMap.enabled = true;
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 200 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshLambertMaterial({ color: 0x9fd39a }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = fine;
    scene.add(ground);

    let track = buildTrack(trackIndex);
    let trackGroup = buildTrackGroup(THREE, track);
    if (fine) trackGroup.children[0]!.receiveShadow = true;
    scene.add(trackGroup);
    const { car, frontWheels, wheels } = buildCar(THREE);
    if (fine) car.traverse((o) => { (o as Mesh).castShadow = true; });
    scene.add(car);

    const hud = h("div", { class: "g3d-hud dg-hud", "data-out": "hud" });
    const countEl = h("div", { class: "dg-count", "aria-hidden": "true" });
    const keys = heldKeys(KEYS, () => shellOpen() && (document.activeElement === stageEl || onScreen(stageEl)));
    const padL = holdPad<Action>([
      { action: "left", label: "◀", aria: t("drivingGame.left") },
      { action: "right", label: "▶", aria: t("drivingGame.right") },
    ], keys.held, "g3d-touch-only dg-pad-l");
    const padR = holdPad<Action>([
      { action: "brake", label: "▼", aria: t("drivingGame.brake") },
      { action: "handbrake", label: "⤾", aria: t("drivingGame.handbrake") },
      { action: "gas", label: "▲", aria: t("drivingGame.gas") },
    ], keys.held, "g3d-touch-only dg-pad-r");
    stageEl.append(hud, countEl, padL, padR);

    let world: World = startWorld(track);
    let laps: Laps = startLaps();
    let drift: Drift = startDrift();
    let clock = 0; // seconds since the green light
    let countdown = COUNTDOWN;
    let lapStart = 0;
    let lapTimes: number[] = [];
    let finished = false;
    let resetHeld = false;
    let wheelSpin = 0;
    const camPos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const scratchWant = new THREE.Vector3();
    const scratchLook = new THREE.Vector3();
    let camReady = false;

    const restart = () => {
      world = startWorld(track);
      laps = startLaps();
      drift = startDrift();
      clock = 0;
      countdown = COUNTDOWN;
      lapStart = 0;
      lapTimes = [];
      finished = false;
      camReady = false;
      statusEl.textContent = "";
      showBest();
    };

    const finish = (message: string) => {
      finished = true;
      statusEl.textContent = message;
      shell.cover(message, t("drivingGame.again"));
    };

    const save = () => writeStore(STORE_KEY, bests);

    stage.onFrame((dt) => {
      const input: Input = {
        throttle: keys.held.has("gas"),
        brake: keys.held.has("brake"),
        // Positive steer turns the heading toward +x, which is screen left for the chase camera (it looks down +z).
        steer: (keys.held.has("left") ? 1 : 0) - (keys.held.has("right") ? 1 : 0),
        handbrake: keys.held.has("handbrake"),
      };
      const k = String(trackIndex);
      if (!finished && shellOpen()) {
        if (countdown > 0) {
          countdown -= dt;
          countEl.textContent = countdown > 0 ? String(Math.ceil(countdown)) : t("drivingGame.go");
        } else {
          if (countdown > -0.8) countdown -= dt;
          else countEl.textContent = "";
          clock += dt;
          if (keys.held.has("reset") && !resetHeld) {
            const s = lastCheckpoint(track, laps);
            world = { car: carAt(track, s), index: s, lateral: 0, onRoad: true, hit: false };
            if (mode === "drift") drift = { ...drift, chain: 0 };
          }
          resetHeld = keys.held.has("reset");
          world = advance(track, { ...world, hit: false }, input, dt);
          // Checkpoints count in both modes, so R in drift mode also goes back to the last one passed.
          const u = updateLaps(track, laps, world.index);
          laps = u.laps;
          if (mode === "time") {
            if (u.lapDone) {
              const ms = Math.round((clock - lapStart) * 1000);
              lapTimes.push(ms);
              lapStart = clock;
              if (!bests.lap[k] || ms < bests.lap[k]!) {
                bests.lap[k] = ms;
                save();
              }
              if (laps.lap >= LAPS) {
                const total = lapTimes.reduce((a, b) => a + b, 0);
                finish(t("drivingGame.finished", { total: formatLap(total), best: formatLap(Math.min(...lapTimes)) }));
              }
            }
          } else {
            drift = driftStep(drift, slipAngle(world.car), speedOf(world.car), world.onRoad, world.hit, dt);
            if (clock >= DRIFT_SECONDS) {
              const score = driftScore(drift);
              if (score > (bests.drift[k] ?? 0)) {
                bests.drift[k] = score;
                save();
              }
              finish(t("drivingGame.driftDone", { score }));
            }
          }
        }
      }
      // Car and wheels.
      const c = world.car;
      car.position.set(c.x, 0, c.z);
      car.rotation.y = c.heading;
      for (const fw of frontWheels) fw.rotation.y = c.steer;
      wheelSpin += forwardSpeed(c) * dt / 0.4;
      for (const w of wheels) w.rotation.x = wheelSpin;
      // Chase camera, eased; never below 2 m.
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      const want = scratchWant.set(c.x - fx * 9, 4.2, c.z - fz * 9);
      const ease = camReady ? 1 - Math.exp(-dt * 5) : 1;
      camPos.lerp(want, ease);
      camPos.y = Math.max(2, camPos.y);
      look.lerp(scratchLook.set(c.x + fx * 4, 1.2, c.z + fz * 4), ease);
      camReady = true;
      camera.position.copy(camPos);
      camera.lookAt(look);
      if (fine) {
        sun.position.set(c.x + 30, 60, c.z + 15);
        sun.target.position.set(c.x, 0, c.z);
      }
      // HUD.
      const kmh = Math.round(speedOf(c) * 3.6);
      const parts = [t("drivingGame.speed", { n: kmh })];
      if (mode === "time") {
        parts.push(t("drivingGame.lap", { n: Math.min(LAPS, laps.lap + 1), of: LAPS }));
        parts.push(t("drivingGame.current", { time: formatLap(Math.max(0, Math.round((clock - lapStart) * 1000))) }));
        if (bests.lap[k]) parts.push(t("drivingGame.bestLap", { time: formatLap(bests.lap[k]!) }));
      } else {
        parts.push(t("drivingGame.drift", { n: driftScore(drift) }));
        parts.push(t("drivingGame.timeLeft", { n: Math.max(0, Math.ceil(DRIFT_SECONDS - clock)) }));
      }
      if (!world.onRoad) parts.push(t("drivingGame.offRoad"));
      const text = parts.join(" · ");
      if (hud.textContent !== text) hud.textContent = text;
    });

    return {
      setTrack(i: number) {
        scene.remove(trackGroup);
        disposeScene(trackGroup);
        track = buildTrack(i);
        trackGroup = buildTrackGroup(THREE, track);
        if (fine) trackGroup.children[0]!.receiveShadow = true;
        scene.add(trackGroup);
        restart();
      },
      restart,
      dispose() {
        keys.dispose();
        hud.remove();
        countEl.remove();
        padL.remove();
        padR.remove();
        stage.dispose();
      },
    };
  }

  /** The cover is hidden, i.e. the player is driving. */
  function shellOpen(): boolean {
    return !shell.covered();
  }

  trackSel.addEventListener("change", () => {
    trackIndex = Number(trackSel.value) || 0;
    showBest();
    game?.setTrack(trackIndex);
    // Hand the keys back to the car: arrows on a focused select would change it instead of steering.
    shell.stage.focus({ preventScroll: true });
  });
  modeSel.addEventListener("change", () => {
    mode = modeSel.value === "drift" ? "drift" : "time";
    showBest();
    game?.restart();
    shell.stage.focus({ preventScroll: true });
  });
  const restartBtn = h("button", { type: "button", class: "btn ghost", "data-act": "restart" }, t("drivingGame.restart"));
  restartBtn.addEventListener("click", () => {
    if (!game) return;
    game.restart();
    shell.uncover();
  });
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) {
      bests = cleanBests(readStore(STORE_KEY));
      showBest();
    }
  };
  window.addEventListener("storage", onStorage);
  showBest();

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("drivingGame.title")),
      h("p", { class: "lede" }, t("drivingGame.privacyNote")),
    ),
    h("div", { class: "dg-tool" },
      shell.root,
      h("div", { class: "g3d-bar" },
        h("label", { class: "field" }, h("span", null, t("drivingGame.track")), trackSel),
        h("label", { class: "field" }, h("span", null, t("drivingGame.mode")), modeSel),
        restartBtn,
        shell.fullscreenButton,
      ),
      h("dl", { class: "stats-grid dg-best" }, h("dt", null, t("drivingGame.best")), bestEl),
      statusEl,
      h("p", { class: "hint" }, t("drivingGame.hint")),
      creditLine("game3d.credit", "https://threejs.org", "three.js"),
    ),
  );

  mounted = {
    cleanup: () => {
      window.removeEventListener("storage", onStorage);
      shell.dispose();
      game = null;
    },
  };
}

export function unmountDrivingGame(): void {
  mounted?.cleanup();
  mounted = null;
}
