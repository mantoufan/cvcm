import { blobFromBytes } from "../../shared/image-encode";
import { encodeWav } from "../../shared/wav";
import {
  MUSIC_BARS,
  MUSIC_STYLES,
  STYLE_PRESETS,
  SURPRISE,
  SURPRISE_IDS,
  STEPS_PER_BAR,
  pieceSeconds,
  toMidi,
  type MusicBars,
  type MusicStyle,
  type Note,
  type Surprise,
} from "../../shared/music-gen";
import { AI_MODELS, formatMb, modelBytes } from "../../shared/ai-models";
import { chipGroup, formatSeconds } from "../ai/kit";
import { downloadBlob, h } from "../dom";
import { t } from "../i18n";
import type { MusicRequest, MusicResponse } from "./model-worker";

/** `job`: the worker job that wrote it, which "More like this" varies. */
type Piece = { notes: Note[]; style: MusicStyle; bars: MusicBars; audio: AudioBuffer; loop: AudioBuffer; job: number };

/** Longest a run may take, model download included (18 MB on a slow line, then the CPU backend). */
const RUN_TIMEOUT_MS = 180_000;

/** The model worker, started on the first Generate; terminating it frees TensorFlow.js and the weights. */
class MusicModel {
  private worker = new Worker(new URL("./model-worker.ts", import.meta.url), { type: "module", name: "cvcm-music" });
  private seq = 0;
  /** The worker failed to start or crashed: make a new one for the next run. */
  dead = false;
  /** The checkpoint is in: the next runs compose without downloading. */
  loaded = false;
  private pending = new Map<number, { resolve: (notes: Note[]) => void; reject: (err: Error) => void }>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<MusicResponse>) => {
      const job = this.pending.get(e.data.id);
      if (!job) return;
      this.pending.delete(e.data.id);
      if ("error" in e.data) job.reject(new Error(e.data.error));
      else {
        this.loaded = true;
        job.resolve(e.data.notes);
      }
    };
    this.worker.onerror = (e) => {
      e.preventDefault();
      this.dead = true;
      this.fail(new Error(e.message || "worker"));
      this.worker.terminate();
    };
  }

  /** Resolves with the notes and the job id (pass it back as `base` to vary that piece). */
  run(type: MusicRequest["type"], bars: MusicBars, temperature: number, base?: number): Promise<{ notes: Note[]; job: number }> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      // A worker the browser kills (out of memory) sends neither a reply nor an error: give up after a while.
      const timer = setTimeout(() => {
        this.dead = true;
        this.fail(new Error("timeout"));
        this.worker.terminate();
      }, RUN_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (notes) => {
          clearTimeout(timer);
          resolve({ notes, job: id });
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.worker.postMessage({ id, type, base, bars, temperature } satisfies MusicRequest);
    });
  }

  private fail(err: Error): void {
    for (const job of this.pending.values()) job.reject(err);
    this.pending.clear();
  }

  dispose(): void {
    this.fail(new Error("cancelled"));
    this.worker.terminate();
  }
}

/**
 * The model line and one status line. Not the AI tools' statusPanel: that one reads the Transformers.js cache and
 * the WebGPU check, which say nothing about TensorFlow.js (it caches through the browser's HTTP cache, runs on WebGL).
 */
type Panel = { el: HTMLElement; working(label: string): void; done(label: string): void; error(label: string): void };

function musicPanel(): Panel {
  const bar = h("progress", { class: "ai-bar", hidden: true });
  const line = h("p", { class: "status ai-status", "aria-live": "polite" });
  const el = h("div", { class: "ai-panel" },
    h("p", { class: "ai-model" },
      h("strong", null, "MusicVAE trio"),
      h("span", null, ` · ${AI_MODELS.trio.license} · ${formatMb(modelBytes("trio", "gpu"))}`),
    ),
    bar,
    line,
  );
  return {
    el,
    working(label) {
      bar.hidden = false;
      line.textContent = label;
    },
    done(label) {
      bar.hidden = true;
      line.textContent = label;
    },
    error(label) {
      bar.hidden = true;
      line.textContent = label;
    },
  };
}

const state = {
  style: "lofi" as MusicStyle,
  bars: 8 as MusicBars,
  surprise: "normal" as Surprise,
  running: false,
};

