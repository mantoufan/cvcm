const LETTERS: Record<string, string> = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....",
  i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.",
  q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-",
  y: "-.--", z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", _: "..--.-",
  '"': ".-..-.", $: "...-..-", "@": ".--.-.",
};

const FROM = Object.fromEntries(Object.entries(LETTERS).map(([k, v]) => [v, k]));

export function textToMorse(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((ch) => LETTERS[ch] ?? "")
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join(" / ");
}

export function morseToText(raw: string): string | null {
  const line = raw.trim();
  if (!line) return "";
  if (/[^.\-\/\s]/.test(line)) return null;
  const words = line.split(/\s*\/\s*|\s{3,}/);
  const out: string[] = [];
  for (const word of words) {
    const letters = word.trim().split(/\s+/).filter(Boolean);
    if (!letters.length) continue;
    let chunk = "";
    for (const code of letters) {
      const ch = FROM[code];
      if (!ch) return null;
      chunk += ch;
    }
    out.push(chunk);
  }
  return out.join(" ");
}
