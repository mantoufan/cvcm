import { h } from "../dom";
import { locale, t } from "../i18n";
import { parseDecimalInput, parseMoneyInput } from "../../shared/decimal-input";
import { numberFormat } from "../../shared/number-format";
import type { Locale } from "../../shared/locale";
import { SENSITIVITY, SHOP_KINDS, shopExample, shopNumbers, type ShopInput, type ShopKind, type ShopResult } from "../../shared/startup-cost";
import { copyButton, field, pct, rowsTo, select, table } from "../academic/common";

const S = "startupCost";
/** The example the page opens with. */
export const EXAMPLE_KIND: ShopKind = "coffee";

type Key = keyof ShopInput;
/** Fields by group, in page order. Percentages read as plain decimals; amounts and counts as money (1.200 is 1,200 in es/id/vi). */
const GROUPS: readonly { id: string; keys: readonly Key[] }[] = [
  { id: "oneOff", keys: ["fee", "buildout", "equipment", "keyMoney", "depositMonths", "stock"] },
  { id: "monthly", keys: ["rent", "staff", "wage", "utilities", "other"] },
  { id: "perOrder", keys: ["price", "cogsPct", "packaging", "deliveryPct", "commissionPct"] },
  { id: "sales", keys: ["orders", "days"] },
];
export const PCT_KEYS: ReadonlySet<Key> = new Set<Key>(["cogsPct", "deliveryPct", "commissionPct"]);
/** Counts take no unit words: "2k" months of deposit is a typo, not 2,000 months. */
const COUNT_KEYS: ReadonlySet<Key> = new Set<Key>(["depositMonths", "staff", "orders", "days"]);

/**
 * Currency signs and codes typed before or after an amount (never inside it, so "1$000" stays unreadable), and a
 * percent sign after a share. Spaces inside a number are kept, so "1 2" stays unreadable too.
 */
const LEAD = /^(?:(?:NT|US|HK|S|A)?\$|[€¥￥₩₫£]|Rp\.?|VND|USD|EUR)\s*/i;
const TRAIL = /\s*(?:[€¥￥₩₫£$]|Rp|元|円|원|đồng|đ|VND|USD|EUR)$/i;
/** Unit words after an amount: 12万 = 120,000, 3000만, 1.5억, 35k, 2 tr / 2 triệu, 5 jt / 5 juta, 500 rb / 500 ribu. */
const UNITS: readonly [RegExp, number][] = [
  [/(?:[万萬만])$/, 1e4],
  [/(?:[億亿억])$/, 1e8],
  [/(?:tỷ|miliar)$/i, 1e9],
  [/(?:triệu|tr|juta|jt|mn)$/i, 1e6],
  [/M$/, 1e6],
  [/(?:ribu|rb|k|千|천)$/i, 1e3],
];

/**
 * A typed figure: "30%", "US$6.50", "￥1,000", "₫29.000", "120,000 元", "12万", "3000만원" and "35k" read as numbers.
 * Empty → undefined; not a number → NaN.
 */
export function readField(raw: string, key: Key, loc: Locale): number | undefined {
  // NFKC turns IME full-width input into ASCII: "３０％" → "30%", "￥" → "¥".
  const typed = raw.normalize("NFKC").trim();
  if (typed === "") return undefined;
  let bare = typed.replace(LEAD, "").replace(TRAIL, "");
  if (PCT_KEYS.has(key)) bare = bare.replace(/\s*%$/, "");
  if (bare === "") return NaN;
  let scale = 1;
  if (!PCT_KEYS.has(key) && !COUNT_KEYS.has(key)) {
    const unit = UNITS.find(([re]) => re.test(bare));
    if (unit) {
      scale = unit[1];
      bare = bare.replace(unit[0], "").trim();
    }
  }
  const x = (PCT_KEYS.has(key) ? parseDecimalInput : parseMoneyInput)(bare, loc);
  // 2.3 × 1,000 is 2299.9999999999995 in floating point: round the scaled figure back to what was typed.
  return x === undefined ? NaN : scale === 1 ? x : Math.round(x * scale * 1e6) / 1e6;
}

/** Whether a read figure is allowed in its field: nothing negative, shares up to 100 %, 1–31 days open. */
export function fieldOk(x: number | undefined, key: Key): boolean {
  if (x === undefined) return key !== "days";
  if (!(Number.isFinite(x) && x >= 0)) return false;
  if (PCT_KEYS.has(key)) return x <= 100;
  if (key === "days") return Number.isInteger(x) && x >= 1 && x <= 31;
  return true;
}

