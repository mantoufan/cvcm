import { describe, expect, it } from "vitest";
import "../src/shared/messages-all";
import { LOCALES } from "../src/shared/locale";
import { messages } from "../src/shared/messages";
import { IDEA_ENTRIES } from "../src/shared/ideas";
import { ideaName } from "../src/shared/ideas-i18n";
import { OPTION_POINTS, QUESTION_WEIGHT, VALIDATOR_QUESTIONS, ideaTokens, matchIdea, validateIdea, type ValidatorAnswers } from "../src/shared/idea-validator";
import { applyHtmlSeo, pageTitle } from "../src/shared/seo";
import { appHref, parseAppPath } from "../src/shared/path";
import { ideasPageHtml } from "../src/shared/ideas-i18n";

const all = (i: number): ValidatorAnswers => Object.fromEntries(VALIDATOR_QUESTIONS.map((q) => [q, Math.min(i, OPTION_POINTS[q].length - 1)]));

describe("idea validator: scoring", () => {
  it("weights sum to 100 and every question has 4-5 options worth 0-4", () => {
    expect(Object.values(QUESTION_WEIGHT).reduce((a, b) => a + b, 0)).toBe(100);
    for (const q of VALIDATOR_QUESTIONS) {
      expect(OPTION_POINTS[q].length, q).toBeGreaterThanOrEqual(4);
      for (const p of OPTION_POINTS[q]) expect(p >= 0 && p <= 4, q).toBe(true);
    }
  });

  it("needs every answer, and scores the best and worst answers 100 and 0", () => {
    expect(validateIdea({ evidence: 4 }, null)).toBeNull();
    const best: ValidatorAnswers = { evidence: 4, price: 4, competition: 3, cost: 4, time: 4, edge: 4, channel: 4, trend: 3 };
    const worst: ValidatorAnswers = { evidence: 0, price: 0, competition: 0, cost: 0, time: 0, edge: 0, channel: 0, trend: 0 };
    expect(validateIdea(best, null)).toMatchObject({ readiness: 100, total: 100, grade: "strong", weaknesses: [] });
    const low = validateIdea(worst, null)!;
    expect(low).toMatchObject({ readiness: 0, grade: "rethink", strengths: [] });
    // Weakest first by weight lost: proof of demand (20) before edge and channel (15).
    expect(low.weaknesses[0]).toBe("evidence");
    expect(low.weaknesses.slice(1, 3).sort()).toEqual(["channel", "edge"]);
  });

  it("blends a matched idea's outlook score as a quarter of the total, and grades by the total", () => {
    const mid = validateIdea(all(2), 80)!;
    expect(mid.market).toBe(80);
    expect(mid.total).toBe(Math.round(0.75 * mid.readiness + 0.25 * 80));
    const grades = [validateIdea(all(4), 100)!.grade, validateIdea(all(2), null)!.grade, validateIdea(all(1), null)!.grade, validateIdea(all(0), 0)!.grade];
    expect(new Set(grades).size).toBeGreaterThanOrEqual(3);
    // "Nobody does this yet" is not the best competition answer.
    expect(OPTION_POINTS.competition[4]).toBeLessThan(OPTION_POINTS.competition[3]);
  });

});

