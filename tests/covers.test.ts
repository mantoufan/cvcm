import { expect, it } from "vitest";
import worker from "../src/worker";
import { COVER } from "../src/client/covers";

it("serves every tool cover as an image instead of a locale redirect", async () => {
  for (const path of Object.values(COVER)) {
    const response = await worker.fetch(new Request(`https://cv.cm${path}`), {
      ASSETS: { fetch: async () => new Response("image", { headers: { "Content-Type": "image/jpeg" } }) },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Location")).toBeNull();
  }
});
