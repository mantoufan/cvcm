/**
 * Domain name valuation from the name itself: the extension, the length, whether it is a common English word or two,
 * a short number or acronym, or pronounceable. The bands follow public aftermarket sales (short .com names,
 * one-word .com names and four-digit .com numbers trade in the thousands and up; long, hyphenated or mixed names near
 * their renewal fee). A rule-based estimate, not an appraisal: traffic, trademarks and one keen buyer move real prices.
 */

/** Common English words that make good names (business, money, tech, places, everyday things). */
const WORDS = new Set(
  (
    "a ace act ad age agent ai air all alpha am angel answer ant app apple apps arc arch area art arts ask atlas auto away " +
    "baby back bag bake baker bank bar base bay beach bean bear beat beauty bed bee best bet big bike bill bio bird bit black " +
    "blog blue board boat body bold bond book books boost boot boss bot box boy brain brand bread bridge bright build bus " +
    "business buy buzz cab cafe cake call cam camp can cap capital car card care cars case cash cast cat chain chat cheap " +
    "check chef chess child chip city class clean clear click clinic clip clock cloud club coach code coffee coin cold " +
    "color cook cool copy core cost craft crypto cube cup cut cyber daily dash data date day deal deals dental design desk " +
    "dev diet digital direct doc dog door dot dream drink drive drop duck earth easy eat eco edge edu energy engine " +
    "event exchange expert eye face fact fair fame family farm fashion fast fiber file film finance find fire first fish fit " +
    "fitness fix flash flight flow fly focus food foot force forest form forum fox free fresh friend fruit fun fund future " +
    "game games garden gas gate gear gift girl glass global go goal gold golf good gps green grid group grow guide guru gym " +
    "hair hand happy hat health heart help hero hire home host hot hotel house hub ice idea image info ink insure invest " +
    "iron island jet job jobs joy juice jump just key kid kids king kit kitchen lab land law lead learn legal lens life " +
    "light line link lion list live loan local lock logic look love luck lucky mail main make map mark market mart master " +
    "match max me media med medical meet meta metal mind mint mix mobile money moon motor move movie music my name nano nest " +
    "net network new news next night note now one online open order pack page paint palm paper park part party pass pay " +
    "peak pen people pet pets phone photo pilot pink pixel pizza place plan planet play plus pod point poker pop post power " +
    "press price prime pro profit project prop pure quick quiz race radio rain rank rate real red rent rest rich ride right " +
    "ring rise road robot rock room root rose run safe sale sales salt save scan school score sea search secure seed sell " +
    "send service shift ship shoe shoes shop shopping show sign silver site skin sky smart smile snap social soft solar " +
    "solutions solution sound space spark speed sport sports spot star start stock store story street studio style sun " +
    "super sure swift system table talk tap task taxi tea team tech test text the thing think ticket time tip today token " +
    "tool tools top tour town toy toys trade trader travel tree trend trip true trust tube tv up urban user van vault vegas " +
    "video view villa vip vision voice vote wall wallet watch water wave way web wealth well west wiki win wind wine wise " +
    "wolf wood word work works world yoga you young zen zero zone"
  ).split(" "),
);

/** Words a buyer pays most for right now. */
const HOT = new Set(["ai", "crypto", "bot", "coin", "token", "pay", "bank", "loan", "insure", "cash", "health", "solar", "data", "cloud", "bet", "poker", "casino", "app", "agent"]);

export type TldTier = { tld: string; factor: number };

/** What the same name is worth under each extension, relative to .com. */
const TLD_FACTOR: Record<string, number> = {
  com: 1, ai: 0.55, io: 0.18, net: 0.14, org: 0.14, co: 0.12, app: 0.1, dev: 0.08, me: 0.06, cn: 0.1, "com.cn": 0.06,
  de: 0.14, "co.uk": 0.12, uk: 0.08, us: 0.05, ca: 0.08, au: 0.05, "com.au": 0.08, fr: 0.06, jp: 0.06, kr: 0.04, vn: 0.05,
  "com.vn": 0.04, in: 0.04, xyz: 0.02, info: 0.03, biz: 0.02, store: 0.03, shop: 0.04, tech: 0.03, online: 0.02, site: 0.02,
};
const OTHER_TLD = 0.025;

