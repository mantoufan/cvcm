import { describe, expect, it } from "vitest";
import en from "../src/locales/en.json";
import es from "../src/locales/es.json";
import id from "../src/locales/id.json";
import ja from "../src/locales/ja.json";
import ko from "../src/locales/ko.json";
import vi from "../src/locales/vi.json";
import zhCN from "../src/locales/zh-CN.json";
import zhTW from "../src/locales/zh-TW.json";
import allowed from "./fixtures/locale-same-as-en.json";

/** Dotted paths whose text in `other` is still exactly the English text (and contains Latin letters). */
function sameAsEnglish(base: unknown, other: unknown, prefix = ""): string[] {
  if (typeof base === "string") {
    return base === other && /[A-Za-z]{2}/.test(base) ? [prefix] : [];
  }
  if (typeof base !== "object" || base === null || typeof other !== "object" || other === null) return [];
  return Object.entries(base as Record<string, unknown>).flatMap(([k, v]) =>
    sameAsEnglish(v, (other as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k),
  );
}

describe("untranslated strings", () => {
  const tables = { "zh-CN": zhCN, "zh-TW": zhTW, ja, ko, es, vi, id } as const;

  // Brand names, code samples, format labels and words that read the same in a language are listed
  // in fixtures/locale-same-as-en.json. Anything else identical to English is a missed translation.
  it.each(Object.keys(tables) as (keyof typeof tables)[])("has no new English leftovers in %s", (name) => {
    const extra = sameAsEnglish(en, tables[name]).filter((path) => !allowed[name].includes(path));
    expect(extra).toEqual([]);
  });

  it.each(Object.keys(tables) as (keyof typeof tables)[])("keeps the %s allowlist current", (name) => {
    const same = new Set(sameAsEnglish(en, tables[name]));
    expect(allowed[name].filter((path) => !same.has(path))).toEqual([]);
  });
});
