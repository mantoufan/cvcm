import { outputFilename } from "../../shared/filename";
import { blobFromBytes } from "../../shared/image-encode";
import { clampRange, formatClock, sliceChannels, waveformPeaks } from "../../shared/audio-cut";
import { encodeWav } from "../../shared/wav";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Item = {
  file: File;
  url: string;
  duration: number;
  sampleRate: number;
  channels: Float32Array[];
};

const state = {
  item: null as Item | null,
  start: 0,
  end: 0,
  error: "",
  playing: false,
};

let player: HTMLAudioElement | null = null;
let wave: HTMLCanvasElement | null = null;
let statusEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let startEl: HTMLInputElement | null = null;
let endEl: HTMLInputElement | null = null;
let startRange: HTMLInputElement | null = null;
let endRange: HTMLInputElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let peaks: number[] = [];

export async function mountAudioCutter(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("audioCutter.back")),
      h("h1", null, t("audioCutter.title")),
      h("p", { class: "lede" }, t("audioCutter.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  paintWave();
  window.addEventListener("paste", onPaste);
  window.addEventListener("resize", paintWave);
}

export function unmountAudioCutter(): void {
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("resize", paintWave);
  stopPlay();
  if (state.item) URL.revokeObjectURL(state.item.url);
  state.item = null;
  player = null;
  wave = null;
  statusEl = null;
  metaEl = null;
  startEl = null;
  endEl = null;
  startRange = null;
  endRange = null;
  playBtn = null;
  peaks = [];
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus",
    class: "sr-only",
    id: "audio-cutter-file-input",
    onChange: (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void setFile(file);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "audio-cutter-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      const file = audioFromList(e.dataTransfer?.files);
      if (file) void setFile(file);
    },
  },
    input,
    h("strong", null, t("audioCutter.dropTitle")),
    h("span", null, t("audioCutter.dropHint")),
    h("em", null, t("audioCutter.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("audioCutter.filesTitle"))),
    drop,
  );
}

function stagePane(): HTMLElement {
  wave = h("canvas", { class: "audio-wave", width: 640, height: 96 });
  player = h("audio", {
    class: "clip-url",
    controls: true,
    onTimeupdate: onTime,
    onEnded: () => stopPlay(),
  });
  metaEl = h("p", { class: "hint" }, t("audioCutter.hint"));
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame audio-stage" }, wave, player),
    metaEl,
    h("div", { class: "stage-actions" },
      playBtn = h("button", { type: "button", class: "btn ghost", onClick: () => togglePlay() }, t("audioCutter.play")),
      h("button", { type: "button", class: "btn", onClick: () => void download() }, t("audioCutter.download")),
    ),
    statusEl,
  );
}

function controls(): HTMLElement {
  startEl = numInput("start");
  endEl = numInput("end");
  startRange = rangeInput("start");
  endRange = rangeInput("end");
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("audioCutter.options")),
      labeled(t("audioCutter.start"), startEl),
      startRange,
      labeled(t("audioCutter.end"), endEl),
      endRange,
    ),
  );
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function numInput(which: "start" | "end"): HTMLInputElement {
  return h("input", {
    type: "number",
    min: "0",
    step: "0.01",
    value: "0",
    onInput: (e: Event) => {
      const n = Number((e.target as HTMLInputElement).value);
      applyRange(which === "start" ? n : state.start, which === "end" ? n : state.end);
    },
  });
}

function rangeInput(which: "start" | "end"): HTMLInputElement {
  return h("input", {
    type: "range",
    min: "0",
    max: "0",
    step: "0.01",
    value: "0",
    onInput: (e: Event) => {
      const n = Number((e.target as HTMLInputElement).value);
      applyRange(which === "start" ? n : state.start, which === "end" ? n : state.end);
    },
  });
}

function audioFromList(list?: FileList | null): File | null {
  return [...(list || [])].find((f) => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(f.name)) || null;
}

function onPaste(e: ClipboardEvent): void {
  const file = audioFromList(e.clipboardData?.files);
  if (file) {
    e.preventDefault();
    void setFile(file);
  }
}

