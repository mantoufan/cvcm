// Loaders for this locale's page-copy buckets (src/shared/page-copy.ts): the copy only one page shows, left out of
// the core pack (ko.ts). Kept apart from the pack so that the pack is pure data.
import type { CopyLoaders } from "../../shared/messages";

/** One chunk per bucket (`copyBucket(id)`), fetched on the page of a tool or tutorial in it. */
export const copy: CopyLoaders = {
  tools: [
    () => import("virtual:page-copy/tools/ko/0"),
    () => import("virtual:page-copy/tools/ko/1"),
    () => import("virtual:page-copy/tools/ko/2"),
    () => import("virtual:page-copy/tools/ko/3"),
    () => import("virtual:page-copy/tools/ko/4"),
    () => import("virtual:page-copy/tools/ko/5"),
    () => import("virtual:page-copy/tools/ko/6"),
    () => import("virtual:page-copy/tools/ko/7"),
    () => import("virtual:page-copy/tools/ko/8"),
    () => import("virtual:page-copy/tools/ko/9"),
    () => import("virtual:page-copy/tools/ko/10"),
    () => import("virtual:page-copy/tools/ko/11"),
    () => import("virtual:page-copy/tools/ko/12"),
    () => import("virtual:page-copy/tools/ko/13"),
    () => import("virtual:page-copy/tools/ko/14"),
    () => import("virtual:page-copy/tools/ko/15"),
  ],
  tutorials: [
    () => import("virtual:page-copy/tutorials/ko/0"),
    () => import("virtual:page-copy/tutorials/ko/1"),
    () => import("virtual:page-copy/tutorials/ko/2"),
    () => import("virtual:page-copy/tutorials/ko/3"),
    () => import("virtual:page-copy/tutorials/ko/4"),
    () => import("virtual:page-copy/tutorials/ko/5"),
    () => import("virtual:page-copy/tutorials/ko/6"),
    () => import("virtual:page-copy/tutorials/ko/7"),
    () => import("virtual:page-copy/tutorials/ko/8"),
    () => import("virtual:page-copy/tutorials/ko/9"),
    () => import("virtual:page-copy/tutorials/ko/10"),
    () => import("virtual:page-copy/tutorials/ko/11"),
    () => import("virtual:page-copy/tutorials/ko/12"),
    () => import("virtual:page-copy/tutorials/ko/13"),
    () => import("virtual:page-copy/tutorials/ko/14"),
    () => import("virtual:page-copy/tutorials/ko/15"),
  ],
};
