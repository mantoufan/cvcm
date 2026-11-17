/**
 * What scripts/sync-covers.ts does with the bucket, worked out from the manifest (files/covers/.manifest.json) and
 * public/covers/. Pure, so tests/covers-manifest.test.ts can check the rules:
 *
 * - Covers are cached for a year (immutable), so a published file never changes: an edited cover gets a new name
 *   with a version (`qr-sweet-v2.jpg`). A known file whose content changed stops the deploy.
 * - A file removed from public/covers is marked removed, and deleted from the bucket once it has been gone for
 *   PRUNE_AFTER_DAYS (cached pages and a rollback may still need it until then).
 */
export const PRUNE_AFTER_DAYS = 7;

export type Manifest = {
  /** Path under covers/ → SHA-256 of what was uploaded. */
  files: Record<string, string>;
  /** Path under covers/ → when it left public/covers (ISO time). */
  removed: Record<string, string>;
};

/** The stored manifest; the first version was a bare path → hash map. */
export function parseManifest(json: unknown): Manifest {
  if (!json || typeof json !== "object") return { files: {}, removed: {} };
  const value = json as Partial<Manifest> & Record<string, unknown>;
  if (value.files && typeof value.files === "object") {
    return { files: { ...value.files }, removed: { ...(value.removed ?? {}) } };
  }
  return { files: { ...(json as Record<string, string>) }, removed: {} };
}

export type SyncPlan = {
  /** Same path and content as the manifest: nothing to do. */
  unchanged: string[];
  /** Not in the manifest: check the bucket (HEAD) and upload unless the same file is already there. */
  added: string[];
  /** In the manifest with other content: published files never change, so this is an error. */
  edited: string[];
  /** In the manifest but no longer in public/covers: newly marked removed. */
  removed: string[];
};

/** Compare public/covers (path → hash) with the manifest. */
export function planSync(before: Manifest, local: Record<string, string>): SyncPlan {
  const plan: SyncPlan = { unchanged: [], added: [], edited: [], removed: [] };
  for (const [rel, hash] of Object.entries(local)) {
    const known = before.files[rel];
    if (known === undefined) plan.added.push(rel);
    else if (known === hash) plan.unchanged.push(rel);
    else plan.edited.push(rel);
  }
  for (const rel of Object.keys(before.files)) if (!(rel in local)) plan.removed.push(rel);
  return plan;
}

/** The manifest after a sync: `files` is what public/covers holds now; removals keep their first date. */
export function nextManifest(before: Manifest, local: Record<string, string>, now: Date): Manifest {
  const removed: Record<string, string> = {};
  for (const [rel, at] of Object.entries(before.removed)) if (!(rel in local)) removed[rel] = at;
  for (const rel of Object.keys(before.files)) if (!(rel in local) && !(rel in removed)) removed[rel] = now.toISOString();
  return { files: sortKeys(local), removed: sortKeys(removed) };
}

/** Removed files old enough to delete from the bucket. */
export function dueForPrune(manifest: Manifest, now: Date, days = PRUNE_AFTER_DAYS): string[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return Object.entries(manifest.removed)
    .filter(([rel, at]) => !(rel in manifest.files) && Date.parse(at) <= cutoff)
    .map(([rel]) => rel)
    .sort();
}

export function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
