import { formatMb, modelBytes } from "../../shared/ai-models";
import { stemAndExt } from "../../shared/filename";
import { appHref } from "../../shared/path";
import { shortClock, toSrt, toText, toVtt, type Segment } from "../../shared/subtitles";
import { AiClient, guessBackend } from "../ai/client";
import { deviceLabel, dropZone, formatSeconds, prewarm, runJob, statusPanel, type Status } from "../ai/kit";
import type { AiResponse } from "../ai/protocol";
import { convertZh, type ZhScript } from "../ai/zh";
import { clear, downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";

/** Whisper's languages, the common ones first. Names come from Intl.DisplayNames in the page language. */
const TOP_LANGUAGES = ["en", "zh", "ja", "ko", "vi", "id", "es", "fr", "de", "pt", "ru", "it", "ar", "hi", "th", "tr", "ms", "nl", "pl", "uk"];
const MORE_LANGUAGES = [
  "af", "am", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs", "ca", "cs", "cy", "da", "el", "et", "eu", "fa", "fi",
  "fo", "gl", "gu", "ha", "haw", "he", "hr", "ht", "hu", "hy", "is", "jw", "ka", "kk", "km", "kn", "la", "lb", "ln", "lo",
  "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "mt", "my", "ne", "nn", "no", "oc", "pa", "ps", "ro", "sa", "sd", "si",
  "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw", "ta", "te", "tg", "tk", "tl", "tt", "ur", "uz", "yi", "yo",
];

type Model = "whisper-base" | "whisper-small";

const state = {
  name: "",
  audio: null as Float32Array | null,
  duration: 0,
  language: "auto",
  model: "whisper-base" as Model,
  task: "transcribe" as "transcribe" | "translate",
  script: "auto" as "auto" | ZhScript,
  detected: "",
  segments: [] as Segment[],
  running: false,
  recording: null as MediaRecorder | null,
};

let client: AiClient | null = null;
let status: Status | null = null;
let output: HTMLTextAreaElement | null = null;
let segList: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let recordBtn: HTMLButtonElement | null = null;
let scriptField: HTMLElement | null = null;
let modelChips: HTMLButtonElement[] = [];
let recordTimer = 0;
let alive = false;

export async function mountSpeechToText(host: HTMLElement): Promise<void> {
  alive = true;
  client = new AiClient();
  status = statusPanel("Whisper", state.model);
  // zh-TW readers get Traditional by default, zh-CN readers Simplified.
  state.script = locale() === "zh-TW" ? "hant" : locale() === "zh-CN" ? "hans" : "auto";
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("stt.back")),
      h("h1", null, t("stt.title")),
      h("p", { class: "lede" }, t("stt.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      controls(),
    ),
  );
  void guessBackend().then((b) => {
    // Small is fast on a GPU with 16-bit floats and much better at Chinese, Japanese and Korean.
    if (!alive || b !== "gpu16") return;
    setModel("whisper-small");
  });
}

export function unmountSpeechToText(): void {
  alive = false;
  stopRecording(true);
  client?.dispose();
  client = null;
  state.audio = null;
  state.segments = [];
  state.running = false;
  state.detected = "";
  status = null;
  output = null;
  segList = null;
  metaEl = null;
  recordBtn = null;
  scriptField = null;
  modelChips = [];
}

function filesRail(): HTMLElement {
  recordBtn = h("button", { type: "button", class: "btn ghost stt-record", onClick: () => void toggleRecording() }, t("stt.record"));
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" }, h("h2", null, t("stt.filesTitle"))),
    dropZone({
      id: "stt-file-input",
      accept: "audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.webm,.mp4,.mov,.mkv",
      title: t("stt.dropTitle"),
      hint: t("stt.dropHint"),
      types: t("stt.dropTypes"),
      onFiles: (files) => void setFile(files[0]),
      onIntent: () => {
        if (client && status) void prewarm(client, state.model, status);
      },
    }),
    recordBtn,
  );
}

function stagePane(): HTMLElement {
  output = h("textarea", { class: "stt-output", readonly: true, rows: 12, placeholder: t("stt.placeholder"), "aria-label": t("stt.outputLabel") });
  segList = h("ol", { class: "stt-segments" });
  metaEl = h("p", { class: "hint" }, t("stt.hint"));
  return h("section", { class: "stage" },
    output,
    status!.el,
    metaEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void transcribe() }, t("stt.run")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void copyText() }, t("stt.copy")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void save("txt") }, "TXT"),
      h("button", { type: "button", class: "btn ghost", onClick: () => void save("srt") }, "SRT"),
      h("button", { type: "button", class: "btn ghost", onClick: () => void save("vtt") }, "VTT"),
    ),
    segList,
  );
}

