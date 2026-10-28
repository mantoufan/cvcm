import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSectionSitemaps, buildSitemapIndexXml, SITEMAP_SECTIONS } from "../src/shared/sitemap";

// Start from an empty folder so a renamed or dropped section leaves no stale file behind.
const dir = resolve(process.cwd(), "public/sitemaps");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(process.cwd(), "public/sitemap.xml"), buildSitemapIndexXml());
const sections = buildSectionSitemaps();
for (const section of SITEMAP_SECTIONS) writeFileSync(resolve(dir, `${section}.xml`), sections[section]);
console.log(`wrote public/sitemap.xml and ${SITEMAP_SECTIONS.length} section sitemaps`);
