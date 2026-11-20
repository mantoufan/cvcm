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

/** Currency signs and codes typed around an amount; spaces inside a number are kept, so "1 2" stays unreadable. */
const CURRENCY = /NT\$|[%$€¥￥₩₫£]|Rp|VND|USD|EUR|元|円|원|đồng|đ/gi;
/** Ten-thousands, as Chinese and Japanese write amounts: 12万 = 120,000. */
const WAN = /[万萬]$/;

/**
 * A typed figure: "30%", "$6.50", "￥1,000", "₫29.000", "120,000 元" and "12万" read as numbers. Empty → undefined;
 * not a number → NaN.
 */
export function readField(raw: string, key: Key, loc: Locale): number | undefined {
  let bare = raw.replace(CURRENCY, "").trim();
  if (bare === "") return raw.trim() === "" ? undefined : NaN;
  const wan = WAN.test(bare) && !PCT_KEYS.has(key);
  if (wan) bare = bare.replace(WAN, "").trim();
  const x = (PCT_KEYS.has(key) ? parseDecimalInput : parseMoneyInput)(bare, loc);
  return x === undefined ? NaN : wan ? x * 10000 : x;
}

/** Whether a read figure is allowed in its field: nothing negative, shares up to 100 %, 1–31 days open. */
export function fieldOk(x: number | undefined, key: Key): boolean {
  if (x === undefined) return key !== "days";
  if (!(Number.isFinite(x) && x >= 0)) return false;
  if (PCT_KEYS.has(key)) return x <= 100;
  if (key === "days") return x >= 1 && x <= 31;
  return true;
}

let timer = 0;

/**
 * Rows of the what-if table: the typed figure itself on the "yours" row (so it matches the result above), the others
 * to a whole order. A row that rounds onto its neighbour (2 orders × 0.8 = 2) is left out rather than shown twice.
 */
export function sensitivityRows(orders: number): { f: number; orders: number }[] {
  const rows: { f: number; orders: number }[] = [];
  for (const f of SENSITIVITY) {
    const n = f === 1 ? orders : Math.round(orders * f);
    if (f !== 1 && (n === Math.round(orders) || rows.some((row) => row.orders === n))) continue;
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
  const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(paint, 150); };
  const whole = numberFormat(loc, { maximumFractionDigits: 0 });
  const one = numberFormat(loc, { maximumFractionDigits: 1 });
  const two = numberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const inputs = {} as Record<Key, HTMLInputElement>;
  for (const g of GROUPS) {
    for (const k of g.keys) {
      inputs[k] = h("input", {
        type: "text", inputmode: "decimal",
        autocomplete: "off", spellcheck: "false", "data-field": k, onInput: schedule,
      });
    }
  }
  const kindSel = select<ShopKind>("kind", SHOP_KINDS, (k) => t(`${S}.k_${k}`), () => load(kindSel.value as ShopKind), EXAMPLE_KIND);
  const out = h("dl", { class: "stats-grid", "data-out": "result" });
  const verdict = h("p", { class: "hint", "data-out": "verdict" });
  const sens = h("div", { class: "table-wrap", "data-out": "table" });
  const copy = copyButton(S, () => { window.clearTimeout(timer); paint(); return last; });

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
      inputs[k].toggleAttribute("aria-invalid", !ok);
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
      const msg = bad.every((k) => k === "days") ? "needDays" : bad.every((k) => PCT_KEYS.has(k)) ? "needPct" : "invalid";
      out.replaceChildren(h("p", { class: "muted" }, t(`${S}.${msg}`)));
      verdict.textContent = "";
      sens.replaceChildren();
      last = "";
      copy.disabled = true;
      return;
    }
    const r = shopNumbers(v);
    const need = Math.ceil(r.breakEvenOrders - 1e-9);
    const breakEven = Number.isFinite(r.breakEvenOrders) ? counted("ordersValue", need, whole.format(need)) : t(`${S}.lossPerOrder`);
    last = rowsTo(out, [
      [t(`${S}.payback`), months(r.paybackMonths), true],
      [t(`${S}.breakEven`), breakEven, true],
      [t(`${S}.startup`), money(r.startup)],
      [t(`${S}.profit`), money(r.profit)],
      [t(`${S}.revenue`), money(r.revenue)],
      [t(`${S}.perOrderNet`), signed(r.perOrder, two, 2)],
      [t(`${S}.fixed`), money(r.fixed)],
      [t(`${S}.rentShare`), pct(r.rentShare, 1)],
      [t(`${S}.laborShare`), pct(r.laborShare, 1)],
    ]);
    copy.disabled = false;
    verdict.textContent = verdictText(v, r, breakEven);
    sens.replaceChildren(
      h("h3", null, t(`${S}.tableTitle`)),
      table([t(`${S}.colOrders`), t(`${S}.profit`), t(`${S}.payback`)], sensitivityRows(v.orders).map(({ f, orders }) => {
        const s = shopNumbers(v, orders);
        const label = f === 1 ? t(`${S}.current`, { n: one.format(orders) })
          : t(f < 1 ? `${S}.fewer` : `${S}.more`, { n: whole.format(orders), pct: whole.format(Math.round(Math.abs(1 - f) * 100)) });
        return [label, money(s.profit), months(s.paybackMonths)];
      })),
    );
  }

  function verdictText(v: ShopInput, r: ShopResult, breakEven: string): string {
    if (!(r.perOrder > 0)) return t(`${S}.vLossPerOrder`);
    if (Math.round(r.profit) === 0) return t(`${S}.vEven`, { orders: one.format(v.orders) });
    if (r.profit < 0) return t(`${S}.vLoss`, { orders: one.format(v.orders), loss: money(-r.profit), need: breakEven });
    if (r.paybackMonths > 24) return t(`${S}.vSlow`, { time: months(r.paybackMonths) });
    return t(`${S}.vOk`, { orders: one.format(v.orders), time: months(r.paybackMonths) });
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

export function unmountStartupCost(): void {
  window.clearTimeout(timer);
}
