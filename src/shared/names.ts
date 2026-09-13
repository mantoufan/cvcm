const FIRST = [
  "Ada", "Aiko", "Amir", "Ana", "Aria", "Ben", "Cam", "Cora", "Diego", "Elena",
  "Ezra", "Farah", "Hugo", "Ines", "Ivan", "Jade", "Kai", "Lina", "Luca", "Mara",
  "Milo", "Nina", "Noor", "Omar", "Pia", "Quinn", "Remy", "Sana", "Theo", "Uma",
  "Vera", "Wei", "Yara", "Zane", "Noah", "Maya", "Leo", "Sofia", "Owen", "Hana",
];

const LAST = [
  "Adler", "Brooks", "Chen", "Diaz", "Ellis", "Frost", "Garcia", "Hayes", "Ito", "Jung",
  "Khan", "Lopez", "Marin", "Nash", "Ortiz", "Park", "Quinn", "Reed", "Santos", "Tran",
  "Ueda", "Vega", "Walsh", "Xu", "Young", "Zahra", "Cole", "Ng", "Silva", "Berg",
];

const ADJ = [
  "amber", "brisk", "calm", "crisp", "daring", "eager", "fair", "gentle", "happy", "ivory",
  "jolly", "kind", "lucky", "mild", "noble", "open", "plucky", "quick", "rosy", "sunny",
  "tidy", "vivid", "warm", "zesty", "silent", "bright", "clever", "cosmic", "mellow", "swift",
];

const NOUN = [
  "otter", "maple", "comet", "pebble", "river", "sparrow", "cocoa", "orchid", "falcon", "lotus",
  "nebula", "willow", "badger", "coral", "dune", "ember", "finch", "grove", "haven", "ink",
  "jasper", "koala", "lagoon", "moss", "nova", "olive", "pine", "quartz", "reef", "sage",
];

function randIndex(max: number): number {
  if (max <= 0) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function pick(list: readonly string[]): string {
  return list[randIndex(list.length)]!;
}

export type NameKind = "person" | "username";

export function generateName(kind: NameKind): string {
  if (kind === "person") return `${pick(FIRST)} ${pick(LAST)}`;
  const n = randIndex(100);
  const tail = n < 40 ? String(randIndex(90) + 10) : n < 70 ? String(randIndex(9) + 1) : "";
  return `${pick(ADJ)}${pick(NOUN)}${tail}`;
}

export function generateNames(kind: NameKind, count: number): string[] {
  const n = Math.max(1, Math.min(50, Math.round(count) || 10));
  const out: string[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard < n * 20) {
    guard += 1;
    const next = generateName(kind);
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  while (out.length < n) out.push(generateName(kind));
  return out;
}
