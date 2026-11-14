// Copy that only one page shows — a tool's FAQ and how-to, a tutorial's text and FAQ — is kept out of the browser's
// core locale pack and shipped in small bucket chunks instead (vite.config.ts builds them from the same JSON files).
// The Worker and the tests register the full packs (messages-all), so nothing here applies to them.
import type { LocaleMessages } from "./messages";
import type { parseAppPath } from "./path";

type Strings = Record<string, string>;
type Tree = Record<string, unknown>;

/** A tool's FAQ (`ui.faq.<tool>`) and how-to (`guides.tools.<tool>`), for every tool of one bucket. */
export type ToolCopy = { faq: Record<string, Strings>; guides: Record<string, Strings> };
/** A tutorial's text (`ui.learn.<id>`, minus the list fields) and FAQ (`ui.faq.learn.<id>`), for every tutorial of one bucket. */
export type TutorialCopy = { learn: Record<string, Strings>; faq: Record<string, Strings> };
export type CopyKind = "tools" | "tutorials";

/** Chunks per kind and locale. A page downloads one of them: about a sixteenth of that copy. */
export const COPY_BUCKETS = 16;

/** The bucket an id's copy is in (FNV-1a, so the build and the browser agree without a table). */
export function copyBucket(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % COPY_BUCKETS;
}

/** The tool or tutorial whose own copy a page shows. */
export type PageCopy = { tool?: string | null; tutorial?: string | null };

/**
 * The copy a path shows, for the client (what to load), the prerender (what the client will have) and the Worker
 * (what to preload). A tool path covers a shared clip note too: its page writes the clipboard's HowTo JSON-LD.
 */
export function pageCopyOf(parsed: ReturnType<typeof parseAppPath>): PageCopy {
  if (parsed.kind === "app" || parsed.kind === "bare") return { tool: parsed.tool };
  if (parsed.kind === "clip") return { tool: "clip" };
  if (parsed.kind === "markets" || parsed.kind === "bare-markets") return { tool: parsed.market };
  if (parsed.kind === "learn" || parsed.kind === "bare-learn") return { tutorial: parsed.tutorial };
  return {};
}

/** Tutorial fields the core pack keeps: lists and breadcrumbs on other pages show them. */
const LIST_FIELDS = ["name", "blurb"];

function isTree(value: unknown): value is Tree {
  return typeof value === "object" && value !== null;
}

/** Tools are the entries of the how-to file (one per tool; tests/page-copy.test.ts checks it against TOOLS). */
export function copyToolIds(guides: Tree): string[] {
  return Object.keys(isTree(guides.tools) ? guides.tools : {});
}

/** Tutorials are the `learn` entries with a name and a title (the hub and group labels have no name). */
export function copyTutorialIds(ui: Tree): string[] {
  const learn = isTree(ui.learn) ? ui.learn : {};
  return Object.keys(learn).filter((id) => {
    const entry = learn[id];
    return isTree(entry) && typeof entry.name === "string" && typeof entry.title === "string";
  });
}

/** The core pack's `ui`: no tool FAQs, no tutorial FAQs, and only the list fields of each tutorial. */
export function slimUi(ui: Tree, guides: Tree): Tree {
  const tools = new Set(copyToolIds(guides));
  const tutorials = new Set(copyTutorialIds(ui));
  const faq: Tree = {};
  for (const [key, value] of Object.entries(isTree(ui.faq) ? ui.faq : {})) {
    if (key === "learn") faq.learn = {};
    else if (!tools.has(key)) faq[key] = value;
  }
  const learn: Tree = {};
  for (const [key, value] of Object.entries(isTree(ui.learn) ? ui.learn : {})) {
    if (!tutorials.has(key)) learn[key] = value;
    else learn[key] = Object.fromEntries(LIST_FIELDS.filter((field) => field in (value as Tree)).map((field) => [field, (value as Tree)[field]]));
  }
  return { ...ui, faq, learn };
}

/** The core pack's how-to file: the shared heading only. */
export function slimGuides(guides: Tree): Tree {
  return { ...guides, tools: {} };
}

export function toolCopyBucket(ui: Tree, guides: Tree, bucket: number): ToolCopy {
  const copy: ToolCopy = { faq: {}, guides: {} };
  const faq = isTree(ui.faq) ? ui.faq : {};
  const tools = isTree(guides.tools) ? guides.tools : {};
  for (const id of copyToolIds(guides)) {
    if (copyBucket(id) !== bucket) continue;
    if (isTree(faq[id])) copy.faq[id] = faq[id] as Strings;
    copy.guides[id] = tools[id] as Strings;
  }
  return copy;
}

