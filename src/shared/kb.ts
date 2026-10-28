import type { ToolId, TutorialId } from "./path";

/**
 * Knowledge articles: plain explanations of the formats, encodings and numbers the tools work with,
 * under `/{locale}/learn/knowledge/{id}/`. Tutorials say how; these say what and why.
 */
export const KB_SEGMENT = "knowledge";

export const KB_ARTICLES = [
  "what-is-heic",
  "jpg-vs-png-vs-webp",
  "what-is-exif",
  "dpi-vs-ppi",
  "aspect-ratios",
  "why-pdf-files-are-large",
  "what-is-base64",
  "unicode-and-utf-8",
  "url-encoding",
  "json-vs-yaml-vs-xml",
  "md5-vs-sha-256",
  "password-strength",
  "what-is-uuid",
  "unix-timestamp",
  "iso-8601",
  "utc-and-time-zones",
  "apr-vs-apy",
  "margin-vs-markup",
] as const;

export type KbId = (typeof KB_ARTICLES)[number];

/** A knowledge page: the hub, one article, or none. */
export type KbPage = KbId | "hub" | null;

export type KbGroupId = "files" | "data" | "time" | "money";

export const KB_GROUPS: readonly { id: KbGroupId; articles: readonly KbId[] }[] = [
  { id: "files", articles: ["what-is-heic", "jpg-vs-png-vs-webp", "what-is-exif", "dpi-vs-ppi", "aspect-ratios", "why-pdf-files-are-large"] },
  { id: "data", articles: ["what-is-base64", "unicode-and-utf-8", "url-encoding", "json-vs-yaml-vs-xml", "md5-vs-sha-256", "password-strength", "what-is-uuid"] },
  { id: "time", articles: ["unix-timestamp", "iso-8601", "utc-and-time-zones"] },
  { id: "money", articles: ["apr-vs-apy", "margin-vs-markup"] },
];

export type KbSource = { title: string; href: string };

export type KbMeta = {
  /** ISO date first published. Last-changed dates per locale come from `npm run kb:sync` (src/locales/kb/meta.ts). */
  published: string;
  /** Tools that put the article to work, first one is the main call to action. */
  tools: ToolId[];
  tutorials: TutorialId[];
  related: KbId[];
  /** Primary references (standards, specs, official docs), not translated. */
  sources: KbSource[];
};

const D = "2026-10-14";

