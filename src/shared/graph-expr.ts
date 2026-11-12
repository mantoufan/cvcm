import { normalize, readGroups } from "./calculator";

/**
 * Graphing calculator expressions: y = f(x) typed the way people write it, compiled once into a function of x (no eval).
 *
 * Grammar (loosest first): sum = product (("+"|"-") product)*
 *   product = unary (("*"|"/"|implicit) unary)*      2x, 3(x+1), x sin x, (x)(x) multiply implicitly
 *   unary   = ("+"|"-") unary | power                -x^2 = -(x^2), as on paper
 *   power   = postfix ("^" unary)?                   right-associative: 2^3^2 = 2^9
 *   postfix = atom ("!")?                             x! is Γ(x+1)
 *   atom    = number | x | constant | func "(" sum ")" | func power | "(" sum ")" | "|" sum "|"
 * Angles are radians. Functions: sin cos tan sec csc cot asin acos atan sinh cosh tanh sqrt cbrt abs ln log log2 exp
 * floor ceil round sign. Constants: pi (π), e.
 */

export type Compiled = (x: number) => number;

export type ParseResult = { ok: true; fn: Compiled; text: string } | { ok: false; error: "empty" | "syntax" };

export const MAX_EXPR_LENGTH = 300;
const MAX_DEPTH = 60;

const FUNCS: Record<string, (v: number) => number> = {
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sec: (v) => 1 / Math.cos(v),
  csc: (v) => 1 / Math.sin(v),
  cot: (v) => 1 / Math.tan(v),
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log2: Math.log2,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
};
/** What f^-1 means for the functions that have a named inverse. */
const INVERSE: Record<string, string> = { sin: "asin", cos: "acos", tan: "atan", arcsin: "sin", arccos: "cos", arctan: "tan" };
/** Longest first, so "sinh" is not read as "sin" "h" and "log2" not as "log" times 2. */
const FUNC_NAMES = Object.keys(FUNCS).sort((a, b) => b.length - a.length);
const WORDS = [...FUNC_NAMES, "pi", "x", "e"].sort((a, b) => b.length - a.length);

type Tok = { k: "num"; v: number } | { k: "x" } | { k: "op"; v: string } | { k: "fn"; v: string };

class Fail extends Error {}
/** Too many ways tried to read the bars: refuse rather than search on (|x|x|x… doubles the work per bar). */
class TooHard extends Error {}
const MAX_BAR_RETRIES = 200;

