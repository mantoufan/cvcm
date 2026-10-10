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
});
