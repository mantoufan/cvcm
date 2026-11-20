import { describe, expect, it } from "vitest";
import { cloneBalls, newBall, simulate, step, strike } from "../src/shared/billiards-physics";
import { ballIds, rack, spotsFor, tableFor, VARIANTS, SNOOKER_FIRST_COLOUR } from "../src/shared/billiards-tables";
import { ballsOn, judge, newMatch, readShot, type Match, type ShotLog } from "../src/shared/billiards-rules";
import { planShot } from "../src/shared/billiards-ai";
import { DRILLS, drill } from "../src/shared/billiards-drills";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000;
}

const log = (over: Partial<ShotLog>): ShotLog => ({ cue: 0, firstHit: null, potted: [], railAfterContact: false, objectRails: 0, caromPoint: false, ...over });

describe("billiards physics", () => {
  const g = tableFor("8-ball");
  const pair = (top: number, speed = 2) => {
    const balls = [newBall(0, -0.6, 0), newBall(1, -0.3, 0)];
    strike(balls[0]!, 0, speed, 0, top, g.R);
    simulate(g, balls);
    return balls;
  };
  it("draw brings the cue ball back, follow sends it on, the object ball goes forward", () => {
    const draw = pair(-0.6);
    const follow = pair(0.5);
    expect(draw[0]!.x).toBeLessThan(-0.45);
    expect(follow[0]!.x).toBeGreaterThan(-0.2);
    expect(Math.abs(draw[1]!.x + 0.3)).toBeGreaterThan(0.3);
  });
  it("a rolling ball slows by rolling friction and comes off a cushion", () => {
    const b = [newBall(0, -1, 0)];
    strike(b[0]!, 0, 1, 0, 0.4, g.R);
    const res = simulate(g, b);
    expect(res.events.some((e) => e.kind === "rail")).toBe(true);
    expect(b[0]!.on).toBe(true);
    expect(b[0]!.x).toBeLessThan(g.length / 2);
  });
  it("pots a ball rolled into a corner pocket", () => {
    const L = g.length / 2;
    const W = g.width / 2;
    const b = [newBall(0, L - 0.4, W - 0.4)];
    strike(b[0]!, Math.PI / 4, 1.5, 0, 0.4, g.R);
    const res = simulate(g, b);
    expect(res.events.some((e) => e.kind === "pot")).toBe(true);
    expect(b[0]!.on).toBe(false);
  });
  it("keeps a ball rolling along the cushion past a middle pocket on the table", () => {
    const W = g.width / 2;
    const b = [newBall(0, -0.8, W - g.R - 0.002)];
    strike(b[0]!, 0, 1.6, 0, 0.4, g.R);
    const res = simulate(g, b);
    expect(res.events.filter((e) => e.kind === "pot" && e.pocket >= 4)).toEqual([]);
    const straight = [newBall(0, 0, 0)];
    strike(straight[0]!, Math.PI / 2, 1.5, 0, 0.4, g.R);
    expect(simulate(g, straight).events.some((e) => e.kind === "pot")).toBe(true);
  });
  it("sends a cut object ball along the contact normal whatever the step size", () => {
    const angleFor = (dt: number) => {
      const R = g.R;
      // Cue ball aimed so it meets the object ball with the centres 0.85 ball widths apart across the line.
      const off = 0.85 * 2 * R;
      const balls = [newBall(0, -0.6, 0), newBall(1, 0, off)];
      strike(balls[0]!, 0, 2, 0, 0, R);
      for (let t = 0; t < 0.6; t += dt) step(g, balls, dt);
      return Math.atan2(balls[1]!.vy, balls[1]!.vx) * (180 / Math.PI);
    };
    const ideal = (Math.asin(0.85) * 180) / Math.PI;
    for (const dt of [1 / 240, 1 / 120, 1 / 60, 1 / 20]) expect(Math.abs(angleFor(dt) - ideal)).toBeLessThan(0.6);
  });
  it("counts a ball resting on the cushion and driven into it as reaching the cushion", () => {
    const W = g.width / 2;
    let missed = 0;
    for (let k = 0; k < 120; k++) {
      const x = -0.9 + k * 0.015;
      const balls = [newBall(0, x, W - g.R - 0.35), newBall(1, x, W - g.R)];
      strike(balls[0]!, Math.PI / 2, 0.6 + (k % 7) * 0.25, 0, 0, g.R);
      const shot = readShot(simulate(g, balls).events, 0);
      // Near x = 0 the ball drops into the middle pocket instead: a pot, not a cushion.
      if (shot.firstHit === 1 && !shot.potted.length && !shot.railAfterContact) missed++;
    }
    expect(missed).toBe(0);
  });
  it("racks every game without overlaps and with its full ball set", () => {
    for (const v of VARIANTS) {
      const balls = rack(v, seeded(3));
      const R = tableFor(v).R;
      expect(balls.map((b) => b.id).sort((a, b) => a - b)).toEqual(ballIds(v));
      for (let i = 0; i < balls.length; i++) {
        for (let k = i + 1; k < balls.length; k++) {
          expect(Math.hypot(balls[i]!.x - balls[k]!.x, balls[i]!.y - balls[k]!.y)).toBeGreaterThanOrEqual(2 * R);
        }
      }
    }
  });
  it("a full-power break settles", () => {
    const balls = rack("8-ball", seeded(5));
    strike(balls[0]!, 0, 7.5, 0, 0.1, g.R);
    const res = simulate(g, balls);
    expect(res.time).toBeLessThan(40);
    expect(new Set(res.events.filter((e) => e.kind === "rail").map((e) => e.a)).size).toBeGreaterThanOrEqual(4);
  });
  it("a straight drill pots with a centre-ball hit along the line", () => {
    const d = drill("straight");
    const balls = cloneBalls(d.balls);
    const [cue, obj] = balls;
    strike(cue!, Math.atan2(obj!.y - cue!.y, obj!.x - cue!.x), 2, 0, 0, tableFor(d.variant).R);
    const res = simulate(tableFor(d.variant), balls);
    expect(res.events.some((e) => e.kind === "pot" && e.a === 1)).toBe(true);
    for (const id of DRILLS) expect(drill(id).balls.length).toBeGreaterThan(1);
  });
});

