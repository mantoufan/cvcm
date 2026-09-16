import { concatClips } from "../../shared/audio-join";
import { outputFilename } from "../../shared/filename";
import { blobFromBytes } from "../../shared/image-encode";
import { encodeWav } from "../../shared/wav";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";

type Item = {
  id: string;
  file: File;
  duration: number;
  sampleRate: number;
  channels: Float32Array[];
  error: string | null;
};

const state = { items: [] as Item[] };

let fileList: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;

export async function mountAudioJoiner(host: HTMLElement): Promise<void> {
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("audioJoiner.back")),
      h("h1", null, t("audioJoiner.title")),
      h("p", { class: "lede" }, t("audioJoiner.privacyNote")),
    ),
    h("div", { class: "tool" },
      filesRail(),
      h("section", { class: "stage" },
        metaEl = h("p", { class: "hint" }, t("audioJoiner.hint")),
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn", onClick: () => void join() }, t("audioJoiner.download")),
        ),
        statusEl = h("p", { class: "status", "aria-live": "polite" }),
      ),
    ),
  );
  refreshList();
  window.addEventListener("paste", onPaste);
}

export function unmountAudioJoiner(): void {
  window.removeEventListener("paste", onPaste);
  state.items = [];
  fileList = null;
  statusEl = null;
  metaEl = null;
}

function filesRail(): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: "audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus",
    multiple: true,
    class: "sr-only",
    id: "audio-joiner-file-input",
    onChange: (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) void addFiles(files);
      (e.target as HTMLInputElement).value = "";
    },
  });
  const drop = h("label", {
    class: "drop",
    for: "audio-joiner-file-input",
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
    h("strong", null, t("audioJoiner.dropTitle")),
    h("span", null, t("audioJoiner.dropHint")),
    h("em", null, t("audioJoiner.dropTypes")),
  );
  fileList = h("ul", { class: "file-list" });
  return h("aside", { class: "rail" },
    h("div", { class: "rail-h" },
      h("h2", null, t("audioJoiner.filesTitle")),
      h("button", { type: "button", class: "link", onClick: () => clearItems() }, t("audioJoiner.clear")),
    ),
    drop,
    fileList,
  );
}

function onPaste(e: ClipboardEvent): void {
  if (e.clipboardData?.files?.length) {
    e.preventDefault();
    void addFiles(e.clipboardData.files);
  }
}

async function addFiles(list: FileList): Promise<void> {
  for (const file of [...list]) {
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(file.name)) continue;
    const item: Item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      duration: 0,
      sampleRate: 0,
      channels: [],
      error: null,
    };
    state.items.push(item);
    try {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = await ctx.decodeAudioData((await file.arrayBuffer()).slice(0));
      const channels: Float32Array[] = [];
      for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i).slice());
      item.duration = buffer.duration;
      item.sampleRate = buffer.sampleRate;
      item.channels = channels;
      void ctx.close();
    } catch {
      item.error = t("audioJoiner.errorDecode");
    }
    refreshList();
  }
}

function refreshList(): void {
  if (!fileList) return;
  fileList.replaceChildren();
  if (state.items.length === 0) {
    fileList.append(h("li", { class: "muted" }, t("audioJoiner.filesEmpty")));
    refreshMeta();
    return;
  }
  state.items.forEach((item, index) => {
    fileList!.append(
      h("li", { class: "file" },
        h("div", { class: "audio-thumb", "aria-hidden": "true" }, "♪"),
        h("div", null,
          h("strong", null, item.file.name),
          h("span", null, item.error || `${item.duration.toFixed(1)}s · ${item.sampleRate} Hz`),
        ),
        h("div", { class: "file-ops" },
          h("button", { type: "button", class: "icon", disabled: index === 0, onClick: () => move(index, -1) }, t("audioJoiner.up")),
          h("button", { type: "button", class: "icon", disabled: index === state.items.length - 1, onClick: () => move(index, 1) }, t("audioJoiner.down")),
          h("button", { type: "button", class: "icon", onClick: () => remove(index) }, "×"),
        ),
      ),
    );
  });
  refreshMeta();
}

function refreshMeta(): void {
  if (!metaEl) return;
  const ready = state.items.filter((it) => !it.error && it.channels.length);
  const seconds = ready.reduce((n, it) => n + it.duration, 0);
  metaEl.textContent = ready.length
    ? t("audioJoiner.meta", { count: String(ready.length), duration: seconds.toFixed(1) })
    : t("audioJoiner.hint");
}

function move(index: number, dir: number): void {
  const next = index + dir;
  if (next < 0 || next >= state.items.length) return;
  const [item] = state.items.splice(index, 1);
  state.items.splice(next, 0, item!);
  refreshList();
}

function remove(index: number): void {
  state.items.splice(index, 1);
  refreshList();
}

function clearItems(): void {
  state.items = [];
  refreshList();
}

async function join(): Promise<void> {
  const ready = state.items.filter((it) => !it.error && it.channels.length);
  if (ready.length < 2) {
    if (statusEl) statusEl.textContent = t("audioJoiner.emptyDownload");
    return;
  }
  if (statusEl) statusEl.textContent = t("audioJoiner.working");
  try {
    const joined = concatClips(ready);
    const wav = encodeWav(joined.channels, joined.sampleRate);
    downloadBlob(blobFromBytes(wav, "audio/wav"), outputFilename(ready[0]!.file.name, "audio/wav", "-join"));
    if (statusEl) statusEl.textContent = "";
  } catch {
    if (statusEl) statusEl.textContent = t("audioJoiner.errorEncode");
  }
}
