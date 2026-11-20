// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mountBowling, unmountBowling } from "../src/client/bowling/ui";
import {
  BALL_R,
  FULL_RACK,
  LANE_LEN,
  PIN_R,
  PIN_SPOTS,
  ROLL_TIMEOUT,
  applyRoll,
  cleanGame,
  cleanSaved,
  cpuRelease,
  cpuTarget,
  finishRoll,
  frameMarks,
  knocked,
  newGame,
  scoreCard,
  standingAfter,
  startRoll,
  stepRoll,
  type Release,
} from "../src/shared/bowling";
import { seeded } from "../src/shared/random";

const roll = (rel: Release) => finishRoll(startRoll(FULL_RACK, rel));

describe("bowling scoring", () => {
  it("scores a perfect game, all spares and a gutter game", () => {
    expect(scoreCard(Array(12).fill(10)).total).toBe(300);
    expect(scoreCard(Array(12).fill(10)).done).toBe(true);
    expect(scoreCard(Array(21).fill(5)).total).toBe(150);
    expect(scoreCard(Array(20).fill(0)).total).toBe(0);
    expect(scoreCard(Array(20).fill(0)).done).toBe(true);
  });

  it("scores known mixed games, tenth-frame bonus balls included", () => {
    // X, 7/, 9-, X, -8, 8/, -6, X, X, X81 = 167
    const rolls = [10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1];
    const card = scoreCard(rolls);
    expect(card.cumulative).toEqual([20, 39, 48, 66, 74, 84, 90, 120, 148, 167]);
    expect(card.done).toBe(true);
    expect(frameMarks(rolls)[9]).toEqual(["X", "8", "1"]);
    expect(frameMarks(rolls).slice(0, 3)).toEqual([["X"], ["7", "/"], ["9", "-"]]);
    // A spare in the tenth earns one more ball; an open tenth does not.
    expect(scoreCard([...Array(18).fill(0), 4, 6]).done).toBe(false);
    expect(scoreCard([...Array(18).fill(0), 4, 6, 7]).total).toBe(17);
    expect(scoreCard([...Array(18).fill(0), 4, 5]).done).toBe(true);
    expect(frameMarks([...Array(18).fill(0), 10, 3, 7])[9]).toEqual(["X", "3", "/"]);
  });

  it("knows which ball comes next and whether the rack is full", () => {
    expect(scoreCard([7]).frame).toBe(0);
    expect(scoreCard([7]).ball).toBe(1);
    expect(scoreCard([7]).left).toBe(3);
    expect(scoreCard([7]).fresh).toBe(false);
    expect(scoreCard([10]).frame).toBe(1);
    expect(scoreCard([10]).fresh).toBe(true);
    const tenth = Array(18).fill(0);
    expect(scoreCard([...tenth, 10]).fresh).toBe(true);
    expect(scoreCard([...tenth, 10, 4]).fresh).toBe(false);
    expect(scoreCard([...tenth, 10, 4]).left).toBe(6);
    expect(scoreCard([...tenth, 3, 7]).fresh).toBe(true);
  });

  it("passes the turn after each frame and ends when both players are done", () => {
    let g = newGame(true);
    // Player 1 strikes: the computer's turn at a full rack.
    g = applyRoll(g, Array(10).fill(false));
    expect(g.turn).toBe(1);
    expect(g.standing).toEqual(FULL_RACK);
    // The computer leaves pins 7 and 10: its second ball at those two.
    const split = FULL_RACK.map((_, i) => i === 6 || i === 9);
    g = applyRoll(g, split);
    expect(g.turn).toBe(1);
    expect(g.standing).toEqual(split);
    g = applyRoll(g, Array(10).fill(false));
    expect(g.turn).toBe(0);
    expect(g.players[1]!.rolls).toEqual([8, 2]);
    let solo = newGame(false);
    for (let k = 0; k < 20; k++) solo = applyRoll(solo, FULL_RACK);
    expect(solo.over).toBe(true);
    expect(scoreCard(solo.players[0]!.rolls).total).toBe(0);
  });

  it("reads back only saves that hold together", () => {
    expect(cleanGame({ players: [{ cpu: false, rolls: [7, 5] }], turn: 0, standing: FULL_RACK })).toBeNull();
    const ok = cleanGame({ players: [{ cpu: false, rolls: [7] }], turn: 0, standing: FULL_RACK.map((_, i) => i < 3) });
    expect(ok?.standing.filter(Boolean).length).toBe(3);
    expect(cleanGame({ players: [{ cpu: false, rolls: [7] }], turn: 0, standing: FULL_RACK })).toBeNull();
    expect(cleanSaved({ best: 999, mode: "x", level: 7 })).toEqual({ best: 0, mode: "cpu", level: 1, game: null });
  });
});