let status: Panel | null = null;
let model: MusicModel | null = null;
let piece: Piece | null = null;
let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let playBtn: HTMLButtonElement | null = null;
let actions: HTMLButtonElement[] = [];
let roll: HTMLCanvasElement | null = null;
let infoEl: HTMLElement | null = null;
let alive = false;
/** Bumped per mount, so a run from an earlier mount stops at its next step. */
let mountId = 0;
let serial = 0;

export async function mountMusicGenerator(host: HTMLElement): Promise<void> {
  alive = true;
  mountId++;
  serial = 0;
  status = musicPanel();
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("musicGen.title")),
      h("p", { class: "lede" }, t("musicGen.privacyNote")),
    ),
    h("div", { class: "tool" },
      leftRail(),
      stagePane(),
      controls(),
    ),
  );
}

export function unmountMusicGenerator(): void {
  alive = false;
  mountId++;
  stop();
  void ctx?.close();
  ctx = null;
  model?.dispose();
  model = null;
  piece = null;
  state.running = false;
  status = null;
  playBtn = null;
  actions = [];
  roll = null;
  infoEl = null;
}

function leftRail(): HTMLElement {
  const make = h("button", { type: "button", class: "btn", onClick: () => void generate(false) }, t("musicGen.generate"));
  const more = h("button", { type: "button", class: "btn ghost", disabled: true, onClick: () => void generate(true) }, t("musicGen.more"));
  actions = [make, more];
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("musicGen.styleTitle"))),
    chipGroup(MUSIC_STYLES, () => state.style, (s) => t(`musicGen.style_${s}`), (s) => (state.style = s), () => {}),
    h("div", { class: "stage-actions" }, make, more),
    h("p", { class: "muted" }, t("musicGen.moreHint")),
  );
}

function stagePane(): HTMLElement {
  roll = h("canvas", { class: "preview music-roll", width: 960, height: 300 });
  infoEl = h("p", { class: "hint" }, t("musicGen.hint"));
  playBtn = h("button", { type: "button", class: "btn", disabled: true, onClick: togglePlay }, t("musicGen.play"));
  const wav = h("button", { type: "button", class: "btn ghost", disabled: true, onClick: () => saveWav() }, t("musicGen.downloadWav"));
  const midi = h("button", { type: "button", class: "btn ghost", disabled: true, onClick: () => saveMidi() }, t("musicGen.downloadMidi"));
  actions.push(playBtn, wav, midi);
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame" }, roll),
    infoEl,
    status!.el,
    h("div", { class: "stage-actions" }, playBtn, wav, midi),
  );
}

function controls(): HTMLElement {
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("musicGen.length")),
      chipGroup(MUSIC_BARS, () => state.bars, (b) => t("musicGen.bars", { n: b }), (b) => (state.bars = b), () => {}),
    ),
    h("fieldset", null,
      h("legend", null, t("musicGen.surprise")),
      chipGroup(SURPRISE_IDS, () => state.surprise, (s) => t(`musicGen.surprise_${s}`), (s) => (state.surprise = s), () => {}),
      h("p", { class: "muted" }, t("musicGen.note")),
    ),
  );
}

/** Generate a new piece, or (`more`) a variation of the current one, then render and play it. */
async function generate(more: boolean): Promise<void> {
  if (!status || state.running || (more && !piece)) return;
  const panel = status;
  const mine = mountId;
  const stale = (): boolean => !alive || mine !== mountId;
  state.running = true;
  setBusy(true);
  const started = performance.now();
  try {
    // Created and resumed inside the click (before any await): Safari only lets audio start with the user's
    // gesture, and the piece is ready seconds later.
    ctx ??= new AudioContext();
    void ctx.resume().catch(() => {});
    if (!model || model.dead) model = new MusicModel();
    // Until a run succeeds, a run also downloads the model (about 18 MB) inside the worker.
    panel.working(t(model.loaded ? "musicGen.composing" : "musicGen.loading"));
    // "More like this" keeps the last piece's ideas and takes the style and length now selected.
    const { style, bars } = state;
    const preset = STYLE_PRESETS[style];
    const temperature = preset.temperature * SURPRISE[state.surprise];
    const { notes, job } = more && piece
      ? await model.run("vary", bars, temperature, piece.job)
      : await model.run("compose", bars, temperature);
    if (stale()) return;
    panel.working(t("musicGen.rendering"));
    const { renderPiece, loopBuffer } = await import("./synth");
    const audio = await renderPiece(notes, bars, preset);
    if (stale()) return;
    piece = { notes, style, bars, audio, loop: loopBuffer(audio, pieceSeconds(bars, preset.bpm)), job };
    serial++;
    drawRoll(notes, bars);
    if (infoEl) infoEl.textContent = t("musicGen.info", { style: t(`musicGen.style_${style}`), bars, bpm: preset.bpm, s: formatSeconds(pieceSeconds(bars, preset.bpm)) });
    panel.done(t("musicGen.done", { s: formatSeconds((performance.now() - started) / 1000) }));
    play();
  } catch (err) {
    if (stale()) return;
    console.error(err);
    panel.error(t("musicGen.errorRun"));
  } finally {
    if (!stale()) {
      state.running = false;
      setBusy(false);
    }
  }
}

