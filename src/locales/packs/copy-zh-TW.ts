// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (zh-TW.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/zh-TW/0"),
    () => import("virtual:page-copy/tools/zh-TW/1"),
    () => import("virtual:page-copy/tools/zh-TW/2"),
    () => import("virtual:page-copy/tools/zh-TW/3"),
    () => import("virtual:page-copy/tools/zh-TW/4"),
    () => import("virtual:page-copy/tools/zh-TW/5"),
    () => import("virtual:page-copy/tools/zh-TW/6"),
    () => import("virtual:page-copy/tools/zh-TW/7"),
    () => import("virtual:page-copy/tools/zh-TW/8"),
    () => import("virtual:page-copy/tools/zh-TW/9"),
    () => import("virtual:page-copy/tools/zh-TW/10"),
    () => import("virtual:page-copy/tools/zh-TW/11"),
    () => import("virtual:page-copy/tools/zh-TW/12"),
    () => import("virtual:page-copy/tools/zh-TW/13"),
    () => import("virtual:page-copy/tools/zh-TW/14"),
    () => import("virtual:page-copy/tools/zh-TW/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/zh-TW/0"),
    () => import("virtual:page-copy/tutorials/zh-TW/1"),
    () => import("virtual:page-copy/tutorials/zh-TW/2"),
    () => import("virtual:page-copy/tutorials/zh-TW/3"),
    () => import("virtual:page-copy/tutorials/zh-TW/4"),
    () => import("virtual:page-copy/tutorials/zh-TW/5"),
    () => import("virtual:page-copy/tutorials/zh-TW/6"),
    () => import("virtual:page-copy/tutorials/zh-TW/7"),
    () => import("virtual:page-copy/tutorials/zh-TW/8"),
    () => import("virtual:page-copy/tutorials/zh-TW/9"),
    () => import("virtual:page-copy/tutorials/zh-TW/10"),
    () => import("virtual:page-copy/tutorials/zh-TW/11"),
    () => import("virtual:page-copy/tutorials/zh-TW/12"),
    () => import("virtual:page-copy/tutorials/zh-TW/13"),
    () => import("virtual:page-copy/tutorials/zh-TW/14"),
    () => import("virtual:page-copy/tutorials/zh-TW/15"),
  ],
};
