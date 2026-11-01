// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountGamepadTest, unmountGamepadTest } from "../src/client/gamepad-test/ui";
import { mountDeadPixel, unmountDeadPixel } from "../src/client/dead-pixel/ui";
import { mountTouchTest, unmountTouchTest } from "../src/client/touch-test/ui";
import { mountRefreshRate, unmountRefreshRate } from "../src/client/refresh-rate/ui";
import { mountWebcamTest, unmountWebcamTest } from "../src/client/webcam-test/ui";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  unmountGamepadTest();
  unmountDeadPixel();
  unmountTouchTest();
  unmountRefreshRate();
  unmountWebcamTest();
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const q = <T extends HTMLElement>(sel: string) => host.querySelector<T>(sel)!;

function fakePad(buttons: boolean[], axes: number[]): Gamepad {
  return {
    id: "Test pad",
    index: 0,
    connected: true,
    mapping: "standard",
    timestamp: 0,
    axes,
    buttons: buttons.map((pressed) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 })),
    vibrationActuator: null,
    hapticActuators: [],
  } as unknown as Gamepad;
}

describe("gamepad-test ui", () => {
  it("draws the pad, marks pressed buttons and reads the sticks", () => {
    let pad = fakePad(Array(17).fill(false), [0, 0, 0, 0]);
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad], configurable: true });
    mountGamepadTest(host);
    window.dispatchEvent(new Event("gamepadconnected"));
    expect(host.querySelectorAll(".gp-btn")).toHaveLength(17);
    expect(q("[data-out=status]").textContent).toMatch(/connected/i);
    pad = fakePad([true, ...Array(16).fill(false)], [0.2, 0, 0, 0.01]);
    window.dispatchEvent(new Event("gamepadconnected"));
    const a = q("[data-button='0']");
    expect(a.classList.contains("down")).toBe(true);
    expect(q("[data-out=left-stick]").textContent).toBe("X +0.20 · Y 0.00");
    pad = fakePad(Array(17).fill(false), [0, 0, 0, 0]);
    window.dispatchEvent(new Event("gamepadconnected"));
    expect(a.classList.contains("down")).toBe(false);
    expect(a.classList.contains("done")).toBe(true);
    expect((q<HTMLButtonElement>("[data-action=rumble]")).disabled).toBe(true);
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });
});

describe("dead-pixel ui", () => {
  it("opens a covering screen without the Fullscreen API and steps colours with keys", async () => {
    mountDeadPixel(host);
    const screen = q("[data-out=screen]");
    Object.defineProperty(screen, "requestFullscreen", { value: undefined, configurable: true });
    q<HTMLButtonElement>("[data-action=start]").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.hidden).toBe(false);
    expect(screen.classList.contains("covering")).toBe(true);
    expect(screen.querySelector(".dp-label")!.textContent).toMatch(/^Black/);
    screen.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(screen.querySelector(".dp-label")!.textContent).toMatch(/^White/);
    screen.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    screen.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(screen.querySelector(".dp-label")!.textContent).toMatch(/^Gray/);
    screen.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(screen.hidden).toBe(true);
    expect(document.documentElement.classList.contains("dp-lock")).toBe(false);
  });
});

describe("touch-test ui", () => {
  it("counts fingers at once and the area touched", () => {
    mountTouchTest(host);
    const pad = q("[data-action=pad]");
    vi.spyOn(pad, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 800, height: 1200, right: 800, bottom: 1200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    const ev = (type: string, id: number, x: number, y: number) =>
      pad.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, button: 0, bubbles: true }));
    ev("pointerdown", 1, 10, 10);
    ev("pointerdown", 2, 700, 1100);
    expect(q("[data-out=now]").textContent).toBe("2");
    ev("pointermove", 1, 790, 10);
    ev("pointerup", 1, 790, 10);
    ev("pointerup", 2, 700, 1100);
    expect(q("[data-out=now]").textContent).toBe("0");
    expect(q("[data-out=max]").textContent).toBe("2");
    // A full top row (8 cells) plus one cell near the bottom: 9 of 96.
    expect(q("[data-out=coverage]").textContent).toBe("9%");
    expect(q("[data-out=type]").textContent).toBe("Touch");
    q<HTMLButtonElement>("[data-action=clear]").click();
    expect(q("[data-out=coverage]").textContent).toBe("0%");
    expect(host.querySelectorAll(".touch-cell.hit")).toHaveLength(0);
  });
});

describe("refresh-rate ui", () => {
  it("waits for enough frames before showing a rate", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    mountRefreshRate(host);
    let now = 0;
    for (let i = 0; i < 80; i++) {
      now += 1000 / 120;
      frames.shift()?.(now);
    }
    expect(q("[data-out=hz]").textContent).toBe("120");
    expect(q("[data-out=near]").textContent).toMatch(/120 Hz/);
    expect(q<HTMLButtonElement>("[data-action=copy]").disabled).toBe(false);
  });
});

describe("webcam-test ui", () => {
  it("explains a blocked camera and keeps Take photo off", async () => {
    const err = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(err) } }));
    mountWebcamTest(host);
    q<HTMLButtonElement>("[data-action=start]").click();
    await new Promise((r) => setTimeout(r, 0));
    expect(q("[data-out=status]").textContent).toMatch(/blocked/);
    expect(q<HTMLButtonElement>("[data-action=photo]").disabled).toBe(true);
    expect(q("[data-action=start]").textContent).toBe("Start camera");
  });
});
