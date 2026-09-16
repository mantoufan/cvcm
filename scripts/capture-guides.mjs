#!/usr/bin/env node
/**
 * Test each cv.cm tool in the existing Chrome (bb-browser CDP)
 * and save step screenshots for the on-page illustrated guides.
 */
import { Buffer } from "node:buffer";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CDP = "http://127.0.0.1:19825";
const BASE = (process.env.GUIDE_BASE || "https://cv.cm/en").replace(/\/$/, "");
const OUT = path.join(ROOT, "public/covers/guides");
const FIX = path.join(ROOT, "scripts/fixtures");
const PROGRESS = path.join(ROOT, "docs/tool-guide-progress.json");

const STEPS = {
  clip: 3,
  qr: 3,
  barcode: 3,
  watermark: 4,
  collage: 4,
  resize: 3,
  crop: 3,
  rotate: 3,
  exif: 3,
  meme: 4,
  signature: 3,
  favicon: 3,
  convert: 3,
  "image-pdf": 3,
  "pdf-jpg": 3,
  "merge-pdf": 3,
  "compress-pdf": 3,
  "split-pdf": 3,
  invoice: 4,
  audio: 3,
  "audio-cutter": 3,
  "audio-joiner": 3,
  data: 3,
  "xml-json": 3,
  "yaml-json": 3,
  password: 3,
  "word-count": 3,
  color: 3,
  "hex-rgb": 3,
  names: 3,
  timezone: 3,
  timestamp: 3,
  lorem: 3,
  units: 3,
  "text-to-speech": 3,
  diff: 3,
  uuid: 3,
  hash: 3,
  regex: 4,
  case: 3,
  jwt: 3,
  screenshot: 3,
  percent: 3,
  random: 3,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpConnect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("cdp ws error")), { once: true });
  });
  let n = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++n;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ws, send };
}

async function evalValue(send, expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    const text = res.exceptionDetails.text || res.exceptionDetails.exception?.description || "eval error";
    throw new Error(text);
  }
  return res.result?.value;
}

async function waitFor(send, expression, timeout = 20000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await evalValue(send, expression);
    if (last) return last;
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${expression} (last=${last})`);
}

function wavBytes(seconds, freq) {
  const rate = 44100;
  const n = Math.floor(rate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / rate) * 0.22;
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function makePdf(file, title) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 594]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 0, width: 420, height: 594, color: rgb(1, 0.95, 0.97) });
  page.drawText(title, { x: 48, y: 520, size: 22, font, color: rgb(0.78, 0.25, 0.48) });
  page.drawText("cv.cm guide fixture", { x: 48, y: 488, size: 12, font, color: rgb(0.35, 0.22, 0.3) });
  const bytes = await doc.save();
  await writeFile(file, bytes);
}

async function prepareFixtures() {
  await mkdir(FIX, { recursive: true });
  const photo = path.join(FIX, "photo.jpg");
  const photo2 = path.join(FIX, "photo2.jpg");
  await copyFile(path.join(ROOT, "public/covers/qr-sweet.jpg"), photo);
  await copyFile(path.join(ROOT, "public/covers/clip-sweet.jpg"), photo2);
  await writeFile(path.join(FIX, "beep.wav"), wavBytes(1.4, 440));
  await writeFile(path.join(FIX, "beep2.wav"), wavBytes(1.1, 660));
  await makePdf(path.join(FIX, "sample.pdf"), "Page one");
  await makePdf(path.join(FIX, "sample2.pdf"), "Page two");
  return {
    photo,
    photo2,
    wav: path.join(FIX, "beep.wav"),
    wav2: path.join(FIX, "beep2.wav"),
    pdf: path.join(FIX, "sample.pdf"),
    pdf2: path.join(FIX, "sample2.pdf"),
  };
}

async function setFiles(send, selector, files) {
  const doc = await send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector,
  });
  if (!nodeId) throw new Error(`file input missing: ${selector}`);
  await send("DOM.setFileInputFiles", { nodeId, files });
}

async function shot(send, tool, step) {
  await evalValue(send, `(() => {
    document.querySelector(".faq")?.setAttribute("hidden", "");
    document.querySelector(".tool-guide")?.setAttribute("hidden", "");
    const foot = document.querySelector(".foot");
    if (foot) foot.style.display = "none";
    window.scrollTo(0, 0);
    return true;
  })()`);
  await sleep(280);
  const box = await evalValue(send, `(() => {
    const el = document.querySelector("main");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const width = Math.max(320, Math.min(r.width, 1180));
    const height = Math.max(240, Math.min(r.height, 1180));
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width, height };
  })()`);
  if (!box) throw new Error("main missing for screenshot");
  const { data } = await send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 82,
    clip: { ...box, scale: 1 },
  });
  const dir = path.join(OUT, tool);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${String(step).padStart(2, "0")}.jpg`);
  await writeFile(file, Buffer.from(data, "base64"));
  return file;
}

