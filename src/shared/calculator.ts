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

/** Longest expression that can be typed (characters). */
export const MAX_EXPR = 500;
/** Longest expression evaluated or kept in history: a typed one with each Ans written out as its number. */
export const MAX_EVAL = 5000;
/** Factorials above this overflow a double. */
const MAX_FACTORIAL = 170;
const MAX_DEPTH = 100;

const FUNCS = ["log2", "asin", "acos", "atan", "sinh", "cosh", "tanh", "sin", "cos", "tan", "sqrt", "cbrt", "log", "ln", "abs", "exp"] as const;
type Func = (typeof FUNCS)[number];
/** Every word the parser reads, in the order it tries them when a run of letters holds several ("pie", "2sinpi"). */
const NAMES = ["ans", "pi", ...FUNCS, "e"];

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

/**
 * Thousands are read only in real groups: 1,234,567 with a decimal point, 1.234.567 or 1.234,5 with a decimal comma,
 * and the result uses "." as the decimal point. Any other comma fails with a decimal point ("1,5" is not quietly 15); with
 * a decimal comma, a lone "." is a decimal point too. With a decimal comma, "1.250" is 1250 in Spain and Indonesia and
 * 1.25 in Mexico: it is refused rather than silently 1000 times out. Shared with the graphing calculator.
 */
export function readGroups(src: string, decimal: "." | ","): string {
  let s = src;
  if (decimal === ",") {
    if (/(^|[^\d,.])[1-9]\d{0,2}\.\d{3}(?![\d.,])/.test(s)) throw new Fail("syntax");
    s = s.replace(/(^|[^\d,.])([1-9]\d{0,2}(?:\.\d{3})+)(?![\d.])/g, (_, pre: string, n: string) => pre + n.replace(/\./g, ""));
    s = s.replace(/,/g, ".");
  } else {
    s = s.replace(/(^|[^\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?![\d,])/g, (_, pre: string, n: string) => pre + n.replace(/,/g, ""));
  }
  return s;
}

/** Maps the many ways people type the same operator onto one. Shared with the graphing calculator. */
export function normalize(src: string): string {
  // Full-width forms from CJK input first ("２＋２"). "**" before ×: two × keys in a row are a typo, not a power.
  return src
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\*\*/g, "^")
    .replace(/[×✕·⋅]/g, "*")
    .replace(/[÷∶]/g, "/")
    .replace(/[−–—﹣－]/g, "-")
    .replace(/＋/g, "+")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
}

