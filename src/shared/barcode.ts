export type BarcodeKind = "code128" | "code39" | "ean13";

export type BarcodeResult = {
  modules: boolean[];
  text: string;
};

const CODE128_WIDTHS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const START_B = 104;
const START_C = 105;
const STOP = 106;

const CODE39_BITS: Record<string, string> = {
  "0": "101001101101",
  "1": "110100101011",
  "2": "101100101011",
  "3": "110110010101",
  "4": "101001101011",
  "5": "110100110101",
  "6": "101100110101",
  "7": "101001011011",
  "8": "110100101101",
  "9": "101100101101",
  A: "110101001011",
  B: "101101001011",
  C: "110110100101",
  D: "101011001011",
  E: "110101100101",
  F: "101101100101",
  G: "101010011011",
  H: "110101001101",
  I: "101101001101",
  J: "101011001101",
  K: "110101010011",
  L: "101101010011",
  M: "110110101001",
  N: "101011010011",
  O: "110101101001",
  P: "101101101001",
  Q: "101010110011",
  R: "110101011001",
  S: "101101011001",
  T: "101011011001",
  U: "110010101011",
  V: "100110101011",
  W: "110011010101",
  X: "100101101011",
  Y: "110010110101",
  Z: "100110110101",
  "-": "100101011011",
  ".": "110010101101",
  " ": "100110101101",
  $: "100100100101",
  "/": "100100101001",
  "+": "100101001001",
  "%": "101001001001",
  "*": "100101101101",
};

const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
const EAN_R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];
const EAN_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

function widthsToModules(widths: string, barFirst = true): boolean[] {
  const out: boolean[] = [];
  let bar = barFirst;
  for (const ch of widths) {
    const n = Number(ch);
    for (let i = 0; i < n; i++) out.push(bar);
    bar = !bar;
  }
  return out;
}

function bitsToModules(bits: string): boolean[] {
  return [...bits].map((ch) => ch === "1");
}

function quiet(n: number): boolean[] {
  return Array.from({ length: n }, () => false);
}

export function ean13Checksum(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(twelve[i]);
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

function encodeCode128(text: string): BarcodeResult {
  if (![...text].every((ch) => {
    const c = ch.charCodeAt(0);
    return c >= 32 && c <= 126;
  })) {
    throw new Error("code128-charset");
  }
  if (text.length === 0 || text.length > 80) throw new Error("code128-length");
  const digits = /^\d+$/.test(text) && text.length % 2 === 0;
  const values: number[] = [];
  if (digits) {
    values.push(START_C);
    for (let i = 0; i < text.length; i += 2) values.push(Number(text.slice(i, i + 2)));
  } else {
    values.push(START_B);
    for (const ch of text) values.push(ch.charCodeAt(0) - 32);
  }
  let checksum = values[0]!;
  for (let i = 1; i < values.length; i++) checksum += values[i]! * i;
  values.push(checksum % 103, STOP);
  const modules = quiet(10);
  for (const value of values) modules.push(...widthsToModules(CODE128_WIDTHS[value]!));
  modules.push(...quiet(10));
  return { modules, text };
}

function encodeCode39(raw: string): BarcodeResult {
  const text = raw.toUpperCase();
  if (!text || text.length > 40) throw new Error("code39-length");
  if (![...text].every((ch) => ch in CODE39_BITS && ch !== "*")) throw new Error("code39-charset");
  const body = `*${text}*`;
  const modules = quiet(10);
  for (let i = 0; i < body.length; i++) {
    if (i > 0) modules.push(false);
    modules.push(...bitsToModules(CODE39_BITS[body[i]!]!));
  }
  modules.push(...quiet(10));
  return { modules, text };
}

function encodeEan13(raw: string): BarcodeResult {
  const digits = raw.replace(/\D/g, "");
  let code = digits;
  if (code.length === 12) code += String(ean13Checksum(code));
  if (code.length !== 13) throw new Error("ean13-length");
  if (ean13Checksum(code.slice(0, 12)) !== Number(code[12])) throw new Error("ean13-checksum");
  const first = Number(code[0]);
  const parity = EAN_PARITY[first]!;
  const left = code.slice(1, 7);
  const right = code.slice(7);
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const d = Number(left[i]);
    bits += parity[i] === "L" ? EAN_L[d]! : EAN_G[d]!;
  }
  bits += "01010";
  for (let i = 0; i < 6; i++) bits += EAN_R[Number(right[i])]!;
  bits += "101";
  return { modules: [...quiet(11), ...bitsToModules(bits), ...quiet(7)], text: code };
}

export function encodeBarcode(kind: BarcodeKind, text: string): BarcodeResult {
  const trimmed = text.trim();
  if (kind === "code39") return encodeCode39(trimmed);
  if (kind === "ean13") return encodeEan13(trimmed);
  return encodeCode128(trimmed);
}

export function isBarcodeKind(value: string): value is BarcodeKind {
  return value === "code128" || value === "code39" || value === "ean13";
}
