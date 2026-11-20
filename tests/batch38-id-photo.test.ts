// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { idPhotoState, mountIdPhoto, unmountIdPhoto } from "../src/client/id-photo/ui";
import { setLocale } from "../src/client/i18n";
import { LOCALES } from "../src/shared/locale";
import { ID_PHOTO_SPECS, specById, specsFor } from "../src/shared/id-photo-specs";
import {
  defaultCrop,
  estimateHead,
  fitToBytes,
  guides,
  mmToPx,
  moveCrop,
  placeCrop,
  reshapeCrop,
  setJpegDpi,
  sheetLayout,
  specPixels,
  targetHeadMm,
  zoomCrop,
} from "../src/shared/id-photo";

const spec = (id: string) => specById(id)!;

describe("id photo specs", () => {
  it("cites an official page for every official size and keeps head rules inside the photo", () => {
    for (const s of ID_PHOTO_SPECS) {
      if (s.kind === "official") expect(s.source, s.id).toMatch(/^https:\/\//);
      else expect(s.source, s.id).toBeUndefined();
      if (s.head) expect(s.head[1], s.id).toBeLessThan(s.h);
      expect(s.bg).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(new Set(ID_PHOTO_SPECS.map((s) => s.id)).size).toBe(ID_PHOTO_SPECS.length);
  });

  it("matches the published sizes", () => {
    expect(spec("us")).toMatchObject({ w: 51, h: 51, head: [25, 35], noEdits: true });
    expect(spec("uk")).toMatchObject({ w: 35, h: 45, head: [29, 34] });
    expect(spec("jp")).toMatchObject({ w: 35, h: 45, head: [32, 36] });
    expect(spec("cn")).toMatchObject({ w: 33, h: 48, head: [28, 33], top: [3, 5] });
    expect(spec("es")).toMatchObject({ w: 26, h: 32 });
    // The 413 × 531 px upload size of Korea and Taiwan is 35 × 45 mm at 300 DPI.
    for (const id of ["kr", "tw"]) expect(spec(id).px).toEqual([specPixels(spec(id)).w, specPixels(spec(id)).h]);
  });

  it("puts each language's usual size first and keeps every size", () => {
    expect(specsFor("en")[0].id).toBe("us");
    expect(specsFor("zh-CN")[0].id).toBe("c25x35");
    expect(specsFor("zh-TW")[0].id).toBe("tw");
    expect(specsFor("ja")[0].id).toBe("c30x40");
    expect(specsFor("es")[0].id).toBe("es");
    for (const loc of LOCALES) expect(specsFor(loc)).toHaveLength(ID_PHOTO_SPECS.length);
  });

  it("has a label for every size in every language", () => {
    for (const loc of LOCALES) {
      const pack = JSON.parse(readFileSync(resolve(__dirname, `../scripts/tools-src/batch38/id-photo/${loc}.json`), "utf8"));
      for (const s of ID_PHOTO_SPECS) expect(pack.ui.idPhoto[`p_${s.id}`], `${loc} ${s.id}`).toBeTruthy();
    }
  });
});

describe("id photo geometry", () => {
  it("converts mm to 300 DPI pixels", () => {
    expect(mmToPx(25.4)).toBe(300);
    expect(specPixels(spec("jp"))).toEqual({ w: 413, h: 531 });
    expect(specPixels(spec("us"))).toEqual({ w: 602, h: 602 });
  });

  it("draws the guides from the rules", () => {
    expect(guides(spec("cn"))).toEqual({ top: 4, chin: [32, 37] });
    const jp = guides(spec("jp"));
    expect(jp.top).toBeCloseTo((45 - 34) * 0.4);
    expect(jp.chin![1] - jp.chin![0]).toBeCloseTo(4);
    expect(guides(spec("c30x40")).chin).toBeNull();
    expect(targetHeadMm(spec("c30x40"))).toBeCloseTo(24);
  });

  /** A person: a round head on a neck over wide shoulders, as the model's mask would be. */
  function personMask(w: number, h: number, headTop: number, headH: number, headW: number, cx: number): Uint8Array {
    const m = new Uint8Array(w * h);
    const cy = headTop + headH / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inHead = ((x - cx) / (headW / 2)) ** 2 + ((y - cy) / (headH / 2)) ** 2 <= 1;
        const neck = y > cy && y < headTop + headH * 1.15 && Math.abs(x - cx) < headW * 0.25;
        const shoulders = y >= headTop + headH * 1.15 && Math.abs(x - cx) < headW * 1.4;
        if (inHead || neck || shoulders) m[y * w + x] = 255;
      }
    }
    return m;
  }

  it("finds the head top, centre and roughly the chin", () => {
    const m = personMask(200, 300, 40, 104, 80, 110);
    const est = estimateHead(m, 200, 300)!;
    // The ellipse's very top row is one pixel wide, under the two-pixel floor.
    expect(Math.abs(est.top - 40)).toBeLessThanOrEqual(3);
    expect(est.cx).toBeGreaterThan(105);
    expect(est.cx).toBeLessThan(115);
    expect(est.chin).toBeGreaterThan(120);
    expect(est.chin).toBeLessThan(165);
    expect(estimateHead(new Uint8Array(100), 10, 10)).toBeNull();
  });

  it("measures head width in rows when the mask is stretched", () => {
    // The same person in a mask squeezed to half width: columns are twice as wide as rows.
    const wide = personMask(200, 300, 40, 104, 80, 100);
    const half = new Uint8Array(100 * 300);
    for (let y = 0; y < 300; y++) for (let x = 0; x < 100; x++) half[y * 100 + x] = wide[y * 200 + x * 2];
    const a = estimateHead(wide, 200, 300)!;
    const b = estimateHead(half, 100, 300, 2)!;
    expect(Math.abs(a.chin - b.chin)).toBeLessThan(6);
  });

  it("places the crop so the head meets the guides", () => {
    const s = spec("jp");
    const head = { top: 100, chin: 440, cx: 500 };
    const crop = placeCrop(s, head);
    const pxPerMm = crop.h / s.h;
    expect(crop.w / crop.h).toBeCloseTo(s.w / s.h);
    expect((head.chin - head.top) / pxPerMm).toBeCloseTo(34);
    expect((head.top - crop.y) / pxPerMm).toBeCloseTo(guides(s).top);
    expect(crop.x + crop.w / 2).toBeCloseTo(500);
  });

  it("keeps the shape, centre and head scale when the size changes", () => {
    const from = spec("jp");
    const to = spec("us");
    const crop = placeCrop(from, { top: 100, chin: 440, cx: 500 });
    const next = reshapeCrop(crop, from, to);
    expect(next.w / next.h).toBeCloseTo(1);
    expect(next.x + next.w / 2).toBeCloseTo(500);
    const direct = placeCrop(to, { top: 100, chin: 440, cx: 500 });
    for (const k of ["x", "y", "w", "h"] as const) expect(next[k]).toBeCloseTo(direct[k]);
  });

  it("starts centred without a mask, zooms around the centre and keeps part of the photo", () => {
    const crop = defaultCrop(spec("c30x40"), 1000, 1000);
    expect(crop.w / crop.h).toBeCloseTo(0.75);
    expect(crop.h).toBeCloseTo(920);
    const z = zoomCrop(crop, 2, 1000, 1000);
    expect(z.h).toBeCloseTo(460);
    expect(z.x + z.w / 2).toBeCloseTo(crop.x + crop.w / 2);
    const far = moveCrop(z, 1e6, 1e6, 1000, 1000);
    expect(far.x).toBeLessThan(1000);
    expect(far.y).toBeLessThan(1000);
  });

  it("lays out print sheets", () => {
    const s35 = { w: 35, h: 45 };
    const four = sheetLayout("4x6", s35);
    expect(four.cells).toHaveLength(6);
    const a4 = sheetLayout("a4", s35);
    expect(a4.cols * a4.rows).toBe(30);
    for (const c of a4.cells) {
      expect(c.x).toBeGreaterThanOrEqual(4);
      expect(c.x + 35).toBeLessThanOrEqual(a4.w - 4 + 1e-9);
      expect(c.y + 45).toBeLessThanOrEqual(a4.h - 4 + 1e-9);
    }
    expect(sheetLayout("4x6", { w: 51, h: 51 }).cells).toHaveLength(2);
  });
});

