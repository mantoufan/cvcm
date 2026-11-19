import { describe, expect, it } from "vitest";
import { TITLE_STYLES, titleCase } from "../src/shared/title-case";

const all = (title: string) => Object.fromEntries(TITLE_STYLES.map((s) => [s, titleCase(title, s)]));

describe("title case", () => {
  it("applies each style's minor words", () => {
    expect(all("the effects of social media on self-esteem: a meta-analysis of studies from 2010 to 2020")).toEqual({
      apa: "The Effects of Social Media on Self-Esteem: A Meta-Analysis of Studies From 2010 to 2020",
      mla: "The Effects of Social Media on Self-Esteem: A Meta-Analysis of Studies from 2010 to 2020",
      chicago: "The Effects of Social Media on Self-Esteem: A Meta-Analysis of Studies from 2010 to 2020",
      ap: "The Effects of Social Media on Self-Esteem: A Meta-Analysis of Studies From 2010 to 2020",
      sentence: "The effects of social media on self-esteem: A meta-analysis of studies from 2010 to 2020",
    });
  });

  it("capitalizes the last word in MLA, Chicago and AP but not APA", () => {
    expect(all("what it's made of")).toMatchObject({ apa: "What It's Made of", mla: "What It's Made Of", chicago: "What It's Made Of", ap: "What It's Made Of" });
  });

  it("differs on yet, so, if and as between MLA and Chicago", () => {
    expect(titleCase("strong yet gentle as ever if needed", "mla")).toBe("Strong yet Gentle as Ever If Needed");
    expect(titleCase("strong yet gentle as ever if needed", "chicago")).toBe("Strong Yet Gentle as Ever If Needed");
    expect(titleCase("strong yet gentle as ever if needed", "apa")).toBe("Strong yet Gentle as Ever if Needed");
  });

  it("keeps acronyms, mixed case, URLs and the pronoun I", () => {
    expect(titleCase("a study of DNA repair in iPhone users", "apa")).toBe("A Study of DNA Repair in iPhone Users");
    expect(titleCase("Testing For COVID-19 At McDonald's", "sentence")).toBe("Testing for COVID-19 at McDonald's");
    expect(titleCase("why I'm reading example.com today", "sentence")).toBe("Why I'm reading example.com today");
  });

  it("starts a subtitle after a colon, question or exclamation mark, and in titles after an em dash", () => {
    expect(titleCase("between you and me: is it worth it? a guide", "sentence")).toBe("Between you and me: Is it worth it? A guide");
    expect(titleCase("users—a new look", "apa")).toBe("Users—A New Look");
    expect(titleCase("users—a new look", "sentence")).toBe("Users—a new look");
    // An abbreviation's full stop does not start a sentence.
    expect(titleCase("growing up in the U.S. vs. the U.K.", "apa")).toBe("Growing up in the U.S. vs. the U.K.");
  });

  it("treats hyphenated compounds part by part, with Chicago's prefixes", () => {
    expect(titleCase("out-of-date anti-inflammatory non-native self-report", "apa")).toBe("Out-of-Date Anti-Inflammatory Non-Native Self-Report");
    expect(titleCase("out-of-date anti-inflammatory non-native self-report", "chicago")).toBe("Out-of-Date Anti-inflammatory Non-native Self-Report");
  });

  it("lowercases a title typed in capitals first, and converts each line on its own", () => {
    expect(titleCase("THE ROLE OF WORKING MEMORY IN READING", "apa")).toBe("The Role of Working Memory in Reading");
    expect(titleCase("first title of note\n\n  second one: in brief", "mla")).toBe("First Title of Note\n\n  Second One: In Brief");
  });

  it("re-cases title-cased compounds and always capitalizes a compound's first part", () => {
    expect(titleCase("The Effects of Social Media on Self-Esteem: A Meta-Analysis", "sentence")).toBe("The effects of social media on self-esteem: A meta-analysis");
    expect(titleCase("Out-Of-Date Anti-Inflammatory Drugs", "apa")).toBe("Out-of-Date Anti-Inflammatory Drugs");
    expect(titleCase("Out-Of-Date Anti-Inflammatory Drugs", "chicago")).toBe("Out-of-Date Anti-inflammatory Drugs");
    expect(titleCase("studies on out-of-date software and in-depth reviews of the for-profit sector", "apa")).toBe("Studies on Out-of-Date Software and In-Depth Reviews of the For-Profit Sector");
    expect(titleCase("over-the-counter drugs", "chicago")).toBe("Over-the-Counter Drugs");
    expect(titleCase("testing COVID-19 vaccines", "sentence")).toBe("Testing COVID-19 vaccines");
  });

  it("keeps dotted initialisms in a title typed in capitals", () => {
    expect(titleCase("THE U.S. AND THE U.K.", "apa")).toBe("The U.S. and the U.K.");
  });

  it("starts a new part after a spaced en dash, hyphen or colon", () => {
    expect(titleCase("learning – a guide to the basics", "apa")).toBe("Learning – A Guide to the Basics");
    expect(titleCase("learning - a guide", "chicago")).toBe("Learning - A Guide");
    expect(titleCase("what it is made of – a guide", "mla")).toBe("What It Is Made Of – A Guide");
    expect(titleCase("learning – a guide", "sentence")).toBe("Learning – a guide");
  });

  it("does not end a sentence at common abbreviations", () => {
    expect(titleCase("Ph.D. students in the U.S.: a survey", "sentence")).toBe("Ph.D. students in the U.S.: A survey");
    expect(titleCase("the role of inc. firms", "sentence")).toBe("The role of inc. firms");
  });

  it("keeps punctuation around words", () => {
    expect(titleCase("“the art of war” (a new translation)", "chicago")).toBe("“The Art of War” (a New Translation)");
  });
});
