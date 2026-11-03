import { describe, expect, it } from "vitest";
import { evaluate, formatResult, parseHistory } from "../src/shared/calculator";
import { fancy, FANCY_STYLES } from "../src/shared/fancy-text";
import { clampAngle, cssRule, gradientCss, linearLine, newStop, normalizeHex, radialRadii, randomGradient, PRESETS } from "../src/shared/gradient";
import { parseMarkdown, safeHref, toHtml } from "../src/shared/markdown";
import { noteFileName, parseNote } from "../src/shared/notepad";

const calc = (s: string, mode: "deg" | "rad" = "deg", ans = 0, dec: "." | "," = ".") => {
  const r = evaluate(s, mode, ans, dec);
  return r.ok ? formatResult(r.value) : r.error;
};
const md = (s: string) => toHtml(parseMarkdown(s));

describe("calculator", () => {
  it("follows the order of operations", () => {
    expect(calc("1+2×3")).toBe("7");
    expect(calc("(1+2)×3")).toBe("9");
    expect(calc("−2^2")).toBe("−4");
    expect(calc("2^3^2")).toBe("512");
    expect(calc("2^-1")).toBe("0.5");
    expect(calc("10÷4")).toBe("2.5");
    expect(calc("0.1+0.2")).toBe("0.3");
    expect(calc("7-−3")).toBe("10");
    expect(calc("2**10")).toBe("1024");
  });
  it("multiplies implicitly and reads constants, functions and postfix", () => {
    expect(calc("2π")).toBe("6.28318530717959");
    expect(calc("2(3+4)")).toBe("14");
    expect(calc("(1+1)(2+2)")).toBe("8");
    expect(calc("sin(30)")).toBe("0.5");
    expect(calc("sin 30 + 1")).toBe("1.5");
    expect(calc("cos(90)")).toBe("0");
    expect(calc("sin(180)")).toBe("0");
    expect(calc("tan(45)")).toBe("1");
    expect(calc("sin(π/2)", "rad")).toBe("1");
    expect(calc("sin(π)", "rad")).toBe("0");
    expect(calc("asin(1)")).toBe("90");
    expect(calc("√16")).toBe("4");
    expect(calc("√(9)+1")).toBe("4");
    expect(calc("sqrt 2")).toBe("1.4142135623731");
    expect(calc("log(1000)")).toBe("3");
    expect(calc("ln(e)")).toBe("1");
    expect(calc("5!")).toBe("120");
    expect(calc("50%")).toBe("0.5");
    expect(calc("200×15%")).toBe("30");
    expect(calc("ans×2", "deg", 21)).toBe("42");
    expect(calc("1.5e3")).toBe("1500");
    expect(calc("2e")).toBe("5.43656365691809");
    expect(calc("2×(3+4")).toBe("14");
  });
  it("reads decimal commas and thousands separators by locale", () => {
    expect(calc("1,5+1", "deg", 0, ",")).toBe("2.5");
    expect(calc("1,000+1")).toBe("1001");
    expect(calc("3.5+1", "deg", 0, ",")).toBe("4.5");
  });
  it("reports errors", () => {
    expect(calc("1÷0")).toBe("domain");
    expect(calc("√−1")).toBe("domain");
    expect(calc("log(0)")).toBe("domain");
    expect(calc("tan(90)")).toBe("domain");
    expect(calc("(−8)^(1/3)")).toBe("domain");
    expect(calc("171!")).toBe("overflow");
    expect(calc("10^400")).toBe("overflow");
    expect(calc("2.5!")).toBe("domain");
    expect(calc("1+")).toBe("syntax");
    expect(calc("")).toBe("syntax");
    expect(calc("foo")).toBe("syntax");
    expect(calc("2)")).toBe("syntax");
    expect(calc("(".repeat(300))).toBe("syntax");
  });
  it("formats results", () => {
    expect(formatResult(1e20)).toBe("1e20");
    expect(formatResult(1.5e-9)).toBe("1.5e-9");
    expect(formatResult(-0.000001)).toBe("−0.000001");
    expect(formatResult(123456789012345)).toBe("123456789012345");
    expect(formatResult(2.5, ",")).toBe("2,5");
    expect(formatResult(1 / 3)).toBe("0.333333333333333");
  });
  it("reads history", () => {
    expect(parseHistory("[{\"expr\":\"1+1\",\"result\":\"2\"},{\"x\":1}]")).toEqual([{ expr: "1+1", result: "2" }]);
    expect(parseHistory("nope")).toEqual([]);
  });
});

