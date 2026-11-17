import { expect, it } from "vitest";
import { dueForPrune, nextManifest, parseManifest, planSync } from "../scripts/covers-manifest";

const NOW = new Date("2026-11-20T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

it("reads the first manifest format (a bare path → hash map)", () => {
  expect(parseManifest({ "a.jpg": "h1" })).toEqual({ files: { "a.jpg": "h1" }, removed: {} });
  expect(parseManifest({ files: { "a.jpg": "h1" }, removed: { "b.jpg": daysAgo(1) } }).removed).toEqual({ "b.jpg": daysAgo(1) });
  expect(parseManifest(null)).toEqual({ files: {}, removed: {} });
});

it("sorts covers into unchanged, added, edited in place and removed", () => {
  const before = parseManifest({ "keep.jpg": "h1", "edit.jpg": "h2", "gone.jpg": "h3" });
  const plan = planSync(before, { "keep.jpg": "h1", "edit.jpg": "NEW", "new-v2.jpg": "h4" });
  expect(plan).toEqual({ unchanged: ["keep.jpg"], added: ["new-v2.jpg"], edited: ["edit.jpg"], removed: ["gone.jpg"] });
});

it("marks a removed cover once and keeps its first removal date", () => {
  const before = { files: { "a.jpg": "h1", "b.jpg": "h2" }, removed: { "old.jpg": daysAgo(3) } };
  const after = nextManifest(before, { "a.jpg": "h1" }, NOW);
  expect(after.files).toEqual({ "a.jpg": "h1" });
  expect(after.removed).toEqual({ "b.jpg": NOW.toISOString(), "old.jpg": daysAgo(3) });
  // Next run: still gone, date unchanged.
  expect(nextManifest(after, { "a.jpg": "h1" }, new Date(NOW.getTime() + 86_400_000)).removed["b.jpg"]).toBe(NOW.toISOString());
});

it("forgets the removal when a cover comes back", () => {
  const before = { files: {}, removed: { "a.jpg": daysAgo(10) } };
  const after = nextManifest(before, { "a.jpg": "h1" }, NOW);
  expect(after).toEqual({ files: { "a.jpg": "h1" }, removed: {} });
  expect(dueForPrune(after, NOW)).toEqual([]);
});

it("deletes only covers gone for seven days or more", () => {
  const manifest = { files: { "live.jpg": "h" }, removed: { "week.jpg": daysAgo(7), "old.jpg": daysAgo(30), "new.jpg": daysAgo(6), "live.jpg": daysAgo(9) } };
  expect(dueForPrune(manifest, NOW)).toEqual(["old.jpg", "week.jpg"]);
});
