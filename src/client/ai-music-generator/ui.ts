import { blobFromBytes } from "../../shared/image-encode";
import { encodeWav } from "../../shared/wav";
import {
  MUSIC_BARS,
  MUSIC_STYLES,
  STYLE_PRESETS,
  SURPRISE,
  SURPRISE_IDS,
  pieceSeconds,
  toMidi,
  type MusicBars,
  type MusicStyle,
  type Note,
  type Surprise,
} from "../../shared/music-gen";
import { appHref } from "../../shared/path";
import { chipGroup, formatSeconds, statusPanel, type Status } from "../ai/kit";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

type Model = typeof import("./model");
type Piece = { notes: Note[]; seeds: unknown[]; style: MusicStyle; bars: MusicBars; audio: AudioBuffer };

const state = {
  style: "lofi" as MusicStyle,
  bars: 8 as MusicBars,
  surprise: "normal" as Surprise,
  running: false,
};

let status: Status | null = null;
let model: Model | null = null;
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
  status = statusPanel("MusicVAE trio", "trio");
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("musicGen.back")),
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
  model?.disposeModel();
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
    if (!model) {
      panel.working(t("musicGen.loading"));
      const m = await import("./model");
      if (stale()) return;
      model = m;
    }
    await model.loadModel();
    if (stale()) return;
    panel.working(t("musicGen.composing"));
    const { style, bars } = more && piece ? piece : state;
    const preset = STYLE_PRESETS[style];
    const temperature = preset.temperature * SURPRISE[state.surprise];
    const { notes, seeds } = more && piece
      ? await model.vary(piece.seeds as never, bars, temperature)
      : await model.compose(bars, temperature);
    if (stale()) return;
    panel.working(t("musicGen.rendering"));
    const { renderPiece } = await import("./synth");
    const audio = await renderPiece(notes, bars, preset);
    if (stale()) return;
    piece = { notes, seeds, style, bars, audio };
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
  for (const b of [play, wav, midi]) if (b) b.disabled = busy || !piece;
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
  void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = piece.audio;
  src.loop = true;
  src.loopEnd = pieceSeconds(piece.bars, STYLE_PRESETS[piece.style].bpm);
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
  downloadBlob(blobFromBytes(toMidi(piece.notes, STYLE_PRESETS[piece.style].bpm), "audio/midi"), `${fileBase()}.mid`);
}

const PART_COLOR = { lead: "#d6336c", bass: "#7048e8", drums: "#868e96" } as const;

/** A piano roll of the piece: melody and bass by pitch, drums as a strip at the bottom. */
function drawRoll(notes: readonly Note[], bars: number): void {
  const c = roll?.getContext("2d");
  if (!roll || !c) return;
  const w = roll.width;
  const hgt = roll.height;
  c.clearRect(0, 0, w, hgt);
  const steps = bars * 16;
  const tonal = notes.filter((n) => n.part !== "drums");
  const lo = Math.min(...tonal.map((n) => n.pitch), 48) - 1;
  const hi = Math.max(...tonal.map((n) => n.pitch), 72) + 1;
  const drumBand = 40;
  const rowH = (hgt - drumBand - 8) / (hi - lo);
  c.strokeStyle = "rgba(0,0,0,0.08)";
  for (let b = 0; b <= bars; b++) {
    const x = (b * 16 * w) / steps;
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
