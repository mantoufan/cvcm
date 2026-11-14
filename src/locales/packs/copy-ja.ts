// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (ja.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/ja/0"),
    () => import("virtual:page-copy/tools/ja/1"),
    () => import("virtual:page-copy/tools/ja/2"),
    () => import("virtual:page-copy/tools/ja/3"),
    () => import("virtual:page-copy/tools/ja/4"),
    () => import("virtual:page-copy/tools/ja/5"),
    () => import("virtual:page-copy/tools/ja/6"),
    () => import("virtual:page-copy/tools/ja/7"),
    () => import("virtual:page-copy/tools/ja/8"),
    () => import("virtual:page-copy/tools/ja/9"),
    () => import("virtual:page-copy/tools/ja/10"),
    () => import("virtual:page-copy/tools/ja/11"),
    () => import("virtual:page-copy/tools/ja/12"),
    () => import("virtual:page-copy/tools/ja/13"),
    () => import("virtual:page-copy/tools/ja/14"),
    () => import("virtual:page-copy/tools/ja/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/ja/0"),
    () => import("virtual:page-copy/tutorials/ja/1"),
    () => import("virtual:page-copy/tutorials/ja/2"),
    () => import("virtual:page-copy/tutorials/ja/3"),
    () => import("virtual:page-copy/tutorials/ja/4"),
    () => import("virtual:page-copy/tutorials/ja/5"),
    () => import("virtual:page-copy/tutorials/ja/6"),
    () => import("virtual:page-copy/tutorials/ja/7"),
    () => import("virtual:page-copy/tutorials/ja/8"),
    () => import("virtual:page-copy/tutorials/ja/9"),
    () => import("virtual:page-copy/tutorials/ja/10"),
    () => import("virtual:page-copy/tutorials/ja/11"),
    () => import("virtual:page-copy/tutorials/ja/12"),
    () => import("virtual:page-copy/tutorials/ja/13"),
    () => import("virtual:page-copy/tutorials/ja/14"),
    () => import("virtual:page-copy/tutorials/ja/15"),
  ],
};