function languageName(code: string): string {
  try {
    const names = new Intl.DisplayNames([locale()], { type: "language" });
    return names.of(code === "jw" ? "jv" : code) ?? code;
  } catch {
    return code;
  }
}

function setModel(model: Model): void {
  state.model = model;
  for (const chip of modelChips) {
    const on = chip.dataset.model === model;
    chip.classList.toggle("on", on);
    chip.setAttribute("aria-pressed", String(on));
  }
  status?.setModel(model);
}

function controls(): HTMLElement {
  const more = [...MORE_LANGUAGES].sort((a, b) => languageName(a).localeCompare(languageName(b), locale()));
  const language = h("select", {
    onChange: (e: Event) => {
      state.language = (e.target as HTMLSelectElement).value;
    },
  },
    h("option", { value: "auto", selected: true }, t("stt.autoDetect")),
    h("optgroup", { label: t("stt.common") }, ...TOP_LANGUAGES.map((c) => h("option", { value: c }, languageName(c)))),
    h("optgroup", { label: t("stt.more") }, ...more.map((c) => h("option", { value: c }, languageName(c)))),
  );
  modelChips = (["whisper-base", "whisper-small"] as Model[]).map((m) =>
    h("button", {
      type: "button",
      class: "chip" + (state.model === m ? " on" : ""),
      "aria-pressed": String(state.model === m),
      dataset: { model: m },
      onClick: () => setModel(m),
    }, t(m === "whisper-base" ? "stt.model_fast" : "stt.model_accurate")),
  );
  const sizes = h("p", { class: "muted", "data-volatile": "" });
  void guessBackend().then((b) => {
    sizes.textContent = t("stt.modelSizes", { fast: formatMb(modelBytes("whisper-base", b)), accurate: formatMb(modelBytes("whisper-small", b)) });
  });
  const script = h("select", {
    onChange: (e: Event) => {
      state.script = (e.target as HTMLSelectElement).value as typeof state.script;
      void showResult();
    },
  },
    h("option", { value: "hans", selected: state.script === "hans" }, "简体中文"),
    h("option", { value: "hant", selected: state.script === "hant" }, "繁體中文"),
    h("option", { value: "auto", selected: state.script === "auto" }, t("stt.scriptAsIs")),
  );
  scriptField = h("label", { class: "field", hidden: true }, h("span", null, t("stt.script")), script);
  return h("aside", { class: "rail controls" },
    h("fieldset", null,
      h("legend", null, t("stt.options")),
      h("label", { class: "field" }, h("span", null, t("stt.language")), language),
      h("label", { class: "field" },
        h("span", null, t("stt.task")),
        h("select", {
          onChange: (e: Event) => {
            state.task = (e.target as HTMLSelectElement).value as typeof state.task;
          },
        },
          h("option", { value: "transcribe", selected: true }, t("stt.task_transcribe")),
          h("option", { value: "translate" }, t("stt.task_translate")),
        ),
      ),
      scriptField,
    ),
    h("fieldset", null,
      h("legend", null, t("stt.model")),
      h("div", { class: "convert-chips" }, ...modelChips),
      sizes,
    ),
  );
}

/** Decode any audio or video file the browser can play into 16 kHz mono, which is what Whisper reads. */
async function decode(blob: Blob): Promise<Float32Array> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx({ sampleRate: 16_000 });
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
    const out = new Float32Array(buffer.length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) out[i] += data[i] / buffer.numberOfChannels;
    }
    return out;
  } finally {
    void ctx.close();
  }
}

async function setFile(file: File | Blob | undefined, name?: string): Promise<void> {
  if (!file || !status) return;
  state.name = name ?? (file instanceof File ? file.name : "recording");
  state.audio = null;
  state.segments = [];
  state.detected = "";
  if (output) output.value = "";
  if (segList) clear(segList);
  status.working(t("stt.decoding"));
  try {
    const audio = await decode(file);
    if (!alive) return;
    state.audio = audio;
    state.duration = audio.length / 16_000;
    if (metaEl) metaEl.textContent = `${state.name} · ${shortClock(state.duration)}`;
    status.idle();
    void transcribe();
  } catch (err) {
    console.error(err);
    status?.error(t("stt.errorDecode"));
  }
}

