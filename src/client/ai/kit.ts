/** Pieces every AI tool page shares: the model line, download / run progress, the GPU→CPU retry. */
import { AI_MODELS, formatMb, modelBytes, type AiBackend, type AiModelId } from "../../shared/ai-models";
import { h } from "../dom";
import { t } from "../i18n";
import { AiClient, guessBackend, isModelCached, persistStorage } from "./client";
import type { AiRequest, AiResponse } from "./protocol";

/** Distributive Omit, so each request keeps its own fields. */
type Body<T> = T extends unknown ? Omit<T, "id" | "backend"> : never;

export type Status = {
  el: HTMLElement;
  /** A job is running; a background warm-up leaves the line alone. */
  busy: boolean;
  /** Point the size / cached line at the model the next run will use. */
  setModel(id: AiModelId): void;
  /** Download progress in bytes. */
  download(loaded: number, total: number): void;
  /** Work in progress: a label and an optional fraction. */
  working(label: string, fraction?: number): void;
  done(label: string): void;
  error(label: string): void;
  idle(): void;
};

export function deviceLabel(backend: AiBackend): string {
  return backend === "cpu" ? t("ai.cpu") : t("ai.gpu");
}

/**
 * The model line ("BiRefNet · MIT · 102 MB, downloaded once") and one progress bar.
 * Browser-specific parts (GPU or CPU, cached or not) fill in after mount and are marked volatile,
 * so the prerendered page never bakes in the build machine's answer.
 */
export function statusPanel(name: string, initial: AiModelId): Status {
  const size = h("span", { "data-volatile": "" });
  const device = h("span", { "data-volatile": "" });
  const bar = h("progress", { class: "ai-bar", max: "1", value: "0", hidden: true });
  const line = h("p", { class: "status ai-status", "aria-live": "polite" });
  const el = h("div", { class: "ai-panel" },
    h("p", { class: "ai-model" },
      h("strong", null, name),
      h("span", null, ` · ${AI_MODELS[initial].license}`),
      size,
      device,
    ),
    bar,
    line,
  );
  let current = initial;
  let backend: AiBackend | null = null;
  const refresh = async (): Promise<void> => {
    const id = current;
    backend ??= await guessBackend();
    if (id !== current) return;
    const cached = await isModelCached(id, backend);
    if (id !== current) return;
    size.textContent = ` · ${cached ? t("ai.cached") : t("ai.size", { size: formatMb(modelBytes(id, backend)) })}`;
    device.textContent = ` · ${deviceLabel(backend)}`;
  };
  void refresh();
  return {
    el,
    busy: false,
    setModel(id) {
      current = id;
      void refresh();
    },
    download(loaded, total) {
      bar.hidden = false;
      bar.value = total ? loaded / total : 0;
      line.textContent = t("ai.downloading", {
        pct: total ? Math.floor((loaded / total) * 100) : 0,
        done: formatMb(loaded),
        total: formatMb(total),
      });
    },
    working(label, fraction) {
      bar.hidden = false;
      if (fraction === undefined) bar.removeAttribute("value");
      else bar.value = fraction;
      line.textContent = label;
    },
    done(label) {
      bar.hidden = true;
      line.textContent = label;
      void refresh();
    },
    error(label) {
      bar.hidden = true;
      line.textContent = label;
    },
    idle() {
      bar.hidden = true;
      line.textContent = "";
    },
  };
}

export type RunHooks = {
  onRun?: (backend: AiBackend) => void;
  onTiles?: (done: number, total: number) => void;
  onText?: (text: string) => void;
  onLanguage?: (code: string) => void;
};

/**
 * One job with the status panel wired up. If the GPU path fails (driver limits, lost device), the same job
 * runs again on the CPU. `make` builds the request each time: transferred buffers cannot be sent twice.
 */
export async function runJob<T extends AiResponse>(
  client: AiClient,
  status: Status,
  make: () => Promise<{ body: Body<AiRequest>; transfer?: Transferable[] }>,
  hooks: RunHooks = {},
): Promise<{ result: T; backend: AiBackend; seconds: number }> {
  const attempt = async (force?: AiBackend): Promise<{ result: T; backend: AiBackend; seconds: number }> => {
    const { body, transfer } = await make();
    let backend: AiBackend = force ?? (await guessBackend());
    let started = performance.now();
    status.working(t("ai.starting"));
    const request = { ...body, backend: force } as unknown as Parameters<AiClient["run"]>[0];
    const result = (await client.run(request, {
      onProgress: (loaded, total) => status.download(loaded, total),
      onRun: (b) => {
        backend = b;
        started = performance.now();
        status.working(t("ai.running", { device: deviceLabel(b) }));
        persistStorage();
        hooks.onRun?.(b);
      },
      onTiles: (done, total) => {
        status.working(t("ai.runningPart", { device: deviceLabel(backend), done, total }), done / total);
        hooks.onTiles?.(done, total);
      },
      onText: hooks.onText,
      onLanguage: hooks.onLanguage,
    }, transfer)) as T;
    return { result, backend, seconds: (performance.now() - started) / 1000 };
  };
  status.busy = true;
  try {
    return await attempt();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "cancelled" || (await guessBackend()) === "cpu") throw err;
    console.warn("GPU run failed, retrying on the CPU:", message);
    return await attempt("cpu");
  } finally {
    status.busy = false;
  }
}

/** Seconds for the "Done in 2.4 s" line. */
export function formatSeconds(s: number): string {
  return s < 10 ? s.toFixed(1) : String(Math.round(s));
}

/** The file picker + drop target used by every AI tool. `onIntent` fires on first hover / focus / tap. */
export function dropZone(opts: {
  id: string;
  accept: string;
  multiple?: boolean;
  title: string;
  hint: string;
  types: string;
  onFiles: (files: File[]) => void;
  onIntent?: () => void;
}): HTMLElement {
  const input = h("input", {
    type: "file",
    accept: opts.accept,
    multiple: opts.multiple ?? false,
    class: "sr-only",
    id: opts.id,
    onChange: (e: Event) => {
      const el = e.target as HTMLInputElement;
      const files = [...(el.files || [])];
      el.value = "";
      if (files.length) opts.onFiles(files);
    },
  });
  let intent = false;
  const warm = (): void => {
    if (intent) return;
    intent = true;
    opts.onIntent?.();
  };
  const drop = h("label", {
    class: "drop",
    for: opts.id,
    onPointerenter: warm,
    onFocusin: warm,
    onTouchstart: warm,
    onDragenter: warm,
    onDragover: (e: Event) => {
      e.preventDefault();
      drop.classList.add("over");
    },
    onDragleave: () => drop.classList.remove("over"),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      drop.classList.remove("over");
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) opts.onFiles(files);
    },
  },
    input,
    h("strong", null, opts.title),
    h("span", null, opts.hint),
    h("em", null, opts.types),
  );
  return drop;
}

/** Models this small download on first hover; bigger ones wait for a file (no surprise downloads on mobile data). */
const EAGER_BYTES = 30_000_000;

/**
 * Load a model while the visitor is still choosing a file: compile it if it is already cached, or download it
 * first if it is small. Errors are left for the real run to report.
 */
export async function prewarm(client: AiClient, model: AiModelId, status: Status): Promise<void> {
  const backend = await guessBackend();
  if (modelBytes(model, backend) > EAGER_BYTES && !(await isModelCached(model, backend))) return;
  const quiet = (): void => {
    if (!status.busy) status.idle();
  };
  client.run({ type: "warm", model }, {
    onProgress: (loaded, total) => {
      if (!status.busy) status.download(loaded, total);
    },
  }).then(quiet, quiet);
}
