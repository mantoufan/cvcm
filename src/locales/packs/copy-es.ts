// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (es.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/es/0"),
    () => import("virtual:page-copy/tools/es/1"),
    () => import("virtual:page-copy/tools/es/2"),
    () => import("virtual:page-copy/tools/es/3"),
    () => import("virtual:page-copy/tools/es/4"),
    () => import("virtual:page-copy/tools/es/5"),
    () => import("virtual:page-copy/tools/es/6"),
    () => import("virtual:page-copy/tools/es/7"),
    () => import("virtual:page-copy/tools/es/8"),
    () => import("virtual:page-copy/tools/es/9"),
    () => import("virtual:page-copy/tools/es/10"),
    () => import("virtual:page-copy/tools/es/11"),
    () => import("virtual:page-copy/tools/es/12"),
    () => import("virtual:page-copy/tools/es/13"),
    () => import("virtual:page-copy/tools/es/14"),
    () => import("virtual:page-copy/tools/es/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/es/0"),
    () => import("virtual:page-copy/tutorials/es/1"),
    () => import("virtual:page-copy/tutorials/es/2"),
    () => import("virtual:page-copy/tutorials/es/3"),
    () => import("virtual:page-copy/tutorials/es/4"),
    () => import("virtual:page-copy/tutorials/es/5"),
    () => import("virtual:page-copy/tutorials/es/6"),
    () => import("virtual:page-copy/tutorials/es/7"),
    () => import("virtual:page-copy/tutorials/es/8"),
    () => import("virtual:page-copy/tutorials/es/9"),
    () => import("virtual:page-copy/tutorials/es/10"),
    () => import("virtual:page-copy/tutorials/es/11"),
    () => import("virtual:page-copy/tutorials/es/12"),
    () => import("virtual:page-copy/tutorials/es/13"),
    () => import("virtual:page-copy/tutorials/es/14"),
    () => import("virtual:page-copy/tutorials/es/15"),
  ],
};
