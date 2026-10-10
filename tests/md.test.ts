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
});
