import type { Line, Mesh, MeshBasicMaterial, Object3D, Vector3 } from "three";
import type { Stage } from "../three-stage";
import type { Ball, TableGeom, Vec } from "../../shared/billiards-physics";
import { ballLook, spotsFor, TABLE_OF, type PlaceZone, type TableKind, type Variant } from "../../shared/billiards-tables";

/**
 * Three.js view of the billiards table. Physics (x, y) on the bed maps to three (x, −z) with y up, so the frame stays
 * right-handed and spins map as (wx, wz, −wy).
 */

export type CameraMode = "top" | "3d";

export interface AimLine {
  points: Vec[];
  color: number;
  /** Lighter, dashed: a predicted path rather than the cue line. */
  dashed?: boolean;
}

export interface TableScene {
  /** Moves the ball meshes (and turns them by their spin over dt seconds). */
  sync(balls: readonly Ball[], dt: number): void;
  cue(show: boolean, at?: Vec, angle?: number, pull?: number): void;
  aim(lines: AimLine[], ghost: Vec | null): void;
  zone(zone: PlaceZone | null): void;
  target(circle: { x: number; y: number; r: number } | null): void;
  /** Eases the camera toward the view for this frame. `snap` jumps there. */
  view(mode: CameraMode, focus: Vec, angle: number, rolling: boolean, dt: number, snap?: boolean): void;
  /** Table point (physics coordinates) under a client pixel, or null. */
  pick(clientX: number, clientY: number): Vec | null;
}

const CLOTH: Record<TableKind, number> = { pool: 0x1f6fb2, chinese: 0x2a7bc0, snooker: 0x1c7a3e, pyramid: 0x237a4a, carom: 0x2d6fb7 };
const WOOD = 0x6b3a22;