/** The calculator's operator spellings (full-width, × ÷ −, ** …), then superscript powers, √, π and a leading "y =" or "f(x) =". */
const SUPERSCRIPT: Record<string, string> = { "⁻": "-", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

export function normalizeExpr(src: string): string {
  return normalize(src)
    // Superscript powers (x², x⁴, x⁻¹) and the calculator's ℯ key.
    .replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^(${[...m].map((c) => SUPERSCRIPT[c]).join("")})`)
    .replace(/ℯ/g, "e")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .replace(/^\s*(?:y|[a-z]\s*\(\s*x\s*\))\s*=\s*/i, "")
    .trim();
}

function tokenize(src: string, decimal: "." | ","): Tok[] {
  let s = src;
  // Thousands groups and the decimal mark exactly as the scientific calculator reads them (1.234,5 in es/id/vi;
  // an ambiguous 1.250 is refused).
  try {
    s = readGroups(s, decimal);
  } catch {
    throw new Fail();
  }
  const out: Tok[] = [];
  let i = 0;
  /** The last token was digits typed by the user (not pi or e). */
  let lastDigits = false;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const wasDigits = lastDigits;
    lastDigits = false;
    // No exponent notation: e is Euler's number here, and "1e3" or "2e+1" (1000 or 1·e·3? 20 or 2e + 1?) is refused below.
    const num = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(s.slice(i));
    if (num) {
      const rest = s.slice(i + num[0].length);
      // "2.5.3" or "1.234,5" read as "1.234.5" is a typo or a grouped number, not two numbers to multiply; "1e3" could be
      // 1000 or 1·e·3. Both are refused rather than guessed.
      if (/^[.\d]/.test(rest) || /^[eE][+-]?\d/.test(rest)) throw new Fail();
      // "2 3" or "1 000" (a space as a thousands group) is not 2·3: two typed numbers in a row are refused.
      if (wasDigits) throw new Fail();
      out.push({ k: "num", v: Number(num[0]) });
      lastDigits = true;
      i += num[0].length;
      continue;
    }
    if ("+-*/^()!|".includes(c)) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    // log10 and log2 name their base when no further digit follows ("log100" is log of 100, "log25" log of 25);
    // "log" alone is already base 10.
    // The base must be followed by an argument, and not by more of a number ("log2.5" is log of 2.5).
    const based = /^log(10|2)(?![\d.])(?=\s*[a-zA-Z\d.(|])/i.exec(s.slice(i));
    if (based) {
      out.push({ k: "fn", v: based[1] === "2" ? "log2" : "log" });
      i += based[0].length;
      continue;
    }
    const word = /^[a-zA-Z]+/.exec(s.slice(i));
    if (word) {
      let w = word[0].toLowerCase();
      let used = 0;
      while (w) {
        const name = WORDS.find((n) => w.startsWith(n));
        if (!name) throw new Fail();
        if (name === "x") out.push({ k: "x" });
        else if (name === "pi") out.push({ k: "num", v: Math.PI });
        else if (name === "e") out.push({ k: "num", v: Math.E });
        else out.push({ k: "fn", v: name });
        w = w.slice(name.length);
        used += name.length;
        // "xlog2x": a base right after a log at the end of a run of letters belongs to it, as in "log2x".
        if (name === "log" && !w) {
          const base = /^(10|2)(?![\d.])(?=\s*[a-zA-Z\d.(|])/.exec(s.slice(i + used));
          if (base) {
            out[out.length - 1] = { k: "fn", v: base[1] === "2" ? "log2" : "log" };
            used += base[0].length;
          }
        }
      }
      i += used;
      continue;
    }
    throw new Fail();
  }
  return out;
}

/** Γ(x + 1) by Lanczos (g = 7), so x! draws a smooth curve; exact for whole numbers up to 170. */
export function factorial(x: number): number {
  if (Number.isInteger(x)) {
    if (x < 0) return NaN;
    if (x > 170) return Infinity;
    let r = 1;
    for (let k = 2; k <= x; k++) r *= k;
    return r;
  }
  return gamma(x + 1);
}

const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * a;
}

/** Real cube roots and odd roots of negatives: (-8)^(1/3) is -2 on paper, NaN in Math.pow. */
function power(a: number, b: number): number {
  const r = a ** b;
  if (!Number.isNaN(r) || a >= 0) return r;
  // b = p/q with odd q: the real root exists.
  for (const q of [3, 5, 7, 9]) {
    const p = Math.round(b * q);
    if (Math.abs(p / q - b) < 1e-12) {
      return (-((-a) ** (1 / q))) ** p;
    }
  }
  return NaN;
}

class Parser {
  private i = 0;
  private depth = 0;
  /** Open |…| bars: inside one, a bar closes it rather than starting another factor. */
  private bars = 0;
  private retries = 0;
  constructor(private readonly toks: Tok[]) {}

  parse(): Compiled {
    const f = this.sum();
    if (this.i !== this.toks.length) throw new Fail();
    return f;
  }

  /** Inside brackets no |…| is open yet, so "|(2|x|)|" can start a new one. */
  private inBrackets<T>(f: () => T): T {
    const bars = this.bars;
    this.bars = 0;
    try {
      return f();
    } finally {
      this.bars = bars;
    }
  }

  /** Consumes "-1" or "(-1)" after a function's "^". */
  private inverseMark(): boolean {
    const at = (k: number) => this.toks[this.i + k];
    const isOp = (k: number, v: string) => at(k)?.k === "op" && (at(k) as { v: string }).v === v;
    const isOne = (k: number) => at(k)?.k === "num" && (at(k) as { v: number }).v === 1;
    if (isOp(0, "-") && isOne(1)) {
      this.i += 2;
      return true;
    }
    if (isOp(0, "(") && isOp(1, "-") && isOne(2) && isOp(3, ")")) {
      this.i += 4;
      return true;
    }
    return false;
  }

  private isBarAt(i: number): boolean {
    const t = this.toks[i];
    return t?.k === "op" && t.v === "|";
  }

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }

  private isOp(v: string): boolean {
    const t = this.peek();
    return t?.k === "op" && t.v === v;
  }

  private enter(): void {
    if (++this.depth > MAX_DEPTH) throw new Fail();
  }

  private sum(): Compiled {
    this.enter();
    let left = this.product();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.toks[this.i++] as { v: string }).v;
      const a = left;
      const b = this.product();
      left = op === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    this.depth--;
    return left;
  }

  /** A token that starts a factor, so "2x", "x(x+1)" and "2|x|" multiply. */
  private startsFactor(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.k !== "op") return true;
    if (t.v === "(") return true;
    if (t.v !== "|") return false;
    // Outside bars a bar opens. Inside, a bar followed by something that starts a value opens a nested one
    // (|2|x|-1| is |2·|x| − 1|, as written by hand); otherwise it closes the open one.
    if (this.bars === 0) return true;
    const after = this.toks[this.i + 1];
    return !!after && (after.k !== "op" || after.v === "(");
  }

  private product(): Compiled {
    let left = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.toks[this.i++] as { v: string }).v;
        const a = left;
        const b = this.unary();
        left = op === "*" ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
      } else if (this.startsFactor()) {
        const a = left;
        // Inside bars a "|" read as a nested opening may be a closing after all (|x|x is |x|·x): if the nested
        // reading fails, step back and let the bar close.
        const at = this.i;
        const bars = this.bars;
        const depth = this.depth;
        let b: Compiled;
        try {
          b = this.power();
        } catch (e) {
          if (!(e instanceof Fail) || !this.isBarAt(at) || bars === 0) throw e;
          if (++this.retries > MAX_BAR_RETRIES) throw new TooHard();
          this.i = at;
          this.bars = bars;
          this.depth = depth;
          break;
        }
        left = (x) => a(x) * b(x);
      } else break;
    }
    return left;
  }

  private unary(): Compiled {
    if (this.isOp("-")) {
      this.i++;
      this.enter();
      const a = this.unary();
      this.depth--;
      return (x) => -a(x);
    }
    if (this.isOp("+")) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Compiled {
    const base = this.postfix();
    if (this.isOp("^")) {
      this.i++;
      this.enter();
      const exp = this.unary();
      this.depth--;
      return (x) => power(base(x), exp(x));
    }
    return base;
  }

  private postfix(): Compiled {
    let a = this.atom();
    while (this.isOp("!")) {
      this.i++;
      const inner = a;
      a = (x) => factorial(inner(x));
    }
    return a;
  }

  private atom(): Compiled {
    const t = this.toks[this.i++];
    if (!t) throw new Fail();
    if (t.k === "num") {
      const v = t.v;
      return () => v;
    }
    if (t.k === "x") return (x) => x;
    if (t.k === "fn") {
      const base = FUNCS[t.v];
      this.enter();
      // sin^2 x and sin^2(x) mean (sin x)², as in textbooks; the power is a single number or bracket. sin^-1 and
      // sin^(-1) are the inverse function (arcsin), as on calculator keys.
      let fn = base;
      let exp: Compiled | null = null;
      if (this.isOp("^")) {
        this.i++;
        if (this.inverseMark()) {
          const inv = INVERSE[t.v];
          if (!inv) throw new Fail();
          fn = FUNCS[inv];
        } else exp = this.atom();
      }
      const e = exp;
      const call = (arg: Compiled): Compiled => (e ? (x) => power(fn(arg(x)), e(x)) : (x) => fn(arg(x)));
      // sin(x) or sin x / sin 2x (the argument runs to the next + or -, as people read "sin 2x").
      let arg: Compiled;
      if (this.isOp("(")) {
        this.i++;
        arg = this.inBrackets(() => this.sum());
        if (!this.isOp(")")) throw new Fail();
        this.i++;
        // sin(x)^2 squares the sine.
        this.depth--;
        return call(arg);
      }
      // "sin -x" works like "sin(-x)".
      arg = this.unary();
      // "sin 2x": numbers and x straight after the function belong to its argument; another function starts a new
      // factor, so "sin x cos x" is sin(x)·cos(x).
      while (this.peek()?.k === "num" || this.peek()?.k === "x") {
        const a = arg;
        const b = this.power();
        arg = (x) => a(x) * b(x);
      }
      this.depth--;
      return call(arg);
    }
    if (t.v === "(") {
      const inner = this.inBrackets(() => this.sum());
      if (!this.isOp(")")) throw new Fail();
      this.i++;
      return inner;
    }
    if (t.v === "|") {
      this.bars++;
      const inner = this.sum();
      this.bars--;
      if (!this.isOp("|")) throw new Fail();
      this.i++;
      return (x) => Math.abs(inner(x));
    }
    throw new Fail();
  }
}

/** Compiles y = f(x). `decimal` "," lets "1,5" mean 1.5 (es, id, vi). */
export function parseExpr(src: string, decimal: "." | "," = "."): ParseResult {
  const text = normalizeExpr(src);
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MAX_EXPR_LENGTH) return { ok: false, error: "syntax" };
  try {
    const fn = new Parser(tokenize(text, decimal)).parse();
    return { ok: true, fn, text };
  } catch (e) {
    if (e instanceof Fail || e instanceof TooHard || e instanceof RangeError) return { ok: false, error: "syntax" };
    throw e;
  }
}

/** A tidy grid step for `span` units over about `target` lines: 1, 2 or 5 times a power of ten. */
export function niceStep(span: number, target = 8): number {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

export type Viewport = { xMin: number; xMax: number; yMin: number; yMax: number };

/**
 * Samples f across the view: one point per pixel column (more where the curve is steep), split into runs that
 * break at gaps (NaN, ±∞) and at jumps such as tan's asymptotes, so no false vertical line is drawn.
 */
export function sampleCurve(f: Compiled, view: Viewport, widthPx: number): Array<Array<[number, number]>> {
  const runs: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> = [];
  const n = Math.max(2, Math.round(widthPx));
  const dx = (view.xMax - view.xMin) / n;
  const ySpan = view.yMax - view.yMin;
  const at = (x: number) => {
    const y = f(x);
    return Number.isFinite(y) ? y : NaN;
  };
  let px = view.xMin;
  let py = at(px);
  if (!Number.isNaN(py)) run.push([px, py]);
  for (let i = 1; i <= n; i++) {
    const x = view.xMin + i * dx;
    const y = at(x);
    if (Number.isNaN(y)) {
      if (run.length) runs.push(run);
      run = [];
    } else if (!Number.isNaN(py) && isJump(at, px, py, x, y, ySpan)) {
      if (run.length) runs.push(run);
      run = [[x, y]];
    } else {
      run.push([x, y]);
    }
    px = x;
    py = y;
  }
  if (run.length) runs.push(run);
  return runs;
}

/**
 * Whether the curve breaks between two samples. A visible step is narrowed by bisection: a steep but continuous
 * stretch flattens out as the interval shrinks, while a pole or a step (tan, 1/x, floor) keeps its jump however
 * narrow it gets.
 */
function isJump(at: (x: number) => number, x0: number, y0: number, x1: number, y1: number, ySpan: number): boolean {
  const jump = Math.abs(y1 - y0);
  // Under about a pixel nothing shows either way.
  if (jump < ySpan / 200) return false;
  let a = x0;
  let b = x1;
  let ya = y0;
  let yb = y1;
  for (let k = 0; k < 24; k++) {
    const m = (a + b) / 2;
    if (m === a || m === b) break;
    const ym = at(m);
    if (Number.isNaN(ym)) return true;
    // Keep the half with the larger change; that is where a break would be.
    if (Math.abs(ym - ya) > Math.abs(yb - ym)) {
      b = m;
      yb = ym;
    } else {
      a = m;
      ya = ym;
    }
  }
  return Math.abs(yb - ya) > Math.max(jump / 2, ySpan / 200);
}

/**
 * Zeros of f in [a, b]: sign changes between samples refined by bisection (poles are rejected), and touching zeros
 * such as the vertex of (x − 1)² found as a dip of |f| to zero. A stretch where f is 0 at several samples in a row
 * (two identical curves) has no single zero and is left out.
 */
export function findZeros(f: Compiled, a: number, b: number, samples = 800, max = 400): number[] {
  const out: number[] = [];
  const dx = (b - a) / samples;
  const xs = Array.from({ length: samples + 1 }, (_, i) => a + i * dx);
  const ys = xs.map((x) => f(x));
  for (let i = 0; i <= samples && out.length < max; i++) {
    const y0 = ys[i];
    if (!Number.isFinite(y0)) continue;
    if (y0 === 0) {
      const flat = ys[i - 1] === 0 || ys[i + 1] === 0;
      if (!flat) push(out, xs[i], dx);
      continue;
    }
    const y1 = ys[i + 1];
    if (i < samples && Number.isFinite(y1) && y1 !== 0 && Math.sign(y0) !== Math.sign(y1)) {
      const z = bisect(f, xs[i], xs[i + 1], y0);
      if (z !== null) push(out, z, dx);
      continue;
    }
    // A dip toward zero without a sign change: look for the bottom between the neighbours.
    const yp = ys[i - 1];
    if (i > 0 && i < samples && Number.isFinite(yp) && Number.isFinite(y1) && Math.sign(yp) === Math.sign(y0) && Math.sign(y1) === Math.sign(y0)
      && Math.abs(y0) <= Math.abs(yp) && Math.abs(y0) < Math.abs(y1)) {
      const z = touching(f, xs[i - 1], xs[i + 1], Math.max(1, Math.abs(yp), Math.abs(y1)));
      if (z !== null) push(out, z, dx);
    }
  }
  return out;
}

/** The bottom of |f| on [a, b] by golden-section search, when it reaches zero (to rounding). */
function touching(f: Compiled, a: number, b: number, scale: number): number | null {
  const g = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  for (let k = 0; k < 80; k++) {
    const c = hi - g * (hi - lo);
    const d = lo + g * (hi - lo);
    if (Math.abs(f(c)) < Math.abs(f(d))) hi = d;
    else lo = c;
  }
  const x = (lo + hi) / 2;
  const y = f(x);
  return Number.isFinite(y) && Math.abs(y) <= 1e-9 * scale ? x : null;
}

function push(out: number[], x: number, dx: number): void {
  const clean = Math.abs(x) < dx * 1e-6 ? 0 : x;
  if (!out.length || Math.abs(out[out.length - 1] - clean) > dx / 2) out.push(clean);
}

function bisect(f: Compiled, a: number, b: number, fa: number): number | null {
  let lo = a;
  let hi = b;
  let flo = fa;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    const fm = f(m);
    if (!Number.isFinite(fm)) return null;
    if (fm === 0) return m;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = m;
      flo = fm;
    } else hi = m;
  }
  const x = (lo + hi) / 2;
  const y = f(x);
  const scale = Math.max(1, Math.abs(f(a)), Math.abs(f(b)));
  return Number.isFinite(y) && Math.abs(y) <= 1e-6 * scale ? x : null;
}
