#!/usr/bin/env node
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/covers/portrait-sim");

const SCENES = {
  window: { sky: "#d7e7f4", wall: "#f3e4d6", floor: "#cbb39a", accent: "#8eb8d6", floorY: 0.82 },
  shade: { sky: "#c5d5c4", wall: "#9bb39a", floor: "#6f8a6e", accent: "#dfe8d8", floorY: 0.78 },
  cafe: { sky: "#ead7c4", wall: "#d9b48a", floor: "#8a5a3c", accent: "#6b3f2a", floorY: 0.8 },
  indoor: { sky: "#ece4ea", wall: "#d8c4d0", floor: "#9a7a88", accent: "#b0899a", floorY: 0.84 },
};

const PEOPLE = {
  mira: "#c45b7a",
  ken: "#4a5d73",
  lin: "#b0893a",
};

function sceneSvg(w, h, scene) {
  const c = SCENES[scene];
  const fy = c.floorY * h;
  const window = scene === "window"
    ? `<rect x="${w * 0.06}" y="${h * 0.08}" width="${w * 0.28}" height="${h * 0.55}" fill="${c.accent}" opacity="0.85"/>
       <rect x="${w * 0.08}" y="${h * 0.1}" width="${w * 0.24}" height="${h * 0.5}" fill="#f7fbff" opacity="0.55"/>`
    : scene === "cafe"
      ? `<rect x="${w * 0.62}" y="${h * 0.12}" width="${w * 0.28}" height="${h * 0.42}" fill="${c.accent}" opacity="0.35"/>`
      : scene === "shade"
        ? `<circle cx="${w * 0.18}" cy="${h * 0.22}" r="${w * 0.12}" fill="${c.accent}" opacity="0.5"/>`
        : `<rect x="${w * 0.7}" y="${h * 0.18}" width="${w * 0.12}" height="${h * 0.38}" fill="${c.accent}" opacity="0.4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${c.sky}"/>
    <rect y="${fy}" width="${w}" height="${h - fy}" fill="${c.floor}"/>
    <rect y="${fy - h * 0.18}" width="${w}" height="${h * 0.18}" fill="${c.wall}"/>
    ${window}
    <line x1="0" y1="${fy}" x2="${w}" y2="${fy}" stroke="#59364b" stroke-opacity="0.18" stroke-width="${Math.max(4, w / 400)}"/>
  </svg>`;
}

function fgSvg(w, h, scene) {
  if (scene === "window") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect x="${w * 0.02}" y="0" width="${w * 0.08}" height="${h}" fill="#f4e4ee" opacity="0.55"/>
      <rect x="${w * 0.12}" y="0" width="${w * 0.05}" height="${h}" fill="#e7c9d8" opacity="0.4"/>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <ellipse cx="${w * 0.5}" cy="${h * 0.92}" rx="${w * 0.42}" ry="${h * 0.08}" fill="#6b3f2a" opacity="0.55"/>
    <rect x="${w * 0.18}" y="${h * 0.78}" width="${w * 0.64}" height="${h * 0.08}" rx="18" fill="#8a5a3c" opacity="0.5"/>
  </svg>`;
}

function cutoutSvg(color, pose) {
  const headX = pose === "away" ? 530 : 450;
  const headY = pose === "sit45" ? 240 : 180;
  const torsoY = pose === "sit45" ? 360 : 300;
  const torsoH = pose === "sit45" ? 260 : 420;
  const armY = pose === "sit45" ? 400 : 360;
  const legs = pose === "sit45"
    ? `<rect x="300" y="600" width="90" height="280" rx="45" fill="${color}"/>
       <rect x="470" y="620" width="280" height="90" rx="45" fill="${color}"/>
       <rect x="680" y="620" width="90" height="260" rx="45" fill="${color}"/>`
    : `<rect x="330" y="700" width="90" height="520" rx="45" fill="${color}"/>
       <rect x="480" y="700" width="90" height="520" rx="45" fill="${color}"/>`;
  const arms = pose === "prop"
    ? `<rect x="160" y="${armY}" width="280" height="80" rx="40" fill="${color}"/>
       <rect x="500" y="250" width="280" height="80" rx="40" fill="${color}"/>
       <rect x="740" y="220" width="110" height="80" rx="16" fill="${color}"/>`
    : pose === "away"
      ? `<rect x="180" y="${armY}" width="250" height="80" rx="40" fill="${color}"/>
         <rect x="480" y="${armY + 40}" width="250" height="80" rx="40" fill="${color}"/>`
      : `<rect x="160" y="${armY}" width="250" height="80" rx="40" fill="${color}"/>
         <rect x="500" y="${armY}" width="250" height="80" rx="40" fill="${color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1400">
    <ellipse cx="${headX}" cy="${headY}" rx="120" ry="120" fill="${color}"/>
    <rect x="370" y="${torsoY}" width="160" height="${torsoH}" rx="80" fill="${color}"/>
    ${arms}
    ${legs}
  </svg>`;
}

function thumbSvg(fill, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100">
    <rect width="160" height="100" rx="12" fill="${fill}"/>
    <circle cx="80" cy="42" r="18" fill="#fff" opacity="0.35"/>
  </svg>`;
}

async function webp(svg, file, extra = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 68, alphaQuality: 80, ...extra }).toFile(file);
}

async function main() {
  await mkdir(path.join(OUT, "scenes"), { recursive: true });
  await mkdir(path.join(OUT, "people"), { recursive: true });
  await mkdir(path.join(OUT, "thumbs"), { recursive: true });

  for (const scene of Object.keys(SCENES)) {
    await webp(sceneSvg(3072, 2048, scene), path.join(OUT, "scenes", `${scene}-wide.webp`));
    await webp(sceneSvg(2048, 1365, scene), path.join(OUT, "scenes", `${scene}-tele.webp`));
    if (scene === "window" || scene === "cafe") {
      await webp(fgSvg(3072, 2048, scene), path.join(OUT, "scenes", `${scene}-wide-fg.webp`));
      await webp(fgSvg(2048, 1365, scene), path.join(OUT, "scenes", `${scene}-tele-fg.webp`));
    }
    await webp(thumbSvg(SCENES[scene].wall), path.join(OUT, "thumbs", `scene-${scene}.webp`));
  }

  for (const [person, color] of Object.entries(PEOPLE)) {
    await mkdir(path.join(OUT, "people", person), { recursive: true });
    await webp(thumbSvg(color), path.join(OUT, "thumbs", `${person}.webp`));
    for (const pose of ["stand34", "sit45", "prop", "away"]) {
      await webp(cutoutSvg(color, pose), path.join(OUT, "people", person, `${pose}.webp`));
    }
  }
  for (const pose of ["stand34", "sit45", "prop", "away"]) {
    await webp(thumbSvg("#f7b6cb"), path.join(OUT, "thumbs", `pose-${pose}.webp`));
  }

  await copyFile(
    path.join(ROOT, "public/covers/collage-sweet.jpg"),
    path.join(ROOT, "public/covers/portrait-sim-sweet.jpg"),
  );
  console.log("wrote silhouette plates and cover copy");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
