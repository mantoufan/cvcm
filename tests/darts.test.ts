// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mountDarts, unmountDarts } from "../src/client/darts/ui";
import { seeded } from "../src/shared/random";
import {
  CPU_SIGMA,
  DOUBLE_OUT,
  applyHit,
  checkout,
  cleanStats,
  cpuTarget,
  hitLabel,
  newMatch,
  scoreAt,
  swayAmplitude,
  targetPoint,
  threeDartAverage,
  throwAt,
  type Hit,
  type Match,
} from "../src/shared/darts";

const polar = (deg: number, r: number) => ({ x: r * Math.sin((deg * Math.PI) / 180), y: r * Math.cos((deg * Math.PI) / 180) });
const at = (deg: number, r: number) => {
  const p = polar(deg, r);
  return scoreAt(p.x, p.y);
};
const hit = (sector: number, mult: 0 | 1 | 2 | 3): Hit => ({ sector, mult, score: sector === 25 ? (mult === 2 ? 50 : 25) : sector * mult });

describe("darts board", () => {
  it("scores the bull, outer bull, trebles, doubles and singles", () => {
    expect(scoreAt(0, 0)).toEqual({ sector: 25, mult: 2, score: 50 });
    expect(scoreAt(0, 10)).toEqual({ sector: 25, mult: 1, score: 25 });
    expect(at(0, 103)).toEqual({ sector: 20, mult: 3, score: 60 });
    expect(at(0, 166)).toEqual({ sector: 20, mult: 2, score: 40 });
    expect(at(0, 60)).toEqual({ sector: 20, mult: 1, score: 20 });
    expect(at(0, 140)).toEqual({ sector: 20, mult: 1, score: 20 });
    expect(at(0, DOUBLE_OUT + 1).score).toBe(0);
    expect(at(90, 103)).toEqual({ sector: 6, mult: 3, score: 18 });
    expect(at(180, 60).sector).toBe(3);
    expect(at(270, 60).sector).toBe(11);
  });

  it("splits sectors at ±9° from each centre line", () => {
    expect(at(8.9, 60).sector).toBe(20);
    expect(at(9.1, 60).sector).toBe(1);
    expect(at(-8.9, 60).sector).toBe(20);
    expect(at(-9.1, 60).sector).toBe(5);
  });

  it("aims at the middle of each bed", () => {
    for (const t of [{ sector: 20, mult: 3 }, { sector: 16, mult: 2 }, { sector: 7, mult: 1 }, { sector: 25, mult: 2 }, { sector: 25, mult: 1 }] as const) {
      const p = targetPoint(t);
      const h = scoreAt(p.x, p.y);
      expect([h.sector, h.mult], hitLabel(t)).toEqual([t.sector, t.mult]);
    }
    expect(hitLabel(hit(20, 3))).toBe("T20");
    expect(hitLabel(hit(25, 2))).toBe("Bull");
  });

  it("steadies the sway over the first second, then shakes again", () => {
    expect(swayAmplitude(0.9)).toBeLessThan(swayAmplitude(0));
    expect(swayAmplitude(3)).toBeGreaterThan(swayAmplitude(0.9));
  });
});

describe("darts checkouts", () => {
  const route = (n: number, darts = 3) => checkout(n, darts)?.map(hitLabel).join(" ") ?? null;
  it("finds the standard finishes", () => {
    expect(route(170)).toBe("T20 T20 Bull");
    expect(route(40)).toBe("D20");
    expect(route(50)).toBe("Bull");
    expect(route(100)).toBe("T20 D20");
    expect(route(60)).toBe("20 D20");
    expect(route(161)).toBe("T20 T17 Bull");
    expect(route(32)).toBe("D16");
  });

  it("has no finish where none exists", () => {
    for (const n of [169, 168, 166, 165, 163, 162, 159, 171, 1, 0]) expect(route(n), String(n)).toBeNull();
    expect(route(100, 1)).toBeNull();
    expect(route(111, 2)).toBeNull();
    expect(route(101, 2)).toBe("T17 Bull");
  });

  it("finishes every route on a double that adds up", () => {
    for (let n = 2; n <= 170; n++) {
      const r = checkout(n);
      if (!r) continue;
      const total = r.reduce((s, b) => s + (b.sector === 25 ? (b.mult === 2 ? 50 : 25) : b.sector * b.mult), 0);
      expect(total, String(n)).toBe(n);
      expect(r[r.length - 1]!.mult, String(n)).toBe(2);
    }
  });
});