function setBusy(busy: boolean): void {
  const [make, more, play, wav, midi] = actions;
  if (make) make.disabled = busy;
  if (more) more.disabled = busy || !piece;
  // Play / Stop stays usable while a new piece is made: the old loop keeps playing until then.
  if (play) play.disabled = !piece;
  for (const b of [wav, midi]) if (b) b.disabled = busy || !piece;
}

function stop(): void {
  try {
    source?.stop();
  } catch {
    /* already stopped */
  }
  source = null;
  if (playBtn) playBtn.textContent = t("musicGen.play");
}

/** Loops the rendered piece (the loop point is the end of the last bar, so the echo tail does not double up). */
function play(): void {
  if (!piece) return;
  stop();
  ctx ??= new AudioContext();
  void ctx.resume().catch(() => {});
  const src = ctx.createBufferSource();
  src.buffer = piece.loop;
  src.loop = true;
  src.connect(ctx.destination);
  src.start();
  source = src;
  if (playBtn) playBtn.textContent = t("musicGen.stop");
}

function togglePlay(): void {
  if (source) stop();
  else play();
}

function fileBase(): string {
  return piece ? `cvcm-${piece.style}-${piece.bars}bars-${STYLE_PRESETS[piece.style].bpm}bpm-${serial}` : "cvcm-music";
}

function saveWav(): void {
  if (!piece) return;
  const a = piece.audio;
  const channels = Array.from({ length: a.numberOfChannels }, (_, i) => a.getChannelData(i));
  downloadBlob(blobFromBytes(encodeWav(channels, a.sampleRate), "audio/wav"), `${fileBase()}.wav`);
}

function saveMidi(): void {
  if (!piece) return;
  downloadBlob(blobFromBytes(toMidi(piece.notes, STYLE_PRESETS[piece.style].bpm, STYLE_PRESETS[piece.style].swing), "audio/midi"), `${fileBase()}.mid`);
}

const PART_COLOR = { lead: "#d6336c", bass: "#7048e8", drums: "#868e96" } as const;

/** A piano roll of the piece: melody and bass by pitch, drums as a strip at the bottom. */
function drawRoll(notes: readonly Note[], bars: number): void {
  const c = roll?.getContext("2d");
  if (!roll || !c) return;
  const w = roll.width;
  const hgt = roll.height;
  c.clearRect(0, 0, w, hgt);
  const steps = bars * STEPS_PER_BAR;
  const tonal = notes.filter((n) => n.part !== "drums");
  const lo = Math.min(...tonal.map((n) => n.pitch), 48) - 1;
  const hi = Math.max(...tonal.map((n) => n.pitch), 72) + 1;
  const drumBand = 40;
  const rowH = (hgt - drumBand - 8) / (hi - lo);
  c.strokeStyle = "rgba(0,0,0,0.08)";
  for (let b = 0; b <= bars; b++) {
    const x = (b * STEPS_PER_BAR * w) / steps;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, hgt);
    c.stroke();
  }
  for (const n of notes) {
    const x = (n.start * w) / steps;
    const nw = Math.max(2, ((n.end - n.start) * w) / steps - 1);
    c.fillStyle = PART_COLOR[n.part];
    if (n.part === "drums") c.fillRect(x, hgt - drumBand + ((n.pitch * 7) % (drumBand - 6)), Math.max(2, nw / 2), 4);
    else c.fillRect(x, (hi - n.pitch) * rowH, nw, Math.max(2, rowH - 1));
  }
}