describe("idea validator: matching", () => {
  it("tokenizes Latin words and CJK pairs", () => {
    expect(ideaTokens("Mobile car-detailing services")).toEqual(["mobile", "car", "detailing"]);
    expect(ideaTokens("Velas aromáticas")).toEqual(["vela", "aromatica"]);
    expect(ideaTokens("自动售货机")).toEqual(["自动", "动售", "售货", "货机"]);
  });

  it("matches descriptions in several languages to the right idea", () => {
    const names = (loc: (typeof LOCALES)[number]) => Object.fromEntries(IDEA_ENTRIES.map((id) => [id, ideaName(loc, id).name]));
    expect(matchIdea("I want to put vending machines in offices", names("en"))).toBe("vending-machine");
    expect(matchIdea("an AI automation agency for dentists", names("en"))).toBe("ai-automation-agency");
    expect(matchIdea("我想开一家奶茶店", names("zh-CN"))).toBe("bubble-tea");
    expect(matchIdea("キッチンカーでカレーを売りたい", names("ja"))).toBe("food-truck");
    expect(matchIdea("셀프 세차장", names("ko"))).toBe("car-wash");
    expect(matchIdea("negocio de velas aromáticas", names("es"))).toBe("candle-business");
    expect(matchIdea("asdf qwerty", names("en"))).toBeNull();
    // Filler words and one shared word that several ideas use are not a match (these used to pick unrelated ideas).
    expect(matchIdea("a mobile app for students", names("en"))).toBeNull();
    expect(matchIdea("Tôi muốn mở cửa hàng", names("vi"))).toBeNull();
    expect(matchIdea("온라인 쇼핑몰", names("ko"))).toBeNull();
    expect(matchIdea("jualan online di rumah", names("id"))).toBeNull();
    expect(matchIdea("副業でお金を稼ぎたい", names("ja"))).toBeNull();
    expect(matchIdea("on at in", names("en"))).toBeNull();
    // An idea's own name matches it even when a longer name contains the same words; katakana long vowels stay in the word.
    expect(matchIdea("AI agency", names("en"))).toBe("ai-agency");
    expect(matchIdea("Car wash business", names("en"))).toBe("car-wash");
    expect(matchIdea("Pet services business", names("en"))).toBe("pet-services");
    expect(matchIdea("カフェを開きたい", names("ja"))).toBe("coffee-shop");
    expect(matchIdea("コーチングを始めたい", names("ja"))).toBeNull();
    expect(ideaTokens("コーヒー")).toEqual(["コー", "ーヒ", "ヒー"]);
    // Generic verbs do not pick an idea; one clear word in a longer text does when no other idea shares a word.
    expect(matchIdea("open a laundromat near campus", names("en"))).toBe("laundromat");
    expect(matchIdea("abrir una lavandería", names("es"))).not.toBe("coffee-shop");
    expect(matchIdea("open a salon", names("en"))).toBeNull();
    // Two ideas sharing different words equally is ambiguous.
    expect(matchIdea("t-shirt printing", names("en"))).not.toBe("3d-printing");
    // Language-specific filler: Vietnamese "in" means print.
    expect(matchIdea("Kinh doanh in 3D", names("vi"), "vi")).toBe("3d-printing");
    expect(matchIdea("car washes", names("en"))).toBe("car-wash");
    // Plurals and accents.
    expect(matchIdea("pressure washing houses and driveways", names("en"))).toBe("pressure-washing");
    expect(matchIdea("tiệm giặt sấy tự động", names("vi"))).toBe("laundromat");
    expect(matchIdea("", names("en"))).toBeNull();
  });
});

describe("idea validator: page", () => {
  it("is a tool route with a title, copy in every locale and links from the ideas channel", () => {
    expect(parseAppPath("/en/idea-validator/")).toEqual({ kind: "app", locale: "en", tool: "idea-validator" });
    for (const locale of LOCALES) {
      expect(pageTitle(locale, "idea-validator"), locale).toMatch(/ — cv\.cm$/);
      const ui = messages(locale).ui as unknown as { ideaValidator: Record<string, unknown> };
      for (const q of VALIDATOR_QUESTIONS) {
        const block = ui.ideaValidator[q] as Record<string, string>;
        expect(Object.keys(block).filter((k) => /^o\d$/.test(k)).length, `${locale} ${q}`).toBe(OPTION_POINTS[q].length);
      }
      expect(ideasPageHtml(locale, null)).toContain(`href="${appHref(locale, "idea-validator")}"`);
      expect(ideasPageHtml(locale, "laundromat")).toContain(`href="${appHref(locale, "idea-validator")}?idea=laundromat"`);
    }
    const html = applyHtmlSeo(`<!doctype html><html><head><title>x</title><link rel="canonical" href="https://cv.cm/"></head><body><div id="app"></div></body></html>`, "en", "idea-validator");
    expect(html).toContain('<link rel="canonical" href="https://cv.cm/en/idea-validator/"');
  });
});
