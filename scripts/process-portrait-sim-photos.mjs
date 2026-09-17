#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG = "/Users/shon/.grok/sessions/%2FUsers%2Fshon%2FGithub/01a0a8f4-afff-7ba1-b81a-f57f3f5e070c/images";
const OUT = path.join(ROOT, "public/covers/portrait-sim");

const PEOPLE = {
  mira: {
    key: "green",
    stand34: "1.jpg",
    sit45: "8.jpg",
    prop: "14.jpg",
    away: "11.jpg",
  },
  ken: {
    key: "green",
    stand34: "2.jpg",
    sit45: "10.jpg",
    prop: "9.jpg",
    away: "12.jpg",
  },
  lin: {
    key: "magenta",
    stand34: "13.jpg",
    sit45: "24.jpg",
    prop: "20.jpg",
    away: "19.jpg",
  },
};

const SCENES = {
  window: { wide: "4.jpg", tele: "17.jpg" },
  shade: { wide: "7.jpg", tele: "22.jpg" },
  cafe: { wide: "6.jpg", tele: "23.jpg" },
  indoor: { wide: "5.jpg", tele: "21.jpg" },
};

function chromaAlpha(r, g, b, mode) {
  if (mode === "magenta") {
    const mag = (r + b) / 2 - g;
    if (r > 70 && mag > 18 && r > g + 12) {
      if (mag > 50) return 0;
      return Math.max(0, 255 - Math.round((mag - 18) * 6));
    }
    return 255;
  }
  const greenness = g - Math.max(r, b);
  if (g > 70 && greenness > 18) {
    if (greenness > 48 && g > 110) return 0;
    return Math.max(0, 255 - Math.round((greenness - 18) * 7));
  }
  return 255;
}

function despill(r, g, b, mode) {
  if (mode === "green" && g > r && g > b) {
    const g2 = Math.min(g, Math.round((r + b) / 2 + 8));
    return [r, g2, b];
  }
  if (mode === "magenta" && r > g + 15 && b > g) {
    const r2 = Math.min(r, Math.round((g + b) / 2 + 20));
    return [r2, g, b];
  }
  return [r, g, b];
}

function keepLargestComponent(data, width, height, channels, thresh = 40) {
  const n = width * height;
  const seen = new Uint8Array(n);
  let best = [];
  for (let start = 0; start < n; start++) {
    if (seen[start] || data[start * channels + 3] <= thresh) continue;
    const stack = [start];
    const cells = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      cells.push(i);
      const x = i % width;
      const y = (i / width) | 0;
      if (x > 0 && !seen[i - 1] && data[(i - 1) * channels + 3] > thresh) {
        seen[i - 1] = 1;
        stack.push(i - 1);
      }
      if (x + 1 < width && !seen[i + 1] && data[(i + 1) * channels + 3] > thresh) {
        seen[i + 1] = 1;
        stack.push(i + 1);
      }
      if (y > 0 && !seen[i - width] && data[(i - width) * channels + 3] > thresh) {
        seen[i - width] = 1;
        stack.push(i - width);
      }
      if (y + 1 < height && !seen[i + width] && data[(i + width) * channels + 3] > thresh) {
        seen[i + width] = 1;
        stack.push(i + width);
      }
    }
    if (cells.length > best.length) best = cells;
  }
  const keep = new Uint8Array(n);
  for (const i of best) keep[i] = 1;
  for (let i = 0; i < n; i++) {
    if (!keep[i]) {
      const p = i * channels;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
      data[p + 3] = 0;
    }
  }
}

function dropGreyFloor(data, width, height, channels) {
  const y0 = Math.floor(height * 0.55);
  for (let y = y0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 20) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const mean = (r + g + b) / 3;
      if (max - min < 24 && mean > 35 && mean < 150) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }
}

