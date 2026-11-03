/**
 * Scientific calculator: a small recursive-descent parser over a typed expression (no eval).
 *
 * Grammar (loosest first): sum = product (("+"|"−") product)*
 *   product = unary (("×"|"÷"|implicit) unary)*      2π, 3(4), (1)(2), 2sin(30) multiply implicitly
 *   unary   = ("+"|"−") unary | power                −2^2 = −4, as on paper
 *   power   = postfix ("^" unary)?                   right-associative: 2^3^2 = 2^9
 *   postfix = atom ("!" | "%")*                       50% = 0.5, 5! = 120
 *   atom    = number | constant | Ans | func "(" sum ")" | func atom | "(" sum ")" | "√" unary
 */

export type AngleMode = "deg" | "rad";

export type CalcError = "syntax" | "domain" | "overflow";

export type CalcResult = { ok: true; value: number } | { ok: false; error: CalcError };

/** Longest expression the calculator accepts (characters), so a pasted novel does not stall the page. */
export const MAX_EXPR = 500;
/** Factorials above this overflow a double. */
const MAX_FACTORIAL = 170;
const MAX_DEPTH = 100;

const FUNCS = ["asin", "acos", "atan", "sinh", "cosh", "tanh", "sin", "cos", "tan", "sqrt", "cbrt", "log", "ln", "abs", "exp"] as const;
type Func = (typeof FUNCS)[number];

type Tok =
  | { k: "num"; v: number }
  | { k: "op"; v: "+" | "-" | "*" | "/" | "^" | "!" | "%" | "(" | ")" | "√" }
  | { k: "fn"; v: Func }
  | { k: "const"; v: "pi" | "e" | "ans" };

class Fail extends Error {
  constructor(readonly kind: CalcError) {
    super(kind);
  }
}

/** Maps the many ways people type the same operator onto one. */
function normalize(src: string): string {
  return src
    .replace(/[×✕·⋅]/g, "*")
    .replace(/[÷∶]/g, "/")
    .replace(/[−–—﹣－]/g, "-")
    .replace(/＋/g, "+")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/\*\*/g, "^");
}

function tokenize(src: string, decimal: "." | ","): Tok[] {
  let s = normalize(src);
  // With a decimal comma, "." still works as a decimal point; with a decimal point, commas group thousands (1,000).
  s = decimal === "," ? s.replace(/,/g, ".") : s.replace(/(\d),(?=\d)/g, "$1");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // A number: digits with one decimal point (".5" works), optional exponent "1.2e-3" (but not "2e" = 2·e).
    const num = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) {
      const v = Number(num[0]);
      if (!Number.isFinite(v)) throw new Fail("overflow");
      out.push({ k: "num", v });
      i += num[0].length;
      continue;
    }
    if ("+-*/^!%()√".includes(c)) {
      out.push({ k: "op", v: c as "+" });
      i++;
      continue;
    }
    if (c === "π") {
      out.push({ k: "const", v: "pi" });
      i++;
      continue;
    }
    const word = /^[a-zA-Z]+/.exec(s.slice(i));
    if (word) {
      let w = word[0].toLowerCase();
      // Split runs like "pie" or "2sinpi": take the longest known name at the front each time.
      while (w) {
        const name = ["ans", "pi", ...FUNCS, "e"].find((n) => w.startsWith(n));
        if (!name) throw new Fail("syntax");
        if (name === "ans" || name === "pi" || name === "e") out.push({ k: "const", v: name });
        else out.push({ k: "fn", v: name as Func });
        w = w.slice(name.length);
        i += name.length;
      }
      continue;
    }
    throw new Fail("syntax");
  }
  return out;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Fail("domain");
  if (n > MAX_FACTORIAL) throw new Fail("overflow");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

