import { describe, expect, it } from "vitest";
import { renderClip } from "../src/shared/md";

describe("renderClip", () => {
  it("renders markdown, code, and media", () => {
    const html = renderClip("# Hi\n\n```js\nconst x = 1\n```\n\n![pic](https://s3.cv.cm/files/clip/abcdefgh/a.png)\n![vid](https://s3.cv.cm/files/clip/abcdefgh/a.mp4)\n[file](https://s3.cv.cm/files/clip/abcdefgh/a.pdf)");
    expect(html).toContain("<h1>");
    expect(html).toContain('class="k">const</span>');
    expect(html).toContain("<img ");
    expect(html).toContain("<video controls");
    expect(html).toContain("<a href=");
  });

  it("renders bold italic underline", () => {
    const html = renderClip("**b** *i* ++u++");
    expect(html).toContain("<strong>b</strong>");
    expect(html).toContain("<em>i</em>");
    expect(html).toContain("<u>u</u>");
  });

  it("escapes scripts in markdown", () => {
    const html = renderClip("<script>alert(1)</script>");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).toContain("alert(1)");
  });

  it("drops javascript urls", () => {
    const html = renderClip("[x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("sanitizes html notes", () => {
    const html = renderClip('<p onclick="alert(1)">ok</p><img src="https://s3.cv.cm/files/clip/abcdefgh/a.png" onerror="alert(2)">');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).toContain("<p>");
    expect(html).toContain("https://s3.cv.cm/files/clip/abcdefgh/a.png");
  });

  it("renders strike, numbered lists and quotes", () => {
    const html = renderClip("~~gone~~\n\n1. one\n2. two\n\n> quoted\n> more");
    expect(html).toContain("<s>gone</s>");
    expect(html).toContain("<ol><li>one</li><li>two</li></ol>");
    expect(html).toContain("<blockquote>quoted<br>more</blockquote>");
  });

  it("keeps rich-text editor markup", () => {
    const html = renderClip("<div><h1>T</h1><b>b</b><strike>s</strike><ol><li>x</li></ol><blockquote>q</blockquote><pre>code</pre></div>");
    for (const tag of ["<h1>", "<b>", "<strike>", "<ol>", "<blockquote>", "<pre>"]) expect(html).toContain(tag);
  });

  it("keeps separated quotes apart and honors list start", () => {
    const html = renderClip("> A\n\n> B\n\n3. third\n4. fourth");
    expect(html).toContain("<blockquote>A</blockquote><blockquote>B</blockquote>");
    expect(html).toContain('<ol start="3"><li>third</li><li>fourth</li></ol>');
  });

  it("treats backslash escapes as literal text", () => {
    const html = renderClip("\\*not em\\* \\<tag\\> \\# x\n\\- item");
    expect(html).toContain("*not em* &lt;tag&gt; # x");
    expect(html).not.toContain("<em>");
    expect(html).not.toContain("<ul>");
  });

  it("is stable when sanitizing twice", () => {
    const once = renderClip('<div><video controls src="https://s3.cv.cm/files/clip/abcdefgh/a.mp4"></video><a href="https://x.test/?a=1&amp;b=2">l</a></div>');
    const twice = renderClip(once);
    expect(twice).toContain("<video controls src=\"https://s3.cv.cm/files/clip/abcdefgh/a.mp4\">");
    expect(twice).toContain('href="https://x.test/?a=1&amp;b=2"');
    expect(twice).toBe(once);
  });

  it("decodes entities before checking urls", () => {
    expect(renderClip('<p><a href="javascript&#58;alert(1)">x</a></p>')).not.toContain("javascript");
  });

  it("keeps loose lists together", () => {
    expect(renderClip("- a\n\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(renderClip("1. a\n\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("renders pipe tables", () => {
    const html = renderClip("| A | B |\n| --- | --- |\n| 1 | **2** |");
    expect(html).toBe("<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table>");
  });

  it("leaves private-use glyphs alone", () => {
    expect(renderClip("a \ue0b0 b")).toContain("\ue0b0");
  });

  it("does not mangle text or urls that contain on…=", () => {
    const html = renderClip('<div><p>WHERE month=3</p><a href="https://x.test/?month=3">m</a></div>');
    expect(html).toContain("WHERE month=3");
    expect(html).toContain('href="https://x.test/?month=3"');
  });

  it("drops handlers in malformed or nested tags", () => {
    for (const src of [
      '<div><img/src="https://s3.cv.cm/a.png"/onerror=alert(1)></div>',
      '<div><b<img src=x onerror=alert(1)>x</b></div>',
      '<div><a href="https://x.test" title="</a><img onerror=alert(1)>">t</a></div>',
      '<div><svg onload=alert(1)><circle/></svg></div>',
    ]) {
      const html = renderClip(src);
      expect(html, src).not.toMatch(/<[^>]*\son[a-z]+\s*=/i);
      expect(html, src).not.toContain("<svg");
    }
  });

  it("cannot glue a tag together by dropping a disallowed one", () => {
    for (const src of [
      "<div><<x>img src=x onerror=alert(1)></div>",
      '<div><<x>a href=https://evil.test style="position:fixed">t</a></div>',
      "<div><scr<x>ipt>alert(1)</script></div>",
    ]) {
      const html = renderClip(src);
      expect(html, src).not.toMatch(/<img[^>]*onerror|<a[^>]*style|<script/i);
      expect(renderClip(html), src).toBe(html);
    }
  });

  it("keeps & in markdown links and alt text single-escaped", () => {
    const html = renderClip("[a & b](https://x.test/?a=1&b=2)");
    expect(html).toBe('<p><a href="https://x.test/?a=1&amp;b=2" rel="noreferrer">a &amp; b</a></p>');
  });

  it("keeps backslashes inside inline code", () => {
    expect(renderClip("`\\d+\\.\\d+` and `a\\*b`")).toBe("<p><code>\\d+\\.\\d+</code> and <code>a\\*b</code></p>");
  });

  it("does not apply emphasis inside urls", () => {
    expect(renderClip("[x](https://a.test/*foo*)")).toContain('href="https://a.test/*foo*"');
  });

  it("keeps pipe lines verbatim when they are not a table", () => {
    expect(renderClip("|  a  |")).toBe("<p>|  a  |</p>");
  });

  it("treats an escaped backtick as text", () => {
    expect(renderClip("run \\`npm i\\` now")).toBe("<p>run `npm i` now</p>");
  });

  it("renders emphasis nested in bold", () => {
    expect(renderClip("**a *b* c**")).toBe("<p><strong>a <em>b</em> c</strong></p>");
  });

  it("finds fences in CRLF text", () => {
    expect(renderClip("```js\r\nconst a = 1;\r\n```")).toContain('<pre><code class="lang-js">');
  });

  it("does not treat typed fence markers as tokens", () => {
    expect(renderClip("%%FENCE0%%")).toBe("<p>%%FENCE0%%</p>");
  });

  it("keeps code markup out of attributes", () => {
    expect(renderClip("![`x`](https://a.test/b.png)")).toBe('<p><img src="https://a.test/b.png" alt="x"></p>');
  });

  it("drops style bodies from html notes", () => {
    expect(renderClip("<p>a</p><style>.x{color:red}</style>")).toBe("<p>a</p>");
  });

  it("stays fast on unmatched brackets", () => {
    const t0 = Date.now();
    renderClip("[".repeat(64000));
    renderClip("[a](".repeat(16000));
    expect(Date.now() - t0).toBeLessThan(800);
  });

  it("keeps a trailing backslash in inline code", () => {
    expect(renderClip("path `C:\\` here")).toBe("<p>path <code>C:\\</code> here</p>");
  });

  it("never reads two adjacent tokens as a third", () => {
    expect(renderClip("\\[c1\\] only")).toBe("<p>[c1] only</p>");
    expect(renderClip("`x` `y` \\[c1\\]")).toBe("<p><code>x</code> <code>y</code> [c1]</p>");
    expect(renderClip("[l](https://a.test) \\*h0\\*")).toBe('<p><a href="https://a.test" rel="noreferrer">l</a> *h0*</p>');
    expect(renderClip("\\*h5\\*")).toBe("<p>*h5*</p>");
  });

  it("supports longer fences and code spans", () => {
    const fenced = renderClip("````\na\n```\nb\n````");
    expect(fenced.startsWith("<pre>")).toBe(true);
    expect(fenced.endsWith("</code></pre>")).toBe(true);
    expect(fenced).not.toContain("<p>");
    expect(renderClip("``a`b``")).toBe("<p><code>a`b</code></p>");
    expect(renderClip("`` `x` ``")).toBe("<p><code>`x`</code></p>");
  });

  it("renders code blocks, lists and paragraphs inside quotes", () => {
    const html = renderClip("> intro\n>\n> ```js\n> const a = 1;\n> ```\n>\n> - x\n> - y");
    expect(html.startsWith("<blockquote><p>intro</p><pre><code class=\"lang-js\">")).toBe(true);
    expect(html).toContain("<ul><li>x</li><li>y</li></ul></blockquote>");
  });

  it("does not read > inside fenced code as a quote", () => {
    expect(renderClip("```\n> not a quote\n```")).toBe('<pre><code class="lang-">&gt; not a quote</code></pre>');
  });

  it("nests lists by indentation", () => {
    expect(renderClip("- a\n    - b\n        1. c\n        2. d\n- e")).toBe(
      "<ul><li>a<ul><li>b<ol><li>c</li><li>d</li></ol></li></ul></li><li>e</li></ul>");
  });

  it("caps nesting depth on hostile input", () => {
    const t0 = Date.now();
    const quotes = renderClip(">".repeat(64000) + " x");
    const lists = renderClip(Array.from({ length: 4000 }, (_, i) => `${" ".repeat(i)}- x`).join("\n"));
    expect(quotes.split("<blockquote>").length - 1).toBeLessThanOrEqual(8);
    expect(lists.split("<ul>").length - 1).toBeLessThanOrEqual(4000);
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("keeps indented fences, also under list items", () => {
    expect(renderClip("1. Install\n   ```bash\n   npm i\n   ```\n2. Run")).toBe(
      '<ol><li>Install<pre><code class="lang-bash">npm i</code></pre></li><li>Run</li></ol>');
    expect(renderClip("  ```js\n  const a = 1;\n  ```")).toBe(
      '<pre><code class="lang-js"><span class="k">const</span> a = 1;</code></pre>');
  });

  it("accepts a fence closed at the end of the last code line", () => {
    expect(renderClip("```js\nconst a = 1;```")).toBe('<pre><code class="lang-js"><span class="k">const</span> a = 1;</code></pre>');
  });

  it("stays linear on many unclosed fences", () => {
    const t0 = Date.now();
    renderClip("```a\n".repeat(13000));
    renderClip("> ```a\n".repeat(9000));
    expect(Date.now() - t0).toBeLessThan(800);
  });

  it("only lets -, * or 1. interrupt a paragraph", () => {
    expect(renderClip("Text\n  2024. was great")).toBe("<p>Text<br>  2024. was great</p>");
  });

  it("treats a dedent to a middle indent as a sibling", () => {
    expect(renderClip("- a\n        - b\n    - c\n- d")).toBe("<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>");
  });

  it("puts quotes and continuation lines inside list items", () => {
    expect(renderClip("- a\n  more\n    > q\n- b")).toBe("<ul><li>a<br>more<blockquote>q</blockquote></li><li>b</li></ul>");
  });

  it("reads a bare number line as text but a bare dash as an empty item", () => {
    expect(renderClip("2024.")).toBe("<p>2024.</p>");
    expect(renderClip("-\n    - b")).toBe("<ul><li><ul><li>b</li></ul></li></ul>");
  });

  it("does not split table cells on escaped pipes or pipes in code", () => {
    expect(renderClip("| a | b |\n|---|---|\n| x \\| y | `p|q` |")).toBe(
      "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>x | y</td><td><code>p|q</code></td></tr></tbody></table>");
  });

  it("keeps a lone dash as text", () => {
    expect(renderClip("notes\n\n-\n\nmore")).toBe("<p>notes</p><p>-</p><p>more</p>");
  });

  it("keeps continuation text in an item", () => {
    expect(renderClip("- Our year\n  2024. was great")).toBe("<ul><li>Our year<br>2024. was great</li></ul>");
  });

  it("lets an item's fence close at a smaller indent", () => {
    expect(renderClip("1. Install:\n   ```\n   npm i\n```\n2. Next")).toBe(
      '<ol><li>Install:<pre><code class="lang-">npm i</code></pre></li><li>Next</li></ol>');
  });

  it("reads a fence opened at the end of a text line", () => {
    expect(renderClip("Text ```\ncode\n```")).toBe('<p>Text</p><pre><code class="lang-">code</code></pre>');
  });

  it("stays fast on long continuation runs and backtick lines", () => {
    const t0 = Date.now();
    renderClip("- a\n" + "  b\n".repeat(100000));
    renderClip(("`".repeat(2000) + "x\n").repeat(50));
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("plays audio links and keeps audio tags", () => {
    expect(renderClip("![a](https://s3.cv.cm/files/clip/abcdefabcdefabcd/a.mp3)")).toBe(
      '<p><audio controls src="https://s3.cv.cm/files/clip/abcdefabcdefabcd/a.mp3"></audio></p>');
    expect(renderClip('<div><audio controls src="https://s3.cv.cm/a.mp3" onplay="x()"></audio></div>')).toBe(
      '<div><audio controls src="https://s3.cv.cm/a.mp3"></audio></div>');
  });

  it("nests a deeper ordered list that does not start at 1", () => {
    expect(renderClip("- a\n    - b\n        3. c\n        4. d\n- e")).toBe(
      '<ul><li>a<ul><li>b<ol start="3"><li>c</li><li>d</li></ol></li></ul></li><li>e</li></ul>');
  });

  it("opens a fence at the end of a list or quote line", () => {
    expect(renderClip("- a ```\n  b\n  ```")).toBe('<ul><li>a<pre><code class="lang-">b</code></pre></li></ul>');
    expect(renderClip("> a ```\n> b\n> ```")).toBe('<blockquote><p>a</p><pre><code class="lang-">b</code></pre></blockquote>');
  });

  it("keeps indented notes and YAML as text", () => {
    expect(renderClip("text\n    - not a list")).toBe("<p>text<br>    - not a list</p>");
    expect(renderClip("steps:\n  - run: a")).toBe("<p>steps:<br>  - run: a</p>");
  });

  it("does not let an unclosed fence in an item swallow what follows", () => {
    const html = renderClip("- step\n  ```\n  run x\n- next step\n\nSome text\n\n```js\ncode\n```");
    expect(html).toContain("<li>next step</li>");
    expect(html).toContain("<p>Some text</p>");
    expect(html).toContain('<pre><code class="lang-js">code</code></pre>');
  });

  it("nests under wide ordered markers", () => {
    expect(renderClip("99. a\n     3. x\n     4. y")).toBe('<ol start="99"><li>a<ol start="3"><li>x</li><li>y</li></ol></li></ol>');
  });
});
