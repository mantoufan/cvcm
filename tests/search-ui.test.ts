// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeSearch, openSearch, setSearchIndexForTest } from "../src/client/search";
import type { SearchEntry } from "../src/shared/search";

const INDEX: SearchEntry[] = [
  ["tool", "/en/merge-pdf/", "Merge PDF", "Combine PDFs in the browser."],
  ["learn", "/en/learn/merge-pdf/", "How to merge PDFs", "Step by step."],
  ["tests", "/en/tests/", "Tests", "Personality tests."],
];

let header: HTMLElement;
let button: HTMLButtonElement;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  setSearchIndexForTest(INDEX);
  header = document.createElement("header");
  button = document.createElement("button");
  header.append(button);
  document.body.append(header);
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  openSearch(header, button);
});

afterEach(() => {
  closeSearch();
  header.remove();
  setSearchIndexForTest(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const input = () => header.querySelector<HTMLInputElement>(".search-input")!;
async function type(text: string): Promise<void> {
  input().value = text;
  input().dispatchEvent(new Event("input"));
  await vi.runAllTimersAsync();
}

describe("search panel", () => {
  it("lists matches with channel, name and blurb, first one selected", async () => {
    await type("merge pdf");
    const hits = [...header.querySelectorAll(".search-hit")];
    expect(hits.map((a) => a.getAttribute("href"))).toEqual(["/en/merge-pdf/", "/en/learn/merge-pdf/"]);
    expect(hits[0].querySelector(".search-ch")?.textContent).toBe("Tools");
    expect(hits[0].querySelector(".search-blurb")?.textContent).toBe("Combine PDFs in the browser.");
    expect(header.querySelector("[aria-selected=true] a")?.getAttribute("href")).toBe("/en/merge-pdf/");
    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves the selection with the arrow keys", async () => {
    await type("pdf");
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(header.querySelector("[aria-selected=true] a")?.getAttribute("href")).toBe("/en/learn/merge-pdf/");
  });

  it("records a miss once after a pause and offers the email form", async () => {
    await type("remove watermark");
    expect(header.querySelector(".search-none")?.textContent).toContain("remove watermark");
    expect(header.querySelector(".search-email")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/search/miss");
    expect(JSON.parse(String(init.body))).toEqual({ q: "remove watermark", locale: "en" });
    await type("remove watermark ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not record a query still being typed", async () => {
    input().value = "remove water";
    input().dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(300);
    await type("merge");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not record single Latin letters or personal data", async () => {
    await type("q");
    await type("me@example.com");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(header.querySelector(".search-email")).toBeNull();
  });

  it("sends the email request and confirms", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await type("remove watermark");
    const email = header.querySelector<HTMLInputElement>(".search-email")!;
    email.value = "Me@Example.com";
    header.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.runAllTimersAsync();
    const call = fetchMock.mock.calls.find(([u]) => u === "/api/search/notify") as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ q: "remove watermark", locale: "en", email: "me@example.com" });
    expect(header.querySelector(".search-done")?.textContent).toContain("me@example.com");
  });

  it("closes on Escape and gives focus back to the button", async () => {
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(header.querySelector(".search-pop")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
