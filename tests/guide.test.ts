import { describe, expect, it } from "vitest";
import en from "../src/locales/guides/en.json";
import es from "../src/locales/guides/es.json";
import id from "../src/locales/guides/id.json";
import ja from "../src/locales/guides/ja.json";
import ko from "../src/locales/guides/ko.json";
import vi from "../src/locales/guides/vi.json";
import zhCN from "../src/locales/guides/zh-CN.json";
import zhTW from "../src/locales/guides/zh-TW.json";
import { GUIDE_STEP_COUNT, guideImage, guideText, toolHowToJsonLd } from "../src/shared/guide";
import { TOOLS } from "../src/shared/path";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("tool guides", () => {
  it("covers every tool with matching locale keys", () => {
    const tables = [
      { name: "en", keys: keys(en).sort() },
      { name: "zh-CN", keys: keys(zhCN).sort() },
      { name: "zh-TW", keys: keys(zhTW).sort() },
      { name: "ja", keys: keys(ja).sort() },
      { name: "ko", keys: keys(ko).sort() },
      { name: "vi", keys: keys(vi).sort() },
      { name: "id", keys: keys(id).sort() },
      { name: "es", keys: keys(es).sort() },
    ];
    const baseline = tables[0].keys;
    for (const table of tables) {
      expect(table.keys, table.name).toEqual(baseline);
    }
    for (const tool of TOOLS) {
      expect(GUIDE_STEP_COUNT[tool], tool).toBeGreaterThanOrEqual(3);
      expect(guideText("en", `tools.${tool}.lead`).length, tool).toBeGreaterThan(20);
      expect(guideText("zh-CN", `tools.${tool}.s1t`).length, tool).toBeGreaterThan(2);
    }
  });

  it("names a screenshot path for every tested step", () => {
    for (const tool of TOOLS) {
      const count = GUIDE_STEP_COUNT[tool];
      for (let i = 1; i <= count; i++) {
        expect(guideText("en", `tools.${tool}.s${i}t`).length, `${tool} s${i}t`).toBeGreaterThan(2);
        expect(guideText("en", `tools.${tool}.s${i}b`).length, `${tool} s${i}b`).toBeGreaterThan(8);
        const file = String(i).padStart(2, "0");
        expect(guideImage(tool, i).split("?")[0]).toMatch(
          new RegExp(`^/covers/guides/${tool}/${file}(\\.v\\d+)?\\.jpg$`),
        );
      }
      expect(guideText("en", `tools.${tool}.s${count + 1}t`)).toBe(`tools.${tool}.s${count + 1}t`);
    }
  });

  it("emits HowTo JSON-LD with images", () => {
    const ld = toolHowToJsonLd("en", "password");
    expect(ld["@type"]).toBe("HowTo");
    const steps = ld.step as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(GUIDE_STEP_COUNT.password);
    expect(String(steps[0].image)).toContain("/covers/guides/password/01.jpg");
    expect(String(steps[0].url)).toContain("/en/password/#guide-step-1");
  });
});