export type DomainKind =
  | "word"
  | "twoWords"
  | "letters2"
  | "letters3"
  | "letters4"
  | "brandable"
  | "numeric"
  | "letters"
  | "mixed";

export type DomainFeature =
  | { key: "tld"; tld: string; factor: number }
  | { key: "kind"; kind: DomainKind; words?: string; digits?: number }
  | { key: "length"; n: number }
  | { key: "hyphen" }
  | { key: "hot"; word: string }
  | { key: "luckyDigits" }
  | { key: "four" }
  | { key: "pronounceable" };

export type DomainValue = {
  domain: string;
  sld: string;
  tld: string;
  kind: DomainKind;
  estimate: number;
  low: number;
  high: number;
  /** 0–100, for the gauge. */
  score: number;
  features: DomainFeature[];
};

export type DomainError = "empty" | "invalid" | "noTld";

const SECOND_LEVEL = new Set(["co.uk", "org.uk", "com.cn", "net.cn", "com.au", "com.vn", "co.jp", "co.kr", "com.br", "com.tw", "com.hk"]);

/** The registrable name and its extension from whatever was pasted (a URL, www., upper case, a trailing dot). */
export function parseDomain(raw: string): { ok: true; sld: string; tld: string } | { ok: false; error: DomainError } {
  let s = raw.trim().toLowerCase();
  if (!s) return { ok: false, error: "empty" };
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "").replace(/^www\./, "");
  const labels = s.split(".");
  if (labels.length < 2) return { ok: false, error: "noTld" };
  if (labels.some((l) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return { ok: false, error: "invalid" };
  const two = labels.slice(-2).join(".");
  const tldLabels = SECOND_LEVEL.has(two) && labels.length >= 3 ? 2 : 1;
  const tld = labels.slice(-tldLabels).join(".");
  const sld = labels[labels.length - tldLabels - 1]!;
  if (/^\d+$/.test(tld)) return { ok: false, error: "invalid" };
  return { ok: true, sld, tld };
}

/** Whether a string of letters reads like a word: no long consonant or vowel clusters, a sensible share of vowels. */
export function pronounceable(s: string): boolean {
  if (!/^[a-z]+$/.test(s)) return false;
  const vowels = s.replace(/[^aeiouy]/g, "").length;
  if (vowels === 0 || vowels / s.length < 0.25 || vowels / s.length > 0.7) return false;
  return !/[^aeiouy]{4,}|[aeiou]{3,}/.test(s);
}

/** The name split into two common words, if it splits ("cloudkitchen" → cloud + kitchen). */
export function twoWords(s: string): [string, string] | null {
  for (let i = 2; i <= s.length - 2; i++) {
    const a = s.slice(0, i);
    const b = s.slice(i);
    if (WORDS.has(a) && WORDS.has(b)) return [a, b];
  }
  return null;
}

/** .com value of the name before the extension, in US dollars, with its kind. */
function baseValue(sld: string): { kind: DomainKind; value: number; features: DomainFeature[] } {
  const features: DomainFeature[] = [];
  const name = sld.replace(/-/g, "");
  const n = name.length;
  if (/^\d+$/.test(name)) {
    const v = [0, 0, 250_000, 40_000, 5_000, 700, 150, 40][n] ?? 15;
    let value = v;
    if (n === 4 || n === 5) {
      // Chinese buyers drive the number market: no 4, and 8s, 6s and 9s, add value.
      if (name.includes("4")) {
        features.push({ key: "four" });
        value *= 0.5;
      } else if (/^[689]+$/.test(name)) {
        features.push({ key: "luckyDigits" });
        value *= 2.5;
      }
    }
    features.push({ key: "kind", kind: "numeric", digits: n });
    return { kind: "numeric", value, features };
  }
  if (/^[a-z]+$/.test(name)) {
    if (WORDS.has(name)) {
      const value = n <= 3 ? 400_000 : n <= 4 ? 250_000 : n <= 6 ? 90_000 : n <= 8 ? 40_000 : 15_000;
      features.push({ key: "kind", kind: "word", words: name });
      return { kind: "word", value, features };
    }
    const pair = twoWords(name);
    if (pair) {
      const value = n <= 7 ? 18_000 : n <= 10 ? 6_000 : n <= 13 ? 2_000 : 700;
      features.push({ key: "kind", kind: "twoWords", words: pair.join(" + ") });
      return { kind: "twoWords", value, features };
    }
    if (n <= 2) return { kind: "letters2", value: 300_000, features: [{ key: "kind", kind: "letters2" }] };
    if (n === 3) {
      const say = pronounceable(name);
      if (say) features.push({ key: "pronounceable" });
      features.push({ key: "kind", kind: "letters3" });
      return { kind: "letters3", value: say ? 45_000 : 25_000, features };
    }
    if (n === 4) {
      const say = pronounceable(name);
      if (say) features.push({ key: "pronounceable" });
      features.push({ key: "kind", kind: "letters4" });
      return { kind: "letters4", value: say ? 5_000 : 1_200, features };
    }
    if (pronounceable(name) && n <= 10) {
      features.push({ key: "pronounceable" }, { key: "kind", kind: "brandable" });
      return { kind: "brandable", value: n <= 6 ? 2_500 : n <= 8 ? 1_200 : 500, features };
    }
    features.push({ key: "kind", kind: "letters" });
    return { kind: "letters", value: n <= 6 ? 250 : 60, features };
  }
  features.push({ key: "kind", kind: "mixed" });
  return { kind: "mixed", value: n <= 4 ? 600 : n <= 6 ? 120 : 30, features };
}

/** The value is never below a year's registration (about $10). */
const FLOOR = 10;

export function valueDomain(raw: string): { ok: true; value: DomainValue } | { ok: false; error: DomainError } {
  const parsed = parseDomain(raw);
  if (!parsed.ok) return parsed;
  const { sld, tld } = parsed;
  const base = baseValue(sld);
  const features: DomainFeature[] = [...base.features];
  let value = base.value;
  if (sld.includes("-")) {
    features.push({ key: "hyphen" });
    value *= 0.15;
  }
  // A hot word on its own or beside another common word (aibot, paynow), not inside a longer one (air, payroll…).
  const plainName = sld.replace(/-/g, "");
  const hot = [...HOT].find((w) =>
    plainName === w ||
    (plainName.startsWith(w) && WORDS.has(plainName.slice(w.length))) ||
    (plainName.endsWith(w) && WORDS.has(plainName.slice(0, -w.length))));
  if (hot && base.kind !== "numeric") {
    features.push({ key: "hot", word: hot });
    value *= 1.6;
  }
  // Every letter past ten costs: long names are hard to type and remember.
  const n = plainName.length;
  if (n > 10) value *= Math.pow(0.8, n - 10);
  features.push({ key: "length", n });
  const factor = TLD_FACTOR[tld] ?? OTHER_TLD;
  features.unshift({ key: "tld", tld, factor });
  value *= factor;
  const estimate = Math.max(FLOOR, roundTo(value));
  const low = Math.max(FLOOR, roundTo(value / 2.5));
  const high = Math.max(FLOOR, roundTo(value * 2.5));
  const score = Math.round(Math.min(100, Math.max(0, (Math.log10(estimate) - 1) * 20)));
  return { ok: true, value: { domain: `${sld}.${tld}`, sld, tld, kind: base.kind, estimate, low, high, score, features } };
}

function roundTo(n: number): number {
  if (n < 100) return Math.round(n / 5) * 5;
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}