describe("billiards referee", () => {
  it("eight-ball: groups from the first legal pot, wrong ball and scratch are fouls", () => {
    const balls = rack("8-ball", seeded(1));
    let m = { ...newMatch("8-ball", 2), breakShot: false };
    let v = judge(m, balls, balls, log({ firstHit: 3, potted: [3], railAfterContact: true }));
    expect(v.foul).toBe(false);
    expect(v.match.groups).toEqual(["solids", "stripes"]);
    expect(v.match.turn).toBe(0);
    m = v.match;
    v = judge(m, balls, balls, log({ firstHit: 12, railAfterContact: true }));
    expect(v.foul).toBe(true);
    expect(v.match.turn).toBe(1);
    expect(v.match.inHand).toBe("anywhere");
    v = judge(m, balls, balls, log({ firstHit: 2, potted: [0], railAfterContact: true }));
    expect(v.foul).toBe(true);
  });
  it("eight-ball: the 8 early loses, on the break it is spotted", () => {
    const balls = rack("8-ball", seeded(1));
    const brk = judge(newMatch("8-ball", 2), balls, balls, log({ firstHit: 1, potted: [8], objectRails: 5 }));
    expect(brk.match.winner).toBeNull();
    expect(brk.respot).toEqual([8]);
    const m = { ...newMatch("8-ball", 2), breakShot: false, groups: ["solids", "stripes"] as ["solids", "stripes"] };
    const early = judge(m, balls, balls, log({ firstHit: 1, potted: [8], railAfterContact: true }));
    expect(early.match.winner).toBe(1);
  });
  it("nine-ball: the 9 on a legal shot wins, on a foul it is spotted", () => {
    const balls = rack("9-ball", seeded(1));
    const m = { ...newMatch("9-ball", 2), breakShot: false };
    expect(judge(m, balls, balls, log({ firstHit: 1, potted: [9], railAfterContact: true })).match.winner).toBe(0);
    const foul = judge(m, balls, balls, log({ firstHit: 4, potted: [9], railAfterContact: true }));
    expect(foul.match.winner).toBeNull();
    expect(foul.respot).toEqual([9]);
  });
  it("ten-ball: an early 10 is spotted and the shooter stays at the table", () => {
    const balls = rack("10-ball", seeded(1));
    const v = judge(newMatch("10-ball", 2), balls, balls, log({ firstHit: 1, potted: [10], objectRails: 4 }));
    expect(v.match.winner).toBeNull();
    expect(v.respot).toEqual([10]);
    expect(v.match.turn).toBe(0);
  });
  it("snooker: red then colour scores, a foul gives at least 4 to the opponent", () => {
    const balls = rack("snooker", seeded(1));
    let m = { ...newMatch("snooker", 2), breakShot: false };
    let v = judge(m, balls, balls, log({ firstHit: 1, potted: [1], railAfterContact: true }));
    expect(v.match.scores).toEqual([1, 0]);
    expect(v.match.onColour).toBe(true);
    m = v.match;
    const black = SNOOKER_FIRST_COLOUR + 5;
    v = judge(m, balls, balls, log({ firstHit: black, potted: [black], railAfterContact: true }));
    expect(v.match.scores).toEqual([8, 0]);
    expect(v.respot).toEqual([black]);
    expect(v.match.breakRun).toBe(8);
    v = judge({ ...v.match, onColour: false }, balls, balls, log({ firstHit: SNOOKER_FIRST_COLOUR, potted: [0] }));
    expect(v.foul).toBe(true);
    expect(v.match.scores).toEqual([8, 4]);
    expect(v.match.inHand).toBe("d");
  });
  it("pyramid: a level score with the table cleared is a draw", () => {
    const before = rack("pyramid", seeded(1)).filter((b) => b.id <= 1);
    const after = before.map((b) => ({ ...b, on: b.id === 0 }));
    const m = { ...newMatch("pyramid", 2), breakShot: false, scores: [6, 7] as [number, number] };
    const v = judge(m, before, after, log({ firstHit: 1, potted: [1], railAfterContact: true }));
    expect(v.match.drawn).toBe(true);
  });
  it("snooker solo: a last black potted on a foul does not clear the table", () => {
    const black = SNOOKER_FIRST_COLOUR + 5;
    const before = rack("snooker", seeded(1)).filter((b) => b.id === 0 || b.id === black);
    const after = before.map((b) => ({ ...b, on: false }));
    const v = judge({ ...newMatch("snooker", 1), breakShot: false }, before, after, log({ firstHit: black, potted: [black, 0] }));
    expect(v.foul).toBe(true);
    expect(v.match.winner).toBe(1);
  });
  it("snooker: a foul with only the black left ends the frame", () => {
    const black = SNOOKER_FIRST_COLOUR + 5;
    const before = rack("snooker", seeded(1)).filter((b) => b.id === 0 || b.id === black);
    const m = { ...newMatch("snooker", 2), breakShot: false, scores: [40, 20] as [number, number] };
    const v = judge(m, before, before, log({ firstHit: null }));
    expect(v.match.scores).toEqual([40, 27]);
    expect(v.match.winner).toBe(0);
  });
  it("snooker: re-spots the higher colour first; solo keeps playing after missing the last black", () => {
    const balls = rack("snooker", seeded(1));
    const m = { ...newMatch("snooker", 2), breakShot: false };
    const pink = SNOOKER_FIRST_COLOUR + 4;
    const black = SNOOKER_FIRST_COLOUR + 5;
    const v = judge(m, balls, balls, log({ firstHit: 1, potted: [pink, black] }));
    expect(v.respot).toEqual([black, pink]);
    const onlyBlack = balls.filter((b) => b.id === 0 || b.id === black);
    const solo = judge({ ...newMatch("snooker", 1), breakShot: false }, onlyBlack, onlyBlack, log({ firstHit: null }));
    expect(solo.foul).toBe(true);
    expect(solo.match.winner).toBeNull();
  });
  it("eight-ball: from the kitchen, a ball behind the head string may not be hit first", () => {
    const balls = rack("8-ball", seeded(1));
    const s = spotsFor("8-ball");
    Object.assign(balls.find((b) => b.id === 3)!, { x: s.headX - 0.2, y: 0.3 });
    const m: Match = { ...newMatch("8-ball", 2), breakShot: false, inHand: "kitchen" };
    const v = judge(m, balls, balls, log({ firstHit: 3, potted: [3], railAfterContact: true }));
    expect(v.foul).toBe(true);
    expect(v.notes.map((n) => n.key)).toContain("kitchenBall");
    // The ball behind the head string is not a ball on, so the computer and the aim never pick it.
    expect(ballsOn(m, balls)).not.toContain(3);
    expect(judge(m, balls, balls, log({ firstHit: 2, potted: [2], railAfterContact: true })).foul).toBe(false);
  });
  it("pyramid: balls potted on a foul go back; three-cushion's opening shot must take the red first", () => {
    const balls = rack("pyramid", seeded(1));
    const v = judge({ ...newMatch("pyramid", 2), breakShot: false }, balls, balls, log({ firstHit: null, potted: [4, 7] }));
    expect(v.foul).toBe(true);
    expect(v.respot).toEqual([4, 7]);
    const carom = rack("3-cushion");
    const brk = judge(newMatch("3-cushion", 2), carom, carom, log({ firstHit: 1, caromPoint: true }));
    expect(brk.match.scores).toEqual([0, 0]);
    const ok = judge(newMatch("3-cushion", 2), carom, carom, log({ firstHit: 2, caromPoint: true }));
    expect(ok.match.scores).toEqual([1, 0]);
  });
  it("snooker: the default break line in both rack sizes touches a red", () => {
    for (const v of ["snooker", "snooker-6"] as const) {
      const g = tableFor(v);
      const balls = rack(v, seeded(2));
      const reds = balls.filter((b) => b.id >= 1 && b.id < SNOOKER_FIRST_COLOUR);
      const edge = reds.reduce((a, b) => (b.y > a.y + 1e-6 || (Math.abs(b.y - a.y) < 1e-6 && b.x > a.x) ? b : a), reds[0]!);
      const cue = balls[0]!;
      strike(cue, Math.atan2(edge.y + g.R * 1.9 - cue.y, edge.x - cue.x), 3.5, 0, 0, g.R);
      const shot = readShot(simulate(g, balls).events, 0);
      expect(shot.firstHit === null ? 0 : shot.firstHit).toBeGreaterThan(0);
      expect(shot.firstHit!).toBeLessThan(SNOOKER_FIRST_COLOUR);
    }
  });
  it("three-cushion: both balls after three cushions scores", () => {
    const events = [
      { kind: "rail" as const, t: 0.1, a: 0, speed: 1 },
      { kind: "ball" as const, t: 0.2, a: 0, b: 2, speed: 1 },
      { kind: "rail" as const, t: 0.3, a: 0, speed: 1 },
      { kind: "rail" as const, t: 0.4, a: 0, speed: 1 },
      { kind: "ball" as const, t: 0.5, a: 0, b: 1, speed: 1 },
    ];
    expect(readShot(events, 0).caromPoint).toBe(true);
    expect(readShot(events.filter((e) => e.t !== 0.4), 0).caromPoint).toBe(false);
  });
});

