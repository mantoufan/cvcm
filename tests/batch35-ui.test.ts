// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountCitation, unmountCitation } from "../src/client/citation-generator/ui";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  window.localStorage.clear();
});

afterEach(() => {
  unmountCitation();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const text = (sel: string) => q(sel).textContent ?? "";
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};

describe("citation generator ui", () => {
  it("opens with the example in APA, and switches styles", () => {
    mountCitation(host, "apa", "main");
    expect(text("h1")).toBe("Citation generator");
    expect(q("[data-out=reference]").innerHTML).toBe("LeCun, Y., Bengio, Y., &amp; Hinton, G. (2015). Deep learning. <i>Nature</i>, <i>521</i>(7553), 436–444. https://doi.org/10.1038/nature14539");
    expect(text("[data-out=intext]")).toBe("In-text citation: (LeCun et al., 2015)");
    set("[data-field=style]", "ieee", "change");
    expect(text("[data-out=reference]")).toContain('Y. LeCun, Y. Bengio, and G. Hinton, "Deep learning," Nature, vol. 521');
    expect(text("[data-out=intext]")).toBe("In-text citation: [1]");
  });

  it("starts in the page's style and hides fields the source type does not use", () => {
    mountCitation(host, "mla", "mla");
    expect(text("h1")).toBe("MLA citation generator");
    expect(text("[data-out=reference]")).toMatch(/^LeCun, Yann, et al\. "Deep learning\." Nature, vol\. 521/);
    set("[data-field=type]", "book", "change");
    expect(q("[data-for=volume]").hidden).toBe(true);
    expect(q("[data-for=publisher]").hidden).toBe(false);
    set("[data-field=title]", "");
    expect(text("[data-out=reference]")).toBe("Add a title to see the reference.");
    expect(q<HTMLButtonElement>("[data-action=copy]").disabled).toBe(true);
  });

  it("fills the form from a DOI lookup (GET, no cookies) and reports failures", { timeout: 40_000 }, async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: { type: "book", title: ["A Book"], author: [{ given: "Ann", family: "Lee" }], issued: { "date-parts": [[1999]] }, publisher: "P", DOI: "10.1000/x" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    mountCitation(host, "apa", "main");
    set("[data-field=lookup]", "10.1000/x");
    q<HTMLButtonElement>("[data-action=find]").click();
    await vi.waitFor(() => expect(text("[data-out=lookup-status]")).toMatch(/^Found/), { timeout: 10000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.crossref.org/works/10.1000%2Fx");
    expect(init).toMatchObject({ method: "GET", credentials: "omit", referrerPolicy: "no-referrer" });
    expect(text("[data-out=reference]")).toBe("Lee, A. (1999). A Book. P. https://doi.org/10.1000/x");
    // Crossref and then DataCite both answer 404.
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    q<HTMLButtonElement>("[data-action=find]").click();
    await vi.waitFor(() => expect(text("[data-out=lookup-status]")).toMatch(/^Nothing/), { timeout: 10000 });
    expect(text("[data-out=lookup-status]")).toContain("Nothing found");
    set("[data-field=lookup]", "not a doi");
    q<HTMLButtonElement>("[data-action=find]").click();
    await vi.waitFor(() => expect(text("[data-out=lookup-status]")).toMatch(/^That/), { timeout: 10000 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to DataCite when Crossref does not know a DOI", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.startsWith("https://api.crossref.org")
      ? new Response("{}", { status: 404 })
      : new Response(JSON.stringify({ data: { attributes: { doi: "10.48550/x", titles: [{ title: "P" }], creators: [{ familyName: "Lee", givenName: "Ann" }], publisher: "arXiv", publicationYear: 2020, types: { resourceTypeGeneral: "Preprint" } } } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    mountCitation(host, "apa", "main");
    set("[data-field=lookup]", "10.48550/x");
    q<HTMLButtonElement>("[data-action=find]").click();
    await vi.waitFor(() => expect(text("[data-out=lookup-status]")).toMatch(/^Found/), { timeout: 10000 });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["https://api.crossref.org/works/10.48550%2Fx", "https://api.datacite.org/dois/10.48550%2Fx"]);
    expect(text("[data-out=reference]")).toBe("Lee, A. (2020). P. arXiv. https://doi.org/10.48550/x");
  });

  it("builds a sorted list kept in this browser, exports it and clears with two taps", () => {
    mountCitation(host, "apa", "main");
    q<HTMLButtonElement>("[data-action=add]").click();
    set("[data-field=import]", "@book{k, author = {Adams, Douglas}, title = {The Hitchhiker's Guide}, publisher = {Pan}, year = {1979}}\n@book{z, author = {Zed, Ann}, title = {Zzz}, publisher = {Q}, year = {2000}}");
    q<HTMLButtonElement>("[data-action=import]").click();
    expect(text("[data-out=import-status]")).toContain("Entries imported: 2.");
    // The first imported entry is already in the list, so it cannot be added again from the form.
    expect(q<HTMLButtonElement>("[data-action=add]").disabled).toBe(true);
    const items = [...host.querySelectorAll("[data-out=list] li")].map((li) => li.textContent ?? "");
    expect(items).toHaveLength(3);
    expect(items[0]).toMatch(/^Adams, D\. \(1979\)/);
    expect(items[2]).toMatch(/^Zed, A\./);
    expect(JSON.parse(window.localStorage.getItem("cvcm.citations.v1")!)).toHaveLength(3);
    q<HTMLButtonElement>("[data-action=remove]").click();
    expect(host.querySelectorAll("[data-out=list] li")).toHaveLength(2);
    q<HTMLButtonElement>("[data-action=clear-list]").click();
    expect(host.querySelectorAll("[data-out=list] li")).toHaveLength(2);
    set("[data-field=style]", "ieee", "change");
    expect(text("[data-out=intext]")).toBe("In-text citation: [3]");
    // The style change re-rendered the list, which disarms a half-pressed Clear: two taps again.
    q<HTMLButtonElement>("[data-action=clear-list]").click();
    q<HTMLButtonElement>("[data-action=clear-list]").click();
    expect(text("[data-out=list]")).toContain("Added references appear here");
    expect(text("[data-out=intext]")).toBe("In-text citation: [1]");
  });

  it("ignores fields hidden for the source type, and keeps a listed source's number", () => {
    mountCitation(host, "apa", "main");
    set("[data-field=type]", "webpage", "change");
    // Volume and issue are hidden for a web page and must not leak into it; the DOI field stays (web pages may have one).
    expect(text("[data-out=reference]")).not.toContain("521");
    expect(text("[data-out=reference]")).not.toContain("7553");
    set("[data-field=doi]", "");
    set("[data-field=url]", "https://example.com/p");
    expect(text("[data-out=reference]")).toContain("https://example.com/p");
    expect(text("[data-out=reference]")).not.toContain("doi.org");
    set("[data-field=style]", "ieee", "change");
    expect(text("[data-out=intext]")).toBe("In-text citation: [1]");
    q<HTMLButtonElement>("[data-action=add]").click();
    expect(text("[data-out=intext]")).toBe("In-text citation: [1]");
    set("[data-field=title]", "Another page");
    expect(text("[data-out=intext]")).toBe("In-text citation: [2]");
  });

  it("keeps another tab's additions and numbers the list as text", () => {
    mountCitation(host, "ieee", "main");
    q<HTMLButtonElement>("[data-action=add]").click();
    // Another tab adds a source meanwhile.
    const other = JSON.parse(window.localStorage.getItem("cvcm.citations.v1")!);
    other.push({ ...other[0], title: "From the other tab" });
    window.localStorage.setItem("cvcm.citations.v1", JSON.stringify(other));
    window.dispatchEvent(new StorageEvent("storage", { key: "cvcm.citations.v1" }));
    expect(host.querySelectorAll("[data-out=list] li")).toHaveLength(2);
    set("[data-field=title]", "A third one");
    q<HTMLButtonElement>("[data-action=add]").click();
    const items = [...host.querySelectorAll("[data-out=list] li")].map((li) => li.textContent ?? "");
    expect(items).toHaveLength(3);
    expect(items[1]).toMatch(/^\[2\] .*From the other tab/);
    expect(text("[data-out=intext]")).toBe("In-text citation: [3]");
  });

  it("keeps working from memory when storage is blocked", () => {
    mountCitation(host, "apa", "main");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    q<HTMLButtonElement>("[data-action=add]").click();
    set("[data-field=title]", "Second source");
    q<HTMLButtonElement>("[data-action=add]").click();
    expect(host.querySelectorAll("[data-out=list] li")).toHaveLength(2);
  });

  it("keeps name suffixes in the saved list and can remove such an entry", () => {
    mountCitation(host, "apa", "main");
    set("[data-field=authors]", "King, Martin Luther, Jr.");
    q<HTMLButtonElement>("[data-action=add]").click();
    expect(text("[data-out=list]")).toContain("King, M. L., Jr.");
    unmountCitation();
    host.replaceChildren();
    mountCitation(host, "apa", "main");
    expect(text("[data-out=list]")).toContain("King, M. L., Jr.");
    q<HTMLButtonElement>("[data-action=remove]").click();
    expect(text("[data-out=list]")).toContain("Added references appear here");
  });

  it("survives a damaged saved list", () => {
    window.localStorage.setItem("cvcm.citations.v1", JSON.stringify([{ title: "x", authors: null, type: "article", container: "J" }, { title: 5 }, "junk", { title: "y", type: "nope" }]));
    mountCitation(host, "apa", "main");
    expect(host.querySelectorAll("[data-out=list] li")).toHaveLength(1);
    expect(text("[data-out=list]")).toContain("x. (n.d.). J.");
  });

  it("does not touch storage or the network on mount", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mountCitation(host, "harvard", "harvard");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(text("[data-out=reference]")).toMatch(/^LeCun, Y\., Bengio, Y\. and Hinton, G\. \(2015\) 'Deep learning'/);
  });
});
