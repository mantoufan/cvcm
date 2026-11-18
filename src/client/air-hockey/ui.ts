import type { Mesh } from "three";
import { h } from "../dom";
import { t } from "../i18n";
import { creditLine, readStore, typingTarget, writeStore } from "../game-input";
import { coarsePointer, createStage, gameShell, heldKeys, lostContext, type Stage } from "../three-stage";
import {
  GOAL_W,
  LEVELS,
  MALLET_MAX,
  MALLET_R,
  PUCK_R,
  TABLE_L,
  TABLE_W,
  cleanRecord,
  clampPlayer,
  newMatch,
  step,
  type Level,
  type Match,
} from "../../shared/air-hockey";

/**
 * Air hockey against the computer (games3d group). Physics and the computer player are in src/shared/air-hockey.ts;
 * this page draws the table with three.js (loaded on Play, three-stage.ts) and feeds the player's mallet target from
 * the pointer or the arrow keys / WASD. Wins and losses per level in `cvcm.airhockey.v1`.
 */

const STORE_KEY = "cvcm.airhockey.v1";
/** Table units to world units: the table is 10 × 16 in the scene, the player's end toward the camera (+z). */
const S = 10;
const KEYS: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};

let mounted: { cleanup: () => void } | null = null;

export function mountAirHockey(host: HTMLElement): void {
  unmountAirHockey();
  const record = cleanRecord(readStore(STORE_KEY));
  let level: Level = record.level;
  let match: Match = newMatch();
  let playing = false;
  let game: { restart(): void } | null = null;

  const youEl = h("dd", { "data-out": "you" }, "0");
  const cpuEl = h("dd", { "data-out": "cpu" }, "0");
  const recordEl = h("p", { class: "ah-record", "data-out": "record" });
  const statusEl = h("p", { class: "ah-status", "aria-live": "polite", "data-out": "status" });
  const hudEl = h("div", { class: "g3d-hud ah-hud", "aria-hidden": "true" });

  const save = () => writeStore(STORE_KEY, record);
  const showRecord = () => {
    recordEl.textContent = t("airHockey.record", { w: record.wins[level], l: record.losses[level] });
  };
  let shownScore = "";
  const showScore = () => {
    const key = `${match.score[0]}:${match.score[1]}`;
    if (key === shownScore) return;
    shownScore = key;
    youEl.textContent = String(match.score[0]);
    cpuEl.textContent = String(match.score[1]);
    hudEl.textContent = t("airHockey.hud", { you: match.score[0], cpu: match.score[1] });
  };

  const shell = gameShell({
    label: t("airHockey.stage"),
    intro: t("airHockey.intro"),
    className: "g3d-tall ah-root",
    start: async (el) => {
      const stage = await createStage(el, { mode: "loop", fov: 42, near: 0.1, far: 200, background: 0xfdf0f5, active: () => !shell.covered(), onLost: () => { game = null; lostContext(shell); } });
      if (!stage) return null;
      const built = build(stage);
      game = built;
      built.restart();
      return () => {
        built.dispose();
        game = null;
        stage.dispose();
      };
    },
    resume: () => game?.restart(),
  });
  shell.root.insertBefore(hudEl, shell.stage.nextSibling);

  function finish() {
    playing = false;
    const [you, cpu] = match.score;
    if (match.winner === "player") record.wins[level]++;
    else record.losses[level]++;
    save();
    showRecord();
    const text = match.winner === "player" ? t("airHockey.youWin", { you, cpu }) : t("airHockey.cpuWins", { you, cpu });
    statusEl.textContent = text;
    shell.cover(text, t("airHockey.again"));
  }

  function build(stage: Stage): { restart(): void; dispose(): void } {
    const { THREE, scene, camera } = stage;
    const shadows = !coarsePointer();
    if (shadows) stage.renderer.shadowMap.enabled = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf2d4e2, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(4, 16, 8);
    sun.castShadow = shadows;
    if (shadows) {
      Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 10, bottom: -10, near: 1, far: 40 });
      sun.shadow.camera.updateProjectionMatrix();
    }
    scene.add(sun);

    const W = TABLE_W * S;
    const L = TABLE_L * S;
    const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
    // Playing surface and its markings.
    const surface = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, L), lambert(0xfbfcff));
    surface.position.y = -0.2;
    surface.receiveShadow = shadows;
    scene.add(surface);
    const markMat = new THREE.MeshBasicMaterial({ color: 0xf4a9c6 });
    const centre = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.06), markMat);
    centre.rotation.x = -Math.PI / 2;
    centre.position.y = 0.005;
    scene.add(centre);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.58, 48), markMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);
    for (const end of [-1, 1]) {
      const crease = new THREE.Mesh(new THREE.RingGeometry(2, 2.08, 32, 1, 0, Math.PI), markMat);
      crease.rotation.x = -Math.PI / 2;
      crease.rotation.z = end > 0 ? Math.PI : 0;
      crease.position.set(0, 0.005, (end * L) / 2);
      scene.add(crease);
    }
    // Rails, open at the goal mouths; dark slots behind the goals.
    const railMat = lambert(0xc2336c);
    const RAIL_T = 0.4, RAIL_H = 0.6;
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(RAIL_T, RAIL_H, L + RAIL_T * 2), railMat);
      rail.position.set(side * (W / 2 + RAIL_T / 2), RAIL_H / 2 - 0.2, 0);
      scene.add(rail);
    }
    const goal = GOAL_W * S;
    const seg = (W - goal) / 2;
    for (const end of [-1, 1]) {
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(seg, RAIL_H, RAIL_T), railMat);
        rail.position.set(side * (goal / 2 + seg / 2), RAIL_H / 2 - 0.2, end * (L / 2 + RAIL_T / 2));
        scene.add(rail);
      }
      const slot = new THREE.Mesh(new THREE.BoxGeometry(goal, 0.3, 0.8), lambert(0x3a2433));
      slot.position.set(0, -0.3, end * (L / 2 + 0.4));
      scene.add(slot);
    }

    // Puck (glowing) and the two mallets.
    const puck = new THREE.Mesh(
      new THREE.CylinderGeometry(PUCK_R * S, PUCK_R * S, 0.14, 32),
      new THREE.MeshStandardMaterial({ color: 0xff7aa8, emissive: 0xff2f7d, emissiveIntensity: 0.55, roughness: 0.35 }),
    );
    puck.castShadow = shadows;
    scene.add(puck);
    const mallet = (color: number): Mesh => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(MALLET_R * S, MALLET_R * S * 1.05, 0.2, 32), mat);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.45, 20), mat);
      knob.position.y = 0.32;
      base.add(knob);
      base.castShadow = shadows;
      knob.castShadow = shadows;
      scene.add(base);
      return base;
    };
    const you = mallet(0xc2336c);
    const cpu = mallet(0x7b5cc4);

    const place = () => {
      puck.position.set(match.puck.x * S, 0.07, -match.puck.y * S);
      you.position.set(match.player.x * S, 0.1, -match.player.y * S);
      cpu.position.set(match.ai.x * S, 0.1, -match.ai.y * S);
    };

    // Pointer: where it meets the mallets' height on the table is the player's target.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
    const hit = new THREE.Vector3();
    let target = { x: match.player.x, y: match.player.y };
    const onPointer = (e: PointerEvent) => {
      if (!playing || shell.covered()) return;
      if (e.pointerType !== "mouse" && e.type === "pointermove" && e.buttons === 0) return;
      if (e.type === "pointerdown") {
        e.preventDefault();
        shell.stage.focus({ preventScroll: true });
      }
      const r = stage.canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) target = clampPlayer(hit.x / S, -hit.z / S);
    };
    shell.stage.addEventListener("pointerdown", onPointer);
    shell.stage.addEventListener("pointermove", onPointer);

    // Keys move the target from where the mallet is, so keys and the mouse never fight.
    const keys = heldKeys(KEYS, () => playing && !shell.covered() && shell.root.contains(document.activeElement));

    let fit = 0;
    const fitCamera = () => {
      fit = camera.aspect;
      // Further back on a narrow stage so the whole table and both goals stay in view.
      const k = Math.max(1, 0.82 / (fit || 1)) ** 0.95;
      camera.position.set(0, 19 * k, 15 * k);
      camera.lookAt(0, 0, 0.9);
    };

    stage.onFrame((dt) => {
      if (camera.aspect !== fit) fitCamera();
      if (playing) {
        const dx = (keys.held.has("right") ? 1 : 0) - (keys.held.has("left") ? 1 : 0);
        const dy = (keys.held.has("up") ? 1 : 0) - (keys.held.has("down") ? 1 : 0);
        if (dx || dy) {
          const n = Math.hypot(dx, dy);
          const reach = MALLET_MAX * 0.06;
          target = clampPlayer(match.player.x + (dx / n) * reach, match.player.y + (dy / n) * reach);
        }
        const before = match.score[0] + match.score[1];
        match = step(match, target, level, dt);
        if (match.score[0] + match.score[1] !== before) {
          showScore();
          statusEl.textContent = match.lastGoal === "player"
            ? t("airHockey.goalYou", { you: match.score[0], cpu: match.score[1] })
            : t("airHockey.goalCpu", { you: match.score[0], cpu: match.score[1] });
        }
        if (match.winner) finish();
      }
      place();
    });

    return {
      restart() {
        match = newMatch();
        target = { x: match.player.x, y: match.player.y };
        playing = true;
        shownScore = "";
        showScore();
        statusEl.textContent = "";
        place();
      },
      dispose() {
        keys.dispose();
        shell.stage.removeEventListener("pointerdown", onPointer);
        shell.stage.removeEventListener("pointermove", onPointer);
      },
    };
  }

  const levelSel = h("select", { "data-in": "level" },
    ...LEVELS.map((l) => h("option", { value: String(l), selected: l === level }, t(`airHockey.l_${l}`)))) as HTMLSelectElement;
  levelSel.addEventListener("change", () => {
    level = (Number(levelSel.value) as Level) ?? 1;
    record.level = level;
    save();
    showRecord();
    // A new level starts a new match.
    if (game) {
      if (shell.covered()) shell.uncover();
      game.restart();
      shell.stage.focus({ preventScroll: true });
    }
  });
  const restartBtn = h("button", { type: "button", class: "btn ghost", "data-act": "restart" }, t("airHockey.restart"));
  restartBtn.addEventListener("click", () => {
    if (!game) return;
    if (shell.covered()) shell.uncover();
    game.restart();
    shell.stage.focus({ preventScroll: true });
  });

  // Space or Enter on the focused stage after a match plays again, like the cover's button.
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "Space" && e.code !== "Enter" && e.code !== "NumpadEnter") return;
    if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target)) return;
    if (e.target !== shell.stage) return;
    e.preventDefault();
    if (!e.repeat && shell.covered() && game) shell.root.querySelector<HTMLButtonElement>('[data-act="play"]')?.click();
  };
  window.addEventListener("keydown", onKey);

  showScore();
  showRecord();
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("airHockey.title")),
      h("p", { class: "lede" }, t("airHockey.privacyNote")),
    ),
    h("div", { class: "g3d-bar ah-bar" },
      h("label", { class: "field" }, h("span", null, t("airHockey.level")), levelSel),
      restartBtn,
      shell.fullscreenButton,
      h("dl", { class: "stats-grid ah-score" }, h("dt", null, t("airHockey.you")), youEl, h("dt", null, t("airHockey.computer")), cpuEl),
    ),
    shell.root,
    statusEl,
    recordEl,
    h("p", { class: "hint" }, t("airHockey.hint")),
    creditLine("game3d.credit", "https://threejs.org", "three.js"),
  );

  mounted = {
    cleanup: () => {
      window.removeEventListener("keydown", onKey);
      shell.dispose();
      game = null;
    },
  };
}

export function unmountAirHockey(): void {
  mounted?.cleanup();
  mounted = null;
}
