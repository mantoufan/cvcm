// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountWhiteNoise, unmountWhiteNoise } from "../src/client/white-noise/ui";
import { mountDecibelMeter, unmountDecibelMeter } from "../src/client/decibel-meter/ui";
import { mountVoiceRecorder, unmountVoiceRecorder } from "../src/client/voice-recorder/ui";
import { mountScreenRecorder, unmountScreenRecorder } from "../src/client/screen-recorder/ui";
import { mountTriangle, unmountTriangle } from "../src/client/triangle/ui";
import { mustStay } from "../src/client/leave-guard";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountWhiteNoise();
  unmountDecibelMeter();
  unmountVoiceRecorder();
  unmountScreenRecorder();
  unmountTriangle();
  host.remove();
  vi.unstubAllGlobals();
  try {
    localStorage.clear();
  } catch {
    // No storage in this environment.
  }
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;
const set = (sel: string, value: string, event = "input") => {
  const el = q<HTMLInputElement | HTMLSelectElement>(sel);
  el.value = value;
  el.dispatchEvent(new Event(event));
};

describe("white noise ui", () => {
  it("renders every colour and says when audio is blocked", () => {
    vi.stubGlobal("AudioContext", undefined);
    mountWhiteNoise(host);
    expect(host.querySelectorAll("[data-field=color] option")).toHaveLength(4);
    expect(host.querySelectorAll("[data-field=timer] option")).toHaveLength(6);
    expect(q("[data-out=status]").textContent).toBe("Stopped.");
    set("[data-field=color]", "brown", "change");
    expect(q("[data-out=about]").textContent).toContain("−6 dB per octave");
    q<HTMLButtonElement>("[data-action=play]").click();
    expect(q("[data-out=status]").textContent).toBe("This browser blocks sound from web pages.");
    expect(q("[data-action=play]").textContent).toBe("Play");
  });

  it("plays a looping stereo buffer and counts the sleep timer down", () => {
    const started: number[] = [];
    let now = 0;
    class FakeParam {
      value = 1;
      setValueAtTime() { return this; }
      linearRampToValueAtTime() { return this; }
      cancelScheduledValues() { return this; }
      setTargetAtTime() { return this; }
    }
    class FakeNode {
      connect(n: unknown) { return n; }
      disconnect() {}
    }
    class FakeCtx {
      sampleRate = 8000;
      state = "running";
      destination = new FakeNode();
      get currentTime() { return now; }
      createGain() { return Object.assign(new FakeNode(), { gain: new FakeParam() }); }
      createBuffer(ch: number, len: number, rate: number) {
        return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, copyToChannel() {} };
      }
      createBufferSource() {
        return Object.assign(new FakeNode(), { buffer: null, loop: false, onended: null, start: (at: number) => started.push(at), stop() {} });
      }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    }
    vi.stubGlobal("AudioContext", FakeCtx);
    mountWhiteNoise(host);
    set("[data-field=timer]", "15", "change");
    q<HTMLButtonElement>("[data-action=play]").click();
    expect(started).toHaveLength(1);
    expect(q("[data-action=play]").textContent).toBe("Stop");
    expect(q("[data-out=status]").textContent).toBe("Playing White noise, stops in 15:00.");
    set("[data-field=color]", "pink", "change");
    expect(started).toHaveLength(2);
    expect(q("[data-out=status]").textContent).toContain("Pink noise");
    q<HTMLButtonElement>("[data-action=play]").click();
    expect(q("[data-out=status]").textContent).toBe("Stopped.");
  });
});

describe("decibel meter ui", () => {
  it("lists examples, keeps the calibration and explains a missing microphone", async () => {
    localStorage.setItem("cvcm.decibelMeter.calibration", "4.5");
    mountDecibelMeter(host);
    expect(q<HTMLInputElement>("[data-field=calibration]").value).toBe("4.5");
    expect(host.querySelectorAll(".db-examples dt")).toHaveLength(10);
    expect(q(".db-unit").textContent).toBe("dB(A)");
    set("[data-field=weighting]", "z", "change");
    expect(q(".db-unit").textContent).toBe("dB(Z)");
    set("[data-field=calibration]", "99", "change");
    expect(q<HTMLInputElement>("[data-field=calibration]").value).toBe("30");
    expect(localStorage.getItem("cvcm.decibelMeter.calibration")).toBe("30");
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    q<HTMLButtonElement>("[data-action=start]").click();
    await Promise.resolve();
    expect(q("[data-out=status]").textContent).toMatch(/cannot use the microphone|secure/);
  });
});

