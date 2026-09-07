import { describe, expect, it } from "vitest";
import { convertData, csvToRows } from "../src/shared/data-convert";
import { encodeBmp, encodeGif, encodeIco } from "../src/shared/image-encode";
import { mimeForFormat, outputFilename } from "../src/shared/filename";
import { encodeWav } from "../src/shared/wav";
import { appHref, parseAppPath } from "../src/shared/path";

function pixels(w: number, h: number, rgb: [number, number, number]): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("image encode", () => {
  it("writes BMP, GIF, and ICO signatures", () => {
    const px = pixels(2, 2, [255, 0, 0]);
    const bmp = encodeBmp(px);
    expect(String.fromCharCode(bmp[0], bmp[1])).toBe("BM");
    const gif = encodeGif(px);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[gif.length - 1]).toBe(0x3b);
    const ico = encodeIco(new Uint8Array([1, 2, 3, 4]), 16, 16);
    expect(ico[2]).toBe(1);
    expect(ico[4]).toBe(1);
  });
});

describe("wav", () => {
  it("writes a RIFF WAVE header", () => {
    const wav = encodeWav([new Float32Array([0, 0.5, -0.5])], 44100);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
  });
});

describe("data convert", () => {
  it("pretty-prints json and round-trips csv", () => {
    expect(convertData("json-pretty", '{"a":1}')).toBe('{\n  "a": 1\n}');
    const rows = csvToRows("name,age\nAda,36");
    expect(rows).toEqual([{ name: "Ada", age: "36" }]);
    expect(convertData("csv-json", "name,age\nAda,36")).toContain("Ada");
    expect(convertData("base64-encode", "hi")).toBe(btoa("hi"));
    expect(convertData("md-html", "# Hi")).toContain("<h1>");
  });
});

describe("filenames and routes", () => {
  it("maps new image mimes", () => {
    expect(outputFilename("a.png", "image/avif", "")).toBe("a.avif");
    expect(outputFilename("a.png", "image/bmp", "")).toBe("a.bmp");
    expect(outputFilename("a.png", "image/gif", "")).toBe("a.gif");
    expect(outputFilename("a.png", "image/x-icon", "")).toBe("a.ico");
    expect(outputFilename("song.mp3", "audio/wav", "")).toBe("song.wav");
    expect(mimeForFormat("avif")).toBe("image/avif");
  });

  it("parses audio and data tools", () => {
    expect(parseAppPath("/en/audio/")).toEqual({ kind: "app", locale: "en", tool: "audio" });
    expect(parseAppPath("/zh-CN/data/")).toEqual({ kind: "app", locale: "zh-CN", tool: "data" });
    expect(appHref("ja", "audio")).toBe("/ja/audio/");
  });
});
