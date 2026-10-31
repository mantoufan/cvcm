import type { DatasetRows } from "../../shared/datasets";

// One lazy chunk per row file, so a page downloads only its own rows (and the Worker bundles none).
// The Worker preloads the same chunks by file name (see scripts/build-worker.mjs). A test keeps this list
// equal to the files DATASET_FILES names (src/data also holds meta.json and ref-photos.json, which are not rows).
export const ROW_FILES: Record<string, () => Promise<{ default: unknown }>> = {
  population: () => import("../../data/population.json"),
  gdp: () => import("../../data/gdp.json"),
  "gdp-per-capita": () => import("../../data/gdp-per-capita.json"),
  "life-expectancy": () => import("../../data/life-expectancy.json"),
  "fertility-rate": () => import("../../data/fertility-rate.json"),
  "internet-users": () => import("../../data/internet-users.json"),
  "gdp-ppp-per-capita": () => import("../../data/gdp-ppp-per-capita.json"),
  "gdp-growth": () => import("../../data/gdp-growth.json"),
  inflation: () => import("../../data/inflation.json"),
  unemployment: () => import("../../data/unemployment.json"),
  "land-area": () => import("../../data/land-area.json"),
  "population-density": () => import("../../data/population-density.json"),
  "urban-population": () => import("../../data/urban-population.json"),
  "aged-65-plus": () => import("../../data/aged-65-plus.json"),
  "birth-rate": () => import("../../data/birth-rate.json"),
  "infant-mortality": () => import("../../data/infant-mortality.json"),
  "co2-per-capita": () => import("../../data/co2-per-capita.json"),
  "electricity-access": () => import("../../data/electricity-access.json"),
  "population-growth": () => import("../../data/population-growth.json"),
  "death-rate": () => import("../../data/death-rate.json"),
  "life-expectancy-male": () => import("../../data/life-expectancy-male.json"),
  "life-expectancy-female": () => import("../../data/life-expectancy-female.json"),
  "maternal-mortality": () => import("../../data/maternal-mortality.json"),
  exports: () => import("../../data/exports.json"),
  imports: () => import("../../data/imports.json"),
  "health-spending-per-capita": () => import("../../data/health-spending-per-capita.json"),
  "female-labor-force": () => import("../../data/female-labor-force.json"),
  "forest-area": () => import("../../data/forest-area.json"),
  "renewable-energy": () => import("../../data/renewable-energy.json"),
  countries: () => import("../../data/countries.json"),
  currencies: () => import("../../data/currencies.json"),
  "time-zones": () => import("../../data/time-zones.json"),
  "paper-sizes": () => import("../../data/paper-sizes.json"),
  ascii: () => import("../../data/ascii.json"),
};

export async function loadRowFile(file: string): Promise<DatasetRows> {
  return (await ROW_FILES[file]()).default as DatasetRows;
}