async function setFile(file: File): Promise<void> {
  stopPlay();
  if (state.item) URL.revokeObjectURL(state.item.url);
  state.item = null;
  state.error = "";
  peaks = [];
  if (statusEl) statusEl.textContent = t("audioCutter.working");
  try {
    const ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const raw = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(raw.slice(0));
    const channels: Float32Array[] = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i).slice());
    void ctx.close();
    const url = URL.createObjectURL(file);
    state.item = {
      file,
      url,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels,
    };
    peaks = waveformPeaks(channels[0] || new Float32Array(), 240);
    applyRange(0, buffer.duration);
    if (player) player.src = url;
    if (statusEl) statusEl.textContent = "";
  } catch {
    state.error = t("audioCutter.errorDecode");
    if (statusEl) statusEl.textContent = state.error;
    refreshMeta();
    paintWave();
  }
}

function applyRange(start: number, end: number): void {
  const dur = state.item?.duration ?? 0;
  const range = clampRange(start, end, dur);
  state.start = range.start;
  state.end = range.end;
  syncInputs();
  refreshMeta();
  paintWave();
}

function syncInputs(): void {
  const dur = state.item?.duration ?? 0;
  for (const el of [startEl, endEl, startRange, endRange]) {
    if (!el) continue;
    el.max = String(dur);
    el.disabled = !state.item;
  }
  if (startEl) startEl.value = state.start.toFixed(2);
  if (endEl) endEl.value = state.end.toFixed(2);
  if (startRange) startRange.value = String(state.start);
  if (endRange) endRange.value = String(state.end);
}

function refreshMeta(): void {
  if (!metaEl) return;
  const item = state.item;
  if (!item) {
    metaEl.textContent = state.error || t("audioCutter.hint");
    return;
  }
  const cut = Math.max(0, state.end - state.start);
  metaEl.textContent = t("audioCutter.meta", {
    duration: formatClock(item.duration),
    start: formatClock(state.start),
    end: formatClock(state.end),
    cut: formatClock(cut),
  });
}

function paintWave(): void {
  if (!wave) return;
  const cssW = Math.max(320, wave.clientWidth || 640);
  const cssH = 96;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  wave.width = Math.round(cssW * dpr);
  wave.height = Math.round(cssH * dpr);
  wave.style.width = `${cssW}px`;
  wave.style.height = `${cssH}px`;
  const ctx = wave.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#fff7fb";
  ctx.fillRect(0, 0, cssW, cssH);
  if (!peaks.length) return;
  const dur = state.item?.duration || 1;
  const x0 = (state.start / dur) * cssW;
  const x1 = (state.end / dur) * cssW;
  ctx.fillStyle = "#fde8f0";
  ctx.fillRect(x0, 0, Math.max(1, x1 - x0), cssH);
  const mid = cssH / 2;
  const bar = cssW / peaks.length;
  for (let i = 0; i < peaks.length; i++) {
    const h = Math.max(1, peaks[i] * (cssH * 0.42));
    const x = i * bar;
    const selected = x + bar * 0.5 >= x0 && x + bar * 0.5 <= x1;
    ctx.fillStyle = selected ? "#c83f79" : "#f3c5df";
    ctx.fillRect(x + 0.4, mid - h, Math.max(1, bar - 0.8), h * 2);
  }
}

function togglePlay(): void {
  if (!player || !state.item) {
    if (statusEl) statusEl.textContent = t("audioCutter.emptyDownload");
    return;
  }
  if (state.playing) {
    stopPlay();
    return;
  }
  player.currentTime = state.start;
  void player.play();
  state.playing = true;
  if (playBtn) playBtn.textContent = t("audioCutter.stop");
}

function stopPlay(): void {
  state.playing = false;
  if (player) player.pause();
  if (playBtn) playBtn.textContent = t("audioCutter.play");
}

function onTime(): void {
  if (!player || !state.playing) return;
  if (player.currentTime >= state.end - 0.02) stopPlay();
}

async function download(): Promise<void> {
  const item = state.item;
  if (!item) {
    if (statusEl) statusEl.textContent = t("audioCutter.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("audioCutter.working");
  try {
    const sliced = sliceChannels(item.channels, item.sampleRate, state.start, state.end);
    const wav = encodeWav(sliced, item.sampleRate);
    downloadBlob(blobFromBytes(wav, "audio/wav"), outputFilename(item.file.name, "audio/wav", "-cut"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("audioCutter.errorEncode");
  }
}
