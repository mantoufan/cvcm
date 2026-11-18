import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every module the client entry reaches through static imports (dynamic import() starts a separate chunk). */
function reachableFromMain(): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(join(root, file), "utf8");
    // One statement at a time (never past its ";"), either quote style, ".js" specifiers too; type-only imports
    // never reach a bundle.
    for (const m of text.matchAll(/^\s*(?:import|export)\b([^;]*?)\bfrom\s*(["'])(\.{1,2}\/[^"']+)\2|^\s*import\s*(["'])(\.{1,2}\/[^"']+)\4/gm)) {
      if (m[1] !== undefined && /^\s*type\s/.test(m[1])) continue;
      const spec = (m[3] ?? m[5]).replace(/\.js$/, "");
      const base = join(dirname(file), spec);
      const target = [`${base}.ts`, `${base}/index.ts`, base].find((p) => /\.(ts|json)$/.test(p) && existsSync(join(root, p)));
      if (target?.endsWith(".ts")) walk(target);
    }
  };
  walk("src/client/main.ts");
  return seen;
}

/** The channel page modules (`<channel>-page.ts`, see AGENTS.md) and the block helpers only they use. */
const PAGE_MODULES = [
  ...readdirSync(join(root, "src/shared")).filter((f) => /^[a-z-]+-page\.ts$/.test(f)).map((f) => `src/shared/${f}`),
  "src/shared/article-html.ts",
];

/** Top-level functions and constants a module declares (`exported`: only its exports). */
const declared = (file: string, exported = false): string[] =>
  [...readFileSync(join(root, file), "utf8").matchAll(/^(export )?(?:async )?(?:function|const|let|var|class) ([A-Za-z_$][\w$]*)/gm)]
    .filter((m) => !exported || m[1])
    .map((m) => m[2]);

/**
 * A page module's exported HTML builders, by naming convention: generic helpers such as `pct` are left out, and so are
 * private helpers (other channels have their own `crumbHtml` / `faqHtml`).
 */
const isBuilder = (name: string): boolean => /(Html|Svg|VoteResult)$/.test(name);

describe("bundle split", () => {
  it("keeps the channel page HTML builders and the Worker-only head module out of the main bundle", () => {
    const seen = reachableFromMain();
    expect(PAGE_MODULES).toEqual(expect.arrayContaining([...["kb", "ref", "slang", "nostalgia", "summaries", "ideas", "calories"].map((m) => `src/shared/${m}-page.ts`), "src/shared/article-html.ts"]));
    // The head helpers stay reachable (titles, descriptions, JSON-LD); the page modules and seo-html.ts do not.
    for (const m of ["kb", "ref", "slang", "nostalgia", "summaries", "ideas", "calories"]) expect(seen.has(`src/shared/${m}-i18n.ts`), m).toBe(true);
    expect(PAGE_MODULES.filter((f) => seen.has(f))).toEqual([]);
    expect(seen.has("src/shared/seo-html.ts")).toBe(false);
  });

  it("does not declare a page module's builders again in a module the main bundle reaches", () => {
    // Catches a renderer copied (or moved back) into an i18n module under its old name, not only an import of the page module.
    const builders = new Set(PAGE_MODULES.flatMap((file) => declared(file, true)).filter(isBuilder));
    for (const name of ["kbPageHtml", "refPageHtml", "slangPageHtml", "nostalgiaPageHtml", "ideasPageHtml", "nostalgiaVoteResult", "summariesPageHtml", "caloriesPageHtml"]) expect(builders.has(name), name).toBe(true);
    const clashes = [...reachableFromMain()].flatMap((file) => declared(file).filter((name) => builders.has(name)).map((name) => `${file}: ${name}`));
    expect(clashes).toEqual([]);
  });
});
