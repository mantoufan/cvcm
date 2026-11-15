/**
 * The Ideas channel under `/{locale}/ideas/{id}/`: business and side-hustle ideas, each valued with search data. Ideas
 * were chosen from Google Ads Keyword Planner (2026-11): what the idea is, what it takes, who it suits and how to test it,
 * plus a demand panel derived from 48 months of Keyword Planner history in eight languages
 * (`scripts/ideas/fetch_kp.py` writes `ideas-data.json`; raw volumes and bids never enter the repo).
 */
export const IDEAS_SEGMENT = "ideas";

export const IDEA_GROUPS = [
  { id: "ai", entries: ["ai-agency", "ai-automation-agency", "ai-app", "micro-saas", "ugc-creator", "virtual-assistant", "social-media-manager", "faceless-youtube", "newsletter", "online-course"] },
  { id: "ecommerce", entries: ["amazon-fba", "tiktok-shop", "affiliate-marketing", "dropshipping", "print-on-demand", "digital-products", "resale", "clothing-brand"] },
  { id: "services", entries: ["cleaning-business", "pressure-washing", "lawn-care", "mobile-car-detailing", "junk-removal", "pet-services", "tutoring", "bookkeeping"] },
  { id: "shops", entries: ["vending-machine", "claw-machine", "laundromat", "car-wash", "self-storage", "food-truck", "bubble-tea", "coffee-shop"] },
  { id: "maker", entries: ["home-bakery", "candle-business", "3d-printing", "laser-engraving", "jewelry-business", "t-shirt-business"] },
] as const;

export type IdeaGroupId = (typeof IDEA_GROUPS)[number]["id"];
export type IdeaId = (typeof IDEA_GROUPS)[number]["entries"][number];

export const IDEA_ENTRIES: readonly IdeaId[] = IDEA_GROUPS.flatMap((group) => group.entries);

/** An ideas page: the hub, one idea, or none. */
export type IdeaPage = IdeaId | "hub" | null;

/** Official or well-known references per idea (every URL was opened and checked) live in `ideas-sources.json`, which
 * rides in the ideas pack so the main bundle does not carry them. */
export type IdeaSource = { name: string; url: string };

/** How much money it usually takes to start: 1 = little (under a few hundred US dollars), 2 = some equipment or stock, 3 = a lease, a vehicle or machines. */
export type IdeaStartup = 1 | 2 | 3;

export type IdeaMeta = {
  /** Upfront cost level, shown as a label (the text explains it; no figures). */
  startup: IdeaStartup;
  /** Online (can run from anywhere) or local (needs customers or a site nearby). */
  where: "online" | "local";
  related: IdeaId[];
};

export const IDEAS_PUBLISHED = "2026-11-14";

/** `fetched` in ideas-data.json (scripts/ideas/fetch_kp.py rewrites both), kept here so the sitemap need not import the data. */
export const IDEAS_DATA_FETCHED = "2026-11-14";

/** Ideas added after the first batch, by id, with the day each went live. */
export const IDEAS_ADDED: Partial<Record<IdeaId, string>> = {};

/** Ideas whose copy was edited after they were published, for dateModified and the sitemap. */
export const IDEAS_UPDATED: Partial<Record<IdeaId, string>> = {};

export function ideaPublished(id: IdeaId): string {
  return IDEAS_ADDED[id] ?? IDEAS_PUBLISHED;
}

/** Ideas the site footer links directly (picked by hand: high search demand, spread across the groups); their names are core-pack `ideasFocus.*`. */
export const IDEAS_FOCUS = [
  "amazon-fba",
  "tiktok-shop",
  "affiliate-marketing",
  "ai-agency",
  "ugc-creator",
  "dropshipping",
  "vending-machine",
  "cleaning-business",
] as const satisfies readonly IdeaId[];