/** Degree trig that gives exact zeros and ones at multiples of 90° (sin 180° is 0, not 1.2e-16). */
function trig(fn: "sin" | "cos" | "tan", x: number, mode: AngleMode): number {
  if (mode === "deg") {
    const d = ((x % 360) + 360) % 360;
    if (fn === "sin" && d % 180 === 0) return 0;
    if (fn === "cos" && (d === 90 || d === 270)) return 0;
    if (fn === "tan" && d % 180 === 0) return 0;
    if (fn === "tan" && d % 180 === 90) throw new Fail("domain");
    if (fn === "sin" && d === 30) return 0.5;
    if (fn === "sin" && d === 150) return 0.5;
    if (fn === "sin" && d === 210) return -0.5;
    if (fn === "sin" && d === 330) return -0.5;
    if (fn === "cos" && d === 60) return 0.5;
    if (fn === "cos" && d === 300) return 0.5;
    if (fn === "cos" && d === 120) return -0.5;
    if (fn === "cos" && d === 240) return -0.5;
    if (fn === "tan" && d % 180 === 45) return 1;
    if (fn === "tan" && d % 180 === 135) return -1;
    x = (x * Math.PI) / 180;
  }
  const v = Math[fn](x);
  // In radians π is inexact, so sin(π) comes out as 1.2e-16: show the zero it stands for.
  return Math.abs(v) < 1e-15 ? 0 : v;
}

function apply(fn: Func, x: number, mode: AngleMode): number {
  const toAngle = (r: number) => (mode === "deg" ? (r * 180) / Math.PI : r);
  switch (fn) {
    case "sin":
    case "cos":
    case "tan":
      return trig(fn, x, mode);
    case "asin":
    case "acos":
      if (x < -1 || x > 1) throw new Fail("domain");
      return toAngle(Math[fn](x));
    case "atan":
      return toAngle(Math.atan(x));
    case "sinh":
    case "cosh":
    case "tanh":
    case "cbrt":
    case "abs":
    case "exp":
      return Math[fn](x);
    case "sqrt":
      if (x < 0) throw new Fail("domain");
      return Math.sqrt(x);
    case "log":
      if (x <= 0) throw new Fail("domain");
      return Math.log10(x);
    case "ln":
      if (x <= 0) throw new Fail("domain");
      return Math.log(x);
  }
}

/**
 * Evaluates a typed expression. `ans` is the value "Ans" stands for (the last result); `decimal` is the decimal mark
 * the reader uses (with ",", "1,5" is 1.5; with ".", "1,000" is 1000).
 */
