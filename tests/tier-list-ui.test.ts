// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountTierList, unmountTierList } from "../src/client/tier-list/ui";

let host: HTMLElement;
const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const qa = (sel: string) => Array.from(host.querySelectorAll<HTMLElement>(sel));
const tap = (el: HTMLElement) => {
  el.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientX: 5, clientY: 5, bubbles: true }));
  window.dispatchEvent(new PointerEvent("pointerup", { button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
};

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountTierList();
  host.remove();
  vi.unstubAllGlobals();
});

describe("tier list ui", () => {
  it("starts with the sample in the pool and S to D rows in English", () => {
    mountTierList(host);
    expect(qa(".tier-pool [data-item]").length).toBe(6);
    expect(qa("[data-field=label]").map((el) => (el as HTMLInputElement).value)).toEqual(["S", "A", "B", "C", "D"]);
  });

  it("tap to pick, tap Put here to place, on the same list too", () => {
    mountTierList(host);
    const first = qa(".tier-pool [data-item]")[0];
    const name = first.textContent;
    tap(first);
    expect(q("[data-out=note]").textContent).toContain(name!);
    const place = qa("[data-tier] [data-action=place]")[1];
    place.click();
    expect(qa("[data-tier]")[1].querySelector("[data-item]")?.textContent).toBe(name);
    expect(qa(".tier-pool [data-item]").length).toBe(5);
    expect(host.querySelector("[data-action=place]")).toBeNull();
  });

  it("adds typed items without repeats, then remembers text across mounts", () => {
    mountTierList(host);
    const entry = q<HTMLTextAreaElement>("[data-field=entry]");
    entry.value = "Pizza\nNew one\nNew one";
    q("[data-action=add]").click();
    expect(qa(".tier-pool [data-item]").length).toBe(7);
    unmountTierList();
    host.replaceChildren();
    mountTierList(host);
    expect(qa(".tier-pool [data-item]").map((el) => el.textContent)).toContain("New one");
  });

  it("switches preset, keeping items, and drops rows past the list", () => {
    mountTierList(host);
    tap(qa(".tier-pool [data-item]")[0]);
    qa("[data-tier] [data-action=place]")[4].click();
    const preset = q<HTMLSelectElement>("[data-field=preset]");
    preset.value = "hang";
    preset.dispatchEvent(new Event("change"));
    expect((qa("[data-field=label]")[0] as HTMLInputElement).value).toBe("夯");
    expect(qa("[data-tier]")[4].querySelector("[data-item]")).not.toBeNull();
  });

  it("removes a row back to the pool", () => {
    mountTierList(host);
    tap(qa(".tier-pool [data-item]")[0]);
    qa("[data-tier] [data-action=place]")[0].click();
    qa("[data-action=remove-row]")[0].click();
    expect(qa("[data-tier]").length).toBe(4);
    expect(qa(".tier-pool [data-item]").length).toBe(6);
  });

  it("deletes the selected item and frees the button", () => {
    mountTierList(host);
    const del = q<HTMLButtonElement>("[data-action=delete-item]");
    expect(del.disabled).toBe(true);
    tap(qa(".tier-pool [data-item]")[0]);
    expect(q<HTMLButtonElement>("[data-action=delete-item]").disabled).toBe(false);
    q("[data-action=delete-item]").click();
    expect(qa(".tier-pool [data-item]").length).toBe(5);
    expect(q<HTMLButtonElement>("[data-action=delete-item]").disabled).toBe(true);
  });

  it("makes no network request at mount", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    mountTierList(host);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("tier list preset select", () => {
  it("shows the remembered board's preset", () => {
    mountTierList(host);
    const preset = q<HTMLSelectElement>("[data-field=preset]");
    preset.value = "feeling";
    preset.dispatchEvent(new Event("change"));
    unmountTierList();
    host.replaceChildren();
    mountTierList(host);
    expect(q<HTMLSelectElement>("[data-field=preset]").value).toBe("feeling");
  });
});

describe("tier list fixes", () => {
  it("start over asks once on a board with items, and works from a custom board", () => {
    mountTierList(host);
    const label = q<HTMLInputElement>("[data-field=label]");
    label.value = "Custom";
    label.dispatchEvent(new Event("input"));
    unmountTierList();
    host.replaceChildren();
    mountTierList(host);
    q("[data-action=start-over]").click();
    expect(qa(".tier-pool [data-item]").length).toBe(6);
    q("[data-action=start-over]").click();
    expect(qa(".tier-pool [data-item]").length).toBe(0);
    expect(qa("[data-field=label]").map((el) => (el as HTMLInputElement).value)).not.toContain("Custom");
  });

  it("does not write to storage until something changes", () => {
    mountTierList(host);
    window.dispatchEvent(new Event("pagehide"));
    unmountTierList();
    expect(localStorage.getItem("cvcm_tier_list")).toBeNull();
  });

  it("keeps lines that did not fit in the box", () => {
    mountTierList(host);
    const entry = q<HTMLTextAreaElement>("[data-field=entry]");
    entry.value = Array.from({ length: 250 }, (_, i) => `n${i}`).join("\n");
    q("[data-action=add]").click();
    expect(q<HTMLTextAreaElement>("[data-field=entry]").value.split("\n")).toHaveLength(56);
  });

  it("ignores a second pointer during a drag and does not treat a touch swipe as a tap", () => {
    mountTierList(host);
    const [a, b] = qa(".tier-pool [data-item]");
    a.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1, pointerType: "touch", clientX: 5, clientY: 5, bubbles: true }));
    b.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 2, clientX: 5, clientY: 5, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 5, clientY: 50 }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 5, clientY: 50 }));
    expect(host.querySelector(".tier-item.picked")).toBeNull();
    expect(document.querySelector(".tier-ghost")).toBeNull();
  });

  it("keeps keyboard focus on the row control after a repaint", () => {
    mountTierList(host);
    const down = qa("[aria-label='Move row down']")[0];
    down.focus();
    down.click();
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe("Move row down");
  });
});