describe("fancy-text", () => {
  it("maps letters and digits, filling the Unicode holes", () => {
    expect(fancy("Abc 1", "bold")).toBe("𝐀𝐛𝐜 𝟏");
    expect(fancy("hi", "italic")).toBe("ℎ𝑖");
    expect(fancy("Bel", "script")).toBe("ℬℯ𝓁");
    expect(fancy("CHRZ", "fraktur")).toBe("ℭℌℜℨ");
    expect(fancy("RN1", "doubleStruck")).toBe("ℝℕ𝟙");
    expect(fancy("ab9", "circled")).toBe("ⓐⓑ⑨");
    expect(fancy("ab", "squared")).toBe("🄰🄱");
    expect(fancy("hey", "smallCaps")).toBe("ʜᴇʏ");
    expect(fancy("ab!", "upsideDown")).toBe("¡qɐ");
    expect(fancy("a b", "strike")).toBe("a̶ b̶");
    expect(fancy("Hi 你好", "fullwidth")).toBe("Ｈｉ 你好");
    expect(fancy("x", "monospace")).toBe("𝚡");
  });
  it("keeps other characters and gives every style an output", () => {
    for (const s of FANCY_STYLES) expect(fancy("你好", s).replace(/[̶̲]/g, "")).toBe(s === "upsideDown" ? "好你" : "你好");
    expect(Array.from(fancy("a".repeat(5000), "bold"))).toHaveLength(2000);
  });
});

describe("gradient", () => {
  it("writes CSS", () => {
    expect(gradientCss(PRESETS[0])).toBe("linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)");
    expect(gradientCss({ ...PRESETS[0], kind: "radial", shape: "ellipse" })).toBe("radial-gradient(ellipse, #ff9a9e 0%, #fad0c4 100%)");
    expect(gradientCss({ ...PRESETS[0], kind: "conic", angle: 90 })).toBe("conic-gradient(from 90deg, #ff9a9e 0%, #fad0c4 100%)");
    expect(gradientCss({ ...PRESETS[0], stops: [{ color: "#000000", pos: 80 }, { color: "#ffffff", pos: 10 }] })).toBe("linear-gradient(135deg, #ffffff 10%, #000000 80%)");
    expect(cssRule(PRESETS[0])).toBe("background: #ff9a9e;\nbackground: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%);");
  });
  it("normalizes input", () => {
    expect(normalizeHex("F0a")).toBe("#ff00aa");
    expect(normalizeHex("#12AB34")).toBe("#12ab34");
    expect(normalizeHex("red")).toBeNull();
    expect([clampAngle(-90), clampAngle(450), clampAngle(Number.NaN)]).toEqual([270, 90, 0]);
  });
  it("matches CSS geometry", () => {
    const l = linearLine(90, 200, 100);
    expect([l.x0, l.y0, l.x1, l.y1].map((n) => Math.round(n) + 0)).toEqual([0, 50, 200, 50]);
    const d = linearLine(180, 200, 100);
    expect([d.x0, d.y0, d.x1, d.y1].map((n) => Math.round(n) + 0)).toEqual([100, 0, 100, 100]);
    expect(radialRadii("circle", 60, 80).rx).toBe(50);
    expect(Math.round(radialRadii("ellipse", 200, 100).ry)).toBe(71);
    expect(newStop([{ color: "#000000", pos: 0 }, { color: "#ffffff", pos: 100 }])).toEqual({ color: "#808080", pos: 50 });
    let n = 0;
    const g = randomGradient(() => ((n = (n * 9301 + 49297) % 233280) / 233280));
    expect(g.stops.length).toBeGreaterThanOrEqual(2);
    for (const s of g.stops) expect(normalizeHex(s.color)).toBe(s.color);
  });
});

