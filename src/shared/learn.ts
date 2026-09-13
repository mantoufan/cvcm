import type { ToolId, TutorialId } from "./path";

export type TutorialMeta = {
  minutes: number;
  related: ToolId[];
  figure?: "thirds" | "window" | "crop" | "court" | "pool" | "site";
};

export const TUTORIAL_META: Record<TutorialId, TutorialMeta> = {
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
};

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
  <p><a class="pay" href="https://buy.stripe.com/your-link">Pay / book</a></p>
</body>
</html>
`;
