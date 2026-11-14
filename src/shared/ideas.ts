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

export type IdeaSource = { name: string; url: string };

/** How much money it usually takes to start: 1 = little (under a few hundred US dollars), 2 = some equipment or stock, 3 = a lease, a vehicle or machines. */
export type IdeaStartup = 1 | 2 | 3;

export type IdeaMeta = {
  /** Upfront cost level, shown as a label (the text explains it; no figures). */
  startup: IdeaStartup;
  /** Online (can run from anywhere) or local (needs customers or a site nearby). */
  where: "online" | "local";
  related: IdeaId[];
  /** Official or well-known references; every URL was opened and checked. */
  sources: IdeaSource[];
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

/** Ideas the site footer links directly (highest Keyword Planner volume); their names are core-pack `ideasFocus.*`. */
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
  "ai-agency": { startup: 1, where: "online", related: ["ai-automation-agency", "ai-app", "social-media-manager"], sources: [{ name: "U.S. Federal Trade Commission: FTC Announces Crackdown on Deceptive AI Claims and Schemes", url: "https://www.ftc.gov/news-events/news/press-releases/2024/09/ftc-announces-crackdown-deceptive-ai-claims-schemes" }] },
  "ai-automation-agency": { startup: 1, where: "online", related: ["ai-agency", "micro-saas", "virtual-assistant"], sources: [{ name: "FTC Consumer Advice: When a Business Offer or Coaching Program Is a Scam", url: "https://consumer.ftc.gov/articles/when-business-offer-or-coaching-program-scam" }] },
  "ai-app": { startup: 1, where: "online", related: ["micro-saas", "ai-agency", "digital-products"], sources: [{ name: "U.S. Federal Trade Commission: FTC Announces Crackdown on Deceptive AI Claims and Schemes", url: "https://www.ftc.gov/news-events/news/press-releases/2024/09/ftc-announces-crackdown-deceptive-ai-claims-schemes" }] },
  "micro-saas": { startup: 1, where: "online", related: ["ai-app", "ai-automation-agency", "newsletter"], sources: [] },
  "ugc-creator": { startup: 1, where: "online", related: ["faceless-youtube", "social-media-manager", "tiktok-shop"], sources: [{ name: "U.S. Federal Trade Commission: Disclosures 101 for Social Media Influencers", url: "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers" }] },
  "virtual-assistant": { startup: 1, where: "online", related: ["social-media-manager", "bookkeeping", "ai-automation-agency"], sources: [{ name: "FTC Consumer Advice: Job Scams", url: "https://consumer.ftc.gov/articles/job-scams" }] },
  "social-media-manager": { startup: 1, where: "online", related: ["ugc-creator", "virtual-assistant", "ai-agency"], sources: [{ name: "U.S. Federal Trade Commission: Disclosures 101 for Social Media Influencers", url: "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers" }] },
  "faceless-youtube": { startup: 1, where: "online", related: ["ugc-creator", "newsletter", "affiliate-marketing"], sources: [{ name: "YouTube Help: YouTube Partner Program overview & eligibility", url: "https://support.google.com/youtube/answer/72851" }, { name: "YouTube Help: YouTube channel monetization policies", url: "https://support.google.com/youtube/answer/1311392" }, { name: "FTC Consumer Advice: When a Business Offer or Coaching Program Is a Scam", url: "https://consumer.ftc.gov/articles/when-business-offer-or-coaching-program-scam" }] },
  newsletter: { startup: 1, where: "online", related: ["online-course", "affiliate-marketing", "faceless-youtube"], sources: [{ name: "U.S. Federal Trade Commission: CAN-SPAM Act: A Compliance Guide for Business", url: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business" }] },
  "online-course": { startup: 1, where: "online", related: ["newsletter", "digital-products", "tutoring"], sources: [{ name: "FTC Consumer Advice: When a Business Offer or Coaching Program Is a Scam", url: "https://consumer.ftc.gov/articles/when-business-offer-or-coaching-program-scam" }] },
  "amazon-fba": { startup: 2, where: "online", related: ["tiktok-shop", "dropshipping", "print-on-demand"], sources: [{ name: "Amazon Sell: Selling fees and pricing", url: "https://sell.amazon.com/pricing" }, { name: "Amazon Sell: Fulfillment by Amazon", url: "https://sell.amazon.com/fulfillment-by-amazon" }] },
  "tiktok-shop": { startup: 1, where: "online", related: ["amazon-fba", "ugc-creator", "affiliate-marketing"], sources: [{ name: "Wikipedia: TikTok Shop", url: "https://en.wikipedia.org/wiki/TikTok_Shop" }] },
  "affiliate-marketing": { startup: 1, where: "online", related: ["newsletter", "faceless-youtube", "tiktok-shop"], sources: [{ name: "FTC: FTC's Endorsement Guides: What People Are Asking", url: "https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking" }] },
  dropshipping: { startup: 1, where: "online", related: ["print-on-demand", "amazon-fba", "tiktok-shop"], sources: [{ name: "FTC: Business Guide to the FTC's Mail, Internet, or Telephone Order Merchandise Rule", url: "https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule" }] },
  "print-on-demand": { startup: 1, where: "online", related: ["t-shirt-business", "dropshipping", "digital-products"], sources: [] },
  "digital-products": { startup: 1, where: "online", related: ["print-on-demand", "online-course", "ai-app"], sources: [{ name: "Etsy Help: Fees & Payments Policy", url: "https://help.etsy.com/hc/en-us/articles/360035902374" }] },
  resale: { startup: 1, where: "online", related: ["clothing-brand", "amazon-fba", "tiktok-shop"], sources: [{ name: "FTC: Informing Businesses about the INFORM Consumers Act", url: "https://www.ftc.gov/business-guidance/resources/informing-businesses-about-inform-consumers-act" }] },
  "clothing-brand": { startup: 2, where: "online", related: ["t-shirt-business", "print-on-demand", "resale"], sources: [{ name: "FTC: Threading Your Way Through the Labeling Requirements Under the Textile and Wool Acts", url: "https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-under-textile-wool-acts" }] },
  "cleaning-business": { startup: 1, where: "local", related: ["pressure-washing", "junk-removal", "lawn-care"], sources: [] },
  "pressure-washing": { startup: 2, where: "local", related: ["cleaning-business", "mobile-car-detailing", "lawn-care"], sources: [] },
  "lawn-care": { startup: 2, where: "local", related: ["pressure-washing", "cleaning-business", "junk-removal"], sources: [{ name: "US EPA: Restricted Use Products (RUP) Report", url: "https://www.epa.gov/pesticide-worker-safety/restricted-use-products-rup-report" }] },
  "mobile-car-detailing": { startup: 2, where: "local", related: ["car-wash", "pressure-washing", "cleaning-business"], sources: [] },
  "junk-removal": { startup: 3, where: "local", related: ["cleaning-business", "resale", "lawn-care"], sources: [{ name: "GOV.UK: Register or renew as a waste carrier, broker or dealer (England)", url: "https://www.gov.uk/register-renew-waste-carrier-broker-dealer-england" }] },
  "pet-services": { startup: 1, where: "local", related: ["cleaning-business", "tutoring", "home-bakery"], sources: [{ name: "GOV.UK: Animal activities licensing: statutory guidance for local authorities", url: "https://www.gov.uk/government/publications/animal-activities-licensing-guidance-for-local-authorities" }] },
  tutoring: { startup: 1, where: "local", related: ["online-course", "pet-services", "bookkeeping"], sources: [{ name: "GOV.UK: DBS check requests: guidance for employers", url: "https://www.gov.uk/guidance/dbs-check-requests-guidance-for-employers" }] },
  bookkeeping: { startup: 1, where: "online", related: ["virtual-assistant", "tutoring", "ai-automation-agency"], sources: [{ name: "GOV.UK: Money Laundering Regulations: who needs to register", url: "https://www.gov.uk/guidance/money-laundering-regulations-who-needs-to-register" }, { name: "IRS: Understanding tax return preparer credentials and qualifications", url: "https://www.irs.gov/tax-professionals/understanding-tax-return-preparer-credentials-and-qualifications" }, { name: "IRS: PTIN requirements for tax return preparers", url: "https://www.irs.gov/tax-professionals/ptin-requirements-for-tax-return-preparers" }] },
  "vending-machine": { startup: 2, where: "local", related: ["claw-machine", "laundromat", "self-storage"], sources: [] },
  "claw-machine": { startup: 2, where: "local", related: ["vending-machine", "laundromat", "bubble-tea"], sources: [{ name: "Wikipedia: Claw machine", url: "https://en.wikipedia.org/wiki/Claw_machine" }] },
  laundromat: { startup: 3, where: "local", related: ["car-wash", "vending-machine", "self-storage"], sources: [{ name: "U.S. Federal Trade Commission: A Consumer's Guide to Buying a Franchise", url: "https://www.ftc.gov/business-guidance/resources/consumers-guide-buying-franchise" }, { name: "U.S. Small Business Administration: Apply for licenses and permits", url: "https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits" }] },
  "car-wash": { startup: 3, where: "local", related: ["mobile-car-detailing", "laundromat", "self-storage"], sources: [{ name: "Wikipedia: Car wash", url: "https://en.wikipedia.org/wiki/Car_wash" }] },
  "self-storage": { startup: 3, where: "local", related: ["laundromat", "vending-machine", "car-wash"], sources: [{ name: "Wikipedia: Self storage", url: "https://en.wikipedia.org/wiki/Self_storage" }] },
  "food-truck": { startup: 3, where: "local", related: ["coffee-shop", "bubble-tea", "home-bakery"], sources: [{ name: "U.S. Small Business Administration: Apply for licenses and permits", url: "https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits" }] },
  "bubble-tea": { startup: 3, where: "local", related: ["coffee-shop", "food-truck", "home-bakery"], sources: [{ name: "U.S. Federal Trade Commission: A Consumer's Guide to Buying a Franchise", url: "https://www.ftc.gov/business-guidance/resources/consumers-guide-buying-franchise" }] },
  "coffee-shop": { startup: 3, where: "local", related: ["bubble-tea", "food-truck", "home-bakery"], sources: [{ name: "U.S. Federal Trade Commission: A Consumer's Guide to Buying a Franchise", url: "https://www.ftc.gov/business-guidance/resources/consumers-guide-buying-franchise" }, { name: "U.S. Small Business Administration: Apply for licenses and permits", url: "https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits" }] },
  "home-bakery": { startup: 1, where: "local", related: ["food-truck", "candle-business", "coffee-shop"], sources: [{ name: "GOV.UK: Starting a food business", url: "https://www.gov.uk/guidance/starting-a-food-business" }, { name: "Wikipedia: California Homemade Food Act", url: "https://en.wikipedia.org/wiki/California_Homemade_Food_Act" }] },
  "candle-business": { startup: 1, where: "online", related: ["jewelry-business", "home-bakery", "laser-engraving"], sources: [{ name: "HSENI: Candles and CLP", url: "https://www.hseni.gov.uk/articles/candles-and-clp" }] },
  "3d-printing": { startup: 2, where: "online", related: ["laser-engraving", "print-on-demand", "jewelry-business"], sources: [{ name: "Creative Commons: Attribution-NonCommercial 4.0 International deed", url: "https://creativecommons.org/licenses/by-nc/4.0/" }] },
  "laser-engraving": { startup: 2, where: "online", related: ["3d-printing", "t-shirt-business", "candle-business"], sources: [{ name: "MIT Environment, Health & Safety: Laser Cutter Safety", url: "https://ehs.mit.edu/workplace-safety-program/laser-cutter-safety/" }] },
  "jewelry-business": { startup: 1, where: "online", related: ["candle-business", "clothing-brand", "laser-engraving"], sources: [{ name: "U.S. Consumer Product Safety Commission: Total Lead Content", url: "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Lead/Total-Lead-Content" }, { name: "Wikipedia: Nickel allergy", url: "https://en.wikipedia.org/wiki/Nickel_allergy" }] },
  "t-shirt-business": { startup: 2, where: "online", related: ["print-on-demand", "clothing-brand", "laser-engraving"], sources: [] },
};

export function isIdeaId(value: string): value is IdeaId {
  return (IDEA_ENTRIES as readonly string[]).includes(value);
}

export function ideaGroupOf(id: IdeaId): IdeaGroupId {
  const group = IDEA_GROUPS.find((g) => (g.entries as readonly string[]).includes(id));
  if (!group) throw new Error(`idea not in a group: ${id}`);
  return group.id;
}
