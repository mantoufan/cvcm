import type { DatasetRows } from "../../shared/datasets";

// One lazy chunk per row file, so a page downloads only its own rows (and the Worker bundles none).
// The Worker preloads the same chunks by file name (see scripts/build-worker.mjs).
const FILES: Record<string, () => Promise<{ default: unknown }>> = {
  population: () => import("../../data/population.json"),
  gdp: () => import("../../data/gdp.json"),
  "gdp-per-capita": () => import("../../data/gdp-per-capita.json"),
  "life-expectancy": () => import("../../data/life-expectancy.json"),
  "fertility-rate": () => import("../../data/fertility-rate.json"),
  "internet-users": () => import("../../data/internet-users.json"),
  countries: () => import("../../data/countries.json"),
  currencies: () => import("../../data/currencies.json"),
  "time-zones": () => import("../../data/time-zones.json"),
  "paper-sizes": () => import("../../data/paper-sizes.json"),
  ascii: () => import("../../data/ascii.json"),
};

export async function loadRowFile(file: string): Promise<DatasetRows> {
  return (await FILES[file]()).default as DatasetRows;
}
