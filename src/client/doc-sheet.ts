/**
 * The paper preview and printing shared by the letter and résumé tools. The preview is a scaled page (sizes in em of
 * a font set from the sheet's width); printing copies one sheet into a print-only root so the browser's "Save as PDF"
 * writes real, selectable text in the visitor's own fonts (CJK and vertical Japanese included).
 */
import { h } from "./dom";
import type { LetterDoc, Paper } from "../shared/letter-doc";

/** The paper a language usually prints on: Letter in the US (en), A4 elsewhere. */
export function defaultPaper(loc: string): Paper {
  return loc === "en" ? "letter" : "a4";
}

/** An empty sheet of the given paper; `doc-page` styles live in styles.css. */
export function sheet(paper: Paper, extra = ""): HTMLElement {
  return h("div", { class: `doc-page doc-${paper}${extra ? ` ${extra}` : ""}`, "data-out": "sheet" });
}

/** Fills a sheet with a letter's lines. */
export function paintLetter(page: HTMLElement, doc: LetterDoc): void {
  page.lang = doc.lang;
  page.classList.toggle("doc-vertical", Boolean(doc.vertical));
  page.classList.toggle("doc-serif", Boolean(doc.serif));
  page.replaceChildren(...doc.lines.map((line) => line.table ? h("table", {
    class: "doc-table",
    style: line.gap ? { marginBlockStart: `${line.gap * 1.6}em` } : null,
  }, h("tbody", null, ...line.table.map(([k, v]) => h("tr", null, h("th", { scope: "row" }, k), h("td", null, v))))) : h("p", {
    class: [
      "doc-line",
      `doc-${line.size ?? "body"}`,
      line.align && line.align !== "start" ? `doc-${line.align}` : "",
      line.bold ? "doc-bold" : "",
      line.indent ? "doc-indent" : "",
    ].filter(Boolean).join(" "),
    style: line.gap ? { marginBlockStart: `${line.gap * 1.6}em` } : null,
  }, line.text)));
}

let cleanup: (() => void) | null = null;

/**
 * Prints one sheet by itself. The browser's dialog offers "Save as PDF"; the document title becomes the PDF's
 * suggested file name. Nothing leaves the page.
 */
export function printSheet(page: HTMLElement, paper: Paper, title: string): void {
  cleanup?.();
  if (typeof window.print !== "function") return;
  const root = h("div", { class: "print-root" }, page.cloneNode(true));
  const style = h("style", null,
    `@page { size: ${paper === "letter" ? "letter" : "A4"}; margin: ${paper === "letter" ? "1in" : "20mm"}; }`);
  const before = document.title;
  document.body.append(root, style);
  document.body.classList.add("printing-doc");
  document.title = title;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    root.remove();
    style.remove();
    document.body.classList.remove("printing-doc");
    document.title = before;
    window.removeEventListener("afterprint", finish);
    cleanup = null;
  };
  cleanup = finish;
  window.addEventListener("afterprint", finish);
  window.print();
  // Some mobile browsers return from print() before printing and never fire afterprint.
  window.setTimeout(finish, 60_000);
}
