import { outputFilename } from "../../shared/filename";
import { blobFromBytes } from "../../shared/image-encode";
import { encodeWav, resampleChannels } from "../../shared/wav";
import { zipStore } from "../../shared/zip";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Item = {
  id: string;
  file: File;
  url: string;
  duration: number;
  sampleRate: number;
  channels: number;
  buffer: AudioBuffer | null;
  error: string | null;
};

const RATES = [0, 44100, 48000] as const;
type Rate = (typeof RATES)[number];

const state = {
  items: [] as Item[],
  selected: null as string | null,
  rate: 0 as Rate,
};

let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let player: HTMLAudioElement | null = null;

export async function mountAudio(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("audio.back")),
      h("h1", null, t("audio.title")),
      h("p", { class: "lede" }, t("audio.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      stagePane(),
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t("audio.exportTitle")),
          h("p", { class: "muted" }, t("audio.hint")),
          h("label", { class: "field" },
            h("span", null, t("audio.sampleRate")),
            h("select", {
              onChange: (e: Event) => {
                state.rate = Number((e.target as HTMLSelectElement).value) as Rate;
              },
            },
              ...RATES.map((n) =>
                h("option", {
                  value: String(n),
                  selected: state.rate === n,
                }, n === 0 ? t("audio.rateOriginal") : `${n} Hz`),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  refreshList();
  window.addEventListener("paste", onPaste);
}

export function unmountAudio(): void {
  window.removeEventListener("paste", onPaste);
  fileList = null;
  statusEl = null;
  metaEl = null;
  player = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus",
    multiple: true,
    class: "sr-only",
    id: "audio-file-input",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles(files);
      (e.target as HTMLInputElement).value = "";
    },
  });
  fileList = h("ul", { class: "file-list" });
  const drop = h("label", {
    class: "drop",
    for: "audio-file-input",
    onDragover: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      if (e.dataTransfer?.files) void addFiles(e.dataTransfer.files);
    },
  },
    input,
    h("strong", null, t("audio.dropTitle")),
    h("span", null, t("audio.dropHint")),
    h("em", null, t("audio.dropTypes")),
  );
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" },
      h("h2", null, t("audio.filesTitle")),
      h("button", { type: "button", class: "link", onClick: () => clearItems() }, t("audio.clear")),
    ),
    drop,
    fileList,
  );
}

function stagePane(): HTMLElement {
  player = h("audio", { class: "clip-url", controls: true });
  metaEl = h("p", { class: "hint" }, t("audio.hint"));
  statusEl = h("p", { class: "status", "aria-live": "polite" });
  return h("section", { class: "stage" },
    h("div", { class: "stage-frame audio-stage" }, player),
    metaEl,
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", onClick: () => void downloadOne() }, t("audio.download")),
      h("button", { type: "button", class: "btn ghost", onClick: () => void downloadAll() }, t("audio.downloadAll")),
    ),
    statusEl,
  );
}

function onPaste(e: ClipboardEvent): void {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("audio/"));
  if (files.length) {
    e.preventDefault();
    void addFiles(files);
  }
}

async function addFiles(list: FileList | File[]): Promise<void> {
  const files = [...list].filter(
    (f) => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(f.name),
  );
  for (const file of files) await ingestFile(file);
  refreshList();
  refreshStage();
}

async function ingestFile(file: File): Promise<void> {
  const id = crypto.randomUUID();
  const url = URL.createObjectURL(file);
  const item: Item = {
    id, file, url, duration: 0, sampleRate: 0, channels: 0, buffer: null, error: null,
  };
  state.items.push(item);
  if (!state.selected) state.selected = id;
  try {
    const ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const raw = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(raw.slice(0));
    item.buffer = buffer;
    item.duration = buffer.duration;
    item.sampleRate = buffer.sampleRate;
    item.channels = buffer.numberOfChannels;
    void ctx.close();
  } catch {
    item.error = t("audio.errorDecode");
  }
}

function current(): Item | null {
  return state.items.find((it) => it.id === state.selected) ?? state.items[0] ?? null;
}

function refreshList(): void {
  if (!fileList) return;
  fileList.replaceChildren();
  if (state.items.length === 0) {
    fileList.append(h("li", { class: "muted" }, t("audio.filesEmpty")));
    return;
  }
  for (const item of state.items) {
    fileList.append(
      h("li", {
        class: "file" + (item.id === state.selected ? " on" : ""),
        onClick: () => {
          state.selected = item.id;
          refreshList();
          refreshStage();
        },
      },
        h("div", { class: "audio-thumb", "aria-hidden": "true" }, "♪"),
        h("div", null,
          h("strong", null, item.file.name),
          h("span", null, item.error || `${item.duration.toFixed(1)}s · ${item.sampleRate} Hz`),
        ),
        h("button", {
          type: "button",
          class: "icon",
          "aria-label": t("audio.remove"),
          onClick: (e: Event) => {
            e.stopPropagation();
            removeItem(item.id);
          },
        }, "×"),
      ),
    );
  }
}

function refreshStage(): void {
  const item = current();
  if (player) player.src = item?.url || "";
  if (metaEl) {
    metaEl.textContent = item
      ? (item.error || t("audio.meta", {
        duration: item.duration.toFixed(1),
        rate: String(item.sampleRate),
        channels: String(item.channels),
      }))
      : t("audio.hint");
  }
}

function removeItem(id: string): void {
  const idx = state.items.findIndex((it) => it.id === id);
  if (idx < 0) return;
  const [item] = state.items.splice(idx, 1);
  URL.revokeObjectURL(item.url);
  if (state.selected === id) state.selected = state.items[0]?.id ?? null;
  refreshList();
  refreshStage();
}

function clearItems(): void {
  for (const item of state.items) URL.revokeObjectURL(item.url);
  state.items = [];
  state.selected = null;
  refreshList();
  refreshStage();
}

function wavBlob(item: Item): Blob {
  if (!item.buffer) throw new Error("decode");
  const chans = [];
  for (let i = 0; i < item.buffer.numberOfChannels; i++) chans.push(item.buffer.getChannelData(i));
  const rate = state.rate || item.buffer.sampleRate;
  const samples = resampleChannels(chans, item.buffer.sampleRate, rate);
  return blobFromBytes(encodeWav(samples, rate), "audio/wav");
}

async function downloadOne(): Promise<void> {
  const item = current();
  if (!item) {
    if (statusEl) statusEl.textContent = t("audio.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("audio.working");
  try {
    const blob = wavBlob(item);
    downloadBlob(blob, outputFilename(item.file.name, "audio/wav", ""));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("audio.errorDecode");
  }
}

async function downloadAll(): Promise<void> {
  const ready = state.items.filter((it) => it.buffer);
  if (ready.length === 0) {
    if (statusEl) statusEl.textContent = t("audio.emptyDownload");
    return;
  }
  if (ready.length === 1) {
    await downloadOne();
    return;
  }
  if (statusEl) statusEl.textContent = t("audio.working");
  try {
    const entries = [];
    for (const item of ready) {
      const blob = wavBlob(item);
      entries.push({
        name: outputFilename(item.file.name, "audio/wav", ""),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }
    const zip = zipStore(entries);
    downloadBlob(blobFromBytes(zip, "application/zip"), "cvcm-audio.zip");
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("audio.errorDecode");
  }
}
