import { h } from "../dom";
import { locale, t } from "../i18n";
import { parseDecimalInput, parseMoneyInput } from "../../shared/decimal-input";
import { numberFormat } from "../../shared/number-format";
import type { Locale } from "../../shared/locale";
import { SENSITIVITY, SHOP_KINDS, shopExample, shopNumbers, type ShopInput, type ShopKind, type ShopResult } from "../../shared/startup-cost";
import { copyButton, field, rowsTo, select, table } from "../academic/common";

const S = "startupCost";
/** The example the page opens with. */
export const EXAMPLE_KIND: ShopKind = "coffee";

type Key = keyof ShopInput;
/** Fields by group, in page order. Percentages and counts read as plain decimals; the rest as money. */
const GROUPS: readonly { id: string; keys: readonly Key[] }[] = [
  { id: "oneOff", keys: ["fee", "buildout", "equipment", "keyMoney", "depositMonths", "stock"] },
  { id: "monthly", keys: ["rent", "staff", "wage", "utilities", "other"] },
  { id: "perOrder", keys: ["price", "cogsPct", "packaging", "deliveryPct", "commissionPct"] },
  { id: "sales", keys: ["orders", "days"] },
];
const PLAIN = new Set<Key>(["depositMonths", "staff", "cogsPct", "deliveryPct", "commissionPct", "orders", "days"]);
/** Whole counts get the digits-only keypad. */
const COUNTS = new Set<Key>(["depositMonths", "staff", "orders", "days"]);

let timer = 0;

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
        type: "text", inputmode: COUNTS.has(k) ? "numeric" : "decimal",
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

  /** The typed figures; an empty or unreadable field counts as 0 and is listed so the page can say so. */
  function read(): { v: ShopInput; bad: boolean } {
    let bad = false;
    const v = {} as ShopInput;
    for (const k of Object.keys(inputs) as Key[]) {
      const raw = inputs[k].value;
      const x = PLAIN.has(k) ? parseDecimalInput(raw, loc) : parseMoneyInput(raw, loc);
      if (x !== undefined && !(Number.isFinite(x) && x >= 0)) bad = true;
      v[k] = x !== undefined && Number.isFinite(x) && x >= 0 ? x : 0;
    }
    return { v, bad };
  }

  const money = (x: number) => (x < 0 ? "−" : "") + whole.format(Math.abs(Math.round(x)));
  const months = (m: number) => !Number.isFinite(m) ? t(`${S}.never`)
    : m < 1 ? t(`${S}.underMonth`)
      : m < 24 ? t(`${S}.months`, { n: one.format(Math.round(m * 10) / 10) })
        : t(`${S}.years`, { n: one.format(Math.round((m / 12) * 10) / 10) });
  const share = (x: number) => (Number.isFinite(x) ? `${one.format(Math.round(x * 1000) / 10)} %` : "—");

  function paint(): void {
    const { v, bad } = read();
    if (bad) {
      out.replaceChildren(h("p", { class: "muted" }, t(`${S}.invalid`)));
      verdict.textContent = "";
      sens.replaceChildren();
      last = "";
      copy.disabled = true;
      return;
    }
    const r = shopNumbers(v);
    const breakEven = Number.isFinite(r.breakEvenOrders) ? t(`${S}.ordersValue`, { n: whole.format(Math.ceil(r.breakEvenOrders - 1e-9)) }) : t(`${S}.lossPerOrder`);
    last = rowsTo(out, [
      [t(`${S}.payback`), months(r.paybackMonths), true],
      [t(`${S}.breakEven`), breakEven, true],
      [t(`${S}.startup`), money(r.startup)],
      [t(`${S}.profit`), money(r.profit)],
      [t(`${S}.revenue`), money(r.revenue)],
      [t(`${S}.perOrderNet`), (r.perOrder < 0 ? "−" : "") + two.format(Math.abs(r.perOrder))],
      [t(`${S}.fixed`), money(r.fixed)],
      [t(`${S}.rentShare`), share(r.rentShare)],
      [t(`${S}.laborShare`), share(r.laborShare)],
    ]);
    copy.disabled = false;
    verdict.textContent = verdictText(v, r, breakEven);
    sens.replaceChildren(
      h("h3", null, t(`${S}.tableTitle`)),
      table([t(`${S}.colOrders`), t(`${S}.profit`), t(`${S}.payback`)], SENSITIVITY.map((f) => {
        const orders = Math.round(v.orders * f);
        const s = shopNumbers(v, orders);
        const label = f === 1 ? t(`${S}.current`, { n: whole.format(orders) })
          : t(f < 1 ? `${S}.fewer` : `${S}.more`, { n: whole.format(orders), pct: whole.format(Math.round(Math.abs(1 - f) * 100)) });
        return [label, money(s.profit), months(s.paybackMonths)];
      })),
    );
  }

  function verdictText(v: ShopInput, r: ShopResult, breakEven: string): string {
    if (!(r.perOrder > 0)) return t(`${S}.vLossPerOrder`);
    if (!(r.profit > 0)) return t(`${S}.vLoss`, { orders: whole.format(v.orders), loss: money(-r.profit), need: breakEven });
    if (r.paybackMonths > 24) return t(`${S}.vSlow`, { time: months(r.paybackMonths) });
    return t(`${S}.vOk`, { orders: whole.format(v.orders), time: months(r.paybackMonths) });
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