describe("file size limit", () => {
  const encoder = (k: number) => async (q: number, scale: number) => {
    const bytes = Math.round(k * q * scale * scale);
    return { out: { q, scale }, bytes };
  };

  it("keeps full quality when it already fits", async () => {
    expect(await fitToBytes(encoder(1000), 2000)).toMatchObject({ quality: 0.95, scale: 1 });
  });

  it("lowers quality first, then size", async () => {
    const q = (await fitToBytes(encoder(100_000), 50_000))!;
    expect(q.scale).toBe(1);
    expect(q.bytes).toBeLessThanOrEqual(50_000);
    expect(q.quality).toBeGreaterThan(0.45);
    const s = (await fitToBytes(encoder(100_000), 10_000))!;
    expect(s.scale).toBeLessThan(1);
    expect(s.bytes).toBeLessThanOrEqual(10_000);
    expect(await fitToBytes(encoder(100_000), 10)).toBeNull();
  });
});

describe("jpeg dpi", () => {
  it("patches an existing JFIF header", () => {
    const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const out = setJpegDpi(jfif, 300);
    expect(out.length).toBe(jfif.length);
    expect([...out.slice(13, 18)]).toEqual([1, 1, 44, 1, 44]);
    expect(jfif[13]).toBe(0);
  });

  it("adds one when missing and leaves other files alone", () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 2, 0xff, 0xd9]);
    const out = setJpegDpi(bare, 600);
    expect(out.length).toBe(bare.length + 18);
    expect([...out.slice(2, 4)]).toEqual([0xff, 0xe0]);
    expect((out[14] << 8) | out[15]).toBe(600);
    expect([...out.slice(20)]).toEqual([...bare.slice(2)]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(setJpegDpi(png)).toBe(png);
  });
});

