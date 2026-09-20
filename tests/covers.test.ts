import { expect, it } from "vitest";
import worker from "../src/worker";
import { COVER, LEARN_COVER } from "../src/client/covers";

it("serves every tool cover as an image instead of a locale redirect", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("missing", { status: 404 });
  try {
    for (const path of [...Object.values(COVER), ...Object.values(LEARN_COVER)]) {
      const response = await worker.fetch(new Request(`https://cv.cm${path}`), {
        ASSETS: { fetch: async () => new Response("image", { headers: { "Content-Type": "image/jpeg" } }) },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/jpeg");
      expect(response.headers.get("Location")).toBeNull();
    }
  } finally {
    globalThis.fetch = original;
  }
});

it("serves covers from S3 when the object exists", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    expect(String(input)).toBe("https://s3.cv.cm/files/covers/qr-sweet.jpg");
    return new Response("s3-bytes", { status: 200, headers: { "Content-Type": "image/jpeg" } });
  };
  try {
    const response = await worker.fetch(new Request("https://cv.cm/covers/qr-sweet.jpg?v=1"), {
      ASSETS: { fetch: async () => new Response("pages", { headers: { "Content-Type": "image/jpeg" } }) },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("s3-bytes");
  } finally {
    globalThis.fetch = original;
  }
});