describe("bowling physics", () => {
  it("knocks most pins down with a straight centre ball at speed", () => {
    expect(knocked(roll({ x: 0, angle: 0, power: 1, hook: 0 }))).toBeGreaterThanOrEqual(7);
  });

  it("strikes from the pocket", () => {
    const tx = 0.06;
    expect(knocked(roll({ x: tx * 1.6, angle: Math.atan2(tx - tx * 1.6, LANE_LEN), power: 0.8, hook: 0 }))).toBe(10);
  });

  it("knocks nothing with a gutter ball", () => {
    const r = roll({ x: 0.4, angle: 0.03, power: 0.8, hook: 0 });
    expect(r.ball.gutter).toBe(true);
    expect(knocked(r)).toBe(0);
    expect(standingAfter(r)).toEqual(FULL_RACK);
  });

  it("curves toward the side of the spin", () => {
    const at = (hook: number) => {
      let r = startRoll(FULL_RACK, { x: 0, angle: 0, power: 0.6, hook });
      while (r.ball.y < 17 && !r.ended) r = stepRoll(r, 0.01);
      return r.ball.x;
    };
    expect(at(1)).toBeGreaterThan(0.1);
    expect(at(-1)).toBeLessThan(-0.1);
    expect(at(0)).toBeCloseTo(0, 6);
  });

  it("always ends a roll, even the slowest one, within the time limit", () => {
    for (const rel of [{ x: 0, angle: 0, power: 0, hook: 0 }, { x: -0.3, angle: 0.02, power: 0.2, hook: 1 }, { x: 0.1, angle: -0.01, power: 1, hook: -1 }]) {
      const r = roll(rel);
      expect(r.ended).toBe(true);
      expect(r.t).toBeLessThanOrEqual(ROLL_TIMEOUT + 0.01);
    }
  });

  it("never lets a pin pass through another or through the ball", () => {
    const rand = seeded(9);
    for (let n = 0; n < 40; n++) {
      let r = startRoll(FULL_RACK, { x: (rand() - 0.5) * 0.6, angle: (rand() - 0.5) * 0.04, power: rand(), hook: rand() * 2 - 1 });
      // The closest any two standing pins and the ball and a standing pin get over the roll, checked once per roll:
      // an expect() per pair per frame (about a million calls) made this test time out on a busy CI runner.
      let pinPin = Infinity;
      let ballPin = Infinity;
      let frame = 0;
      let pinPinAt = "";
      let ballPinAt = "";
      while (!r.ended) {
        r = stepRoll(r, 1 / 60);
        frame++;
        const live = r.pins.filter((p) => !p.gone && !p.down);
        const ballLive = !r.ball.gutter && !r.ball.done;
        for (let i = 0; i < live.length; i++) {
          for (let k = i + 1; k < live.length; k++) {
            const d = Math.hypot(live[i]!.x - live[k]!.x, live[i]!.y - live[k]!.y);
            if (d < pinPin) { pinPin = d; pinPinAt = `frame ${frame}, pins ${r.pins.indexOf(live[i]!)} and ${r.pins.indexOf(live[k]!)}`; }
          }
          const d = ballLive ? Math.hypot(live[i]!.x - r.ball.x, live[i]!.y - r.ball.y) : Infinity;
          if (d < ballPin) { ballPin = d; ballPinAt = `frame ${frame}, pin ${r.pins.indexOf(live[i]!)}`; }
        }
      }
      expect(pinPin, `roll ${n}, ${pinPinAt}: pin through pin`).toBeGreaterThan(PIN_R * 1.5);
      expect(ballPin, `roll ${n}, ${ballPinAt}: ball through pin`).toBeGreaterThan((PIN_R + BALL_R) * 0.75);
    }
  });

  it("gives the same result at any frame rate", () => {
    const rel = { x: 0.1, angle: -0.003, power: 0.7, hook: -0.5 };
    let a = startRoll(FULL_RACK, rel);
    let b = startRoll(FULL_RACK, rel);
    for (let i = 0; i < 90; i++) a = stepRoll(a, 1 / 30);
    for (let i = 0; i < 360; i++) b = stepRoll(b, 1 / 120);
    expect(a.ball.y).toBeCloseTo(b.ball.y, 9);
    expect(a.pins.map((p) => p.x)).toEqual(b.pins.map((p) => p.x));
  });

  it("aims the computer at the pocket or the front of what is left", () => {
    expect(cpuTarget(FULL_RACK)).toBeGreaterThan(0);
    const tenPin = FULL_RACK.map((_, i) => i === 9);
    expect(cpuTarget(tenPin)).toBeCloseTo(PIN_SPOTS[9]!.x, 6);
    const rand = seeded(3);
    let total = 0;
    for (let i = 0; i < 20; i++) total += knocked(roll(cpuRelease(FULL_RACK, 2, rand)));
    expect(total / 20).toBeGreaterThan(7);
  });
});

