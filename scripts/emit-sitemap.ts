import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSitemapXml } from "../src/shared/sitemap";

const xml = buildSitemapXml(new Date().toISOString().slice(0, 10));
writeFileSync(resolve(process.cwd(), "public/sitemap.xml"), xml);
console.log("wrote public/sitemap.xml");
