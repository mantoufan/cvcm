import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import "../src/shared/kb-code-meta";
import { buildLlmsTxt, buildPoppyJson, buildToolsJson } from "../src/shared/agent-docs";
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
