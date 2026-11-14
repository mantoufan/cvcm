// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (id.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/id/0"),
    () => import("virtual:page-copy/tools/id/1"),
    () => import("virtual:page-copy/tools/id/2"),
    () => import("virtual:page-copy/tools/id/3"),
    () => import("virtual:page-copy/tools/id/4"),
    () => import("virtual:page-copy/tools/id/5"),
    () => import("virtual:page-copy/tools/id/6"),
    () => import("virtual:page-copy/tools/id/7"),
    () => import("virtual:page-copy/tools/id/8"),
    () => import("virtual:page-copy/tools/id/9"),
    () => import("virtual:page-copy/tools/id/10"),
    () => import("virtual:page-copy/tools/id/11"),
    () => import("virtual:page-copy/tools/id/12"),
    () => import("virtual:page-copy/tools/id/13"),
    () => import("virtual:page-copy/tools/id/14"),
    () => import("virtual:page-copy/tools/id/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/id/0"),
    () => import("virtual:page-copy/tutorials/id/1"),
    () => import("virtual:page-copy/tutorials/id/2"),
    () => import("virtual:page-copy/tutorials/id/3"),
    () => import("virtual:page-copy/tutorials/id/4"),
    () => import("virtual:page-copy/tutorials/id/5"),
    () => import("virtual:page-copy/tutorials/id/6"),
    () => import("virtual:page-copy/tutorials/id/7"),
    () => import("virtual:page-copy/tutorials/id/8"),
    () => import("virtual:page-copy/tutorials/id/9"),
    () => import("virtual:page-copy/tutorials/id/10"),
    () => import("virtual:page-copy/tutorials/id/11"),
    () => import("virtual:page-copy/tutorials/id/12"),
    () => import("virtual:page-copy/tutorials/id/13"),
    () => import("virtual:page-copy/tutorials/id/14"),
    () => import("virtual:page-copy/tutorials/id/15"),
  ],
};
