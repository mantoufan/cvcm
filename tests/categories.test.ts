import { describe, expect, it } from "vitest";
import { CATEGORIES, TOOLS } from "../src/shared/path";

describe("tool categories", () => {
  it("puts every tool in exactly one category", () => {
    const listed = CATEGORIES.flatMap((c) => [...c.tools] as string[]);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...TOOLS].sort());
  });

  it("keeps categories small enough to scan (no catch-all group)", () => {
    for (const c of CATEGORIES) expect(c.tools.length, c.id).toBeLessThanOrEqual(20);
  });
});
