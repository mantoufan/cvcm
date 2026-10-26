import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSitemapIndexXml, buildSitemapXml, SITEMAP_SECTIONS } from "../src/shared/sitemap";

const dir = resolve(process.cwd(), "public/sitemaps");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(process.cwd(), "public/sitemap.xml"), buildSitemapIndexXml());
for (const section of SITEMAP_SECTIONS) {
  writeFileSync(resolve(dir, `${section}.xml`), buildSitemapXml(section));
}
console.log(`wrote public/sitemap.xml and ${SITEMAP_SECTIONS.length} section sitemaps`);
