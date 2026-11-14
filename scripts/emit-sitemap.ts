import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import "../src/shared/messages-all";
import "../src/shared/kb-code-meta";
import "../src/shared/kb-ai-meta";
import { buildLlmsTxt, buildPoppyJson, buildToolsJson } from "../src/shared/agent-docs";
import { buildAllSearchIndexes } from "../src/shared/search-index";
import { buildSectionSitemaps, buildSitemapIndexXml, SITEMAP_SECTIONS } from "../src/shared/sitemap";

// Start from an empty folder so a renamed or dropped section leaves no stale file behind.
const dir = resolve(process.cwd(), "public/sitemaps");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(process.cwd(), "public/sitemap.xml"), buildSitemapIndexXml());
const sections = buildSectionSitemaps();
for (const section of SITEMAP_SECTIONS) writeFileSync(resolve(dir, `${section}.xml`), sections[section]);
console.log(`wrote public/sitemap.xml and ${SITEMAP_SECTIONS.length} section sitemaps`);

// Agent discovery files, generated from the same tool registry.
mkdirSync(resolve(process.cwd(), "public/.well-known"), { recursive: true });
writeFileSync(resolve(process.cwd(), "public/llms.txt"), buildLlmsTxt());
writeFileSync(resolve(process.cwd(), "public/tools.json"), buildToolsJson());
writeFileSync(resolve(process.cwd(), "public/.well-known/poppy.json"), buildPoppyJson());
console.log("wrote public/llms.txt, public/tools.json and public/.well-known/poppy.json");

// Site search index: one JSON per locale, imported by src/client/search.ts as its own chunk (gitignored, rebuilt every build).
const searchDir = resolve(process.cwd(), "src/generated/search");
rmSync(searchDir, { recursive: true, force: true });
mkdirSync(searchDir, { recursive: true });
const indexes = buildAllSearchIndexes();
for (const [locale, entries] of Object.entries(indexes)) writeFileSync(resolve(searchDir, `${locale}.json`), JSON.stringify(entries));
console.log(`wrote src/generated/search/*.json (${Object.values(indexes)[0].length} pages per locale)`);