export const KB_META: Record<KbId, KbMeta> = {
  "what-is-heic": {
    published: D,
    tools: ["convert", "image-pdf", "resize"],
    tutorials: ["heic-to-jpg", "jpg-to-pdf"],
    related: ["jpg-vs-png-vs-webp", "what-is-exif"],
    sources: [
      { title: "Apple Support: Using HEIF or HEVC media on Apple devices", href: "https://support.apple.com/en-us/116944" },
      { title: "ISO/IEC 23008-12: High efficiency image file format (HEIF)", href: "https://www.iso.org/standard/83650.html" },
      { title: "Nokia Technologies: HEIF technical information", href: "https://nokiatech.github.io/heif/technical.html" },
    ],
  },
  "jpg-vs-png-vs-webp": {
    published: D,
    tools: ["convert", "resize", "image-pdf"],
    tutorials: ["png-to-jpg", "webp-to-png", "png-to-webp", "avif-to-jpg"],
    related: ["what-is-heic", "dpi-vs-ppi"],
    sources: [
      { title: "MDN: Image file type and format guide", href: "https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types" },
      { title: "Google: WebP compression study", href: "https://developers.google.com/speed/webp/docs/webp_study" },
      { title: "W3C: Portable Network Graphics (PNG) Specification", href: "https://www.w3.org/TR/png-3/" },
      { title: "AOMedia: AV1 Image File Format (AVIF)", href: "https://aomediacodec.github.io/av1-avif/" },
    ],
  },
  "what-is-exif": {
    published: D,
    tools: ["exif", "watermark", "mosaic"],
    tutorials: ["remove-exif", "watermark-id-copy"],
    related: ["what-is-heic", "jpg-vs-png-vs-webp"],
    sources: [
      { title: "Library of Congress: Exif Exchangeable Image File Format", href: "https://www.loc.gov/preservation/digital/formats/fdd/fdd000146.shtml" },
      { title: "ExifTool: EXIF tag names", href: "https://exiftool.org/TagNames/EXIF.html" },
    ],
  },
  "dpi-vs-ppi": {
    published: D,
    tools: ["resize", "crop", "aspect"],
    tutorials: ["resize-image", "crop-photo"],
    related: ["aspect-ratios", "jpg-vs-png-vs-webp"],
    sources: [
      { title: "W3C: CSS Values and Units, absolute lengths", href: "https://www.w3.org/TR/css-values-4/#absolute-lengths" },
      { title: "MDN: Window.devicePixelRatio", href: "https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio" },
    ],
  },
  "aspect-ratios": {
    published: D,
    tools: ["aspect", "crop", "resize"],
    tutorials: ["aspect-ratio", "crop-photo"],
    related: ["dpi-vs-ppi", "jpg-vs-png-vs-webp"],
    sources: [
      { title: "MDN: aspect-ratio (CSS)", href: "https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio" },
      { title: "ITU-R BT.709: HDTV parameter values", href: "https://www.itu.int/rec/R-REC-BT.709" },
    ],
  },
  "why-pdf-files-are-large": {
    published: D,
    tools: ["compress-pdf", "split-pdf", "merge-pdf"],
    tutorials: ["compress-pdf", "split-pdf", "jpg-to-pdf"],
    related: ["dpi-vs-ppi", "jpg-vs-png-vs-webp"],
    sources: [
      { title: "PDF Association: ISO 32000 (PDF)", href: "https://pdfa.org/resource/iso-32000-pdf/" },
      { title: "ISO 32000-2: Document management — PDF 2.0", href: "https://www.iso.org/standard/75839.html" },
    ],
  },
  "what-is-base64": {
    published: D,
    tools: ["base64", "data", "text-hex"],
    tutorials: ["decode-base64", "read-jwt"],
    related: ["unicode-and-utf-8", "url-encoding"],
    sources: [
      { title: "RFC 4648: The Base16, Base32, and Base64 Data Encodings", href: "https://www.rfc-editor.org/rfc/rfc4648" },
      { title: "MDN: Base64", href: "https://developer.mozilla.org/en-US/docs/Glossary/Base64" },
    ],
  },
  "unicode-and-utf-8": {
    published: D,
    tools: ["text-hex", "url-encode", "word-count"],
    tutorials: ["encode-url", "count-words"],
    related: ["what-is-base64", "url-encoding"],
    sources: [
      { title: "Unicode Consortium: UTF-8, UTF-16, UTF-32 & BOM FAQ", href: "https://www.unicode.org/faq/utf_bom.html" },
      { title: "RFC 3629: UTF-8, a transformation format of ISO 10646", href: "https://www.rfc-editor.org/rfc/rfc3629" },
    ],
  },
  "url-encoding": {
    published: D,
    tools: ["url-encode", "slug", "html"],
    tutorials: ["encode-url"],
    related: ["unicode-and-utf-8", "what-is-base64"],
    sources: [
      { title: "RFC 3986: Uniform Resource Identifier (URI): Generic Syntax", href: "https://www.rfc-editor.org/rfc/rfc3986" },
      { title: "WHATWG: URL Standard", href: "https://url.spec.whatwg.org/" },
      { title: "MDN: encodeURIComponent()", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent" },
    ],
  },
  "json-vs-yaml-vs-xml": {
    published: D,
    tools: ["json", "yaml-json", "xml-json"],
    tutorials: ["format-json"],
    related: ["what-is-base64", "unicode-and-utf-8"],
    sources: [
      { title: "RFC 8259: The JSON Data Interchange Format", href: "https://www.rfc-editor.org/rfc/rfc8259" },
      { title: "YAML Ain't Markup Language, version 1.2.2", href: "https://yaml.org/spec/1.2.2/" },
      { title: "W3C: Extensible Markup Language (XML) 1.0", href: "https://www.w3.org/TR/xml/" },
    ],
  },
  "md5-vs-sha-256": {
    published: D,
    tools: ["hash", "password", "uuid"],
    tutorials: ["make-password"],
    related: ["password-strength", "what-is-base64"],
    sources: [
      { title: "NIST FIPS 180-4: Secure Hash Standard", href: "https://csrc.nist.gov/pubs/fips/180-4/upd1/final" },
      { title: "RFC 6151: Updated Security Considerations for MD5", href: "https://www.rfc-editor.org/rfc/rfc6151" },
      { title: "NIST: Hash Functions", href: "https://csrc.nist.gov/projects/hash-functions" },
    ],
  },
  "password-strength": {
    published: D,
    tools: ["password", "hash", "random"],
    tutorials: ["make-password"],
    related: ["md5-vs-sha-256", "what-is-uuid"],
    sources: [
      { title: "NIST SP 800-63B: Authentication and Authenticator Management", href: "https://pages.nist.gov/800-63-4/sp800-63b.html" },
      { title: "CISA: Use Strong Passwords", href: "https://www.cisa.gov/secure-our-world/use-strong-passwords" },
    ],
  },
  "what-is-uuid": {
    published: D,
    tools: ["uuid", "random", "hash"],
    tutorials: [],
    related: ["md5-vs-sha-256", "unix-timestamp"],
    sources: [
      { title: "RFC 9562: Universally Unique IDentifiers (UUIDs)", href: "https://www.rfc-editor.org/rfc/rfc9562" },
      { title: "MDN: Crypto.randomUUID()", href: "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID" },
    ],
  },
  "unix-timestamp": {
    published: D,
    tools: ["timestamp", "timezone", "days"],
    tutorials: ["unix-time", "convert-timezone"],
    related: ["iso-8601", "utc-and-time-zones"],
    sources: [
      { title: "The Open Group: POSIX, Seconds Since the Epoch", href: "https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap04.html" },
      { title: "MDN: Date", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date" },
    ],
  },
  "iso-8601": {
    published: D,
    tools: ["week", "days", "timestamp"],
    tutorials: ["iso-week", "days-between", "shift-date"],
    related: ["unix-timestamp", "utc-and-time-zones"],
    sources: [
      { title: "ISO: ISO 8601 Date and time format", href: "https://www.iso.org/iso-8601-date-and-time-format.html" },
      { title: "RFC 3339: Date and Time on the Internet: Timestamps", href: "https://www.rfc-editor.org/rfc/rfc3339" },
    ],
  },
  "utc-and-time-zones": {
    published: D,
    tools: ["timezone", "timestamp", "countdown"],
    tutorials: ["convert-timezone", "unix-time"],
    related: ["unix-timestamp", "iso-8601"],
    sources: [
      { title: "IANA: Time Zone Database", href: "https://www.iana.org/time-zones" },
      { title: "BIPM: Time (UTC)", href: "https://www.bipm.org/en/time-metrology" },
    ],
  },
  "apr-vs-apy": {
    published: D,
    tools: ["compound", "loan", "percent"],
    tutorials: ["loan-payment", "calculate-percent"],
    related: ["margin-vs-markup"],
    sources: [
      { title: "CFPB: What is the difference between a loan interest rate and the APR?", href: "https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-a-loan-interest-rate-and-the-apr-en-733/" },
      { title: "Investor.gov: Compound Interest Calculator", href: "https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator" },
    ],
  },
  "margin-vs-markup": {
    published: D,
    tools: ["margin", "percent", "discount"],
    tutorials: ["profit-margin", "percent-off", "vat-price"],
    related: ["apr-vs-apy"],
    sources: [
      { title: "U.S. SEC: Beginners' Guide to Financial Statements (revenue, cost of sales, gross profit)", href: "https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements" },
    ],
  },
};

export function isKbId(value: string): value is KbId {
  return (KB_ARTICLES as readonly string[]).includes(value);
}

export function kbGroupOf(id: KbId): KbGroupId {
  return KB_GROUPS.find((group) => group.articles.includes(id))!.id;
}

/** Articles that use this tool, in hub order: tool pages link to them. */
export function kbForTool(tool: ToolId): KbId[] {
  return KB_ARTICLES.filter((id) => KB_META[id].tools.includes(tool));
}