describe("markdown", () => {
  it("renders blocks", () => {
    expect(md("# Hi\n\nText *em* **b** ~~d~~ `c`")).toBe("<h1>Hi</h1>\n<p>Text <em>em</em> <strong>b</strong> <del>d</del> <code>c</code></p>");
    expect(md("Title\n=====\nSub\n---")).toBe("<h1>Title</h1>\n<h2>Sub</h2>");
    expect(md("- a\n- b\n  - c")).toBe("<ul>\n<li>a</li>\n<li>b\n<ul>\n<li>c</li>\n</ul></li>\n</ul>");
    expect(md("3. x\n4. y")).toBe("<ol start=\"3\">\n<li>x</li>\n<li>y</li>\n</ol>");
    expect(md("- [x] done\n- [ ] todo")).toBe("<ul>\n<li><input type=\"checkbox\" disabled checked> done</li>\n<li><input type=\"checkbox\" disabled> todo</li>\n</ul>");
    expect(md("- a\n\n- b")).toBe("<ul>\n<li><p>a</p></li>\n<li><p>b</p></li>\n</ul>");
    expect(md("> quote\nlazy\n\n---")).toBe("<blockquote>\n<p>quote\nlazy</p>\n</blockquote>\n<hr>");
    expect(md("```js\nif (a < b) {}\n```")).toBe("<pre><code class=\"language-js\">if (a &lt; b) {}\n</code></pre>");
    expect(md("    code\n    more")).toBe("<pre><code>code\nmore\n</code></pre>");
    expect(md("| a | b |\n|:--|--:|\n| 1 | `x|y` |")).toBe("<table>\n<thead>\n<tr><th style=\"text-align: left\">a</th><th style=\"text-align: right\">b</th></tr>\n</thead>\n<tbody>\n<tr><td style=\"text-align: left\">1</td><td style=\"text-align: right\"><code>x|y</code></td></tr>\n</tbody>\n</table>");
    expect(md("line one  \nline two")).toBe("<p>line one<br>\nline two</p>");
    expect(md("2019. A year")).toBe("<ol start=\"2019\">\n<li>A year</li>\n</ol>");
    expect(md("text\n2019. A year")).toBe("<p>text\n2019. A year</p>");
  });
  it("renders links and images safely", () => {
    expect(md("[cv](https://cv.cm \"Home\")")).toBe("<p><a href=\"https://cv.cm\" title=\"Home\">cv</a></p>");
    expect(md("![logo](/a.png)")).toBe("<p><img src=\"/a.png\" alt=\"logo\"></p>");
    expect(md("[x](javascript:alert(1))")).toBe("<p>x</p>");
    expect(md("[x](<java\tscript:alert(1)>)")).not.toContain("href=\"java\tscript");
    expect(md("[x](<java\tscript:alert(1)>)")).toMatch(/href="java%20/);
    expect(md("[x](\u0001javascript:alert(1))")).toBe("<p>x</p>");
    expect(md("![x](data:image/svg+xml,abc)")).toBe("<p>x</p>");
    expect(md("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(md("<img src=x onerror=alert(1)>")).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
    expect(md("[a\"b](https://x.y/\"onmouseover=\")")).toBe("<p><a href=\"https://x.y/&quot;onmouseover=&quot;\">a&quot;b</a></p>");
    expect(md("see https://cv.cm/a_(b). and <https://x.y>")).toBe("<p>see <a href=\"https://cv.cm/a_(b)\">https://cv.cm/a_(b)</a>. and <a href=\"https://x.y\">https://x.y</a></p>");
    expect(md("&copy; &#x1F600; &bogus;")).toBe("<p>© 😀 &amp;bogus;</p>");
    expect(safeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeHref("VBScript:x")).toBeNull();
    expect(safeHref("page.html#x")).toBe("page.html#x");
  });
  it("handles emphasis edge cases", () => {
    expect(md("snake_case_name")).toBe("<p>snake_case_name</p>");
    expect(md("***both***")).toBe("<p><strong><em>both</em></strong></p>");
    expect(md("*a **b** c*")).toBe("<p><em>a <strong>b</strong> c</em></p>");
    expect(md("2 * 3 * 4")).toBe("<p>2 * 3 * 4</p>");
    expect(md("\\*not em\\*")).toBe("<p>*not em*</p>");
    expect(md("**[link](https://a.b)**")).toBe("<p><strong><a href=\"https://a.b\">link</a></strong></p>");
  });
  it("survives hostile input", () => {
    const start = Date.now();
    md("[".repeat(5000) + "](".repeat(5000));
    md("*a ".repeat(3000));
    md(">".repeat(500) + " deep");
    md("- ".repeat(500) + "x");
    expect(Date.now() - start).toBeLessThan(3000);
  });
});

describe("notepad", () => {
  it("reads the saved note and names the file", () => {
    expect(parseNote("{\"text\":\"hi\",\"savedAt\":5}")).toEqual({ text: "hi", savedAt: 5 });
    expect(parseNote("{\"text\":3}")).toBeNull();
    expect(parseNote("x")).toBeNull();
    expect(noteFileName("\n  Shopping: list?\nmore", "note")).toBe("Shopping list.txt");
    expect(noteFileName("   \n", "note-2026-11-03")).toBe("note-2026-11-03.txt");
    expect(noteFileName("...", "n")).toBe("n.txt");
  });
});
