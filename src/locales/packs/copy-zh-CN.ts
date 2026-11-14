// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (zh-CN.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/zh-CN/0"),
    () => import("virtual:page-copy/tools/zh-CN/1"),
    () => import("virtual:page-copy/tools/zh-CN/2"),
    () => import("virtual:page-copy/tools/zh-CN/3"),
    () => import("virtual:page-copy/tools/zh-CN/4"),
    () => import("virtual:page-copy/tools/zh-CN/5"),
    () => import("virtual:page-copy/tools/zh-CN/6"),
    () => import("virtual:page-copy/tools/zh-CN/7"),
    () => import("virtual:page-copy/tools/zh-CN/8"),
    () => import("virtual:page-copy/tools/zh-CN/9"),
    () => import("virtual:page-copy/tools/zh-CN/10"),
    () => import("virtual:page-copy/tools/zh-CN/11"),
    () => import("virtual:page-copy/tools/zh-CN/12"),
    () => import("virtual:page-copy/tools/zh-CN/13"),
    () => import("virtual:page-copy/tools/zh-CN/14"),
    () => import("virtual:page-copy/tools/zh-CN/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/zh-CN/0"),
    () => import("virtual:page-copy/tutorials/zh-CN/1"),
    () => import("virtual:page-copy/tutorials/zh-CN/2"),
    () => import("virtual:page-copy/tutorials/zh-CN/3"),
    () => import("virtual:page-copy/tutorials/zh-CN/4"),
    () => import("virtual:page-copy/tutorials/zh-CN/5"),
    () => import("virtual:page-copy/tutorials/zh-CN/6"),
    () => import("virtual:page-copy/tutorials/zh-CN/7"),
    () => import("virtual:page-copy/tutorials/zh-CN/8"),
    () => import("virtual:page-copy/tutorials/zh-CN/9"),
    () => import("virtual:page-copy/tutorials/zh-CN/10"),
    () => import("virtual:page-copy/tutorials/zh-CN/11"),
    () => import("virtual:page-copy/tutorials/zh-CN/12"),
    () => import("virtual:page-copy/tutorials/zh-CN/13"),
    () => import("virtual:page-copy/tutorials/zh-CN/14"),
    () => import("virtual:page-copy/tutorials/zh-CN/15"),
  ],
};
