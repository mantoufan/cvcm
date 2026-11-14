// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (vi.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/vi/0"),
    () => import("virtual:page-copy/tools/vi/1"),
    () => import("virtual:page-copy/tools/vi/2"),
    () => import("virtual:page-copy/tools/vi/3"),
    () => import("virtual:page-copy/tools/vi/4"),
    () => import("virtual:page-copy/tools/vi/5"),
    () => import("virtual:page-copy/tools/vi/6"),
    () => import("virtual:page-copy/tools/vi/7"),
    () => import("virtual:page-copy/tools/vi/8"),
    () => import("virtual:page-copy/tools/vi/9"),
    () => import("virtual:page-copy/tools/vi/10"),
    () => import("virtual:page-copy/tools/vi/11"),
    () => import("virtual:page-copy/tools/vi/12"),
    () => import("virtual:page-copy/tools/vi/13"),
    () => import("virtual:page-copy/tools/vi/14"),
    () => import("virtual:page-copy/tools/vi/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/vi/0"),
    () => import("virtual:page-copy/tutorials/vi/1"),
    () => import("virtual:page-copy/tutorials/vi/2"),
    () => import("virtual:page-copy/tutorials/vi/3"),
    () => import("virtual:page-copy/tutorials/vi/4"),
    () => import("virtual:page-copy/tutorials/vi/5"),
    () => import("virtual:page-copy/tutorials/vi/6"),
    () => import("virtual:page-copy/tutorials/vi/7"),
    () => import("virtual:page-copy/tutorials/vi/8"),
    () => import("virtual:page-copy/tutorials/vi/9"),
    () => import("virtual:page-copy/tutorials/vi/10"),
    () => import("virtual:page-copy/tutorials/vi/11"),
    () => import("virtual:page-copy/tutorials/vi/12"),
    () => import("virtual:page-copy/tutorials/vi/13"),
    () => import("virtual:page-copy/tutorials/vi/14"),
    () => import("virtual:page-copy/tutorials/vi/15"),
  ],
};
