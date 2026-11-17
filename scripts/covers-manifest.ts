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
  /** Path under covers/ → when it left public/covers (ISO time) and the hash it had. */
  removed: Record<string, Removed>;
};

/**
 * `deleted`: pruned from the bucket. The entry is kept for good, so the name can never come back with other bytes
 * (returning visitors would keep the old ones for a year).
 */
export type Removed = { at: string; hash: string; deleted?: boolean };

/** The stored manifest; the first version was a bare path → hash map. */
export function parseManifest(json: unknown): Manifest {
  if (!json || typeof json !== "object") return { files: {}, removed: {} };
  const value = json as Partial<Manifest> & Record<string, unknown>;
  if (value.files && typeof value.files === "object") {
    const removed: Record<string, Removed> = {};
    for (const [rel, entry] of Object.entries(value.removed ?? {})) {
      removed[rel] = typeof entry === "string" ? { at: entry, hash: "" } : entry;
    }
    return { files: { ...value.files }, removed };
  }
  return { files: { ...(json as Record<string, string>) }, removed: {} };
}

export type SyncPlan = {
  /** Same path and content as the manifest: nothing to do. */
  unchanged: string[];
  /** Not in the manifest: check the bucket (HEAD) and upload unless the same file is already there. */
  added: string[];
  /**
   * In the manifest (or removed but not yet deleted) with other content: published files never change, so this is
   * an error. A removed file that comes back with the same content is unchanged.
   */
  edited: string[];
  /** In the manifest but no longer in public/covers: newly marked removed. */
  removed: string[];
};

/** Compare public/covers (path → hash) with the manifest. */
export function planSync(before: Manifest, local: Record<string, string>): SyncPlan {
  // A known hash of "" (a removal recorded before hashes were kept) cannot be compared: treat the file as added.
  const plan: SyncPlan = { unchanged: [], added: [], edited: [], removed: [] };
  for (const [rel, hash] of Object.entries(local)) {
    const gone = before.removed[rel];
    const known = before.files[rel] ?? (gone?.hash || undefined);
    if (known === undefined) plan.added.push(rel);
    else if (known !== hash) plan.edited.push(rel);
    // Pruned: same bytes, but no longer on the bucket.
    else if (!(rel in before.files) && gone?.deleted) plan.added.push(rel);
    else plan.unchanged.push(rel);
  }
  for (const rel of Object.keys(before.files)) if (!(rel in local)) plan.removed.push(rel);
  return plan;
}

/** The manifest after a sync: `files` is what public/covers holds now; removals keep their first date. */
export function nextManifest(before: Manifest, local: Record<string, string>, now: Date): Manifest {
  const removed: Record<string, Removed> = {};
  for (const [rel, entry] of Object.entries(before.removed)) {
    // Back in public/covers: forget a pending removal, keep a pruned name's tombstone.
    if (!(rel in local) || entry.deleted) removed[rel] = entry;
  }
  for (const [rel, hash] of Object.entries(before.files)) {
    // A fresh removal (a pruned name that came back and left again starts its week anew).
    if (!(rel in local) && (!(rel in removed) || removed[rel].deleted)) removed[rel] = { at: now.toISOString(), hash };
  }
  return { files: sortKeys(local), removed: sortKeys(removed) };
}

/** Removed files old enough to delete from the bucket (not deleted yet). */
export function dueForPrune(manifest: Manifest, now: Date, days = PRUNE_AFTER_DAYS): string[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return Object.entries(manifest.removed)
    .filter(([rel, entry]) => !(rel in manifest.files) && !entry.deleted && Date.parse(entry.at) <= cutoff)
    .map(([rel]) => rel)
    .sort();
}

export function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}
