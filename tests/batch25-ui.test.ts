// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountArea, unmountArea } from "../src/client/area/ui";
import { mountVolume, unmountVolume } from "../src/client/volume/ui";
import { mountRandomLetter, unmountRandomLetter } from "../src/client/random-letter/ui";
import { mountImageSplitter, unmountImageSplitter } from "../src/client/image-splitter/ui";
import { mountGifMaker, unmountGifMaker } from "../src/client/gif-maker/ui";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountArea();
  unmountVolume();
  unmountRandomLetter();
  unmountImageSplitter();
  unmountGifMaker();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};
const click = (sel: string) => q<HTMLButtonElement>(sel).click();

describe("area ui", () => {
  it("starts with a worked rectangle and follows shape and unit changes", () => {
    mountArea(host);
    expect(q("[data-out=main]").textContent).toBe("15 m²");
    expect(q("[data-out=formula]").textContent).toBe("A = l × w");
    expect(host.querySelectorAll("[data-field=shape] option")).toHaveLength(12);
    set("[data-field=unit]", "ft", "change");
    expect(q("[data-out=main]").textContent).toBe("15 ft²");
    set("[data-field=shape]", "circle", "change");
    expect(q("[data-out=error]").textContent).toBe("Fill in every size for this shape.");
    set("[data-field=radius]", "2");
    expect(q("[data-out=main]").textContent).toBe("12.566371 ft²");
    // The conversions list every unit.
    expect(q("[data-out=conversions]").querySelectorAll("dt")).toHaveLength(10);
  });

  it("keeps typed values across shapes and explains a missing perimeter", () => {
    mountArea(host);
    set("[data-field=shape]", "triangle", "change");
    set("[data-field=base]", "6");
    set("[data-field=height]", "4");
    expect(q("[data-out=main]").textContent).toBe("12 m²");
    expect(q("[data-out=no-second]")).not.toBeNull();
    set("[data-field=shape]", "parallelogram", "change");
    expect(q<HTMLInputElement>("[data-field=base]").value).toBe("6");
    set("[data-field=height]", "abc");
    expect(q("[data-out=error]").textContent).toBe("Sizes must be numbers above 0.");
    click("[data-action=clear]");
    expect(q<HTMLInputElement>("[data-field=base]").value).toBe("");
  });
});

describe("volume ui", () => {
  it("starts with a 30 × 20 × 10 cm box in litres", () => {
    mountVolume(host);
    expect(q("[data-out=main]").textContent).toBe("6,000 cm³");
    const rows = [...q("[data-out=conversions]").querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(rows).toContainEqual(["Litres (L)", "6"]);
    set("[data-field=shape]", "tube", "change");
    set("[data-field=outer]", "1");
    set("[data-field=inner]", "2");
    set("[data-field=height]", "1");
    expect(q("[data-out=error]").textContent).toBe("The inner radius must be smaller than the outer radius.");
  });
});

describe("random letter ui", () => {
  it("draws nothing on mount, then draws from the pool and keeps a history", () => {
    mountRandomLetter(host);
    expect(q("[data-out=letters]").textContent).toBe("—");
    expect(q("[data-out=pool]").textContent).toContain("Drawing from 26");
    set("[data-field=kind]", "vowels", "change");
    expect(q("[data-out=pool]").textContent).toBe("Drawing from 5: A E I O U");
    set("[data-field=count]", "5");
    q<HTMLInputElement>("[data-field=unique]").click();
    click("[data-action=draw]");
    const letters = q("[data-out=letters]").textContent!.split(" ");
    expect(letters.sort()).toEqual(["A", "E", "I", "O", "U"]);
    expect(host.querySelectorAll("[data-out=history] li")).toHaveLength(1);
    set("[data-field=count]", "6");
    click("[data-action=draw]");
    expect(q("[data-out=error]").textContent).toContain("No repeats");
  });

  it("turns the vowel and case menus off for kana", () => {
    mountRandomLetter(host);
    set("[data-field=alphabet]", "katakana", "change");
    expect(q<HTMLSelectElement>("[data-field=kind]").disabled).toBe(true);
    expect(q<HTMLSelectElement>("[data-field=case]").disabled).toBe(true);
    expect(q("[data-out=pool]").textContent).toContain("Drawing from 46");
  });
});

describe("image splitter ui", () => {
  it("asks for a picture before splitting", () => {
    mountImageSplitter(host);
    expect(q("[data-out=info]").textContent).toBe("Add a picture to see the grid.");
    expect(host.querySelectorAll("[data-preset]")).toHaveLength(6);
    click("[data-action=split]");
    expect(q("[data-out=status]").textContent).toBe("Add a picture first.");
    expect(q<HTMLInputElement>("[data-field=order]").disabled).toBe(false);
    click("[data-preset=grid2x2]");
    // Posting order is for Instagram's three-wide grid only.
    expect(q<HTMLInputElement>("[data-field=order]").disabled).toBe(true);
    // The Instagram grid presets cut 3:4 tiles; the carousel preset square ones.
    click("[data-preset=grid3x3]");
    expect(q<HTMLSelectElement>("[data-field=shape]").value).toBe("portrait");
    expect(host.querySelectorAll("[data-field=shape] option")).toHaveLength(3);
    click("[data-preset=row1x3]");
    expect(q<HTMLSelectElement>("[data-field=shape]").value).toBe("square");
    expect(q<HTMLInputElement>("[data-field=rows]").value).toBe("1");
    expect(q<HTMLInputElement>("[data-field=cols]").value).toBe("3");
    // A cleared box shows the grid still in use when left, and an oversized one the clamped value.
    set("[data-field=cols]", "");
    q("[data-field=cols]").dispatchEvent(new Event("change"));
    expect(q<HTMLInputElement>("[data-field=cols]").value).toBe("3");
    set("[data-field=cols]", "99");
    q("[data-field=cols]").dispatchEvent(new Event("change"));
    expect(q<HTMLInputElement>("[data-field=cols]").value).toBe("20");
  });
});

describe("gif maker ui", () => {
  it("starts empty with picture options and asks for frames", () => {
    mountGifMaker(host);
    expect(q("[data-out=frames]").textContent).toContain("No frames yet");
    expect(q<HTMLInputElement>("[data-field=delay]").value).toBe("500");
    expect(q<HTMLInputElement>("[data-field=fps]").closest("div")!.hidden).toBe(true);
    click("[data-action=make]");
    expect(q("[data-out=status]").textContent).toBe("Add pictures or a video first.");
    set("[data-field=delay]", "5");
    q("[data-field=delay]").dispatchEvent(new Event("change"));
    expect(q<HTMLInputElement>("[data-field=delay]").value).toBe("20");
  });
});
