import { describe, expect, it } from "vitest";
import { evaluate, formatResult, parseHistory, replaceAns } from "../src/shared/calculator";
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
    expect(calc("1,234,567.5×2")).toBe("2469135");
    expect(calc("1,5")).toBe("syntax");
    expect(calc("3,14×2")).toBe("syntax");
    expect(calc("1,0000")).toBe("syntax");
    expect(calc("1.234,5", "deg", 0, ",")).toBe("1234.5");
    expect(calc("1.000×3", "deg", 0, ",")).toBe("syntax");
    expect(calc("2ℯ3")).toBe("16.3096909707543");
    expect(calc("2e3")).toBe("2000");
    expect(calc("1.2.3")).toBe("syntax");
    expect(calc("1 000")).toBe("syntax");
    expect(calc("sqrt 2 3")).toBe("syntax");
    expect(calc("2 π")).toBe("6.28318530717959");
    expect(calc("sin -30")).toBe("−0.5");
    expect(calc("cos -60 + 1")).toBe("1.5");
    expect(calc("sin(1e-20)", "rad")).toBe("1e-20");
    expect(calc("1/10^400")).toBe("overflow");
    expect(calc("exp(1000)-exp(1000)")).toBe("overflow");
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
    expect(formatResult(1.23456789012345e-7)).toBe("0.000000123456789012345");
    expect(formatResult(-5e-7)).toBe("−0.0000005");
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
    expect(fancy("ßıſé", "squared")).toBe("ßıſé");
    expect(fancy("ßa1", "circledNegative")).toBe("ß🅐❶");
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
    expect(md("foo\n| a | b |\n|---|---|\n| 1 | 2 |")).toBe("<p>foo</p>\n<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table>");
    expect(md("1. a\n   - b")).toBe("<ol>\n<li>a\n<ul>\n<li>b</li>\n</ul></li>\n</ol>");
  });
  it("renders links and images safely", () => {
    expect(md("[cv](https://cv.cm \"Home\")")).toBe("<p><a href=\"https://cv.cm\" title=\"Home\">cv</a></p>");
    expect(md("![logo](/a.png)")).toBe("<p><img src=\"/a.png\" alt=\"logo\"></p>");
    expect(md("[x](javascript:alert(1))")).toBe("<p>x</p>");
    expect(md("[x](<java\tscript:alert(1)>)")).not.toContain("href=\"java\tscript");
    expect(md("[x](<java\tscript:alert(1)>)")).toBe("<p>x</p>");
    expect(md("[x](\u0001javascript:alert(1))")).toBe("<p>x</p>");
    expect(md("![x](data:image/svg+xml,abc)")).toBe("<p>x</p>");
    expect(md("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(md("<img src=x onerror=alert(1)>")).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
    expect(md("[a\"b](https://x.y/\"onmouseover=\")")).toBe("<p><a href=\"https://x.y/&quot;onmouseover=&quot;\">a&quot;b</a></p>");
    expect(md("see https://cv.cm/a_(b). and <https://x.y>")).toBe("<p>see <a href=\"https://cv.cm/a_(b)\">https://cv.cm/a_(b)</a>. and <a href=\"https://x.y\">https://x.y</a></p>");
    expect(md("&copy; &#x1F600; &bogus;")).toBe("<p>© 😀 &amp;bogus;</p>");
    expect(md("<javascript:alert(document.domain)//@x.y>")).not.toContain("href");
    expect(md("<me@cv.cm> <https://cv.cm/x>")).toBe("<p><a href=\"mailto:me@cv.cm\">me@cv.cm</a> <a href=\"https://cv.cm/x\">https://cv.cm/x</a></p>");
    expect(md("Visit https:// now, HTTPS://cv.cm or Www.cv.cm")).toBe("<p>Visit https:// now, <a href=\"HTTPS://cv.cm\">HTTPS://cv.cm</a> or <a href=\"http://Www.cv.cm\">Www.cv.cm</a></p>");
    expect(md("~~~ js `x`\ncode\n~~~\n# H")).toBe("<pre><code class=\"language-js\">code\n</code></pre>\n<h1>H</h1>");
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
    expect(md("**bold *italic***")).toBe("<p><strong>bold <em>italic</em></strong></p>");
    expect(md("*a **b***")).toBe("<p><em>a <strong>b</strong></em></p>");
    expect(md("Card ending ****1234")).toBe("<p>Card ending ****1234</p>");
    expect(md("***foo")).toBe("<p>***foo</p>");
    expect(md("a *b* **c** ***d***")).toBe("<p>a <em>b</em> <strong>c</strong> <strong><em>d</em></strong></p>");
    expect(md("**[link](https://a.b)**")).toBe("<p><strong><a href=\"https://a.b\">link</a></strong></p>");
  });
  it("survives hostile input", () => {
    const start = Date.now();
    md("[".repeat(5000) + "](".repeat(5000));
    md("*a ".repeat(3000));
    md(">".repeat(500) + " deep");
    md("- ".repeat(500) + "x");
    md("*a ".repeat(60000));
    md("_a **b ".repeat(30000));
    md("`a ".repeat(60000));
    md("[a ".repeat(60000));
    md("[a](".repeat(40000));
    md("b\n".repeat(90000));
    md("http://x.co" + ")".repeat(199000));
    md("a" + " ".repeat(199000) + "b\nc");
    md("a" + " ".repeat(199000) + "b");
    md("a|b\n" + " ".repeat(199000) + "x-");
    md("www./中".repeat(33000));
    md("-" + "\n".repeat(199000) + "  x\n\n  y");
    md("www./".repeat(40000));
    md("http:///".repeat(25000));
    md("# a" + " ".repeat(199000) + "b");
    md("---" + " ".repeat(199000) + "x");
    md("| a" + " ".repeat(199000) + "x");
    md("- a" + " ".repeat(199000) + "x");
    md("|a".repeat(1500) + "|\n" + "|-".repeat(1500) + "|\n" + "x\n".repeat(40000));
    // A paragraph that uses up its scan budget leaves the next one alone.
    expect(md("[a ".repeat(60000) + "\n\n`code` [ok](https://cv.cm)")).toContain("<p><code>code</code> <a href=\"https://cv.cm\">ok</a></p>");
    expect(Date.now() - start).toBeLessThan(4000);
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

describe("review pass 4", () => {
  it("does not read decimals or typos as thousands", () => {
    expect(calc("0.125", "deg", 0, ",")).toBe("0.125");
    expect(calc("0.500", "deg", 0, ",")).toBe("0.5");
    expect(calc("1.234.567", "deg", 0, ",")).toBe(formatResult(1234567));
    expect(calc("1,234,567")).toBe(formatResult(1234567));
    expect(calc("3.14.159", "deg", 0, ",")).toBe("syntax");
    expect(calc("1.5.000", "deg", 0, ",")).toBe("syntax");
    expect(calc("0,125")).toBe("syntax");
  });
  it("keeps two × from becoming a power", () => {
    expect(calc("2××3")).toBe("syntax");
    expect(calc("2**3")).toBe("8");
  });
  it("has no value for tan of a right angle in radians", () => {
    expect(calc("tan(π/2)", "rad")).toBe("domain");
    expect(calc("tan(1)", "rad")).toBe(formatResult(Math.tan(1)));
  });
  it("keeps the angle mode in history", () => {
    expect(parseHistory(JSON.stringify([{ expr: "sin(30)", result: "0.5", mode: "deg" }]))[0].mode).toBe("deg");
    expect(parseHistory(JSON.stringify([{ expr: "1", result: "1", mode: "x" }]))[0].mode).toBeUndefined();
  });
  it("decodes entities in link addresses and still blocks script", () => {
    expect(md("[a](http://x.com?a=1&amp;b=2)")).toContain('href="http://x.com?a=1&amp;b=2"');
    expect(md("[a](&#106;avascript:alert(1))")).not.toContain("href=\"javascript");
  });
  it("trims a bare address the same way after the rewrite", () => {
    expect(md("(see http://x.co/a_(b)).")).toContain('href="http://x.co/a_(b)"');
    expect(md("line  \nnext")).toBe("<p>line<br>\nnext</p>");
  });
  it("lets an unmatched backtick leave table cells apart", () => {
    const html = md("| a | b |\n|---|---|\n| ` | c |");
    expect(html).toContain("<td>c</td>");
  });
});

describe("review pass 5", () => {
  it("prints the largest doubles instead of throwing", () => {
    expect(formatResult(Number.MAX_VALUE)).toBe("1.79769313486232e308");
    expect(formatResult(-Number.MAX_VALUE)).toBe("−1.79769313486232e308");
  });
  it("finds Ans only where the parser does", () => {
    const out = (e: string) => replaceAns(e, () => "7");
    expect(out("tansin(30)")).toBe("tansin(30)");
    expect(out("2Ans+ANS")).toBe("27+7");
    expect(out("sinAns")).toBe("sin7");
    expect(out("pians")).toBe("pi7");
  });
  it("keeps tabs in code and strips only the heading's closing marks", () => {
    expect(md("```\n\tfoo\tbar\n```")).toContain("\tfoo\tbar");
    expect(md("`a\tb`")).toContain("<code>a\tb</code>");
    expect(md("\t- not a tab stop issue")).toBeTruthy();
    expect(md("- a\n\t- b")).toContain("<li>b</li>");
    expect(md("## Title ##")).toBe("<h2>Title</h2>");
    expect(md("## C#")).toBe("<h2>C#</h2>");
    expect(md("#\tTabbed")).toBe("<h1>Tabbed</h1>");
    expect(md("# Spaced   ")).toBe("<h1>Spaced</h1>");
  });
  it("reads delimiter rows as before", () => {
    expect(md("a|b\n-|:-:")).toContain("<table>");
    expect(md("a|b\n-|x")).not.toContain("<table>");
    expect(md("| a | b |\n| --- | --- |\n| 1 | 2 |")).toContain("<td>2</td>");
  });
  it("caps table cells across a document", () => {
    const doc = parseMarkdown("|a".repeat(1500) + "|\n" + "|-".repeat(1500) + "|\n" + "x\n".repeat(40000));
    const table = doc[0] as { rows: unknown[] };
    expect(table.rows.length).toBeLessThanOrEqual(67);
  });
});

describe("review pass 6", () => {
  it("ends a bare address at CJK punctuation and links it after CJK letters", () => {
    expect(md("详情见 https://cv.cm/zh-cn/，然后继续。")).toContain('<a href="https://cv.cm/zh-cn/">https://cv.cm/zh-cn/</a>，然后继续。');
    expect(md("详情见https://cv.cm/ 后面")).toContain('<a href="https://cv.cm/">');
    expect(md("xhttps://cv.cm/")).not.toContain("<a ");
  });
  it("continues only paragraphs lazily", () => {
    expect(md("> # h\nnext")).toBe("<blockquote>\n<h1>h</h1>\n</blockquote>\n<p>next</p>");
    expect(md("> a\nb")).toBe("<blockquote>\n<p>a\nb</p>\n</blockquote>");
    expect(md("- a\n  ```\n  x\n  ```\nafter")).toContain("<p>after</p>");
    expect(md("- # h\nnext")).toContain("<p>next</p>");
    expect(md("- a\nb")).not.toContain("<p>b</p>");
  });
  it("treats a shown whole number as whole", () => {
    expect(calc("((0.1+0.2)*10)!")).toBe("6");
    expect(calc("(-8)^((0.1+0.2)*10)")).toBe("−512");
    expect(calc("(-8)^0.5")).toBe("domain");
    expect(calc("2.5!")).toBe("domain");
  });
  it("reads a trailing equals sign", () => {
    expect(calc("2+2=")).toBe("4");
    expect(calc("2=2")).toBe("syntax");
  });
  it("resolves reference links and hides definitions", () => {
    expect(md("[docs][1] and [Site] and [x][]\n\n[1]: https://x.y \"T\"\n[site]: <https://s.t>\n[x]: /x")).toBe('<p><a href="https://x.y" title="T">docs</a> and <a href="https://s.t">Site</a> and <a href="/x">x</a></p>');
    expect(md("![badge][b]\n\n[b]: https://i.png")).toBe('<p><img src="https://i.png" alt="badge"></p>');
    expect(md("[a]\n\n[a]: javascript:alert(1)")).toBe("<p>a</p>");
    expect(md("[no ref] stays")).toBe("<p>[no ref] stays</p>");
    expect(md("text\n[1]: https://x.y")).toContain("[1]:");
    expect(md("```\n\n[1]: https://x.y\n```")).toContain("[1]: https://x.y");
    expect(md("[a]: x" + " ".repeat(199000) + "y")).toBeTruthy();
  });
});

describe("review pass 7", () => {
  it("keeps definitions inside any fence as code", () => {
    const html = md("- a\n\n  ```\n  x\n\n  [r]: http://x\n  ```\n\n[r]");
    expect(html).toContain("[r]: http://x");
    expect(html).not.toContain('href="http://x"');
  });
  it("ends an unspaced address at the next CJK letter only", () => {
    expect(md("详见https://a.com/x了解更多。")).toContain('<a href="https://a.com/x">https://a.com/x</a>了解更多');
    expect(md("公式见www.a.com的说明")).toContain('href="http://www.a.com"');
    expect(md("wiki https://zh.wikipedia.org/wiki/中国")).toContain('href="https://zh.wikipedia.org/wiki/中国"');
  });
  it("decodes entities in bare addresses", () => {
    expect(md("http://a.com?a=1&amp;b=2")).toBe('<p><a href="http://a.com?a=1&amp;b=2">http://a.com?a=1&amp;b=2</a></p>');
  });
  it("keeps a list tight around nested blank lines", () => {
    expect(md("- a\n  ```\n  x\n\n  y\n  ```\n- b")).toContain("<li>b</li>");
    expect(md("- a\n  - b\n\n  - c\n- d")).toContain("<li>d</li>");
    expect(md("- a\n\n  more\n- b")).toContain("<li><p>b</p></li>");
  });
});

describe("review pass 8", () => {
  it("calls an indented second paragraph loose, whatever its indent", () => {
    expect(md("- Install\n\n    Run it.\n- Next")).toContain("<p>Install</p>");
    expect(md("1. One\n\n    More\n2. Two")).toContain("<p>More</p>");
  });
  it("follows a fence opened on a list marker", () => {
    expect(md("- ```\n  x\n\n  [a]: http://y\n\n  z\n  ```\n")).toContain("[a]: http://y");
    expect(md("- ```\n  code\n  ```\n\n[ref]: http://x.com\n\n[ref]")).toContain('<a href="http://x.com">ref</a>');
  });
  it("leaves names from Object.prototype as text", () => {
    expect(md("&valueOf; &toString; &amp;")).toBe("<p>&amp;valueOf; &amp;toString; &amp;</p>");
  });
});

describe("review pass 9", () => {
  it("reads a bracketed root like any function", () => {
    expect(calc("√(9)!")).toBe("6");
    expect(calc("√(16)%")).toBe("0.04");
    expect(calc("√(-4)^2")).toBe("domain");
    expect(calc("√4")).toBe("2");
    expect(calc("√(9)π")).toBe(formatResult(3 * Math.PI));
  });
  it("refuses a lone dot group on decimal-comma pages", () => {
    expect(calc("3.142", "deg", 0, ",")).toBe("syntax");
    expect(calc("2^1.000", "deg", 0, ",")).toBe("syntax");
    expect(calc("1.5", "deg", 0, ",")).toBe("1.5");
    expect(calc("1.234.567", "deg", 0, ",")).toBe(formatResult(1234567));
    expect(calc("1.234,5", "deg", 0, ",")).toBe("1234.5");
    expect(calc("3.142")).toBe("3.142");
  });
  it("reads full-width input", () => {
    expect(calc("２＋２")).toBe("4");
    expect(calc("３＊４／２")).toBe("6");
    expect(calc("１０％")).toBe("0.1");
  });
  it("keeps flags, emoji and accents whole", () => {
    expect(fancy("🇨🇳", "upsideDown")).toBe("🇨🇳");
    expect(fancy("👍🏽", "strike")).toBe("👍🏽");
    expect(fancy("👨‍👩‍👧", "underline")).toBe("👨‍👩‍👧");
    expect(Array.from(new Intl.Segmenter().segment(fancy("e\u0301x", "strike"))).length).toBe(2);
  });
});

describe("review pass 10", () => {
  it("takes a definition after any block but a paragraph", () => {
    expect(md("# T\n[a]: /b\n\n[a]")).toBe('<h1>T</h1>\n<p><a href="/b">a</a></p>');
    expect(md("```\nx\n```\n[a]: /b\n\n[a]")).toContain('<a href="/b">a</a>');
    expect(md("[a]: /b\n[c]: /d\n\n[a] [c]")).toBe('<p><a href="/b">a</a> <a href="/d">c</a></p>');
    expect(md("text\n[a]: /b")).toContain("[a]: /b");
  });
  it("leaves closing brackets out of a bare address", () => {
    expect(md("see [https://a.com/x] and {www.a.com}")).toContain('href="https://a.com/x">https://a.com/x</a>]');
    expect(md("see [https://a.com/x] and {www.a.com}")).toContain('href="http://www.a.com">www.a.com</a>}');
  });
});

describe("review pass 11", () => {
  it("ends a bare address at raw HTML quotes and brackets", () => {
    expect(md('<a href="https://x.com">link</a>')).toContain('href="https://x.com"');
    expect(md("<img src='https://x.com/a.png'>")).toContain('href="https://x.com/a.png"');
  });
  it("reduces large degree angles and keeps small ones", () => {
    expect(Number(calc("sin(1e20)").replace("−", "-"))).toBeCloseTo(Math.sin((280 * Math.PI) / 180), 10);
    expect(calc("cos(1e308)")).not.toBe("domain");
    expect(Number(calc("sin(0.000001)"))).toBeCloseTo((0.000001 * Math.PI) / 180, 12);
    expect(calc("sin(390)")).toBe("0.5");
  });
});

describe("review pass 12", () => {
  it("keeps quotes inside an address unless it opened after one", () => {
    expect(md("https://en.wikipedia.org/wiki/Alzheimer's_disease")).not.toContain('Alzheimer">');
    expect(md('<a href="https://x.com">link</a>')).toContain('href="https://x.com"');
  });
  it("treats rounding around a right angle as the right angle", () => {
    expect(calc("sin((0.1+0.2)×1200)")).toBe("0");
    expect(calc("sin(11880.000000000002)")).toBe("0");
    expect(calc("tan(90.00000000000001)")).toBe("domain");
    expect(calc("sin(90.001)")).not.toBe("1");
  });
  it("keeps the full sum of a history line", () => {
    expect(parseHistory(JSON.stringify([{ expr: "0.3+1", result: "1.3", full: "0.30000000000000004+1" }]))[0].full).toBe("0.30000000000000004+1");
  });
});

describe("review pass 13", () => {
  it("does not snap large degree angles to a right angle", () => {
    expect(Number(calc("cos(1e17)"))).toBeCloseTo(Math.cos((280 * Math.PI) / 180), 8);
    expect(calc("tan(1e17)")).not.toBe("domain");
    expect(calc("sin(11880.000000000002)")).toBe("0");
  });
  it("links a bare address only where one can start", () => {
    expect(md("ftp://www.a.com/x")).not.toContain("<a ");
    expect(md("me@www.a.com")).not.toContain("<a ");
    expect(md("a.www.b.com")).not.toContain("<a ");
    expect(md("(https://a.com)")).toContain('href="https://a.com"');
    expect(md("**https://a.com**")).toContain('href="https://a.com"');
    expect(md("https://a.com")).toContain('href="https://a.com"');
    expect(md("详见https://a.com")).toContain('href="https://a.com"');
  });
  it("ends an address at curly quotes", () => {
    expect(md("“https://a.com”")).toContain('<a href="https://a.com">https://a.com</a>”');
    expect(md("详见“https://a.com/x”。")).toContain('href="https://a.com/x"');
  });
  it("keeps a task box in the first paragraph of a loose item", () => {
    expect(md("- [x] a\n\n- [ ] b")).toContain('<li><p><input type="checkbox" disabled checked> a</p></li>');
    expect(md("- [x] a\n- [ ] b")).toContain('<li><input type="checkbox" disabled checked> a</li>');
  });
});

describe("review pass 14", () => {
  it("reads log bases and refuses a number glued to a function and a bracket", () => {
    expect(calc("log10(100)")).toBe("2");
    expect(calc("log2(8)")).toBe("3");
    expect(calc("log(1000)")).toBe("3");
    expect(calc("sin2(30)")).toBe("syntax");
    expect(calc("ln2(3)")).toBe("syntax");
    expect(calc("sin 30")).toBe("0.5");
    expect(calc("log 100")).toBe("2");
    expect(calc("log2")).toBe(formatResult(Math.log10(2)));
  });
  it("collects definitions wherever a paragraph could start", () => {
    expect(md("[r]:\n  http://a.com\n[s]: http://b.com\n\n[s] [r]")).toBe('<p><a href="http://b.com">s</a> <a href="http://a.com">r</a></p>');
    expect(md("- ```\n  x\n- y\n\n[a]: http://a.com\n\n[a]")).toContain('<a href="http://a.com">a</a>');
    expect(md("> [r]: http://a.com\n\n[r]")).toContain('<a href="http://a.com">r</a>');
    expect(md("  ```\n    ```\n  [a]: b\n  ```")).toContain("[a]: b");
    expect(md("[f]\n\n[f]: /later")).toBe('<p><a href="/later">f</a></p>');
  });
  it("closes a triple run in two steps", () => {
    expect(md("***a** b*")).toBe("<p><em><strong>a</strong> b</em></p>");
    expect(md("***a* b**")).toBe("<p><strong><em>a</em> b</strong></p>");
    expect(md("___a__ b_")).toBe("<p><em><strong>a</strong> b</em></p>");
    expect(md("***a***")).toBe("<p><strong><em>a</em></strong></p>");
  });
});

describe("review pass 15", () => {
  it("keeps two paragraphs of an item apart whatever their indent", () => {
    expect(md("1. Step one\n    more detail\n\n    Second paragraph")).toContain("<p>Second paragraph</p>");
    expect(md("- a\n  - b\n\n  - c\n- d")).toContain("<li>d</li>");
  });
});