/**
 * Rows of the what-if table: the typed figure itself on the "yours" row (so it matches the result above), the others
 * to a whole order. A row that rounds onto its neighbour (2 orders × 0.8 = 2) is left out rather than shown twice.
 */
export function sensitivityRows(orders: number): { f: number; orders: number }[] {
  const rows: { f: number; orders: number }[] = [];
  for (const f of SENSITIVITY) {
    // Under 20 a day keep a tenth, so 2 orders still get a "20 % fewer" row (1.6) rather than rounding back onto 2.
    const n = f === 1 ? orders : orders < 20 ? Math.round(orders * f * 10) / 10 : Math.round(orders * f);
    if (f !== 1 && (n === orders || rows.some((row) => row.orders === n))) continue;
    rows.push({ f, orders: n });
  }
  return rows;
}

/** A start value in the page language's own digits: 15,480,000 / 826.000.000 / 3,6. */
export function shownValue(x: number, loc: Locale): string {
  return numberFormat(loc, { maximumFractionDigits: 2 }).format(x);
}

export function mountStartupCost(host: HTMLElement): void {
  const loc = locale();
  let last = "";
  const whole = numberFormat(loc, { maximumFractionDigits: 0 });
  const one = numberFormat(loc, { maximumFractionDigits: 1 });
  // Yen, won, đồng, rupiah and NT$ prices have no cents worth showing.
  const centDigits = loc === "en" || loc === "es" || loc === "zh-CN" ? 2 : 0;
  const cents = numberFormat(loc, { minimumFractionDigits: centDigits, maximumFractionDigits: centDigits });
  const typedOrders = numberFormat(loc, { maximumFractionDigits: 2 });

  const inputs = {} as Record<Key, HTMLInputElement>;
  for (const g of GROUPS) {
    for (const k of g.keys) {
      inputs[k] = h("input", {
        type: "text", inputmode: "decimal",
        autocomplete: "off", spellcheck: "false", "data-field": k, onInput: () => paint(),
      });
    }
  }
  const kindSel = select<ShopKind>("kind", SHOP_KINDS, (k) => t(`${S}.k_${k}`), () => load(kindSel.value as ShopKind), EXAMPLE_KIND);
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const verdict = h("p", { class: "hint", "data-out": "verdict" });
  const sens = h("div", { class: "table-wrap", "data-out": "table" });
  const copy = copyButton(S, () => last);

  function load(kind: ShopKind): void {
    const ex = shopExample(loc, kind);
    for (const k of Object.keys(inputs) as Key[]) inputs[k].value = shownValue(ex[k], loc);
    paint();
  }

  /** The typed figures. An empty field counts as 0 (days open must be filled); a field out of range is marked aria-invalid. */
  function read(): { v: ShopInput; bad: Key[] } {
    const bad: Key[] = [];
    const v = {} as ShopInput;
    for (const k of Object.keys(inputs) as Key[]) {
      const x = readField(inputs[k].value, k, loc);
      const ok = fieldOk(x, k);
      // An empty aria-invalid means "false" to assistive tech: write "true", or remove it.
      if (ok) inputs[k].removeAttribute("aria-invalid");
      else inputs[k].setAttribute("aria-invalid", "true");
      if (!ok) bad.push(k);
      v[k] = ok && x !== undefined ? x : 0;
    }
    return { v, bad };
  }

  const plural = new Intl.PluralRules(loc);
  /** "{n} months" with the singular where the language has one (1 month, 1 mes). */
  const counted = (key: "months" | "years" | "ordersValue", n: number, shown: string) =>
    t(`${S}.${key}${plural.select(n) === "one" ? "One" : ""}`, { n: shown });

  /** Rounded before the sign is chosen, so −0.3 reads 0, not −0. */
  const signed = (x: number, f: Intl.NumberFormat, digits: number) => {
    const n = Math.round(x * 10 ** digits) / 10 ** digits;
    return (n < 0 ? "−" : "") + f.format(Math.abs(n));
  };
  const money = (x: number) => signed(x, whole, 0);
  const months = (m: number) => {
    if (!Number.isFinite(m)) return t(`${S}.never`);
    if (m < 1) return t(`${S}.underMonth`);
    if (m > 600) return t(`${S}.overFifty`);
    const n = Math.round((m < 24 ? m : m / 12) * 10) / 10;
    return counted(m < 24 ? "months" : "years", n, one.format(n));
  };

  function paint(): void {
    const { v, bad } = read();
    if (bad.length) {
      // The most specific message that covers a bad field: amounts first, then days open, then shares.
      const msg = bad.some((k) => k !== "days" && !PCT_KEYS.has(k)) ? "invalid" : bad.includes("days") ? "needDays" : "needPct";
      out.replaceChildren(h("p", { class: "muted" }, t(`${S}.${msg}`)));
      verdict.textContent = "";
      sens.replaceChildren();
      last = "";
      copy.disabled = true;
      return;
    }
    const r = shopNumbers(v);
    // Math.max(0, …) also turns the −0 that ceil(−1e-9) gives into 0.
    const need = Math.max(0, Math.ceil(r.breakEvenOrders - 1e-9));
    const breakEven = Number.isFinite(r.breakEvenOrders) ? counted("ordersValue", need, whole.format(need)) : t(`${S}.lossPerOrder`);
    last = rowsTo(out, [
      [t(`${S}.payback`), months(r.paybackMonths), true],
      [t(`${S}.breakEven`), breakEven, true],
      [t(`${S}.startup`), money(r.startup)],
      [t(`${S}.profit`), money(r.profit)],
      [t(`${S}.revenue`), money(r.revenue)],
      [t(`${S}.perOrderNet`), signed(r.perOrder, cents, centDigits)],
      [t(`${S}.fixed`), money(r.fixed)],
      [t(`${S}.rentShare`), pct(r.rentShare, 1)],
      [t(`${S}.laborShare`), pct(r.laborShare, 1)],
    ]);
    copy.disabled = false;
    verdict.textContent = verdictText(v, r, breakEven);
    const head = [t(`${S}.colOrders`), t(`${S}.profit`), t(`${S}.payback`)];
    const rows = sensitivityRows(v.orders).map(({ f, orders }) => {
      const s = shopNumbers(v, orders);
      const label = f === 1 ? t(`${S}.current`, { n: typedOrders.format(orders) })
        : t(f < 1 ? `${S}.fewer` : `${S}.more`, { n: one.format(orders), pct: whole.format(Math.round(Math.abs(1 - f) * 100)) });
      return [label, money(s.profit), months(s.paybackMonths)];
    });
    sens.replaceChildren(h("h3", null, t(`${S}.tableTitle`)), table(head, rows));
    // Copy carries the verdict and the what-if table too: the check the page asks for travels with the numbers.
    last = [last, "", verdict.textContent, "", t(`${S}.tableTitle`), ...[head, ...rows].map((row) => row.join("\t"))].join("\n");
  }

  /** A standalone label ("Under a month", "Más de 50 años") made to sit mid-sentence. */
  const inline = (label: string) => label.charAt(0).toLocaleLowerCase(loc) + label.slice(1);

  function verdictText(v: ShopInput, r: ShopResult, breakEven: string): string {
    if (!(r.perOrder > 0)) return t(`${S}.vLossPerOrder`);
    if (Math.round(r.profit) === 0) return t(`${S}.vEven`, { orders: typedOrders.format(v.orders) });
    if (r.profit < 0) return t(`${S}.vLoss`, { orders: typedOrders.format(v.orders), loss: money(-r.profit), need: breakEven });
    if (r.paybackMonths > 24) return t(`${S}.vSlow`, { time: inline(months(r.paybackMonths)) });
    return t(`${S}.vOk`, { orders: typedOrders.format(v.orders), time: inline(months(r.paybackMonths)) });
  }

  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t(`${S}.title`)),
      h("p", { class: "lede" }, t(`${S}.privacyNote`)),
    ),
    h("div", { class: "data-tool sc-tool" },
      h("aside", { class: "rail controls" },
        h("fieldset", null,
          h("legend", null, t(`${S}.start`)),
          field(t(`${S}.kind`), kindSel),
          h("p", { class: "hint" }, t(`${S}.exampleNote`)),
        ),
        ...GROUPS.map((g) => h("fieldset", { class: "sc-group" },
          h("legend", null, t(`${S}.g_${g.id}`)),
          ...g.keys.map((k) => field(t(`${S}.f_${k}`), inputs[k])))),
        h("div", { class: "stage-actions" }, copy),
      ),
      h("div", { class: "rail sc-result" },
        h("h2", null, t(`${S}.result`)),
        out, verdict, sens,
        h("p", { class: "hint", "data-out": "disclaimer" }, t(`${S}.disclaimer`)),
      ),
    ),
  );
  load(EXAMPLE_KIND);
}

/** Nothing outlives the page: no timers or listeners outside its own nodes. */
export function unmountStartupCost(): void {}
