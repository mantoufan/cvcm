import { describe, expect, it } from "vitest";
import { toolBreadcrumbJsonLd } from "../src/shared/seo";

type Item = { name: string; item: string };
const items = (data: Record<string, unknown>): Item[] => data.itemListElement as Item[];

describe("tool breadcrumb", () => {
  it("files a browser game under Games / Free mini games", () => {
    const list = items(toolBreadcrumbJsonLd("zh-CN", "reversi"));
    expect(list.map((i) => i.item)).toEqual([
      "https://cv.cm/zh-cn/",
      "https://cv.cm/zh-cn/games/",
      "https://cv.cm/zh-cn/games/mini/",
      "https://cv.cm/zh-cn/reversi/",
    ]);
    expect(list[1].name).toBe("游戏");
    expect(list[2].name).toBe("免费小游戏");
  });

  it("keeps Home / tool for a plain tool", () => {
    expect(items(toolBreadcrumbJsonLd("en", "qr")).map((i) => i.item)).toEqual(["https://cv.cm/en/", "https://cv.cm/en/qr/"]);
  });
});
