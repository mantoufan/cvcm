// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (en.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/en/0"),
    () => import("virtual:page-copy/tools/en/1"),
    () => import("virtual:page-copy/tools/en/2"),
    () => import("virtual:page-copy/tools/en/3"),
    () => import("virtual:page-copy/tools/en/4"),
    () => import("virtual:page-copy/tools/en/5"),
    () => import("virtual:page-copy/tools/en/6"),
    () => import("virtual:page-copy/tools/en/7"),
    () => import("virtual:page-copy/tools/en/8"),
    () => import("virtual:page-copy/tools/en/9"),
    () => import("virtual:page-copy/tools/en/10"),
    () => import("virtual:page-copy/tools/en/11"),
    () => import("virtual:page-copy/tools/en/12"),
    () => import("virtual:page-copy/tools/en/13"),
    () => import("virtual:page-copy/tools/en/14"),
    () => import("virtual:page-copy/tools/en/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/en/0"),
    () => import("virtual:page-copy/tutorials/en/1"),
    () => import("virtual:page-copy/tutorials/en/2"),
    () => import("virtual:page-copy/tutorials/en/3"),
    () => import("virtual:page-copy/tutorials/en/4"),
    () => import("virtual:page-copy/tutorials/en/5"),
    () => import("virtual:page-copy/tutorials/en/6"),
    () => import("virtual:page-copy/tutorials/en/7"),
    () => import("virtual:page-copy/tutorials/en/8"),
    () => import("virtual:page-copy/tutorials/en/9"),
    () => import("virtual:page-copy/tutorials/en/10"),
    () => import("virtual:page-copy/tutorials/en/11"),
    () => import("virtual:page-copy/tutorials/en/12"),
    () => import("virtual:page-copy/tutorials/en/13"),
    () => import("virtual:page-copy/tutorials/en/14"),
    () => import("virtual:page-copy/tutorials/en/15"),
  ],
};
