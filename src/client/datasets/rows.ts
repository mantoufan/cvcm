import type { DatasetRows } from "../../shared/datasets";

// One lazy chunk per row file, so a page downloads only its own rows (and the Worker bundles none). Vite and
// esbuild (prerender) both expand this template import to every src/data/*.json; the Worker preloads the
// same chunks by file name (see scripts/build-worker.mjs).
export async function loadRowFile(file: string): Promise<DatasetRows> {
  return ((await import(`../../data/${file}.json`)) as { default: unknown }).default as DatasetRows;
}