export function tutorialCopyBucket(ui: Tree, bucket: number): TutorialCopy {
  const copy: TutorialCopy = { learn: {}, faq: {} };
  const learn = isTree(ui.learn) ? ui.learn : {};
  const faq = isTree(ui.faq) && isTree(ui.faq.learn) ? ui.faq.learn : {};
  for (const id of copyTutorialIds(ui)) {
    if (copyBucket(id) !== bucket) continue;
    copy.learn[id] = Object.fromEntries(Object.entries(learn[id] as Strings).filter(([field]) => !LIST_FIELDS.includes(field)));
    if (isTree(faq[id])) copy.faq[id] = faq[id] as Strings;
  }
  return copy;
}

/** Puts a bucket's tool copy where the full pack has it, so `faqItems` and `guideText` read it as before. */
export function mergeToolCopy(pack: LocaleMessages, copy: ToolCopy): void {
  Object.assign(pack.ui.faq, copy.faq);
  Object.assign(pack.guides.tools, copy.guides);
}

export function mergeTutorialCopy(pack: LocaleMessages, copy: TutorialCopy): void {
  const learn = pack.ui.learn as unknown as Record<string, Strings>;
  for (const [id, fields] of Object.entries(copy.learn)) learn[id] = { ...learn[id], ...fields };
  Object.assign(pack.ui.faq.learn, copy.faq);
}

/** Whether a pack holds this tool's page copy: always for a full pack, after its bucket was merged for a core pack. */
export function hasToolCopy(pack: LocaleMessages, tool: string): boolean {
  return tool in pack.guides.tools;
}

export function hasTutorialCopy(pack: LocaleMessages, tutorial: string): boolean {
  const entry = (pack.ui.learn as unknown as Record<string, Strings | undefined>)[tutorial];
  // Not a tutorial in this pack at all (an unpublished id): nothing to wait for.
  return !entry || typeof entry !== "object" || "title" in entry;
}

/**
 * What the browser has on one page: the core pack plus the bucket of the page's tool or tutorial. The prerender
 * registers this instead of the full pack, so the markup it writes is what the client will mount.
 */
export function clientPack(full: LocaleMessages, tool: string | null, tutorial: string | null): LocaleMessages {
  const ui = full.ui as unknown as Tree;
  const guides = full.guides as unknown as Tree;
  const pack = { ...full, ui: slimUi(ui, guides), guides: slimGuides(guides) } as unknown as LocaleMessages;
  if (tool) mergeToolCopy(pack, toolCopyBucket(ui, guides, copyBucket(tool)));
  if (tutorial) mergeTutorialCopy(pack, tutorialCopyBucket(ui, copyBucket(tutorial)));
  return pack;
}

/** The module a `virtual:page-copy/<part>/<locale>[/<bucket>]` import loads (vite.config.ts). */
export function pageCopyModule(part: string, ui: Tree, guides: Tree, bucket: number): unknown {
  if (part === "ui") return slimUi(ui, guides);
  if (part === "guides") return slimGuides(guides);
  if (part === "tools") return toolCopyBucket(ui, guides, bucket);
  if (part === "tutorials") return tutorialCopyBucket(ui, bucket);
  throw new Error(`page-copy: unknown part ${part}`);
}

/** Key of the bucket chunk a page's copy is in, in the Worker's preload table (scripts/build-worker.mjs), or null. */
export function copyChunkKey(locale: string, copy: PageCopy): string | null {
  if (copy.tool) return `copy-${locale}/tools-${copyBucket(copy.tool)}`;
  if (copy.tutorial) return `copy-${locale}/tutorials-${copyBucket(copy.tutorial)}`;
  return null;
}

/** Source of `virtual:page-copy/loaders/<locale>`: one dynamic import per bucket, so the count follows COPY_BUCKETS. */
export function copyLoadersSource(locale: string): string {
  const list = (kind: CopyKind): string => Array.from({ length: COPY_BUCKETS }, (_, n) => `() => import("virtual:page-copy/${kind}/${locale}/${n}")`).join(", ");
  return `export const copy = { tools: [${list("tools")}], tutorials: [${list("tutorials")}] };`;
}