describe("darts 501", () => {
  const play = (m: Match, ...hits: Hit[]) => hits.reduce((acc, h) => applyHit(acc, h).match, m);

  it("scores a turn and passes to the next player", () => {
    let m = newMatch("x01", true);
    m = play(m, hit(20, 3), hit(20, 3), hit(20, 3));
    expect(m.players[0]!.remaining).toBe(321);
    expect(m.current).toBe(1);
    expect(threeDartAverage(m.players[0]!)).toBe(180);
  });

  it("busts below zero, on 1, and on a finish that is not a double", () => {
    const base = newMatch("x01", false);
    const with40 = { ...base, players: [{ ...base.players[0]!, remaining: 40, turnStart: 40 }] };
    const below = applyHit(play(with40, hit(20, 1)), hit(20, 3));
    expect(below.events).toContain("bust");
    expect(below.match.players[0]!.remaining).toBe(40);
    expect(applyHit(with40, hit(13, 3)).events).toContain("bust");
    expect(applyHit(play(with40, hit(20, 1)), hit(20, 1)).events).toContain("bust");
    const win = applyHit(with40, hit(20, 2));
    expect(win.events).toContain("win");
    expect(win.match.winner).toBe(0);
    const bull = { ...base, players: [{ ...base.players[0]!, remaining: 50, turnStart: 50 }] };
    expect(applyHit(bull, hit(25, 2)).events).toContain("win");
    expect(applyHit(bull, hit(25, 1)).match.players[0]!.remaining).toBe(25);
  });

  it("takes back the whole turn on a bust", () => {
    const base = newMatch("x01", false);
    const m = { ...base, players: [{ ...base.players[0]!, remaining: 100, turnStart: 100 }] };
    const after = play(m, hit(20, 3), hit(20, 3));
    expect(after.players[0]!.remaining).toBe(100);
    expect(after.players[0]!.points).toBe(0);
    expect(after.turn).toEqual([]);
  });
});

describe("darts around the clock and the computer", () => {
  it("advances only on the current number, then the bull", () => {
    let m = newMatch("clock", false);
    m = applyHit(m, hit(2, 1)).match;
    expect(m.players[0]!.clock).toBe(0);
    m = applyHit(m, hit(1, 3)).match;
    expect(m.players[0]!.clock).toBe(1);
    m = { ...m, players: [{ ...m.players[0]!, clock: 20 }] };
    const done = applyHit(m, hit(25, 1));
    expect(done.events).toContain("win");
  });

  it("aims at a checkout, else the treble 20, and keeps a hard computer on the board", () => {
    const base = newMatch("x01", true);
    expect(hitLabel(cpuTarget(base))).toBe("T20");
    const at40 = { ...base, players: [{ ...base.players[0]!, remaining: 40 }, base.players[1]!] };
    expect(hitLabel(cpuTarget(at40))).toBe("D20");
    const rand = seeded(7);
    const aim = targetPoint({ sector: 20, mult: 3 });
    let onBoard = 0;
    for (let i = 0; i < 1000; i++) {
      const p = throwAt(aim.x, aim.y, CPU_SIGMA[2], rand);
      if (scoreAt(p.x, p.y).score > 0) onBoard++;
    }
    expect(onBoard).toBeGreaterThan(990);
  });

  it("reads saved stats defensively", () => {
    expect(cleanStats({ bestAvg: 61.2, bestLeg: 18, bestClock: "x" })).toEqual({ bestAvg: 61.2, bestLeg: 18, bestClock: 0 });
    expect(cleanStats(null)).toEqual({ bestAvg: 0, bestLeg: 0, bestClock: 0 });
  });
});

describe("darts page", () => {
  afterEach(() => {
    unmountDarts();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  it("mounts without WebGL, keeps the settings and falls back on Play", async () => {
    window.localStorage.setItem("cvcm.darts.v1", JSON.stringify({ mode: "clock", opp: "solo", bestAvg: 55.5 }));
    const host = document.createElement("div");
    document.body.append(host);
    mountDarts(host);
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector<HTMLSelectElement>('[data-in="mode"]')!.value).toBe("clock");
    expect(host.querySelector<HTMLSelectElement>('[data-in="opponent"]')!.value).toBe("solo");
    // Solo Around the Clock: one player row, next target 1.
    const rows = host.querySelectorAll('[data-out="scoreboard"] tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.querySelectorAll("td")[0]!.textContent).toBe("1");
    expect(host.querySelector('[data-out="best"]')!.textContent).not.toBe("");
    // A mode change rebuilds the scoreboard and is saved.
    const mode = host.querySelector<HTMLSelectElement>('[data-in="mode"]')!;
    mode.value = "x01";
    mode.dispatchEvent(new Event("change"));
    expect(host.querySelector('[data-out="scoreboard"] tbody td')!.textContent).toBe("501");
    expect(JSON.parse(window.localStorage.getItem("cvcm.darts.v1")!).mode).toBe("x01");
    host.querySelector<HTMLButtonElement>('[data-act="play"]')!.click();
    for (let i = 0; i < 100 && !host.querySelector('[data-act="play"]:not([disabled])'); i++) await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector<HTMLElement>(".g3d-cover")!.hidden).toBe(false);
  });
});
