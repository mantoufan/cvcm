import { expect, it } from "vitest";
import { COVER_ORIGIN as BUILD_ORIGIN, rewriteCoverPaths } from "../scripts/cover-origin.mjs";
import worker from "../src/worker";
import { COVER, LEARN_COVER } from "../src/client/covers";
import { COVER_ORIGIN, coverUrl } from "../src/shared/covers";

const noAssets = { ASSETS: { fetch: async () => new Response("asset", { headers: { "Content-Type": "image/jpeg" } }) } };

it("sends every /covers/ URL to the bucket, keeping the ?v=", async () => {
  for (const path of [...Object.values(COVER), ...Object.values(LEARN_COVER)]) {
    const response = await worker.fetch(new Request(`https://cv.cm${path}`), noAssets);
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(`${COVER_ORIGIN}${path}`);
  }
});

it("redirects nested covers and refuses writes and odd paths", async () => {
  const nested = await worker.fetch(new Request("https://cv.cm/covers/games/guides/thwaite/play.jpg?v=2"), noAssets);
  expect(nested.headers.get("Location")).toBe("https://s3.cv.cm/files/covers/games/guides/thwaite/play.jpg?v=2");
  const put = await worker.fetch(new Request("https://cv.cm/covers/qr-sweet.jpg", { method: "PUT", body: "x" }), noAssets);
  expect(put.status).toBe(405);
  const odd = await worker.fetch(new Request("https://cv.cm/covers/a//b.jpg"), noAssets);
  expect(odd.status).toBe(400);
});

it("builds with the same cover origin the app uses", () => {
  expect(BUILD_ORIGIN).toBe(COVER_ORIGIN);
});

it("rewrites cover literals in every quote style and nothing else", () => {
  const source = [
    `a = "/covers/x.jpg?v=1";`,
    `b = '/covers/y.svg';`,
    "c = `/covers/ref/${id}.webp`;",
    `d = "/learn/covers/";`,
    `e = /^\\/covers\\/(.+)$/;`,
  ].join("\n");
  expect(rewriteCoverPaths(source).split("\n")).toEqual([
    `a = "https://s3.cv.cm/files/covers/x.jpg?v=1";`,
    `b = 'https://s3.cv.cm/files/covers/y.svg';`,
    "c = `https://s3.cv.cm/files/covers/ref/${id}.webp`;",
    `d = "/learn/covers/";`,
    `e = /^\\/covers\\/(.+)$/;`,
  ]);
});

it("gives absolute cover URLs on the bucket, before and after the build rewrite", () => {
  expect(coverUrl("/covers/qr-sweet.jpg?v=1")).toBe("https://s3.cv.cm/files/covers/qr-sweet.jpg");
  expect(coverUrl("https://s3.cv.cm/files/covers/qr-sweet.jpg?v=1")).toBe("https://s3.cv.cm/files/covers/qr-sweet.jpg");
});