function ballTexture(THREE: Stage["THREE"], variant: Variant, id: number) {
  const look = ballLook(variant, id);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d")!;
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  x.fillStyle = look.kind === "stripe" ? "#fbf8ef" : hex(look.color);
  x.fillRect(0, 0, 256, 128);
  if (look.kind === "stripe") {
    x.fillStyle = hex(look.color);
    x.fillRect(0, 36, 256, 56);
  }
  if (look.number !== null) {
    for (const u of [64, 192]) {
      if (look.kind !== "pyramid") {
        x.fillStyle = "#fbf8ef";
        x.beginPath();
        x.ellipse(u, 64, 22, 22, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = "#111";
      x.font = `bold ${look.number > 9 ? 24 : 28}px sans-serif`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(String(look.number), u, 66);
    }
  }
  if (look.kind === "cue") {
    // Training dots, so spin and roll can be seen.
    x.fillStyle = variant === "pyramid" ? "#7a1f1f" : "#d9241c";
    for (const [u, v] of [[0, 64], [64, 64], [128, 64], [192, 64], [32, 8], [160, 120]]) {
      x.beginPath();
      x.ellipse(u!, v!, 7, 7, 0, 0, Math.PI * 2);
      x.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Cloth with the markings of the game (baulk line and D, spots, head string). */
function clothTexture(THREE: Stage["THREE"], variant: Variant, g: TableGeom, margin: number) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * (g.width + 2 * margin)) / (g.length + 2 * margin));
  const x = c.getContext("2d")!;
  const base = CLOTH[TABLE_OF[variant]];
  x.fillStyle = `#${base.toString(16).padStart(6, "0")}`;
  x.fillRect(0, 0, c.width, c.height);
  // Faint nap noise.
  for (let i = 0; i < 2400; i++) {
    x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)";
    x.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  const sx = c.width / (g.length + 2 * margin);
  const px = (v: Vec) => ({ x: (v.x + g.length / 2 + margin) * sx, y: (g.width / 2 + margin - v.y) * sx });
  const s = spotsFor(variant);
  x.strokeStyle = "rgba(255,255,255,0.55)";
  x.fillStyle = "rgba(255,255,255,0.7)";
  x.lineWidth = 2;
  const dot = (v: Vec) => {
    const p = px(v);
    x.beginPath();
    x.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    x.fill();
  };
  const kind = TABLE_OF[variant];
  if (kind === "snooker") {
    const a = px({ x: s.baulkX, y: g.width / 2 });
    const b = px({ x: s.baulkX, y: -g.width / 2 });
    x.beginPath();
    x.moveTo(a.x, a.y);
    x.lineTo(b.x, b.y);
    x.stroke();
    const o = px({ x: s.baulkX, y: 0 });
    x.beginPath();
    x.arc(o.x, o.y, s.dRadius * sx, Math.PI / 2, (Math.PI * 3) / 2);
    x.stroke();
    for (let v = 2; v <= 7; v++) dot(s.colourSpots[v]!);
  } else {
    dot({ x: s.footX, y: 0 });
    dot({ x: s.headX, y: 0 });
    if (kind !== "carom") {
      const a = px({ x: s.headX, y: g.width / 2 });
      const b = px({ x: s.headX, y: -g.width / 2 });
      x.strokeStyle = "rgba(255,255,255,0.18)";
      x.beginPath();
      x.moveTo(a.x, a.y);
      x.lineTo(b.x, b.y);
      x.stroke();
    } else {
      dot({ x: 0, y: 0 });
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildScene(stage: Stage, variant: Variant, g: TableGeom, ids: readonly number[]): TableScene {
  const { THREE, scene, camera } = stage;
  const R = g.R;
  const L = g.length / 2;
  const W = g.width / 2;
  const P = (v: Vec, h = R) => new THREE.Vector3(v.x, h, -v.y);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b4a3a, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(0.6, 4, 0.8);
  scene.add(sun);
  // Two lamps over the table for highlights on the balls.
  for (const lx of [-L / 2, L / 2]) {
    const lamp = new THREE.PointLight(0xfff4e0, 6, 6, 1.6);
    lamp.position.set(lx, 1.6, 0);
    scene.add(lamp);
  }

  const table = new THREE.Group();
  scene.add(table);
  const cushion = 0.05;
  const margin = cushion + 0.01;
  const cloth = new THREE.MeshLambertMaterial({ map: clothTexture(THREE, variant, g, margin) });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(g.length + 2 * margin, g.width + 2 * margin), cloth);
  bed.rotation.x = -Math.PI / 2;
  table.add(bed);

  const clothColor = new THREE.Color(CLOTH[TABLE_OF[variant]]).multiplyScalar(0.82);
  const cushionMat = new THREE.MeshLambertMaterial({ color: clothColor });
  const woodMat = new THREE.MeshPhongMaterial({ color: WOOD, shininess: 60, specular: 0x332211 });
  const railH = R * 1.35;
  for (const r of g.rails) {
    const len = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, railH, cushion), cushionMat);
    const mid = { x: (r.a.x + r.b.x) / 2 - (r.n.x * cushion) / 2, y: (r.a.y + r.b.y) / 2 - (r.n.y * cushion) / 2 };
    m.position.copy(P(mid, railH / 2));
    m.rotation.y = Math.atan2(r.b.y - r.a.y, r.b.x - r.a.x);
    table.add(m);
  }
  // Wooden frame around the cushions.
  const frame = 0.11;
  const frameH = railH + 0.012;
  const outerL = g.length + 2 * (cushion + frame);
  const outerW = g.width + 2 * (cushion + frame);
  for (const sy of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(outerL, frameH, frame), woodMat);
    m.position.set(0, frameH / 2, -sy * (W + cushion + frame / 2));
    table.add(m);
  }
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(frame, frameH, g.width + 2 * cushion), woodMat);
    m.position.set(sx * (L + cushion + frame / 2), frameH / 2, 0);
    table.add(m);
  }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(outerL, 0.18, outerW), woodMat);
  // Top face just under the cloth (level with it the two z-fight).
  skirt.position.y = -0.093;
  table.add(skirt);
  // Pockets: black holes cut through cushion and wood.
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
  for (const p of g.pockets) {
    const r = p.r * 1.12;
    for (const hgt of [0.0015, frameH + 0.001]) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 28), holeMat);
      hole.rotation.x = -Math.PI / 2;
      hole.position.copy(P(p, hgt));
      table.add(hole);
    }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(r, r, frameH, 28, 1, true), holeMat);
    cup.position.copy(P(p, frameH / 2));
    table.add(cup);
  }
  // Diamonds on the rails (pool and carom tables).
  if (TABLE_OF[variant] !== "snooker") {
    const dMat = new THREE.MeshBasicMaterial({ color: 0xf6efe0 });
    const dGeo = new THREE.CircleGeometry(0.008, 12);
    const at = (x: number, y: number) => {
      const d = new THREE.Mesh(dGeo, dMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, frameH + 0.002, -y);
      table.add(d);
    };
    // The middle diamond sits where a pocket table has its middle pocket; carom tables keep it.
    for (let i = 1; i < 8; i++) if (i !== 4 || !g.pockets.length) for (const sy of [-1, 1]) at(-L + (i * g.length) / 8, sy * (W + cushion + frame / 2));
    for (let i = 1; i < 4; i++) for (const sx of [-1, 1]) at(sx * (L + cushion + frame / 2), -W + (i * g.width) / 4);
  }

  // Balls with blob shadows.
  const ballGeo = new THREE.SphereGeometry(R, 32, 20);
  const shadowGeo = new THREE.CircleGeometry(R * 1.05, 20);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const meshes = new Map<number, { ball: Mesh; shadow: Mesh; drop: number }>();
  for (const id of ids) {
    const ball = new THREE.Mesh(ballGeo, new THREE.MeshPhongMaterial({ map: ballTexture(THREE, variant, id), shininess: 110, specular: 0x8a8a8a }));
    // Random starting orientation, so the numbers do not all face up.
    ball.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    scene.add(ball, shadow);
    meshes.set(id, { ball, shadow, drop: 0 });
  }

  // Cue stick: a tapered maple shaft with a dark butt, along +x of its group; the tip at the group's origin.
  const cueGroup = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.011, 0.85, 16), new THREE.MeshPhongMaterial({ color: 0xe8c98f, shininess: 40 }));
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = -0.425 - 0.01;
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.015, 0.6, 16), new THREE.MeshPhongMaterial({ color: 0x3a1d12, shininess: 60 }));
  butt.rotation.z = Math.PI / 2;
  butt.position.x = -0.85 - 0.3 - 0.01;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0065, 0.012, 12), new THREE.MeshPhongMaterial({ color: 0x3b6fd8 }));
  tip.rotation.z = Math.PI / 2;
  tip.position.x = -0.006;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.02, 12), new THREE.MeshPhongMaterial({ color: 0xfbf8ef }));
  ferrule.rotation.z = Math.PI / 2;
  ferrule.position.x = -0.022;
  cueGroup.add(shaft, butt, tip, ferrule);
  scene.add(cueGroup);

  // Aim lines and the ghost ball.
  const lines: Line[] = [];
  const ghost = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
  ghost.rotation.x = -Math.PI / 2;
  ghost.visible = false;
  scene.add(ghost);
  const clearLines = () => {
    for (const l of lines) {
      scene.remove(l);
      l.geometry.dispose();
      (l.material as MeshBasicMaterial).dispose();
    }
    lines.length = 0;
  };

  // Ball-in-hand area and drill circle.
  const zoneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false });
  let zoneMesh: Object3D | null = null;
  // Keeps zoneMat in the scene graph, so the rebuild's disposeScene frees it even with no zone showing.
  const zoneHolder = new THREE.Mesh(new THREE.BufferGeometry(), zoneMat);
  zoneHolder.visible = false;
  scene.add(zoneHolder);
  let zoneNow: PlaceZone | null = null;
  const targetMesh = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff8fb8, transparent: true, opacity: 0.9, depthWrite: false }));
  targetMesh.rotation.x = -Math.PI / 2;
  targetMesh.visible = false;
  const targetFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff8fb8, transparent: true, opacity: 0.18, depthWrite: false }));
  targetMesh.add(targetFill);
  scene.add(targetMesh);

  const camPos = new THREE.Vector3(0, 3, 0.01);
  const camLook = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const tmpUp = new THREE.Vector3(0, 0, -1);
  const up = new THREE.Vector3(0, 0, -1);
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
  const hit = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const axis = new THREE.Vector3();

  return {
    sync(balls, dt) {
      for (const b of balls) {
        const m = meshes.get(b.id);
        if (!m) continue;
        if (!b.on) {
          // Potted: sink out of sight over a moment.
          if (m.ball.visible) {
            m.drop += dt;
            m.ball.position.y = R - m.drop * 0.6;
            m.shadow.visible = false;
            if (m.drop > 0.12 || dt === 0) m.ball.visible = false;
          }
          continue;
        }
        m.drop = 0;
        m.ball.visible = true;
        m.shadow.visible = true;
        m.ball.position.set(b.x, R, -b.y);
        m.shadow.position.set(b.x + R * 0.25, 0.0008, -b.y + R * 0.2);
        const w = Math.hypot(b.wx, b.wy, b.wz);
        if (w > 1e-6 && dt > 0) {
          axis.set(b.wx / w, b.wz / w, -b.wy / w);
          quat.setFromAxisAngle(axis, w * dt);
          m.ball.quaternion.premultiply(quat);
        }
      }
    },
    cue(show, at, angle = 0, pull = 0) {
      cueGroup.visible = show;
      if (!show || !at) return;
      const back = R + 0.012 + pull;
      cueGroup.position.set(at.x - Math.cos(angle) * back, R + 0.004, -(at.y - Math.sin(angle) * back));
      cueGroup.rotation.set(0, angle, 0, "YXZ");
      // Butt slightly raised, as over a rail.
      cueGroup.rotateZ(-0.07);
    },
    aim(list, g0) {
      clearLines();
      for (const a of list) {
        if (a.points.length < 2) continue;
        const geo = new THREE.BufferGeometry().setFromPoints(a.points.map((p) => P(p, R * 0.15)));
        const mat = a.dashed
          ? new THREE.LineDashedMaterial({ color: a.color, dashSize: 0.025, gapSize: 0.018, transparent: true, opacity: 0.85 })
          : new THREE.LineBasicMaterial({ color: a.color, transparent: true, opacity: 0.9 });
        const line = new THREE.Line(geo, mat);
        if (a.dashed) line.computeLineDistances();
        scene.add(line);
        lines.push(line);
      }
      ghost.visible = Boolean(g0);
      if (g0) ghost.position.copy(P(g0, R * 0.2));
    },
    zone(zone) {
      if (zone === zoneNow) return;
      zoneNow = zone;
      if (zoneMesh) {
        scene.remove(zoneMesh);
        (zoneMesh as Mesh).geometry.dispose();
        zoneMesh = null;
      }
      if (!zone || zone === "anywhere") return;
      const s = spotsFor(variant);
      let geo;
      if (zone === "kitchen") {
        const w = s.headX + L;
        geo = new THREE.PlaneGeometry(w, g.width);
        const m = new THREE.Mesh(geo, zoneMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(-L + w / 2, 0.001, 0);
        zoneMesh = m;
      } else {
        geo = new THREE.CircleGeometry(s.dRadius, 40, Math.PI / 2, Math.PI);
        const m = new THREE.Mesh(geo, zoneMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(s.baulkX, 0.001, 0);
        zoneMesh = m;
      }
      scene.add(zoneMesh);
    },
    target(circle) {
      targetMesh.visible = Boolean(circle);
      if (!circle) return;
      targetMesh.position.copy(P(circle, 0.0012));
      targetMesh.scale.setScalar(circle.r);
    },
    view(mode, focus, angle, rolling, dt, snap) {
      const { width, height } = stage.size();
      const portrait = height > width;
      if (mode === "top") {
        // Fit the whole table (with its frame) in view; on a portrait screen the table runs up the screen.
        const vfov = (camera.fov * Math.PI) / 180;
        const aspect = width / height;
        const along = outerL * 1.04;
        const across = outerW * 1.04;
        const [sw, sh] = portrait ? [across, along] : [along, across];
        const hgt = Math.max(sh / 2 / Math.tan(vfov / 2), sw / 2 / (Math.tan(vfov / 2) * aspect));
        tmpPos.set(0, hgt, 0.0001);
        tmpLook.set(0, 0, 0);
        tmpUp.set(portrait ? -1 : 0, 0, portrait ? 0 : -1);
      } else {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const dist = rolling ? 1.7 : portrait ? 1.55 : 1.3;
        const hgt = rolling ? 1.35 : portrait ? 0.8 : 0.62;
        const ahead = rolling ? 0.9 : 0.55;
        tmpPos.set(focus.x - dx * dist, hgt, -(focus.y - dy * dist));
        tmpLook.set(focus.x + dx * ahead, 0, -(focus.y + dy * ahead));
        tmpUp.set(0, 1, 0);
      }
      const k = snap ? 1 : Math.min(1, dt * (rolling ? 2.2 : 7));
      camPos.lerp(tmpPos, k);
      camLook.lerp(tmpLook, k);
      up.lerp(tmpUp, k).normalize();
      camera.position.copy(camPos);
      camera.up.copy(up);
      camera.lookAt(camLook);
    },
    pick(clientX, clientY) {
      const rect = stage.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const ndc = { x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -((clientY - rect.top) / rect.height) * 2 + 1 };
      raycaster.setFromCamera(ndc as unknown as import("three").Vector2, camera);
      const p: Vector3 | null = raycaster.ray.intersectPlane(plane, hit);
      return p ? { x: p.x, y: -p.z } : null;
    },
  };
}

