import type { ToolId, TutorialId } from "./path";

export type TutorialMeta = {
  minutes: number;
  related: ToolId[];
  steps?: number;
  kind?: "card" | "course";
  figure?: "thirds" | "window" | "crop" | "court" | "pool" | "site" | "mind";
  figByStep?: Partial<Record<number, string>>;
  codeByStep?: Partial<Record<number, "twoSum" | "binarySearch" | "countdown">>;
};

export function tutorialSteps(id: TutorialId): number {
  return TUTORIAL_META[id].steps ?? 5;
}

export const TUTORIAL_META: Record<TutorialId, TutorialMeta> = {
  portrait: {
    minutes: 75,
    steps: 10,
    kind: "course",
    related: ["crop", "collage", "color"],
  },
  algorithms: {
    minutes: 90,
    steps: 10,
    kind: "course",
    related: [],
    codeByStep: { 7: "twoSum", 8: "binarySearch", 10: "countdown" },
  },
  "phone-photos": {
    minutes: 20,
    related: ["crop", "collage", "watermark"],
    figure: "thirds",
  },
  "window-light": {
    minutes: 15,
    related: ["crop", "color"],
    figure: "window",
  },
  "crop-compose": {
    minutes: 10,
    related: ["crop", "resize", "collage"],
    figure: "crop",
  },
  "badminton-warmup": {
    minutes: 10,
    related: ["clip"],
    figure: "court",
  },
  "badminton-rules": {
    minutes: 15,
    related: ["clip"],
    figure: "court",
  },
  "pool-safety": {
    minutes: 12,
    related: ["clip"],
    figure: "pool",
  },
  "one-page-site": {
    minutes: 60,
    related: ["data", "clip", "qr"],
    figure: "site",
  },
  "healthy-boundaries": {
    minutes: 15,
    related: ["clip"],
    figure: "mind",
  },
  "read-character": {
    minutes: 15,
    related: ["clip"],
    figure: "mind",
  },
};

export const ALGO_SNIPPETS = {
  twoSum: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return null;
}

twoSum([2, 7, 11, 15], 9); // [0, 1]`,
  binarySearch: `function binarySearch(sorted, target) {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

binarySearch([1, 3, 4, 8, 12], 8); // 3`,
  countdown: `function countdown(n, result = []) {
  if (n === 0) return result;
  result.push(n);
  return countdown(n - 1, result);
}

countdown(3); // [3, 2, 1]`,
} as const;

export const ONE_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your name</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 12vh auto; padding: 1.25rem; line-height: 1.55; color: #3a2030; }
    a.pay { display: inline-block; margin-top: 0.6rem; background: #c83f79; color: #fff; padding: 0.75rem 1.15rem; border-radius: 999px; text-decoration: none; }
  </style>
</head>
<body>
  <h1>Your name</h1>
  <p>One sentence: what you make or do.</p>
  <p><a class="pay" href="mailto:hello@example.com">Contact</a></p>
</body>
</html>
`;

export const TUTORIAL_SOURCES: Partial<Record<TutorialId, { title: string; href: string }[]>> = {
  algorithms: [{ title: "JavaScript Map — MDN", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map" }],
  "one-page-site": [
    { title: "Cloudflare Pages — Direct Upload", href: "https://developers.cloudflare.com/pages/get-started/direct-upload/" },
    { title: "GitHub Pages — Create a site", href: "https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site" },
  ],
};