describe("computer player", () => {
  it("places the cue ball in the D and plays legally from hand in snooker", () => {
    const rand = seeded(4);
    const g = tableFor("snooker");
    let fouls = 0;
    const spots = new Set<string>();
    for (let n = 0; n < 8; n++) {
      const balls = rack("snooker", seeded(10 + n));
      strike(balls[0]!, Math.atan2(0.13 - balls[0]!.y, 1.15 - balls[0]!.x), 5, 0.2, 0, g.R);
      simulate(g, balls);
      Object.assign(balls[0]!, { on: true });
      const m: Match = { ...newMatch("snooker", 2), breakShot: false, turn: 1, inHand: "d" };
      const plan = planShot(m, balls, g, "hard", rand, 800);
      expect(plan.place).toBeDefined();
      spots.add(`${plan.place!.x.toFixed(2)},${plan.place!.y.toFixed(2)}`);
      Object.assign(balls[0]!, plan.place);
      const before = cloneBalls(balls);
      strike(balls[0]!, plan.angle, plan.speed, plan.side, plan.top, g.R);
      if (judge(m, before, balls, readShot(simulate(g, balls).events, 0)).foul) fouls++;
    }
    const sp = spotsFor("snooker");
    for (const key of spots) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      expect(Math.hypot(x - sp.baulkX, y)).toBeLessThanOrEqual(sp.dRadius + 0.01);
    }
    expect(fouls).toBeLessThanOrEqual(2);
  }, 15_000); // 8 full shot plans by the hard computer player: ~3 s locally. Room for a busy CI runner, tight enough to catch a much slower planner.
  it("breaks a pool rack at full power into the head ball", () => {
    const g = tableFor("9-ball");
    const balls = rack("9-ball", seeded(3));
    const plan = planShot({ ...newMatch("9-ball", 2), turn: 1 }, balls, g, "medium", seeded(1));
    expect(plan.speed).toBeGreaterThan(6);
    strike(balls[0]!, plan.angle, plan.speed, plan.side, plan.top, g.R);
    expect(readShot(simulate(g, balls).events, 0).firstHit).toBe(1);
  });
  it("plays legal shots in nine-ball", () => {
    const rand = seeded(9);
    const g = tableFor("9-ball");
    let m: Match = { ...newMatch("9-ball", 2), breakShot: false, inHand: "anywhere" };
    const balls = rack("9-ball", rand);
    let fouls = 0;
    for (let i = 0; i < 6 && m.winner === null; i++) {
      const plan = planShot(m, balls, g, "hard", rand);
      const cue = balls.find((b) => b.id === 0)!;
      if (plan.place) Object.assign(cue, plan.place, { on: true });
      const before = cloneBalls(balls);
      strike(cue, plan.angle, plan.speed, plan.side, plan.top, g.R);
      const v = judge(m, before, balls, readShot(simulate(g, balls).events, 0));
      if (v.foul) fouls++;
      for (const id of v.respot) Object.assign(balls.find((b) => b.id === id)!, { on: true, x: spotsFor("9-ball").footX, y: 0 });
      if (v.cueOff) Object.assign(cue, { on: true, x: -0.9, y: 0 });
      m = v.match;
    }
    expect(fouls).toBeLessThanOrEqual(2);
  });
});