function tokenize(src: string, decimal: "." | ","): Tok[] {
  // A pasted "2+2=" asks for the result.
  let s = normalize(src).replace(/[=＝]\s*$/, "");
  s = readGroups(s, decimal);
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
    // "ℯ" is what the keypad's e key types, so 2, e, 3 is 2·e·3 and not 2e3 (2000).
    if (c === "ℯ") {
      out.push({ k: "const", v: "e" });
      i++;
      continue;
    }
    if (c === "π") {
      out.push({ k: "const", v: "pi" });
      i++;
      continue;
    }
    // log2(8) and log10(100): the base belongs to the name, and "log" is already base 10.
    const based = /^log\s*(2|10)(?=\s*\()/i.exec(s.slice(i, i + 32));
    if (based) {
      out.push({ k: "fn", v: based[1] === "2" ? "log2" : "log" });
      i += based[0].length;
      continue;
    }
    const word = /^[a-zA-Z]+/.exec(s.slice(i));
    if (word) {
      let w = word[0].toLowerCase();
      // Split runs like "pie" or "2sinpi": take the longest known name at the front each time.
      while (w) {
        const name = NAMES.find((n) => w.startsWith(n));
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

/** A result that displays as a whole number counts as one: (0.1+0.2)*10 shows 3, so 3! must work too. */
function nearInt(v: number): number {
  const r = Number(v.toPrecision(15));
  return Number.isInteger(r) ? r : v;
}

function factorial(raw: number): number {
  const n = nearInt(raw);
  if (n < 0 || !Number.isInteger(n)) throw new Fail("domain");
  if (n > MAX_FACTORIAL) throw new Fail("overflow");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

/** Degree trig that gives exact zeros and ones at multiples of 90° (sin 180° is 0, not 1.2e-16). */
function trig(fn: "sin" | "cos" | "tan", x: number, mode: AngleMode): number {
  const angle = x;
  if (mode === "deg") {
    let d = ((x % 360) + 360) % 360;
    // Within rounding of a right angle counts as one: (0.1+0.2)×1200 is 360.00000000000006.
    const right = Math.round(d / 90) * 90;
    if (Math.abs(d - right) <= Math.min(Math.abs(x) * 4 * Number.EPSILON, 1e-9)) d = right % 360;
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
    // A whole number of turns off first: sin(1e20) loses every digit otherwise, and 1e308·π overflows.
    x = ((x % 360) * Math.PI) / 180;
  }
  // tan(π/2) comes out as 1.6e16 because π is inexact: it has no value, the same as tan(90) in degrees.
  if (fn === "tan" && Math.abs(Math.cos(x)) < 1e-15) throw new Fail("domain");
  const v = Math[fn](x);
  // In radians π is inexact, so sin(π) comes out as 1.2e-16: show the zero it stands for (but keep sin of a tiny angle).
  return Math.abs(v) < 1e-15 && Math.abs(angle) > 1e-6 ? 0 : v;
}

/** A step that overflowed (10^400, exp(1000)) is an error, even if a later step would bring it back to a finite 0. */
function fin(v: number): number {
  if (Number.isNaN(v)) throw new Fail("domain");
  if (!Number.isFinite(v)) throw new Fail("overflow");
  return v;
}

function apply(fn: Func, x: number, mode: AngleMode): number {
  return fin(applyRaw(fn, x, mode));
}

function applyRaw(fn: Func, x: number, mode: AngleMode): number {
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
    case "log2":
      if (x <= 0) throw new Fail("domain");
      return Math.log2(x);
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
  if (src.length > MAX_EVAL) return { ok: false, error: "syntax" };
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
      v = fin(op === "+" ? v + r : v - r);
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
        v = fin(t!.k === "op" && t!.v === "*" ? v * r : v / r);
      } else if (startsAtom(t)) {
        // Two bare numbers in a row ("1.2.3", "1 000") are a typo, not a product.
        if (t!.k === "num" && toks[pos - 1]?.k === "num") throw new Fail("syntax");
        v = fin(v * power());
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
      const raw = unary();
      const exp = base < 0 ? nearInt(raw) : raw;
      // A negative base with a fractional power has no real result.
      if (base < 0 && !Number.isInteger(exp)) throw new Fail("domain");
      if (base === 0 && exp < 0) throw new Fail("domain");
      return fin(base ** exp);
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
      // "sin2(30)" reads as sin(2×30) by the rules but almost never means that: ask, rather than answer something else.
      if (peek()?.k === "num" && isOp(toks[pos + 1], "(")) throw new Fail("syntax");
      return apply(t.v, postfixChain(), mode);
    }
    // Bracketed, it reads like every other function: √(9)! is 3!, not √(9!).
    if (isOp(t, "√")) return apply("sqrt", isOp(peek(), "(") ? atom() : unaryNoImplicit(), mode);
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
    // "sin -30" and "log +2": a sign right after the function name belongs to its argument.
    if (isOp(peek(), "-")) {
      pos++;
      return -postfixChain();
    }
    if (isOp(peek(), "+")) {
      pos++;
      return postfixChain();
    }
    let v = power();
    while (startsAtom(peek()) && peek()!.k !== "fn") {
      if (peek()!.k === "num" && toks[pos - 1]?.k === "num") throw new Fail("syntax");
      v = fin(v * power());
    }
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
  // Rounding up the largest doubles gives Infinity: keep the value itself, which still prints at 15 digits below.
  const up = Number(v.toPrecision(15));
  const rounded = Number.isFinite(up) ? up : v;
  const abs = Math.abs(rounded);
  let s: string;
  if (abs >= 1e15 || abs < 1e-7) {
    const [m, e] = rounded.toExponential(14).split("e");
    s = `${m.replace(/\.?0+$/, "")}e${e.replace("+", "")}`;
  } else {
    s = String(rounded);
    // String() uses an exponent below 1e-6; spell those out from the same 15 digits.
    if (/e/i.test(s)) {
      const [m, e] = Math.abs(rounded).toExponential(14).split("e");
      const digits = m.replace(".", "").replace(/0+$/, "");
      s = `${rounded < 0 ? "-" : ""}0.${"0".repeat(-Number(e) - 1)}${digits}`;
    }
  }
  s = s.replace(/^-/, "−");
  return decimal === "," ? s.replace(".", ",") : s;
}

/** Whether a locale writes decimals with a comma (es, id, vi). */
export function decimalMarkOf(locale: string): "." | "," {
  return ["es", "id", "vi"].includes(locale) ? "," : ".";
}

/**
 * Rewrites each Ans in an expression, reading letters the way the parser does, so the "ans" across "tansin" is left alone.
 * `write` gets where the Ans starts in `expr`.
 */
export function replaceAns(expr: string, write: (at: number) => string): string {
  return expr.replace(/[a-zA-Z]+/g, (run: string, at: number) => {
    const w = run.toLowerCase();
    let out = "";
    let p = 0;
    while (p < run.length) {
      const name = NAMES.find((n) => w.startsWith(n, p));
      if (!name) return out + run.slice(p);
      out += name === "ans" ? write(at + p) : run.slice(p, p + name.length);
      p += name.length;
    }
    return out;
  });
}

/** `expr` is what the line shows; `full` is the same sum with Ans in all its digits, which is what reusing the line enters. */
export type HistoryEntry = { expr: string; result: string; mode?: AngleMode; full?: string };
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
      .filter((e) => e.expr.length <= MAX_EVAL)
      .map((e) => ({ expr: e.expr, result: e.result.slice(0, 64), ...(e.mode === "rad" || e.mode === "deg" ? { mode: e.mode } : {}), ...(typeof e.full === "string" && e.full.length <= MAX_EVAL ? { full: e.full } : {}) }));
  } catch {
    return [];
  }
}
