import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/shared/locale";
import { messages } from "../src/shared/messages";
import { preloadLocalePack } from "../src/shared/locale-preload";
import { TOOLS, TUTORIALS, isPublishedTutorial } from "../src/shared/path";
import {
  COPY_BUCKETS,
  clientPack,
  copyBucket,
  copyChunkKey,
  copyToolIds,
  copyTutorialIds,
  hasToolCopy,
  hasTutorialCopy,
  mergeToolCopy,
  mergeTutorialCopy,
  slimGuides,
  slimUi,
  toolCopyBucket,
  tutorialCopyBucket,
} from "../src/shared/page-copy";
import type { LocaleMessages } from "../src/shared/messages";

type Tree = Record<string, unknown>;
const tree = (value: unknown): Tree => value as Tree;

// tests/setup.ts registers the full packs, as the Worker does.
describe("page copy buckets", () => {
  it("finds exactly the tools and tutorials in every locale", () => {
    for (const locale of LOCALES) {
      const full = messages(locale);
      expect(copyToolIds(tree(full.guides)).sort(), `${locale} tools`).toEqual([...TOOLS].sort());
      // Every tutorial with copy is a known id, and every published tutorial has copy (unpublished ids have none).
      const tutorials = copyTutorialIds(tree(full.ui));
      expect(tutorials.filter((id) => !(TUTORIALS as readonly string[]).includes(id)), `${locale} unknown tutorials`).toEqual([]);
      expect(TUTORIALS.filter((id) => isPublishedTutorial(id) && !tutorials.includes(id)), `${locale} tutorials without copy`).toEqual([]);
    }
  });

  it("puts every id in one bucket, the same on every run", () => {
    expect(copyBucket("json")).toBe(copyBucket("json"));
    for (const id of [...TOOLS, ...TUTORIALS]) {
      const bucket = copyBucket(id);
      expect(Number.isInteger(bucket) && bucket >= 0 && bucket < COPY_BUCKETS, id).toBe(true);
    }
    // Spread out: no bucket carries more than a fifth of the tools.
    const sizes = new Array<number>(COPY_BUCKETS).fill(0);
    for (const id of TOOLS) sizes[copyBucket(id)] += 1;
    expect(Math.max(...sizes)).toBeLessThan(TOOLS.length / 5);
  });

  it("the core pack plus every bucket is the full pack", () => {
    for (const locale of LOCALES) {
      const full = messages(locale);
      const ui = tree(full.ui);
      const guides = tree(full.guides);
      const pack = { ...full, ui: slimUi(ui, guides), guides: slimGuides(guides) } as unknown as LocaleMessages;
      for (let bucket = 0; bucket < COPY_BUCKETS; bucket++) {
        mergeToolCopy(pack, toolCopyBucket(ui, guides, bucket));
        mergeTutorialCopy(pack, tutorialCopyBucket(ui, bucket));
      }
      expect(pack.guides, `${locale} guides`).toEqual(full.guides);
      expect(pack.ui, `${locale} ui`).toEqual(full.ui);
    }
  });

  it("the core pack keeps list names and drops page copy", () => {
    const full = messages("en");
    const pack = clientPack(full, null, null);
    expect(pack.ui.learn["make-qr"].name).toBe(full.ui.learn["make-qr"].name);
    expect(pack.ui.learn["make-qr"].blurb).toBe(full.ui.learn["make-qr"].blurb);
    expect("title" in pack.ui.learn["make-qr"]).toBe(false);
    expect("json" in pack.ui.faq).toBe(false);
    expect(Object.keys(pack.ui.faq.learn)).toEqual([]);
    expect(Object.keys(pack.guides.tools)).toEqual([]);
    // Shared FAQ blocks are not page copy.
    expect(pack.ui.faq.title).toBe(full.ui.faq.title);
    expect(pack.ui.faq.games).toEqual(full.ui.faq.games);
    expect(pack.ui.faq.convertJobs).toEqual(full.ui.faq.convertJobs);
    expect(hasToolCopy(pack, "json")).toBe(false);
    expect(hasTutorialCopy(pack, "make-qr")).toBe(false);
    // The full pack is never changed by cutting or merging.
    expect(full.ui.faq.json.q1).toBeTruthy();
    expect(full.guides.tools.json.lead).toBeTruthy();
  });

  it("a page's client pack has that page's copy", () => {
    for (const locale of LOCALES) {
      const full = messages(locale);
      const tool = clientPack(full, "json", null);
      expect(hasToolCopy(tool, "json")).toBe(true);
      expect(tool.ui.faq.json).toEqual(full.ui.faq.json);
      expect(tool.guides.tools.json).toEqual(full.guides.tools.json);
      expect(hasTutorialCopy(tool, "make-qr")).toBe(false);
      const lesson = clientPack(full, null, "make-qr");
      expect(hasTutorialCopy(lesson, "make-qr")).toBe(true);
      expect(lesson.ui.learn["make-qr"]).toEqual(full.ui.learn["make-qr"]);
      expect(lesson.ui.faq.learn["make-qr"]).toEqual(full.ui.faq.learn["make-qr"]);
      expect(hasToolCopy(lesson, "json")).toBe(false);
    }
  });

  it("full packs always have every page's copy", () => {
    const full = messages("ja");
    for (const id of TOOLS) expect(hasToolCopy(full, id), id).toBe(true);
    for (const id of TUTORIALS) expect(hasTutorialCopy(full, id), id).toBe(true);
  });

  it("preloads the page's bucket chunk", () => {
    const key = copyChunkKey("tools", "ja", "json");
    expect(key).toBe(`copy-ja/tools-${copyBucket("json")}`);
    const packs = { ja: ["/assets/ja-1.js"], "copy-ja": ["/assets/copy-ja-t.js"], [key]: ["/assets/copy-tools-ja-x.js"] };
    const page = preloadLocalePack("<head></head>", "ja", false, packs, false, false, null, null, null, key);
    expect(page).toContain('href="/assets/ja-1.js"');
    expect(page).toContain('href="/assets/copy-ja-t.js"');
    expect(page).toContain('href="/assets/copy-tools-ja-x.js"');
    expect(preloadLocalePack("<head></head>", "ja", false, packs)).not.toContain("copy-");
  });
});