export function evaluate(src: string, mode: AngleMode = "deg", ans = 0, decimal: "." | "," = "."): CalcResult {
  if (src.length > MAX_EXPR) return { ok: false, error: "syntax" };
  let toks: Tok[];
  try {
    toks = tokenize(src, decimal);
  } catch (e) {
    return { ok: false, error: e instanceof Fail ? e.kind : "syntax" };
  }
  if (toks.length === 0) return { ok: false, error: "syntax" };
  let pos = 0;
  let depth = 0;
  const peek = () => toks[pos];
  const isOp = (t: Tok | undefined, v: string) => t?.k === "op" && t.v === v;

  // An implicit multiplication starts with anything that can begin an atom (not an operator or ")").
  const startsAtom = (t: Tok | undefined) =>
    !!t && (t.k === "num" || t.k === "const" || t.k === "fn" || isOp(t, "(") || isOp(t, "√"));

  const nest = <T>(f: () => T): T => {
    if (++depth > MAX_DEPTH) throw new Fail("syntax");
    try {
      return f();
    } finally {
      depth--;
    }
  };

  const sum = (): number => nest(() => {
    let v = product();
    while (isOp(peek(), "+") || isOp(peek(), "-")) {
      const op = (toks[pos++] as { v: string }).v;
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  });

  const product = (): number => {
    let v = unary();
    for (;;) {
      const t = peek();
      if (isOp(t, "*") || isOp(t, "/")) {
        pos++;
        const r = unary();
        if (t!.k === "op" && t!.v === "/" && r === 0) throw new Fail("domain");
        v = t!.k === "op" && t!.v === "*" ? v * r : v / r;
      } else if (startsAtom(t)) {
        v *= power();
      } else {
        return v;
      }
    }
  };

  const unary = (): number => nest(() => {
    if (isOp(peek(), "-")) {
      pos++;
      return -unary();
    }
    if (isOp(peek(), "+")) {
      pos++;
      return unary();
    }
    return power();
  });

  const power = (): number => {
    const base = postfix();
    if (isOp(peek(), "^")) {
      pos++;
      const exp = unary();
      // A negative base with a fractional power has no real result.
      if (base < 0 && !Number.isInteger(exp)) throw new Fail("domain");
      if (base === 0 && exp < 0) throw new Fail("domain");
      return base ** exp;
    }
    return base;
  };

  const postfix = (): number => {
    let v = atom();
    for (;;) {
      if (isOp(peek(), "!")) {
        pos++;
        v = factorial(v);
      } else if (isOp(peek(), "%")) {
        pos++;
        v /= 100;
      } else {
        return v;
      }
    }
  };

  const atom = (): number => nest(() => {
    const t = toks[pos++];
    if (!t) throw new Fail("syntax");
    if (t.k === "num") return t.v;
    if (t.k === "const") return t.v === "pi" ? Math.PI : t.v === "e" ? Math.E : ans;
    if (t.k === "fn") {
      // "sin 30" and "sin(30)" both work; "sin 30 + 1" is sin(30) + 1 and "sin 2π" is sin(2π) — as calculators read it.
      if (isOp(peek(), "(")) return apply(t.v, atom(), mode);
      return apply(t.v, postfixChain(), mode);
    }
    if (isOp(t, "√")) return apply("sqrt", unaryNoImplicit(), mode);
    if (isOp(t, "(")) {
      const v = sum();
      // A missing ")" at the very end is closed for you, as on most calculators: "2×(3+4" is 14.
      if (isOp(peek(), ")")) pos++;
      else if (pos < toks.length) throw new Fail("syntax");
      return v;
    }
    throw new Fail("syntax");
  });

  /** The argument of a function written without brackets: a number with its implicit factors (2π), not the rest of the sum. */
  const postfixChain = (): number => {
    let v = power();
    while (startsAtom(peek()) && peek()!.k !== "fn") v *= power();
    return v;
  };

  /** √ takes the next signed power: √4 = 2, √−4 fails, √2π is √2·π as printed on keys. */
  const unaryNoImplicit = (): number => {
    if (isOp(peek(), "-")) {
      pos++;
      return -unaryNoImplicit();
    }
    return power();
  };

  try {
    const value = sum();
    if (pos < toks.length) throw new Fail("syntax");
    if (Number.isNaN(value)) return { ok: false, error: "domain" };
    if (!Number.isFinite(value)) return { ok: false, error: "overflow" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Fail ? e.kind : "syntax" };
  }
}

/**
 * A result as a calculator shows it: 15 significant digits (so 0.1 + 0.2 reads 0.3 and integers stay exact), plain digits from 1e-7 to 1e15
 * and scientific notation outside that. `decimal` is the decimal mark to show ("." or ",").
 */
export function formatResult(v: number, decimal: "." | "," = "."): string {
  if (!Number.isFinite(v)) return "";
  if (v === 0) return "0";
  const rounded = Number(v.toPrecision(15));
  const abs = Math.abs(rounded);
  let s: string;
  if (abs >= 1e15 || abs < 1e-7) {
    const [m, e] = rounded.toExponential(14).split("e");
    s = `${m.replace(/\.?0+$/, "")}e${e.replace("+", "")}`;
  } else {
    s = String(rounded);
    // String() still uses exponents below 1e-6; spell those out.
    if (/e/i.test(s)) s = rounded.toFixed(20).replace(/\.?0+$/, "");
  }
  s = s.replace(/^-/, "−");
  return decimal === "," ? s.replace(".", ",") : s;
}

/** Whether a locale writes decimals with a comma (es, id, vi). */
export function decimalMarkOf(locale: string): "." | "," {
  return ["es", "id", "vi"].includes(locale) ? "," : ".";
}

export type HistoryEntry = { expr: string; result: string };
export const MAX_HISTORY = 20;

/** Reads history saved by an earlier visit; anything malformed is dropped. */
export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is HistoryEntry => !!e && typeof e === "object" && typeof (e as HistoryEntry).expr === "string" && typeof (e as HistoryEntry).result === "string")
      .slice(0, MAX_HISTORY)
      .map((e) => ({ expr: e.expr.slice(0, MAX_EXPR), result: e.result.slice(0, 64) }));
  } catch {
    return [];
  }
}
