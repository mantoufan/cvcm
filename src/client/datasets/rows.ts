import type { DatasetId, DatasetRows } from "../../shared/datasets";

// One lazy chunk per table, so a page downloads only its own rows (and the Worker bundles none).
const ROWS: Record<DatasetId, () => Promise<{ default: unknown }>> = {
  population: () => import("../../data/population.json"),
  gdp: () => import("../../data/gdp.json"),
  "gdp-per-capita": () => import("../../data/gdp-per-capita.json"),
  "life-expectancy": () => import("../../data/life-expectancy.json"),
  "fertility-rate": () => import("../../data/fertility-rate.json"),
  "internet-users": () => import("../../data/internet-users.json"),
  "country-codes": () => import("../../data/countries.json"),
  "calling-codes": () => import("../../data/countries.json"),
  "currency-codes": () => import("../../data/currencies.json"),
  "time-zones": () => import("../../data/time-zones.json"),
  "paper-sizes": () => import("../../data/paper-sizes.json"),
  ascii: () => import("../../data/ascii.json"),
};

export async function loadDatasetRows(id: DatasetId): Promise<DatasetRows> {
  return (await ROWS[id]()).default as DatasetRows;
}