describe("voice recorder ui", () => {
  it("starts empty and reports a blocked microphone", async () => {
    mountVoiceRecorder(host);
    expect(q("[data-out=time]").textContent).toBe("0:00");
    expect(q<HTMLButtonElement>("[data-action=pause]").disabled).toBe(true);
    expect(q("[data-out=empty]").hidden).toBe(false);
    class FakeRecorder {
      static isTypeSupported() { return true; }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" })) } });
    q<HTMLButtonElement>("[data-action=record]").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(q("[data-out=status]").textContent).toContain("blocked");
    expect(q("[data-action=record]").textContent).toBe("Record");
    // Nothing recorded, so links may swap in-app; the guard is cleared on unmount.
    expect(mustStay()).toBe(false);
    unmountVoiceRecorder();
    expect(mustStay()).toBe(false);
  });
});

describe("screen recorder ui", () => {
  it("shows the support note and reports a cancelled share", async () => {
    mountScreenRecorder(host);
    expect(q("[data-out=support]").textContent).toContain("Phones and tablets");
    expect(q("[data-out=result]").hidden).toBe(true);
    class FakeRecorder {
      static isTypeSupported() { return true; }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getDisplayMedia: () => Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" })) } });
    q<HTMLButtonElement>("[data-action=start]").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(q("[data-out=status]").textContent).toBe("Screen sharing was cancelled.");
    expect(host.querySelectorAll("[data-field=format] option")).toHaveLength(2);
    expect(mustStay()).toBe(false);
  });
});

describe("triangle ui", () => {
  it("solves the default right triangle, examples and errors", () => {
    mountTriangle(host);
    const text = () => q("[data-out=result]").textContent ?? "";
    expect(q<HTMLInputElement>("[data-field=C]").disabled).toBe(true);
    expect(text()).toContain("36.8699°");
    expect(host.querySelectorAll(".tri-svg")).toHaveLength(1);
    // Right mode keeps the user's C and gives it back when turned off.
    q<HTMLInputElement>("[data-field=right]").click();
    set("[data-field=C]", "60");
    q<HTMLInputElement>("[data-field=right]").click();
    expect(q<HTMLInputElement>("[data-field=C]").value).toBe("90");
    q<HTMLInputElement>("[data-field=right]").click();
    expect(q<HTMLInputElement>("[data-field=C]").value).toBe("60");
    q<HTMLButtonElement>("[data-example=ssa]").click();
    expect(q<HTMLInputElement>("[data-field=C]").disabled).toBe(false);
    expect(q<HTMLInputElement>("[data-field=C]").value).toBe("");
    expect(host.querySelectorAll(".tri-solution")).toHaveLength(2);
    expect(q("[data-out=error]").textContent).toBe("These values fit two triangles. Both are shown.");
    set("[data-field=c]", "5");
    expect(q("[data-out=error]").textContent).toBe("Enter only three values; clear the others.");
    expect(host.querySelectorAll(".tri-solution")).toHaveLength(0);
    q<HTMLButtonElement>("[data-action=clear]").click();
    set("[data-field=a]", "1");
    set("[data-field=b]", "2");
    set("[data-field=c]", "3");
    expect(q("[data-out=error]").textContent).toContain("cannot form a triangle");
    set("[data-field=c]", "2,5");
    expect(text()).toContain("scalene");
    set("[data-field=c]", "1,000");
    expect(q("[data-out=error]").textContent).toContain("cannot form a triangle");
    set("[data-field=c]", "abc");
    expect(q("[data-out=error]").textContent).toBe("Sides and angles must be numbers above 0.");
  });
});