async function transcribe(): Promise<void> {
  if (!client || !status || state.running) return;
  if (!state.audio) {
    status.error(t("stt.empty"));
    return;
  }
  state.running = true;
  const audio = state.audio;
  let live = "";
  if (output) output.value = "";
  if (segList) clear(segList);
  try {
    const { result, backend, seconds } = await runJob<Extract<AiResponse, { type: "transcript" }>>(
      client,
      status,
      async () => {
        const copy = audio.slice();
        return {
          body: {
            type: "transcribe",
            audio: copy,
            model: state.model,
            language: state.language === "auto" ? null : state.language,
            task: state.task,
          },
          transfer: [copy.buffer],
        };
      },
      {
        onText: (text) => {
          live += text;
          if (output) {
            output.value = live;
            output.scrollTop = output.scrollHeight;
          }
        },
        onLanguage: (code) => {
          state.detected = code;
          if (metaEl) metaEl.textContent = `${state.name} · ${shortClock(state.duration)} · ${languageName(code)}`;
        },
      },
    );
    if (!alive || state.audio !== audio) return;
    state.segments = result.chunks.length ? result.chunks : [{ start: 0, end: state.duration, text: result.text }];
    state.detected = result.language;
    await showResult();
    status.done(t("stt.doneIn", { s: formatSeconds(seconds), device: deviceLabel(backend), len: shortClock(state.duration) }));
  } catch (err) {
    if (!alive) return;
    console.error(err);
    status.error(t("ai.errorRun"));
  } finally {
    state.running = false;
  }
}

/** Segments in the chosen Chinese script (other languages pass through). */
async function finalSegments(): Promise<Segment[]> {
  const zh = state.detected === "zh" && state.task === "transcribe";
  if (scriptField) scriptField.hidden = !zh;
  if (!zh || state.script === "auto") return state.segments;
  const to = state.script;
  return Promise.all(state.segments.map(async (s) => ({ ...s, text: await convertZh(s.text, to) })));
}

async function showResult(): Promise<void> {
  if (!state.segments.length) return;
  const segments = await finalSegments();
  if (!alive) return;
  if (output) output.value = toText(segments);
  if (!segList) return;
  clear(segList);
  for (const seg of segments) {
    if (!seg.text.trim()) continue;
    segList.append(h("li", null, h("time", null, shortClock(seg.start)), " ", seg.text.trim()));
  }
}

async function copyText(): Promise<void> {
  if (!output?.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    status?.done(t("stt.copied"));
  } catch {
    output.select();
  }
}

async function save(kind: "txt" | "srt" | "vtt"): Promise<void> {
  if (!state.segments.length) {
    status?.error(t("stt.empty"));
    return;
  }
  const segments = await finalSegments();
  const body = kind === "srt" ? toSrt(segments) : kind === "vtt" ? toVtt(segments) : toText(segments);
  const type = kind === "vtt" ? "text/vtt" : kind === "srt" ? "application/x-subrip" : "text/plain";
  const stem = stemAndExt(state.name || "transcript").stem.replace(/[^\w\u0080-￿.-]+/g, "_").slice(0, 80) || "transcript";
  downloadBlob(new Blob([body], { type: `${type};charset=utf-8` }), `${stem}.${kind}`);
}

async function toggleRecording(): Promise<void> {
  if (state.recording) {
    stopRecording(false);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!alive) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const parts: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => parts.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (!alive || recorder.state === "inactive" && parts.length === 0) return;
      void setFile(new Blob(parts, { type: recorder.mimeType }), `${t("stt.recordingName")}.${recorder.mimeType.includes("mp4") ? "m4a" : "webm"}`);
    };
    recorder.start();
    state.recording = recorder;
    const started = Date.now();
    const tick = (): void => {
      if (recordBtn) recordBtn.textContent = t("stt.stop", { time: shortClock((Date.now() - started) / 1000) });
    };
    tick();
    recordTimer = window.setInterval(tick, 500);
  } catch {
    status?.error(t("stt.errorMic"));
  }
}

function stopRecording(discard: boolean): void {
  window.clearInterval(recordTimer);
  const recorder = state.recording;
  state.recording = null;
  if (recordBtn) recordBtn.textContent = t("stt.record");
  if (!recorder) return;
  if (discard) recorder.ondataavailable = null;
  if (recorder.state !== "inactive") recorder.stop();
}