describe("bowling page", () => {
  afterEach(() => {
    unmountBowling();
    document.body.innerHTML = "";
  });

  it("mounts without WebGL or three.js, keeps settings, and Play falls back to the retry cover", async () => {
    window.localStorage.clear();
    const host = document.createElement("div");
    document.body.append(host);
    mountBowling(host);
    expect(host.querySelector("h1")).not.toBeNull();
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelectorAll("[data-out=sheet] tr").length).toBeGreaterThan(1);
    const sel = host.querySelector<HTMLSelectElement>("[data-in=opponent]")!;
    sel.value = "solo";
    sel.dispatchEvent(new Event("change"));
    expect(JSON.parse(window.localStorage.getItem("cvcm.bowling.v1")!).mode).toBe("solo");
    // Before Play, New game keeps the cover (and its Play button).
    host.querySelector<HTMLButtonElement>("[data-act=new]")!.click();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
    const play = host.querySelector<HTMLButtonElement>("[data-act=play]")!;
    play.click();
    for (let i = 0; i < 100 && play.textContent !== "Try again"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(host.querySelector("canvas")).toBeNull();
    expect(host.querySelector(".g3d-cover")?.hasAttribute("hidden")).toBe(false);
  });

  it("restores a game in progress and starts a finished one fresh", () => {
    window.localStorage.setItem("cvcm.bowling.v1", JSON.stringify({ best: 0, mode: "solo", level: 1, game: { players: [{ cpu: false, rolls: [10, 3] }], turn: 0, standing: FULL_RACK.map((_, i) => i < 7), over: false } }));
    const host = document.createElement("div");
    document.body.append(host);
    mountBowling(host);
    expect(host.querySelector("[data-out=sheet]")!.textContent).toContain("X");
    unmountBowling();
    host.remove();
    window.localStorage.setItem("cvcm.bowling.v1", JSON.stringify({ best: 300, mode: "solo", level: 1, game: { players: [{ cpu: false, rolls: Array(12).fill(10) }], turn: 0, standing: FULL_RACK, over: true } }));
    const host2 = document.createElement("div");
    document.body.append(host2);
    mountBowling(host2);
    expect(host2.querySelector("[data-out=sheet]")!.textContent).not.toContain("X");
    expect(host2.querySelector("[data-out=best]")!.textContent).toBe("300");
  });
});
