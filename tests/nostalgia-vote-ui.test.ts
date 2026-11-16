// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/shared/messages-all";
import { mountNostalgia } from "../src/client/nostalgia/ui";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("nostalgia vote UI", () => {
  it("sends nothing at mount, posts on click, shows the share and remembers the answer", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ yes: 3, no: 1, counted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    // Attached: the handler skips pages that were navigated away from while the request ran.
    const host = document.body.appendChild(document.createElement("div"));
    mountNostalgia(host, "zh-CN", "white-rabbit");
    expect(fetchMock).not.toHaveBeenCalled();
    // Shown only once wired.
    expect(host.querySelector(".nostalgia-vote")!.classList.contains("ready")).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('button[data-answer="yes"]')!.disabled).toBe(false);
    host.querySelector<HTMLButtonElement>('button[data-answer="yes"]')!.click();
    await vi.waitFor(() => expect(host.querySelector(".nostalgia-vote-result")!.textContent).toContain("%"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/nostalgia/vote");
    expect(JSON.parse(String(init.body))).toEqual({ id: "white-rabbit", answer: "yes" });
    const result = host.querySelector<HTMLElement>(".nostalgia-vote-result")!;
    expect(result.hidden).toBe(false);
    expect(result.textContent).toBe("75% 的回答是「尝过」 · 共 4 份回答 · 你的回答：尝过");
    expect(host.querySelector<HTMLButtonElement>('button[data-answer="yes"]')!.getAttribute("aria-pressed")).toBe("true");

    // Coming back: the stored answer shows at once, with no request.
    const again = document.createElement("div");
    mountNostalgia(again, "zh-CN", "white-rabbit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // An earlier answer's totals are labelled as a snapshot.
    expect(again.querySelector(".nostalgia-vote-result")!.textContent).toBe("75% 的回答是「尝过」 · 共 4 份回答（你回答时的统计） · 你的回答：尝过");
    expect(again.querySelector<HTMLButtonElement>('button[data-answer="no"]')!.disabled).toBe(true);
  });

  it("says so when the network reached today's cap", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ yes: 1, no: 0, counted: false }), { status: 200 })));
    const host = document.body.appendChild(document.createElement("div"));
    mountNostalgia(host, "en", "famicom");
    host.querySelector<HTMLButtonElement>('button[data-answer="no"]')!.click();
    await vi.waitFor(() => expect(host.querySelector(".nostalgia-vote-result")!.textContent).toContain("%"));
    expect(host.querySelector(".nostalgia-vote-result")!.textContent).toContain("Your network has reached today's limit for this page");
    // Not remembered: the reader can answer again another day.
    expect(localStorage.getItem("cvcm.nostalgia.vote.famicom")).toBeNull();
    // But not again today: a re-mount shows the limit and sends nothing.
    const again = document.body.appendChild(document.createElement("div"));
    mountNostalgia(again, "en", "famicom");
    expect(again.querySelector<HTMLButtonElement>('button[data-answer="yes"]')!.disabled).toBe(true);
    expect(again.querySelector(".nostalgia-vote-result")!.textContent).toContain("today's limit");
  });

  it("a page re-mounted while the answer is on its way waits for it instead of asking again", async () => {
    let release: (r: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { release = r; }));
    vi.stubGlobal("fetch", fetchMock);
    const first = document.body.appendChild(document.createElement("div"));
    mountNostalgia(first, "en", "tamagotchi");
    first.querySelector<HTMLButtonElement>('button[data-answer="yes"]')!.click();
    // Locale switch: the page is rebuilt before the reply.
    first.remove();
    const again = document.body.appendChild(document.createElement("div"));
    mountNostalgia(again, "ja", "tamagotchi");
    expect(again.querySelector<HTMLButtonElement>('button[data-answer="yes"]')!.disabled).toBe(true);
    release(new Response(JSON.stringify({ yes: 2, no: 0, counted: true }), { status: 200 }));
    await vi.waitFor(() => expect(again.querySelector(".nostalgia-vote-result")!.textContent).toContain("100%"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets the reader try again when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const host = document.body.appendChild(document.createElement("div"));
    mountNostalgia(host, "en", "pager");
    host.querySelector<HTMLButtonElement>('button[data-answer="no"]')!.click();
    await vi.waitFor(() => expect(host.querySelector<HTMLButtonElement>('button[data-answer="no"]')!.disabled).toBe(false));
    expect(host.querySelector(".nostalgia-vote-result")!.textContent).toBe("Could not send your answer. Please try again later.");
    expect(host.querySelector<HTMLButtonElement>('button[data-answer="no"]')!.disabled).toBe(false);
    expect(localStorage.getItem("cvcm.nostalgia.vote.pager")).toBeNull();
  });
});