function fillExpr(selector, value) {
  const js = JSON.stringify(value);
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error("missing " + ${JSON.stringify(selector)});
    el.focus();
    el.value = ${js};
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value;
  })()`;
}

async function clickSel(send, selector) {
  const ok = await evalValue(send, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`click missed ${selector}`);
}

async function clickText(send, text) {
  const ok = await evalValue(send, `(() => {
    const want = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll("button, .chip, .btn, label")];
    const el = nodes.find((n) => (n.textContent || "").trim() === want);
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`click text missed ${text}`);
}

async function goto(send, url) {
  const nav = send("Page.navigate", { url });
  await Promise.race([
    send("Page.loadEventFired").catch(() => null),
    sleep(8000),
  ]);
  await nav;
  await waitFor(
    send,
    `!!document.querySelector("h1") && (document.querySelector("h1").textContent||"").length > 2`,
  );
  const path = await evalValue(send, `location.pathname`);
  if (typeof path !== "string" || !path.includes(`/${url.split("/").filter(Boolean).at(-1)}/`)) {
    throw new Error(`landed on ${path}, expected ${url}`);
  }
  await sleep(350);
}

async function drawSignature(send) {
  const box = await evalValue(send, `(() => {
    const c = document.querySelector("canvas.signature-pad, .signature-stage canvas, canvas");
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  if (!box) throw new Error("signature canvas missing");
  const points = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = box.x + box.w * (0.12 + 0.7 * t);
    const y = box.y + box.h * (0.55 + 0.18 * Math.sin(t * Math.PI * 2) - 0.12 * t);
    points.push({ x, y });
  }
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: points[0].x,
    y: points[0].y,
    button: "left",
    clickCount: 1,
  });
  for (const p of points.slice(1)) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: p.x,
      y: p.y,
      button: "left",
    });
  }
  const last = points[points.length - 1];
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: last.x,
    y: last.y,
    button: "left",
    clickCount: 1,
  });
}

async function runTool(send, id, fx) {
  const url = `${BASE}/${id}/`;
  await goto(send, url);
  const title = await evalValue(send, `document.querySelector("h1")?.textContent || ""`);
  if (!title) throw new Error("no h1");

  const snap = (n) => shot(send, id, n);

  if (id === "clip") {
    await snap(1);
    await evalValue(send, fillExpr("textarea", "cv.cm guide test — expires automatically."));
    await snap(2);
    await clickSel(send, ".stage-actions .btn");
    await waitFor(
      send,
      `!!document.querySelector(".clip-result a, .clip-result input, .clip-result") && (document.querySelector(".clip-result")?.textContent||"").length > 8`,
      25000,
    );
    await snap(3);
    return;
  }

  if (id === "qr") {
    await snap(1);
    await evalValue(send, fillExpr("textarea", "https://cv.cm/en/qr/"));
    await sleep(250);
    await snap(2);
    await waitFor(send, `!!document.querySelector("canvas")`);
    await snap(3);
    return;
  }

  if (id === "barcode") {
    await snap(1);
    await evalValue(send, fillExpr("textarea", "CVCM-TEST"));
    await sleep(250);
    await snap(2);
    await waitFor(send, `!!document.querySelector("canvas")`);
    await snap(3);
    return;
  }

  if (id === "watermark") {
    await snap(1);
    await setFiles(send, "#file-input", [fx.photo]);
    await waitFor(send, `!!document.querySelector("canvas, .file-list li")`);
    await sleep(500);
    await snap(2);
    await evalValue(send, fillExpr("#wm-text", "cv.cm"));
    await sleep(400);
    await snap(3);
    await snap(4);
    return;
  }

  if (id === "collage") {
    await snap(1);
    await setFiles(send, "#collage-file-input", [fx.photo, fx.photo2]);
    await waitFor(send, `(document.querySelectorAll(".file-list li").length >= 2) || !!document.querySelector("canvas")`);
    await sleep(600);
    await snap(2);
    await evalValue(send, `(() => {
      const btn = [...document.querySelectorAll("button, .chip, .layout-btn")].find((n) => /2/.test(n.textContent||"") || n.getAttribute("data-layout"));
      if (btn) btn.click();
      return true;
    })()`);
    await sleep(400);
    await snap(3);
    await snap(4);
    return;
  }

  const imageTools = {
    resize: "#resize-file-input",
    crop: "#crop-file-input",
    rotate: "#rotate-file-input",
    exif: "#exif-file-input",
    favicon: "#favicon-file-input",
    screenshot: "#screenshot-file-input",
    convert: "#convert-file-input",
    "image-pdf": "#pdf-file-input",
  };
  if (imageTools[id]) {
    await snap(1);
    await setFiles(send, imageTools[id], [fx.photo]);
    await waitFor(send, `!!document.querySelector("canvas, .file-list li")`);
    await sleep(500);
    await snap(2);
    if (id === "rotate") {
      await clickText(send, "180°").catch(() =>
        evalValue(send, `document.querySelector(".chips button:nth-child(2)")?.click() || true`),
      );
      await sleep(350);
    }
    if (id === "crop") {
      await evalValue(send, `(() => {
        const btn = [...document.querySelectorAll("button, .chip")].find((n) => /1\\s*:\\s*1|1:1/.test(n.textContent||""));
        if (btn) btn.click();
        return true;
      })()`);
      await sleep(300);
    }
    if (id === "screenshot") {
      const box = await evalValue(send, `(() => {
        const c = document.querySelector("canvas.preview, canvas");
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })()`);
      if (!box) throw new Error("screenshot canvas missing");
      const x1 = box.x + box.w * 0.18;
      const y1 = box.y + box.h * 0.2;
      const x2 = box.x + box.w * 0.72;
      const y2 = box.y + box.h * 0.58;
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x1, y: y1, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x2, y: y2, button: "left" });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button: "left", clickCount: 1 });
      await sleep(250);
    }
    await snap(3);
    return;
  }

  if (id === "meme") {
    await snap(1);
    await setFiles(send, "#meme-file-input", [fx.photo]);
    await waitFor(send, `!!document.querySelector("canvas")`);
    await sleep(400);
    await snap(2);
    await evalValue(send, `(() => {
      const areas = [...document.querySelectorAll("textarea")];
      if (areas[0]) { areas[0].value = "WHEN THE FILE STAYS IN THIS TAB"; areas[0].dispatchEvent(new Event("input", { bubbles: true })); }
      if (areas[1]) { areas[1].value = "AND NOTHING IS UPLOADED"; areas[1].dispatchEvent(new Event("input", { bubbles: true })); }
      return areas.length;
    })()`);
    await sleep(350);
    await snap(3);
    await snap(4);
    return;
  }

  if (id === "signature") {
    await snap(1);
    await drawSignature(send);
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  const pdfTools = {
    "pdf-jpg": "#pdf-jpg-file-input",
    "merge-pdf": "#merge-pdf-file-input",
    "compress-pdf": "#compress-pdf-file-input",
    "split-pdf": "#split-pdf-file-input",
  };
  if (pdfTools[id]) {
    await snap(1);
    const files = id === "merge-pdf" ? [fx.pdf, fx.pdf2] : [fx.pdf];
    await setFiles(send, pdfTools[id], files);
    await waitFor(
      send,
      `!!document.querySelector("canvas, .file-list li") || /page|pdf|ready|split/i.test(document.body.innerText)`,
      25000,
    );
    await sleep(800);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "invoice") {
    await snap(1);
    await evalValue(send, `(() => {
      const set = (label, value) => {
        const span = [...document.querySelectorAll("label span, .field > span")].find((s) => (s.textContent || "").includes(label));
        const input = span?.parentElement?.querySelector("input, textarea");
        if (!input) return false;
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      };
      set("From name", "cv.cm");
      set("From address", "On-device tools");
      set("Client name", "Test customer");
      set("Client address", "Local tab");
      set("Number", "INV-1001");
      const line = document.querySelector(".invoice-line input[type=text]");
      if (line) { line.value = "Guide screenshot pack"; line.dispatchEvent(new Event("input", { bubbles: true })); }
      const nums = [...document.querySelectorAll(".invoice-line input")].slice(1);
      if (nums[0]) { nums[0].value = "2"; nums[0].dispatchEvent(new Event("input", { bubbles: true })); }
      if (nums[1]) { nums[1].value = "40"; nums[1].dispatchEvent(new Event("input", { bubbles: true })); }
      return true;
    })()`);
    await sleep(400);
    await snap(2);
    await waitFor(send, `!!document.querySelector("canvas")`);
    await snap(3);
    await snap(4);
    return;
  }

  const audioTools = {
    audio: "#audio-file-input",
    "audio-cutter": "#audio-cutter-file-input",
    "audio-joiner": "#audio-joiner-file-input",
  };
  if (audioTools[id]) {
    await snap(1);
    const files = id === "audio-joiner" ? [fx.wav, fx.wav2] : [fx.wav];
    await setFiles(send, audioTools[id], files);
    await waitFor(
      send,
      `!!document.querySelector("audio, canvas, .file-list li") || /wav|ready|duration/i.test(document.body.innerText)`,
      20000,
    );
    await sleep(700);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "data") {
    await snap(1);
    await evalValue(send, fillExpr("textarea.clip-input, textarea", '{"tool":"cv.cm","ok":true}'));
    await sleep(300);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "xml-json") {
    await snap(1);
    await sleep(200);
    await snap(2);
    await evalValue(send, `(() => {
      const sel = document.querySelector("select");
      if (!sel) return false;
      sel.value = "json-xml";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await sleep(250);
    await snap(3);
    return;
  }

  if (id === "password") {
    await snap(1);
    await evalValue(send, `(() => {
      const range = document.querySelector("input[type=range]");
      if (!range) return false;
      range.value = "24";
      range.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    await snap(2);
    await clickText(send, "Generate").catch(() => clickSel(send, ".stage-actions .btn"));
    await sleep(200);
    await snap(3);
    return;
  }

  if (id === "word-count") {
    await snap(1);
    await evalValue(send, fillExpr("textarea", "cv.cm counts words, characters, and reading time in this tab. 中文字也算。"));
    await sleep(250);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "color") {
    await snap(1);
    await evalValue(send, `(() => {
      const hex = document.querySelector("input[type=text], .field input");
      if (!hex) return false;
      hex.value = "#c83f79";
      hex.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "hex-rgb") {
    await snap(1);
    await evalValue(send, fillExpr("input.regex-pattern, input[type=text]", "#3a2030"));
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "names") {
    await snap(1);
    await evalValue(send, `(() => {
      const sel = document.querySelector("select");
      if (!sel) return false;
      sel.value = "username";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "timezone") {
    await snap(1);
    await evalValue(send, `(() => {
      const sels = [...document.querySelectorAll("select")];
      if (sels[0]) { sels[0].value = "America/New_York"; sels[0].dispatchEvent(new Event("change", { bubbles: true })); }
      if (sels[1]) { sels[1].value = "Asia/Shanghai"; sels[1].dispatchEvent(new Event("change", { bubbles: true })); }
      const when = document.querySelector("input[type=datetime-local]");
      if (when) { when.value = "2026-09-16T09:00:00"; when.dispatchEvent(new Event("input", { bubbles: true })); }
      return true;
    })()`);
    await sleep(250);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "timestamp") {
    await snap(1);
    await evalValue(send, fillExpr("input.regex-pattern, input[type=text]", "1700000000"));
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "lorem") {
    await snap(1);
    await evalValue(send, `(() => {
      const sel = document.querySelector("select");
      if (sel) { sel.value = "sentences"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      return true;
    })()`);
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "units") {
    await snap(1);
    await evalValue(send, `(() => {
      const val = document.querySelector("input[type=text], input[inputmode=decimal]");
      if (!val) return false;
      val.value = "12";
      val.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "text-to-speech") {
    await snap(1);
    await evalValue(send, fillExpr("textarea", "This text stays in the browser. cv.cm does not upload it."));
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "diff") {
    await snap(1);
    await evalValue(send, `(() => {
      const areas = [...document.querySelectorAll("textarea")];
      if (areas[0]) { areas[0].value = "alpha\\nbeta\\nkeep"; areas[0].dispatchEvent(new Event("input", { bubbles: true })); }
      if (areas[1]) { areas[1].value = "alpha\\ngamma\\nkeep"; areas[1].dispatchEvent(new Event("input", { bubbles: true })); }
      return areas.length;
    })()`);
    await sleep(300);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "uuid") {
    await snap(1);
    await evalValue(send, `(() => {
      const range = document.querySelector("input[type=range]");
      if (!range) return false;
      range.value = "8";
      range.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "hash") {
    await snap(1);
    await evalValue(send, fillExpr("textarea", "cv.cm"));
    await sleep(250);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "regex") {
    await snap(1);
    await evalValue(send, `(() => {
      const pattern = document.querySelector("input.regex-pattern, input[aria-label]");
      if (pattern) { pattern.value = "\\\\d+"; pattern.dispatchEvent(new Event("input", { bubbles: true })); }
      return true;
    })()`);
    await sleep(150);
    await snap(2);
    await evalValue(send, `(() => {
      const text = document.querySelector("textarea");
      if (text) { text.value = "order 42 and 7"; text.dispatchEvent(new Event("input", { bubbles: true })); }
      return true;
    })()`);
    await sleep(250);
    await snap(3);
    await evalValue(send, `(() => {
      const inputs = [...document.querySelectorAll("input.regex-pattern")];
      const replace = inputs[1];
      if (replace) { replace.value = "#$&"; replace.dispatchEvent(new Event("input", { bubbles: true })); }
      return true;
    })()`);
    await sleep(200);
    await snap(4);
    return;
  }

  if (id === "yaml-json") {
    await snap(1);
    await evalValue(send, fillExpr(".data-tool textarea, textarea.clip-input", "note:\n  to: cv.cm\n  n: 2\n  tags:\n    - yaml\n    - json\n"));
    await sleep(250);
    await snap(2);
    await evalValue(send, `(() => {
      const input = document.querySelector(".data-tool textarea") || document.querySelector("textarea.clip-input");
      if (input) {
        input.value = '{"tool":"cv.cm","ok":true}';
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const sel = document.querySelector(".controls select");
      if (!sel) throw new Error("yaml-json direction missing");
      sel.value = "json-yaml";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return sel.value;
    })()`);
    await sleep(250);
    await snap(3);
    return;
  }

  if (id === "case") {
    await snap(1);
    await evalValue(send, `(() => {
      const sel = document.querySelector(".controls select");
      if (!sel) throw new Error("case select missing");
      sel.value = "camel";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return sel.value;
    })()`);
    await sleep(200);
    await snap(2);
    await evalValue(send, fillExpr(".data-tool textarea, textarea.clip-input", "Convert This Title To Snake"));
    await evalValue(send, `(() => {
      const sel = document.querySelector(".controls select");
      if (!sel) throw new Error("case select missing");
      sel.value = "snake";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return sel.value;
    })()`);
    await sleep(200);
    await snap(3);
    return;
  }

  if (id === "jwt") {
    await evalValue(send, `(() => {
      const el = document.querySelector(".data-tool textarea") || document.querySelector("textarea.clip-input");
      if (el) { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); }
      return true;
    })()`);
    await sleep(150);
    await snap(1);
    const token = await evalValue(send, `(() => {
      const b64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/,"").replace(/\\+/g,"-").replace(/\\//g,"_");
      return b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: "cv.cm", name: "guide", iat: 1700000000, exp: 1893456000 }) + ".sig";
    })()`);
    await evalValue(send, fillExpr(".data-tool textarea, textarea.clip-input", token));
    await sleep(250);
    await snap(2);
    await clickSel(send, ".stage-actions .btn");
    await sleep(200);
    await snap(3);
    return;
  }

  if (id === "percent") {
    await snap(1);
    await evalValue(send, `(() => {
      const nums = [...document.querySelectorAll("input[type=number]")];
      if (nums[0]) { nums[0].value = "18"; nums[0].dispatchEvent(new Event("input", { bubbles: true })); }
      if (nums[1]) { nums[1].value = "90"; nums[1].dispatchEvent(new Event("input", { bubbles: true })); }
      return nums.length;
    })()`);
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  if (id === "random") {
    await snap(1);
    await evalValue(send, `(() => {
      const nums = [...document.querySelectorAll("input[type=number]")];
      if (nums[0]) nums[0].value = "1";
      if (nums[1]) nums[1].value = "6";
      if (nums[2]) nums[2].value = "8";
      nums.forEach((n) => n.dispatchEvent(new Event("input", { bubbles: true })));
      return true;
    })()`);
    await clickText(send, "Roll").catch(() => clickSel(send, ".stage-actions .btn"));
    await sleep(200);
    await snap(2);
    await snap(3);
    return;
  }

  throw new Error(`no scenario for ${id}`);
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const fx = await prepareFixtures();
  const created = await fetch(`${CDP}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((r) => r.json());
  const wsUrl = created.webSocketDebuggerUrl;
  const targetId = created.id;
  const { ws, send } = await cdpConnect(wsUrl);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1180,
    height: 920,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const tools = only.length ? only : Object.keys(STEPS);
  const results = existsSync(PROGRESS)
    ? JSON.parse(await (await import("node:fs/promises")).readFile(PROGRESS, "utf8"))
    : { tools: {} };

  for (const id of tools) {
    const started = Date.now();
    process.stdout.write(`\n== ${id} ==\n`);
    try {
      await runTool(send, id, fx);
      const dir = path.join(OUT, id);
      const shots = [];
      for (let i = 1; i <= STEPS[id]; i++) {
        const f = path.join(dir, `${String(i).padStart(2, "0")}.jpg`);
        if (!existsSync(f)) throw new Error(`missing screenshot ${f}`);
        shots.push(`covers/guides/${id}/${String(i).padStart(2, "0")}.jpg`);
      }
      results.tools[id] = {
        status: "pass",
        steps: STEPS[id],
        shots,
        ms: Date.now() - started,
        error: null,
      };
      console.log(`PASS ${id} ${STEPS[id]} shots ${Date.now() - started}ms`);
    } catch (err) {
      results.tools[id] = {
        status: "fail",
        steps: STEPS[id],
        shots: [],
        ms: Date.now() - started,
        error: String(err?.message || err),
      };
      console.error(`FAIL ${id}: ${err?.message || err}`);
    }
  }

  results.updated = new Date().toISOString();
  await mkdir(path.dirname(PROGRESS), { recursive: true });
  await writeFile(PROGRESS, JSON.stringify(results, null, 2));

  try {
    await fetch(`${CDP}/json/close/${targetId}`);
  } catch {
    /* ignore */
  }
  ws.close();

  const vals = Object.values(results.tools);
  const pass = vals.filter((t) => t.status === "pass").length;
  const fail = vals.filter((t) => t.status === "fail").length;
  console.log(`\nDone. pass=${pass} fail=${fail} of ${vals.length}`);
  if (fail) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
