import type { BufferGeometry, Group, InstancedMesh, Material, Mesh } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, onScreen, readStore, writeStore } from "../game-input";
import { seeded } from "../../shared/random";
import { coarsePointer, createStage, gameShell, heldKeys, holdPad, lostContext, type Shell, type Stage } from "../three-stage";
import {
  GEAR,
  RING_COUNT,
  RING_RADIUS,
  RUNWAY_LENGTH,
  RUNWAY_WIDTH,
  RUNWAY_TOP,
  WORLD,
  airborneStart,
  formatFlightTime,
  forward,
  onRunwayStart,
  ringCourse,
  step,
  meshHeight,
  surfaceHeight,
  terrainHeight,
  TERRAIN_SEGMENTS,
  throughRing,
  type Controls,
  type Plane,
  type Ring,
} from "../../shared/flight-simulator";

const STORE_KEY = "cvcm.flightsim.v1";
const SKY = 0xd6ecf7;
type Mode = "free" | "rings";
type CameraMode = "chase" | "cockpit";
type Action = "thrUp" | "thrDown" | "stickFwd" | "stickBack" | "noseUp" | "noseDown" | "rollLeft" | "rollRight" | "yawLeft" | "yawRight" | "restart";
interface Saved { best?: number | null; invert?: boolean }

const KEYS: Record<string, Action> = {
  KeyW: "thrUp", KeyS: "thrDown",
  ArrowUp: "stickFwd", ArrowDown: "stickBack",
  ArrowLeft: "rollLeft", ArrowRight: "rollRight",
  KeyA: "yawLeft", KeyD: "yawRight",
  KeyR: "restart",
};

let mounted: { cleanup: () => void } | null = null;