describe("id photo ui", () => {
  let host: HTMLElement;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => {
    unmountIdPhoto();
    host.remove();
    setLocale("en");
  });

  const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;

  it("opens on the US passport with the original background kept", () => {
    setLocale("en");
    mountIdPhoto(host);
    expect(q<HTMLSelectElement>("[data-field=size]").value).toBe("us");
    expect(q("[data-out=size]").textContent).toContain("51 mm wide × 51 mm high");
    expect(q("[data-out=head]").textContent).toContain("25–35 mm");
    expect(q<HTMLAnchorElement>("[data-out=source]").href).toContain("travel.state.gov");
    expect(q("[data-mode=keep]").getAttribute("aria-pressed")).toBe("true");
    expect(q<HTMLInputElement>("[data-field=px-w]").value).toBe("602");
    expect(q("h1").textContent).toBe("Passport photo maker");
    expect(idPhotoState().bgMode).toBe("keep");
  });

  it("switches to replace for a common size and warns when a passport gets a new background", () => {
    setLocale("en");
    mountIdPhoto(host);
    const size = q<HTMLSelectElement>("[data-field=size]");
    size.value = "c30x40";
    size.dispatchEvent(new Event("change"));
    expect(idPhotoState().bgMode).toBe("replace");
    expect(q(".idp-chin").hidden).toBe(true);
    expect(q<HTMLInputElement>("[data-field=px-h]").value).toBe("472");
    size.value = "kr";
    size.dispatchEvent(new Event("change"));
    expect(idPhotoState().bgMode).toBe("keep");
    expect(q<HTMLElement>("[data-out=warning]").hidden).toBe(true);
    q<HTMLButtonElement>("[data-mode=replace]").click();
    expect(q<HTMLElement>("[data-out=warning]").hidden).toBe(false);
    // A choice the visitor made sticks across sizes.
    size.value = "us";
    size.dispatchEvent(new Event("change"));
    expect(idPhotoState().bgMode).toBe("replace");
  });

  it("opens on the local default size in each language without missing strings", () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      mountIdPhoto(host);
      expect(q<HTMLSelectElement>("[data-field=size]").value).toBe(specsFor(loc)[0].id);
      expect(host.textContent).not.toMatch(/idPhoto\./);
      unmountIdPhoto();
      host.replaceChildren();
    }
  });

  it("counts photos on the chosen paper", () => {
    setLocale("ja");
    mountIdPhoto(host);
    expect(q("[data-out=sheet]").textContent).toContain("A4");
    expect(q("[data-out=sheet]").textContent).toContain(String(sheetLayout("a4", spec("c30x40")).cells.length));
  });
});