async function keyPerson(src, dest, mode) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let a = chromaAlpha(r, g, b, mode);
      const [nr, ng, nb] = despill(r, g, b, mode);
      data[i] = a === 0 ? 0 : nr;
      data[i + 1] = a === 0 ? 0 : ng;
      data[i + 2] = a === 0 ? 0 : nb;
      data[i + 3] = a;
    }
  }
  keepLargestComponent(data, width, height, channels);
  if (mode === "green") dropGreyFloor(data, width, height, channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (data[i + 3] > 40) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = Math.round(Math.min(width, height) * 0.02);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = await sharp(data, { raw: { width, height, channels } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toBuffer();

  const targetW = 900;
  const targetH = 1400;
  const scale = Math.min(targetW / cw, targetH / ch);
  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));
  const resized = await sharp(cropped).resize(nw, nh).png().toBuffer();
  const left = Math.round((targetW - nw) / 2);
  const top = targetH - nh;
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp({
    create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .webp({ quality: 72, alphaQuality: 85 })
    .toFile(dest);
}

async function keyFg(src, dest, w, h) {
  const { data, info } = await sharp(src).ensureAlpha().resize(w, h, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const a = chromaAlpha(data[i], data[i + 1], data[i + 2], "green");
    const [r, g, b] = despill(data[i], data[i + 1], data[i + 2], "green");
    data[i] = a === 0 ? 0 : r;
    data[i + 1] = a === 0 ? 0 : g;
    data[i + 2] = a === 0 ? 0 : b;
    data[i + 3] = a;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp(data, { raw: { width, height, channels } })
    .webp({ quality: 72, alphaQuality: 80 })
    .toFile(dest);
}

async function cafeTableFg(src, dest, w, h) {
  const tableH = Math.round(h * 0.38);
  const { data, info } = await sharp(src).ensureAlpha().resize(w, tableH, { fit: "cover", position: "bottom" }).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const a = chromaAlpha(data[i], data[i + 1], data[i + 2], "green");
    const [r, g, b] = despill(data[i], data[i + 1], data[i + 2], "green");
    data[i] = a === 0 ? 0 : r;
    data[i + 1] = a === 0 ? 0 : g;
    data[i + 2] = a === 0 ? 0 : b;
    data[i + 3] = a;
  }
  const table = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: table, left: 0, top: h - tableH }])
    .webp({ quality: 72, alphaQuality: 80 })
    .toFile(dest);
}

async function scenePlate(src, dest, w, h) {
  await mkdir(path.dirname(dest), { recursive: true });
  await sharp(src).resize(w, h, { fit: "cover", position: "centre" }).webp({ quality: 76 }).toFile(dest);
}

async function thumbFrom(src, dest, gravity = "centre") {
  await sharp(src).resize(160, 100, { fit: "cover", position: gravity }).webp({ quality: 70 }).toFile(dest);
}

async function main() {
  await mkdir(path.join(OUT, "people"), { recursive: true });
  await mkdir(path.join(OUT, "scenes"), { recursive: true });
  await mkdir(path.join(OUT, "thumbs"), { recursive: true });

  for (const [person, spec] of Object.entries(PEOPLE)) {
    for (const pose of ["stand34", "sit45", "prop", "away"]) {
      const dest = path.join(OUT, "people", person, `${pose}.webp`);
      await keyPerson(path.join(IMG, spec[pose]), dest, spec.key);
      console.log("cutout", person, pose);
    }
    await thumbFrom(path.join(OUT, "people", person, "stand34.webp"), path.join(OUT, "thumbs", `${person}.webp`), "top");
  }
  for (const pose of ["stand34", "sit45", "prop", "away"]) {
    await thumbFrom(path.join(OUT, "people", "mira", `${pose}.webp`), path.join(OUT, "thumbs", `pose-${pose}.webp`), "top");
  }

  for (const [scene, files] of Object.entries(SCENES)) {
    await scenePlate(path.join(IMG, files.wide), path.join(OUT, "scenes", `${scene}-wide.webp`), 3072, 2048);
    await scenePlate(path.join(IMG, files.tele), path.join(OUT, "scenes", `${scene}-tele.webp`), 2048, 1365);
    await thumbFrom(path.join(OUT, "scenes", `${scene}-wide.webp`), path.join(OUT, "thumbs", `scene-${scene}.webp`));
    console.log("scene", scene);
  }

  await cafeTableFg(path.join(IMG, "15.jpg"), path.join(OUT, "scenes", "cafe-wide-fg.webp"), 3072, 2048);
  await cafeTableFg(path.join(IMG, "15.jpg"), path.join(OUT, "scenes", "cafe-tele-fg.webp"), 2048, 1365);
  console.log("fg done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