export const IDEA_META: Record<IdeaId, IdeaMeta> = {
  "ai-agency": { startup: 1, where: "online", related: ["ai-automation-agency", "ai-app", "social-media-manager"] },
  "ai-automation-agency": { startup: 1, where: "online", related: ["ai-agency", "micro-saas", "virtual-assistant"] },
  "ai-app": { startup: 1, where: "online", related: ["micro-saas", "ai-agency", "digital-products"] },
  "micro-saas": { startup: 1, where: "online", related: ["ai-app", "ai-automation-agency", "newsletter"] },
  "ugc-creator": { startup: 1, where: "online", related: ["faceless-youtube", "social-media-manager", "tiktok-shop"] },
  "virtual-assistant": { startup: 1, where: "online", related: ["social-media-manager", "bookkeeping", "ai-automation-agency"] },
  "social-media-manager": { startup: 1, where: "online", related: ["ugc-creator", "virtual-assistant", "ai-agency"] },
  "faceless-youtube": { startup: 1, where: "online", related: ["ugc-creator", "newsletter", "affiliate-marketing"] },
  newsletter: { startup: 1, where: "online", related: ["online-course", "affiliate-marketing", "faceless-youtube"] },
  "online-course": { startup: 1, where: "online", related: ["newsletter", "digital-products", "tutoring"] },
  "amazon-fba": { startup: 2, where: "online", related: ["tiktok-shop", "dropshipping", "print-on-demand"] },
  "tiktok-shop": { startup: 1, where: "online", related: ["amazon-fba", "ugc-creator", "affiliate-marketing"] },
  "affiliate-marketing": { startup: 1, where: "online", related: ["newsletter", "faceless-youtube", "tiktok-shop"] },
  dropshipping: { startup: 1, where: "online", related: ["print-on-demand", "amazon-fba", "tiktok-shop"] },
  "print-on-demand": { startup: 1, where: "online", related: ["t-shirt-business", "dropshipping", "digital-products"] },
  "digital-products": { startup: 1, where: "online", related: ["print-on-demand", "online-course", "ai-app"] },
  resale: { startup: 1, where: "online", related: ["clothing-brand", "amazon-fba", "tiktok-shop"] },
  "clothing-brand": { startup: 2, where: "online", related: ["t-shirt-business", "print-on-demand", "resale"] },
  "cleaning-business": { startup: 1, where: "local", related: ["pressure-washing", "junk-removal", "lawn-care"] },
  "pressure-washing": { startup: 2, where: "local", related: ["cleaning-business", "mobile-car-detailing", "lawn-care"] },
  "lawn-care": { startup: 2, where: "local", related: ["pressure-washing", "cleaning-business", "junk-removal"] },
  "mobile-car-detailing": { startup: 2, where: "local", related: ["car-wash", "pressure-washing", "cleaning-business"] },
  "junk-removal": { startup: 3, where: "local", related: ["cleaning-business", "resale", "lawn-care"] },
  "pet-services": { startup: 1, where: "local", related: ["cleaning-business", "tutoring", "home-bakery"] },
  tutoring: { startup: 1, where: "local", related: ["online-course", "pet-services", "bookkeeping"] },
  bookkeeping: { startup: 1, where: "online", related: ["virtual-assistant", "tutoring", "ai-automation-agency"] },
  "vending-machine": { startup: 2, where: "local", related: ["claw-machine", "laundromat", "self-storage"] },
  "claw-machine": { startup: 2, where: "local", related: ["vending-machine", "laundromat", "bubble-tea"] },
  laundromat: { startup: 3, where: "local", related: ["car-wash", "vending-machine", "self-storage"] },
  "car-wash": { startup: 3, where: "local", related: ["mobile-car-detailing", "laundromat", "self-storage"] },
  "self-storage": { startup: 3, where: "local", related: ["laundromat", "vending-machine", "car-wash"] },
  "food-truck": { startup: 3, where: "local", related: ["coffee-shop", "bubble-tea", "home-bakery"] },
  "bubble-tea": { startup: 3, where: "local", related: ["coffee-shop", "food-truck", "home-bakery"] },
  "coffee-shop": { startup: 3, where: "local", related: ["bubble-tea", "food-truck", "home-bakery"] },
  "home-bakery": { startup: 1, where: "local", related: ["food-truck", "candle-business", "coffee-shop"] },
  "candle-business": { startup: 1, where: "online", related: ["jewelry-business", "home-bakery", "laser-engraving"] },
  "3d-printing": { startup: 2, where: "online", related: ["laser-engraving", "print-on-demand", "jewelry-business"] },
  "laser-engraving": { startup: 2, where: "online", related: ["3d-printing", "t-shirt-business", "candle-business"] },
  "jewelry-business": { startup: 1, where: "online", related: ["candle-business", "clothing-brand", "laser-engraving"] },
  "t-shirt-business": { startup: 2, where: "online", related: ["print-on-demand", "clothing-brand", "laser-engraving"] },
};

export function isIdeaId(value: string): value is IdeaId {
  return (IDEA_ENTRIES as readonly string[]).includes(value);
}

export function ideaGroupOf(id: IdeaId): IdeaGroupId {
  const group = IDEA_GROUPS.find((g) => (g.entries as readonly string[]).includes(id));
  if (!group) throw new Error(`idea not in a group: ${id}`);
  return group.id;
}
