import { expect, it } from "vitest";
import { dueForPrune, nextManifest, parseManifest, planSync, type Manifest } from "../scripts/covers-manifest";

const NOW = new Date("2026-11-20T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const gone = (days: number, hash = "h") => ({ at: daysAgo(days), hash });

it("reads the first manifest format (a bare path → hash map)", () => {
  expect(parseManifest({ "a.jpg": "h1" })).toEqual({ files: { "a.jpg": "h1" }, removed: {} });
  expect(parseManifest({ files: { "a.jpg": "h1" }, removed: { "b.jpg": gone(1) } }).removed).toEqual({ "b.jpg": gone(1) });
  expect(parseManifest(null)).toEqual({ files: {}, removed: {} });
});

it("sorts covers into unchanged, added, edited in place and removed", () => {
  const before = parseManifest({ "keep.jpg": "h1", "edit.jpg": "h2", "gone.jpg": "h3" });
  const plan = planSync(before, { "keep.jpg": "h1", "edit.jpg": "NEW", "new-v2.jpg": "h4" });
  expect(plan).toEqual({ unchanged: ["keep.jpg"], added: ["new-v2.jpg"], edited: ["edit.jpg"], removed: ["gone.jpg"] });
});

it("treats a removed cover put back with other content as edited in place, with the same content as unchanged", () => {
  const before: Manifest = { files: {}, removed: { "a.jpg": gone(2, "old") } };
  expect(planSync(before, { "a.jpg": "new" }).edited).toEqual(["a.jpg"]);
  expect(planSync(before, { "a.jpg": "old" }).unchanged).toEqual(["a.jpg"]);
});

it("marks a removed cover once, with its hash, and keeps its first removal date", () => {
  const before: Manifest = { files: { "a.jpg": "h1", "b.jpg": "h2" }, removed: { "old.jpg": gone(3) } };
  const after = nextManifest(before, { "a.jpg": "h1" }, NOW);
  expect(after.files).toEqual({ "a.jpg": "h1" });
  expect(after.removed).toEqual({ "b.jpg": { at: NOW.toISOString(), hash: "h2" }, "old.jpg": gone(3) });
  // Next run: still gone, date unchanged.
  expect(nextManifest(after, { "a.jpg": "h1" }, new Date(NOW.getTime() + 86_400_000)).removed["b.jpg"].at).toBe(NOW.toISOString());
});

it("forgets the removal when a cover comes back", () => {
  const before: Manifest = { files: {}, removed: { "a.jpg": gone(10, "h1") } };
  const after = nextManifest(before, { "a.jpg": "h1" }, NOW);
  expect(after).toEqual({ files: { "a.jpg": "h1" }, removed: {} });
  expect(dueForPrune(after, NOW)).toEqual([]);
});

it("deletes only covers gone for seven days or more", () => {
  const manifest: Manifest = {
    files: { "live.jpg": "h" },
    removed: { "week.jpg": gone(7), "old.jpg": gone(30), "new.jpg": gone(6), "live.jpg": gone(9) },
  };
  expect(dueForPrune(manifest, NOW)).toEqual(["old.jpg", "week.jpg"]);
});

it("keeps a pruned name's hash for good: same bytes upload again, other bytes are an in-place edit", () => {
  const pruned: Manifest = { files: {}, removed: { "a.jpg": { at: daysAgo(30), hash: "h1", deleted: true } } };
  expect(dueForPrune(pruned, NOW)).toEqual([]);
  expect(planSync(pruned, { "a.jpg": "h1" }).added).toEqual(["a.jpg"]);
  expect(planSync(pruned, { "a.jpg": "h2" }).edited).toEqual(["a.jpg"]);
  // Back with the same bytes, then removed again: a new week, then pruned again.
  const back = nextManifest(pruned, { "a.jpg": "h1" }, NOW);
  expect(back.files).toEqual({ "a.jpg": "h1" });
  expect(planSync(back, { "a.jpg": "h1" }).unchanged).toEqual(["a.jpg"]);
  const later = new Date(NOW.getTime() + 86_400_000);
  const goneAgain = nextManifest(back, {}, later);
  expect(goneAgain.removed["a.jpg"]).toEqual({ at: later.toISOString(), hash: "h1" });
  expect(dueForPrune(goneAgain, new Date(later.getTime() + 8 * 86_400_000))).toEqual(["a.jpg"]);
});
