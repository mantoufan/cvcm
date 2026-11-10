// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordingTake, errorName, type TakeOptions, type TakeResult } from "../src/client/recording-take";

/** Enough of MediaRecorder for a take: a stop() hands over one chunk per started second, then fires onstop later. */
class FakeRecorder {
  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  stops = 0;
  failStart = false;
  start() {
    if (this.failStart) throw new Error("nope");
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop() {
    this.stops++;
    this.state = "inactive";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["abc"]) });
      this.onstop?.();
    }, 0);
  }
}

let ends: TakeResult[];
let ticks: number[];

function make(over: Partial<TakeOptions> = {}) {
  const rec = new FakeRecorder();
  const take: RecordingTake = new RecordingTake(rec as unknown as MediaRecorder, {
    maxMinutes: 1,
    fallbackType: "audio/webm",
    onTick: (ms) => ticks.push(ms),
    onLimit: () => take.stop(),
    onEnd: (r) => ends.push(r),
    ...over,
  });
  return { rec, take };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"] });
  ends = [];
  ticks = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RecordingTake", () => {
  it("records, leaves pauses out of the time and hands over one Blob", async () => {
    const { rec, take } = make({ maxMinutes: 10 });
    expect(take.start()).toBe(true);
    expect(ticks).toEqual([0]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(take.togglePause()).toBe("paused");
    await vi.advanceTimersByTimeAsync(5000);
    expect(take.elapsed()).toBe(2000);
    expect(take.togglePause()).toBe("recording");
    await vi.advanceTimersByTimeAsync(1000);
    take.stop();
    // A second Stop while the last chunk is on its way changes nothing.
    take.stop();
    expect(rec.stops).toBe(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(ends).toHaveLength(1);
    expect(ends[0].ms).toBe(3000);
    expect(ends[0].limited).toBe(false);
    expect(ends[0].blob?.type).toBe("audio/webm;codecs=opus");
    expect(await ends[0].blob?.text()).toBe("abc");
    // The clock stops with the take.
    const n = ticks.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(ticks).toHaveLength(n);
  });

  it("stops at the length limit once and says so", async () => {
    let limits = 0;
    const { rec, take }: { rec: FakeRecorder; take: RecordingTake } = make({ maxMinutes: 1, onLimit: () => { limits++; take.stop(); } });
    take.start();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(limits).toBe(1);
    expect(rec.stops).toBe(1);
    expect(ends).toHaveLength(1);
    expect(ends[0].limited).toBe(true);
    expect(ends[0].ms).toBeGreaterThanOrEqual(60_000);
  });

  it("counts the time of a recorder that stopped by itself", async () => {
    const { rec, take } = make({ maxMinutes: 10 });
    take.start();
    await vi.advanceTimersByTimeAsync(1500);
    // An error or a lost track: MediaRecorder stops without the take's stop().
    rec.stop();
    await vi.advanceTimersByTimeAsync(10);
    expect(ends[0].ms).toBe(1500);
  });

  it("delivers nothing after cancel, and null when there was no data", async () => {
    const a = make();
    a.take.start();
    a.take.cancel();
    await vi.advanceTimersByTimeAsync(10);
    expect(ends).toHaveLength(0);

    const b = make();
    b.take.start();
    b.rec.stop = () => {
      b.rec.state = "inactive";
      setTimeout(() => b.rec.onstop?.(), 0);
    };
    b.take.stop();
    await vi.advanceTimersByTimeAsync(10);
    expect(ends).toEqual([{ blob: null, ms: 0, limited: false }]);
  });

  it("stops while paused without counting the pause, and rethrows a failed pause", async () => {
    const { rec, take } = make({ maxMinutes: 10 });
    take.start();
    await vi.advanceTimersByTimeAsync(1000);
    take.togglePause();
    await vi.advanceTimersByTimeAsync(9000);
    take.stop();
    await vi.advanceTimersByTimeAsync(10);
    expect(ends[0].ms).toBe(1000);

    const b = make();
    b.take.start();
    b.rec.pause = () => { throw new Error("no pause"); };
    expect(() => b.take.togglePause()).toThrow("no pause");
    expect(b.take.state).toBe("recording");
    expect(rec.state).toBe("inactive");
  });

  it("reports a recorder that refuses to start", () => {
    const { rec, take } = make();
    rec.failStart = true;
    expect(take.start()).toBe(false);
    expect(rec.onstop).toBeNull();
    expect(ticks).toEqual([]);
  });

  it("reads the error name", () => {
    expect(errorName(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toBe("NotAllowedError");
    expect(errorName(null)).toBe("");
    expect(errorName("boom")).toBe("");
  });
});