export function mountFlightSimulator(host: HTMLElement): void {
  unmountFlightSimulator();
  const saved: Saved = readStore<Saved>(STORE_KEY) ?? {};
  let best = typeof saved.best === "number" && saved.best > 0 ? saved.best : null;
  let invert = saved.invert === true;
  let mode: Mode = "free";
  let camMode: CameraMode = "chase";
  const save = () => writeStore(STORE_KEY, { best, invert });

  const statusEl = h("p", { class: "fs-status", "aria-live": "polite", "data-out": "status" });
  const hudSpeed = h("span", { "data-out": "speed" });
  const hudAlt = h("span", { "data-out": "altitude" });
  const hudThr = h("span", { "data-out": "throttle" });
  const hudRings = h("span", { "data-out": "rings", hidden: true });
  const hudStall = h("strong", { class: "fs-stall", hidden: true }, t("flightSim.stall"));
  const hud = h("div", { class: "g3d-hud fs-hud", "aria-hidden": "true" }, hudSpeed, hudAlt, hudThr, hudRings, hudStall);
  const bestEl = h("dd", { "data-out": "best" }, best ? formatFlightTime(best) : "—");

  let game: Game | null = null;
  let held = new Set<Action>();

  const shell: Shell = gameShell({
    label: t("flightSim.stage"),
    intro: t("flightSim.intro"),
    async start(stageEl) {
      const stage = await createStage(stageEl, { mode: "loop", fov: 60, near: 0.5, far: 4200, background: SKY, active: () => !shell.covered(), onLost: () => lostContext(shell) });
      if (!stage) return null;
      game = buildGame(stage);
      // Window key listeners only once the game is built, so a build that throws leaves none behind.
      const keys = heldKeys<Action>(KEYS, () => !!game?.playing && !shell.covered() && (document.activeElement === stageEl || onScreen(shell.root)));
      held = keys.held;
      game.reset();
      return () => {
        keys.dispose();
        stage.dispose();
        game = null;
      };
    },
    resume() {
      game?.reset();
    },
  });
  shell.root.classList.add("fs-root");

  // Touch buttons have their own set; controls() reads both.
  const padHeld = new Set<Action>();
  const pad = holdPad<Action>([
    { action: "noseUp", label: "▲", aria: t("flightSim.p_noseUp") },
    { action: "noseDown", label: "▼", aria: t("flightSim.p_noseDown") },
    { action: "thrUp", label: "+", aria: t("flightSim.p_thrUp") },
    { action: "thrDown", label: "−", aria: t("flightSim.p_thrDown") },
    { action: "rollLeft", label: "◀", aria: t("flightSim.p_rollLeft") },
    { action: "rollRight", label: "▶", aria: t("flightSim.p_rollRight") },
  ], padHeld, "g3d-touch-only fs-pad");
  shell.root.insertBefore(hud, shell.stage.nextSibling);
  shell.root.insertBefore(pad, hud.nextSibling);

  const modeSel = h("select", { "data-in": "mode" },
    h("option", { value: "free", selected: true }, t("flightSim.m_free")),
    h("option", { value: "rings" }, t("flightSim.m_rings"))) as HTMLSelectElement;
  modeSel.addEventListener("change", () => {
    mode = modeSel.value === "rings" ? "rings" : "free";
    // Behind a cover (crash, finish) the new mode starts when the player presses the cover's button.
    if (!shell.covered()) game?.reset();
    shell.stage.focus({ preventScroll: true });
  });
  const restartBtn = h("button", { type: "button", class: "btn ghost", "data-act": "restart" }, t("flightSim.restart"));
  restartBtn.addEventListener("click", () => {
    if (!game) return;
    shell.uncover();
    game.reset();
  });
  const camBtn = h("button", { type: "button", class: "btn ghost", "data-act": "camera", "aria-pressed": "false" }, t("flightSim.c_cockpit"));
  camBtn.addEventListener("click", () => {
    camMode = camMode === "chase" ? "cockpit" : "chase";
    camBtn.textContent = camMode === "chase" ? t("flightSim.c_cockpit") : t("flightSim.c_chase");
    camBtn.setAttribute("aria-pressed", String(camMode === "cockpit"));
    game?.snapCamera();
    shell.stage.focus({ preventScroll: true });
  });
  const invertBox = h("input", { type: "checkbox", "data-in": "invert", checked: invert }) as HTMLInputElement;
  invertBox.addEventListener("change", () => {
    invert = invertBox.checked;
    save();
    shell.stage.focus({ preventScroll: true });
  });

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("flightSim.title")),
      h("p", { class: "lede" }, t("flightSim.privacyNote")),
    ),
    shell.root,
    h("div", { class: "g3d-bar fs-bar" },
      h("label", { class: "field fs-mode" }, h("span", null, t("flightSim.mode")), modeSel),
      restartBtn,
      camBtn,
      shell.fullscreenButton,
      h("label", { class: "check" }, invertBox, h("span", null, t("flightSim.invert"))),
    ),
    statusEl,
    h("dl", { class: "stats-grid fs-best" }, h("dt", null, t("flightSim.best")), bestEl),
    h("p", { class: "hint" }, t("flightSim.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );

  interface Game {
    playing: boolean;
    reset(): void;
    snapCamera(): void;
  }

  function buildGame(stage: Stage): Game {
    const { THREE, scene, camera } = stage;
    const coarse = coarsePointer();
    scene.fog = new THREE.Fog(SKY, 700, 3800);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb58a, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(-0.5, 1, 0.3);
    scene.add(sun);

    // Terrain: flat-shaded, coloured by height.
    // The same grid on every device: the physics reads this exact surface (meshHeight).
    const plane = new THREE.PlaneGeometry(WORLD * 2, WORLD * 2, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position!;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
    const terrainGeo = plane.toNonIndexed();
    plane.dispose();
    const tp = terrainGeo.attributes.position!;
    const colors = new Float32Array(tp.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < tp.count; i += 3) {
      const y = (tp.getY(i) + tp.getY(i + 1) + tp.getY(i + 2)) / 3;
      const hex = y < 4 ? 0xe9d8a6 : y < 150 ? 0x9ccf7f : y < 260 ? 0x7fae6a : y < 380 ? 0xa59a91 : 0xf7f7f7;
      color.setHex(hex);
      for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3);
    }
    terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshLambertMaterial({ color: 0x8fd0e6 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0;
    scene.add(sea);

    // Runway with centre stripes.
    // A 1.5 m slab whose top is RUNWAY_TOP, the height the wheels roll on (surfaceHeight).
    const runway = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY_WIDTH, 1.5, RUNWAY_LENGTH), new THREE.MeshLambertMaterial({ color: 0x6d6b73 }));
    runway.position.set(0, RUNWAY_TOP - 0.75, 0);
    scene.add(runway);
    const stripeGeo = new THREE.BoxGeometry(1, 0.1, 18);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const stripeCount = Math.floor(RUNWAY_LENGTH / 40);
    const stripes = new THREE.InstancedMesh(stripeGeo, stripeMat, stripeCount);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < stripeCount; i++) {
      m4.makeTranslation(0, RUNWAY_TOP + 0.03, -RUNWAY_LENGTH / 2 + 20 + i * 40);
      stripes.setMatrixAt(i, m4);
    }
    scene.add(stripes);

    // Trees and clouds, placed the same way every time.
    const rand = seeded(12345);
    const treeCount = coarse ? 220 : 480;
    const trees: InstancedMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(5, 16, 6), new THREE.MeshLambertMaterial({ color: 0x5f9b5a, flatShading: true }), treeCount);
    let placed = 0;
    for (let tries = 0; placed < treeCount && tries < treeCount * 20; tries++) {
      const x = (rand() * 2 - 1) * 2400;
      const z = (rand() * 2 - 1) * 2400;
      const y = meshHeight(x, z);
      if (y < 8 || y > 240 || (Math.abs(x) < 120 && Math.abs(z) < RUNWAY_LENGTH / 2 + 200)) continue;
      const s = 0.7 + rand() * 0.8;
      m4.makeScale(s, s, s).setPosition(x, y + 7 * s, z);
      trees.setMatrixAt(placed++, m4);
    }
    trees.count = placed;
    scene.add(trees);
    const cloudCount = coarse ? 24 : 48;
    const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(40, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xc8c8cc, flatShading: true }), cloudCount);
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < cloudCount; i++) {
      v.set((rand() * 2 - 1) * 3000, 650 + rand() * 350, (rand() * 2 - 1) * 3000);
      sc.set(1.5 + rand() * 2, 0.5 + rand() * 0.4, 1 + rand() * 1.5);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
      m4.compose(v, q, sc);
      clouds.setMatrixAt(i, m4);
    }
    scene.add(clouds);

    // The plane: nose towards -z.
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const pink = new THREE.MeshLambertMaterial({ color: 0xf08bb4, flatShading: true });
    const dark = new THREE.MeshLambertMaterial({ color: 0x4a3a44 });
    const plane3d: Group = new THREE.Group();
    const part = (geo: BufferGeometry, mat: Material, x: number, y: number, z: number): Mesh => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      plane3d.add(mesh);
      return mesh;
    };
    part(new THREE.BoxGeometry(1.4, 1.4, 7.5), white, 0, 0, 0);
    const nose = part(new THREE.ConeGeometry(0.75, 1.4, 8), pink, 0, 0, -4.4);
    nose.rotation.x = -Math.PI / 2;
    part(new THREE.BoxGeometry(11, 0.22, 1.9), pink, 0, 0.2, -0.6);
    part(new THREE.BoxGeometry(4, 0.16, 1.1), pink, 0, 0.3, 3.3);
    part(new THREE.BoxGeometry(0.16, 1.7, 1.3), pink, 0, 1.1, 3.4);
    part(new THREE.BoxGeometry(0.9, 0.6, 1.4), dark, 0, 0.9, -1.2);
    const prop = part(new THREE.BoxGeometry(3, 0.24, 0.1), dark, 0, 0, -5.15);
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 10);
    for (const [x, z] of [[-1.3, -0.4], [1.3, -0.4], [0, -3.3]] as const) {
      const w = part(wheelGeo, dark, x, -GEAR + 0.35, z);
      w.rotation.z = Math.PI / 2;
    }
    plane3d.rotation.order = "YXZ";
    scene.add(plane3d);

    // Rings.
    const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 1.8, 8, 40);
    const ringNext = new THREE.MeshLambertMaterial({ color: 0xd63c7c });
    const ringLater = new THREE.MeshLambertMaterial({ color: 0xf6b8d2, transparent: true, opacity: 0.7 });
    const course: Ring[] = ringCourse(1);
    const ringMeshes = course.map((r) => {
      const mesh = new THREE.Mesh(ringGeo, ringLater);
      mesh.position.set(r.x, r.y, r.z);
      mesh.lookAt(r.x + r.nx, r.y + r.ny, r.z + r.nz);
      scene.add(mesh);
      return mesh;
    });

    camera.rotation.order = "YXZ";
    let state: Plane = onRunwayStart();
    let ring = 0;
    let elapsed = 0;
    let wasOnGround = true;
    let wasLanded = false;
    let restartHeld = false;
    let lastHud = "";
    let propAngle = 0;
    const camPos = new THREE.Vector3();
    const target = new THREE.Vector3();

    const g: Game = {
      playing: false,
      reset() {
        state = mode === "rings" ? airborneStart() : onRunwayStart();
        ring = 0;
        elapsed = 0;
        wasOnGround = state.onGround;
        wasLanded = state.landed;
        g.playing = true;
        hudRings.hidden = mode !== "rings";
        ringMeshes.forEach((m, i) => {
          m.visible = mode === "rings";
          m.material = i === 0 ? ringNext : ringLater;
        });
        setStatus(mode === "rings" ? t("flightSim.ringsGo") : t("flightSim.freeGo"));
        g.snapCamera();
      },
      snapCamera() {
        placeCamera(1);
      },
    };

    function setStatus(text: string) {
      if (statusEl.textContent !== text) statusEl.textContent = text;
    }

    function controls(): Controls {
      const has = (a: Action) => (held.has(a) || padHeld.has(a) ? 1 : 0);
      const stick = (has("stickBack") - has("stickFwd")) * (invert ? -1 : 1);
      return {
        throttle: has("thrUp") - has("thrDown"),
        pitch: Math.max(-1, Math.min(1, stick + has("noseUp") - has("noseDown"))),
        roll: has("rollRight") - has("rollLeft"),
        yaw: has("yawRight") - has("yawLeft"),
      };
    }

    function placeCamera(k: number) {
      const [fx, fy, fz] = forward(state);
      if (camMode === "cockpit") {
        plane3d.visible = false;
        camera.position.set(state.x + fx * 1.5, state.y + 1.1, state.z + fz * 1.5);
        camera.rotation.set(state.pitch, -state.yaw, -state.roll);
        return;
      }
      plane3d.visible = true;
      const flat = Math.hypot(fx, fz) || 1;
      camPos.set(state.x - (fx / flat) * 26, state.y + 7 - fy * 6, state.z - (fz / flat) * 26);
      // Keep the camera above the ground and the sea.
      camPos.y = Math.max(camPos.y, surfaceHeight(camPos.x, camPos.z) + 3);
      camera.position.lerp(camPos, k);
      target.set(state.x + fx * 20, state.y + fy * 20 + 2, state.z + fz * 20);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
    }

    function finish(text: string, again = t("flightSim.again")) {
      g.playing = false;
      shell.cover(text, again);
    }

    stage.onFrame((dt) => {
      if (g.playing) {
        // Edge-triggered: key repeat re-adds "restart" while R is held, which would reset every frame.
        if (held.has("restart") && !restartHeld) g.reset();
        restartHeld = held.has("restart");
        const before: [number, number, number] = [state.x, state.y, state.z];
        state = step(state, controls(), dt);
        if (mode === "rings") {
          elapsed += dt * 1000;
          const r = course[ring];
          if (r && throughRing(r, before, [state.x, state.y, state.z])) {
            ringMeshes[ring]!.visible = false;
            ring++;
            const next = ringMeshes[ring];
            if (next) next.material = ringNext;
            if (ring >= RING_COUNT) {
              const time = Math.round(elapsed);
              const record = best === null || time < best;
              if (record) {
                best = time;
                save();
                bestEl.textContent = formatFlightTime(time);
              }
              finish(record ? t("flightSim.newBest", { time: formatFlightTime(time) }) : t("flightSim.finished", { time: formatFlightTime(time) }));
            } else {
              setStatus(t("flightSim.ringPassed", { n: ring, total: RING_COUNT }));
            }
          }
        }
        if (state.crashed) {
          const reason = state.crashed === "water" ? "crashWater" : state.crashed === "hard" ? "crashHard" : "crashTerrain";
          finish(t(`flightSim.${reason}`));
        } else if (g.playing) {
          // `landed` turns true seconds after touchdown (once the roll slows), so it has its own edge.
          if (state.landed && !wasLanded) setStatus(t("flightSim.landed"));
          else if (!state.onGround && wasOnGround) setStatus(t("flightSim.airborne"));
          wasOnGround = state.onGround;
          wasLanded = state.landed;
        }
      }
      // Model and camera.
      plane3d.position.set(state.x, state.y, state.z);
      plane3d.rotation.set(state.pitch, -state.yaw, -state.roll);
      propAngle += dt * (8 + state.throttle * 60);
      prop.rotation.z = propAngle;
      placeCamera(Math.min(1, dt * 5));
      // HUD, only when something shown changed.
      const speed = Math.round(state.speed * 3.6);
      const alt = Math.round(Math.max(0, state.y - GEAR));
      const thr = Math.round(state.throttle * 100);
      const key = `${speed}|${alt}|${thr}|${ring}|${Math.floor(elapsed / 100)}|${state.stalled}`;
      if (key !== lastHud) {
        lastHud = key;
        hudSpeed.textContent = t("flightSim.hudSpeed", { n: speed });
        hudAlt.textContent = t("flightSim.hudAlt", { n: alt });
        hudThr.textContent = t("flightSim.hudThrottle", { n: thr });
        hudRings.textContent = t("flightSim.hudRings", { n: Math.min(ring + 1, RING_COUNT), total: RING_COUNT, time: formatFlightTime(elapsed) });
        hudStall.hidden = !state.stalled;
      }
    });
    return g;
  }

  mounted = {
    cleanup: () => {
      shell.dispose();
    },
  };
}

export function unmountFlightSimulator(): void {
  mounted?.cleanup();
  mounted = null;
}
