import { describe, expect, it } from "vitest";
import en from "../src/locales/en.json";
import ja from "../src/locales/ja.json";
import ko from "../src/locales/ko.json";
import zhCN from "../src/locales/zh-CN.json";
import zhTW from "../src/locales/zh-TW.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("locale key parity", () => {
  const tables = [
    { name: "en", keys: keys(en).sort() },
    { name: "zh-CN", keys: keys(zhCN).sort() },
    { name: "zh-TW", keys: keys(zhTW).sort() },
    { name: "ja", keys: keys(ja).sort() },
    { name: "ko", keys: keys(ko).sort() },
  ];
  const baseline = tables[0].keys;

  it("keeps the same keys in every language file", () => {
    for (const table of tables) {
      expect(table.keys, table.name).toEqual(baseline);
    }
  });
});
