import { describe, expect, it } from "vitest";
import { handleClipApi } from "../src/clip-api";
import { memoryStore } from "../src/clip-store";
import {
  CLIP_MAX_BYTES,
  CLIP_MAX_VIEWS,
  CLIP_RATE_MAX,
  CLIP_TTL_MS,
  isClipId,
  newClipId,
  remainingClock,
} from "../src/shared/clip";
import { appHref, parseAppPath } from "../src/shared/path";
import worker from "../src/worker";

const origin = "https://cv.cm";

function assets() {
  return {
    fetch: async () => new Response("ok"),
  };
}

async function post(store: ReturnType<typeof memoryStore>, body: unknown, ip = "1.1.1.1", now?: number) {
  const request = new Request(`${origin}/api/clip`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "CF-Connecting-IP": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return handleClipApi(request, { store, now });
}

async function get(store: ReturnType<typeof memoryStore>, id: string, now?: number) {
  return handleClipApi(new Request(`${origin}/api/clip/${id}`), { store, now });
}

describe("remainingClock", () => {
  it("does not render 60 minutes", () => {
    expect(remainingClock(24 * 60 * 60 * 1000)).toEqual({ h: 24, m: 0 });
    expect(remainingClock(23 * 60 * 60 * 1000 + 59.7 * 60 * 1000)).toEqual({ h: 24, m: 0 });
    expect(remainingClock(90 * 1000)).toEqual({ h: 0, m: 2 });
    expect(remainingClock(0)).toBeNull();
  });
});

describe("clip ids", () => {
  it("uses the 8-character alphabet", () => {
    for (let i = 0; i < 40; i++) {
      const id = newClipId();
      expect(id).toHaveLength(8);
      expect(isClipId(id)).toBe(true);
    }
  });
});

describe("clip API", () => {
  it("creates a note and serves it until the 10th view", async () => {
    const store = memoryStore();
    const created = await post(store, { body: "hello from phone" });
    expect(created?.status).toBe(201);
    const payload = (await created!.json()) as { id: string; url: string; maxViews: number };
    expect(isClipId(payload.id)).toBe(true);
    expect(payload.url).toBe(`${origin}/c/${payload.id}`);
    expect(payload.maxViews).toBe(CLIP_MAX_VIEWS);

    for (let i = 1; i <= CLIP_MAX_VIEWS; i++) {
      const res = await get(store, payload.id);
      expect(res?.status).toBe(200);
      const read = (await res!.json()) as { body: string; views: number };
      expect(read.body).toBe("hello from phone");
      expect(read.views).toBe(i);
    }
    const gone = await get(store, payload.id);
    expect(gone?.status).toBe(404);
    expect(await gone!.json()).toEqual({ error: "gone" });
  });

  it("deletes notes older than one day", async () => {
    const store = memoryStore();
    const now = 1_000_000;
    const created = await post(store, { body: "stale" }, "8.8.8.8", now);
    const { id } = (await created!.json()) as { id: string };
    const expired = await get(store, id, now + CLIP_TTL_MS + 1);
    expect(expired?.status).toBe(404);
  });

  it("rejects empty and oversized notes", async () => {
    const store = memoryStore();
    expect((await post(store, { body: "   " }))?.status).toBe(400);
    const huge = "a".repeat(CLIP_MAX_BYTES + 1);
    const res = await post(store, { body: huge });
    expect(res?.status).toBe(400);
    expect(await res!.json()).toEqual({ error: "too_large" });
  });

  it("rate-limits creates from one IP", async () => {
    const store = memoryStore();
    const now = 5_000_000;
    for (let i = 0; i < CLIP_RATE_MAX; i++) {
      const res = await post(store, { body: `n${i}` }, "9.9.9.9", now);
      expect(res?.status).toBe(201);
    }
    const blocked = await post(store, { body: "nope" }, "9.9.9.9", now);
    expect(blocked?.status).toBe(429);
    const other = await post(store, { body: "ok" }, "8.8.4.4", now);
    expect(other?.status).toBe(201);
  });

  it("does not list notes", async () => {
    const store = memoryStore();
    const res = await handleClipApi(new Request(`${origin}/api/clip`), { store });
    expect(res?.status).toBe(405);
  });

  it("returns 503 without a database", async () => {
    const res = await handleClipApi(new Request(`${origin}/api/clip`, { method: "POST", body: "x" }), { store: null });
    expect(res?.status).toBe(503);
  });

  it("presigns S3 uploads and rejects html files", async () => {
    const store = memoryStore();
    const s3 = {
      accessKey: "AKID",
      secret: "secret",
      host: "files.s3.cv.cm",
      bucket: "files",
      region: "us-east-1",
    };
    const ok = await handleClipApi(
      new Request(`${origin}/api/clip/upload`, {
        method: "POST",
        headers: { "content-type": "application/json", "CF-Connecting-IP": "2.2.2.2" },
        body: JSON.stringify({ name: "pic.png", type: "image/png", size: 12 }),
      }),
      { store, s3 },
    );
    expect(ok?.status).toBe(200);
    const payload = (await ok!.json()) as { putUrl: string; url: string; kind: string };
    expect(payload.kind).toBe("image");
    expect(payload.putUrl).toContain("https://files.s3.cv.cm/clip/");
    expect(payload.putUrl).toContain("X-Amz-Signature=");
    const bad = await handleClipApi(
      new Request(`${origin}/api/clip/upload`, {
        method: "POST",
        headers: { "content-type": "application/json", "CF-Connecting-IP": "2.2.2.2" },
        body: JSON.stringify({ name: "x.html", type: "text/html", size: 12 }),
      }),
      { store, s3 },
    );
    expect(bad?.status).toBe(400);
    expect(await bad!.json()).toEqual({ error: "file_type" });
  });
});

describe("clip routes", () => {
  it("parses share and tool paths", () => {
    expect(parseAppPath("/c/abcdefgh")).toEqual({ kind: "clip", id: "abcdefgh" });
    expect(parseAppPath("/zh-CN/clip/")).toEqual({ kind: "app", locale: "zh-CN", tool: "clip" });
    expect(parseAppPath("/en/clip/abcdefgh/")).toEqual({
      kind: "app",
      locale: "en",
      tool: "clip",
      clipId: "abcdefgh",
    });
    expect(appHref("en", "clip", "abcdefgh")).toBe("/en/clip/abcdefgh/");
  });
});

describe("clip worker", () => {
  it("redirects short links into the tool", async () => {
    const res = await worker.fetch(new Request("https://cv.cm/c/abcdefgh"), { ASSETS: assets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://cv.cm/en/clip/abcdefgh/");
  });

  it("keeps rejecting unrelated POST", async () => {
    const res = await worker.fetch(new Request("https://cv.cm/en/", { method: "POST" }), { ASSETS: assets() });
    expect(res.status).toBe(405);
  });

  it("returns 503 for clip POST when D1 is missing", async () => {
    const res = await worker.fetch(
      new Request("https://cv.cm/api/clip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "hi" }),
      }),
      { ASSETS: assets() },
    );
    expect(res.status).toBe(503);
  });
});
