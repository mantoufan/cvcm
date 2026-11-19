// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountPressurePoints, unmountPressurePoints } from "../src/client/pressure-points-map/ui";
import { LOCALES } from "../src/shared/locale";
import { PP_POINTS, PP_VIEWS, PP_ZONES, ppClock, ppMatches } from "../src/shared/pressure-points";

const root = resolve(__dirname, "..");
const json = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8"));

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountPressurePoints();
  host.remove();
  vi.useRealTimers();
});

const q = <T extends Element>(sel: string) => host.querySelector<T>(sel)!;
const text = (sel: string) => q(sel).textContent ?? "";

describe("pressure points map ui", () => {
  it("opens on the hand with LI4 and its pregnancy caution", async () => {
    await mountPressurePoints(host);
    expect(text("h1")).toBe("Pressure points map");
    expect(text(".ppm-disclaimer")).toContain("not medical advice");
    expect(q("[data-view=hand]").getAttribute("aria-selected")).toBe("true");
    expect(text("[data-out=name]")).toBe("Union Valley");
    expect(text("[data-out=code]")).toBe("Hégǔ · LI4");
    expect(text("[data-out=caution]")).toContain("Pregnancy");
    const dot = q('[data-target=li4][role=button]');
    expect(dot.getAttribute("aria-label")).toBe("Union Valley (LI4)");
    expect(dot.getAttribute("aria-pressed")).toBe("true");
  });

  it("switches views from the tabs and the list, and draws mirror dots without extra tab stops", async () => {
    await mountPressurePoints(host);
    (q("[data-view=face]") as HTMLButtonElement).click();
    expect(text("[data-out=name]")).toBe("Hall of Impression");
    expect(host.querySelectorAll("[data-target=bl2]")).toHaveLength(2);
    expect(host.querySelectorAll("[data-target=bl2][role=button]")).toHaveLength(1);
    (q("[data-pick=pc6]") as HTMLButtonElement).click();
    expect(q("[data-view=arm]").getAttribute("aria-selected")).toBe("true");
    expect(text("[data-out=use]")).toContain("may reduce nausea");
    // Arrow keys move between the dots of a view.
    const first = q<SVGGElement>("[data-target=pc6][role=button]");
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement?.getAttribute("data-target")).toBe("ht7");
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(text("[data-out=name]")).toBe("Spirit Gate");
  });

  it("shows reflexology zones with the not-a-diagnosis note", async () => {
    await mountPressurePoints(host);
    (q("[data-view=sole]") as HTMLButtonElement).click();
    expect(text("[data-out=name]")).toBe("Left foot: Toes");
    expect(text("[data-out=caution]")).toContain("chest pain is an emergency");
    expect(host.querySelector("[data-target=right-heart]")).toBeNull();
    (q("[data-target=right-liver]") as SVGGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(text("[data-out=name]")).toBe("Right foot: Liver and gallbladder area (right foot)");
    expect(host.querySelector("[data-target=ki1][role=button]")).not.toBeNull();
  });

  it("filters the list by name, pinyin or code", async () => {
    await mountPressurePoints(host);
    const find = q<HTMLInputElement>("[data-field=find]");
    find.value = "sanyinjiao";
    find.dispatchEvent(new Event("input"));
    const shown = [...host.querySelectorAll<HTMLButtonElement>("[data-pick]")].filter((b) => !b.hidden).map((b) => b.dataset.pick);
    expect(shown).toEqual(["sp6"]);
    find.value = "zzz";
    find.dispatchEvent(new Event("input"));
    expect(q<HTMLElement>("[data-out=none]").hidden).toBe(false);
  });

  it("counts the hold down and says when the time is up", async () => {
    vi.useFakeTimers();
    await mountPressurePoints(host);
    const sel = q<HTMLSelectElement>("[data-field=hold]");
    sel.value = "30";
    sel.dispatchEvent(new Event("change"));
    const btn = q<HTMLButtonElement>("[data-action=timer]");
    expect(btn.textContent).toBe("Start 30 s");
    btn.click();
    expect(btn.textContent).toBe("Stop");
    vi.advanceTimersByTime(10_000);
    expect(text("[data-out=clock]")).toBe("0:20");
    vi.advanceTimersByTime(21_000);
    expect(text("[data-out=timer-status]")).toContain("Time is up");
    expect(btn.textContent).toBe("Start 30 s");
  });
});

describe("pressure points data and copy", () => {
  it("formats the clock and folds tone marks", () => {
    expect(ppClock(65)).toBe("1:05");
    expect(ppClock(0.2)).toBe("0:01");
    expect(ppMatches("hegu", ["Hégǔ"])).toBe(true);
    expect(ppMatches("ex hn5", ["EX-HN5"])).toBe(true);
    expect(ppMatches("tu bach", ["Tứ bạch"])).toBe(true);
  });

  it("puts every point on a view and keeps dots inside the drawing", () => {
    for (const p of PP_POINTS) {
      expect(PP_VIEWS).toContain(p.view);
      expect(p.x).toBeGreaterThan(10);
      expect(p.x).toBeLessThan(330);
    }
    expect(new Set(PP_POINTS.map((p) => p.id)).size).toBe(PP_POINTS.length);
    // The cautions the brief asks for: firm pressure in pregnancy is avoided on these three.
    expect(PP_POINTS.filter((p) => p.pregnancy).map((p) => p.code).sort()).toEqual(["GB21", "LI4", "SP6"]);
  });

  it.each(LOCALES)("has complete point, zone and page copy in %s", (loc) => {
    const copy = json(`src/locales/pressure-points/${loc}.json`);
    for (const p of PP_POINTS) {
      for (const field of ["name", "where", "press", "use"]) expect(copy.points[p.id]?.[field], `${p.id}.${field}`).toBeTruthy();
      expect(Boolean(copy.points[p.id].caution), `${p.id} caution`).toBe(Boolean(p.pregnancy));
    }
    for (const z of PP_ZONES) expect(copy.zones[z]?.name && copy.zones[z]?.maps, z).toBeTruthy();
    const en = json("scripts/tools-src/batch36/en.json");
    const src = json(`scripts/tools-src/batch36/${loc}.json`);
    expect(Object.keys(src.ui.ppm).sort()).toEqual(Object.keys(en.ui.ppm).sort());
    for (const [k, v] of Object.entries(en.ui.ppm as Record<string, string>)) {
      for (const ph of v.match(/\{\w+\}/g) ?? []) expect(src.ui.ppm[k], `${loc} ${k}`).toContain(ph);
    }
    expect(json(`src/locales/${loc}.json`).ppm).toEqual(src.ui.ppm);
  });

  it("makes no cure or treatment claims in the English copy", () => {
    const all = JSON.stringify([json("src/locales/pressure-points/en.json"), json("scripts/tools-src/batch36/en.json")]);
    // "treats" appears only in the denial that reflexology shows or treats organ problems.
    expect(all.replace(/shows? or treats? problems in organs/g, "")).not.toMatch(/\b(cures?|treats?|treatment|heals?|healing|detox)/i);
  });
});
