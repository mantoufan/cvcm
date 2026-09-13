const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do",
  "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim",
  "ad", "minim", "veniam", "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip",
  "ex", "ea", "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint", "occaecat", "cupidatat",
  "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id",
  "est", "laborum",
];

export type LoremKind = "paragraphs" | "sentences" | "words";

function wordAt(i: number): string {
  return WORDS[i % WORDS.length]!;
}

export function loremWords(count: number): string {
  const n = Math.max(1, Math.min(2000, Math.round(count) || 50));
  const out = [];
  for (let i = 0; i < n; i++) out.push(wordAt(i));
  return out.join(" ");
}

export function loremSentences(count: number): string {
  const n = Math.max(1, Math.min(200, Math.round(count) || 5));
  const sentences = [];
  let w = 0;
  for (let s = 0; s < n; s++) {
    const len = 8 + (s % 7);
    const words = [];
    for (let i = 0; i < len; i++) words.push(wordAt(w++));
    words[0] = words[0]![0]!.toUpperCase() + words[0]!.slice(1);
    sentences.push(`${words.join(" ")}.`);
  }
  return sentences.join(" ");
}

export function loremParagraphs(count: number): string {
  const n = Math.max(1, Math.min(50, Math.round(count) || 3));
  const blocks = [];
  let w = 8;
  for (let i = 0; i < n; i++) {
    const sentenceCount = 3 + (i % 3);
    const sentences: string[] = [];
    if (i === 0) sentences.push("Lorem ipsum dolor sit amet, consectetur adipiscing elit.");
    for (let s = 0; s < sentenceCount; s++) {
      const len = 8 + ((i + s) % 7);
      const words = [];
      for (let k = 0; k < len; k++) words.push(wordAt(w++));
      words[0] = words[0]![0]!.toUpperCase() + words[0]!.slice(1);
      sentences.push(`${words.join(" ")}.`);
    }
    blocks.push(sentences.join(" "));
  }
  return blocks.join("\n\n");
}

export function generateLorem(kind: LoremKind, count: number): string {
  if (kind === "words") return loremWords(count);
  if (kind === "sentences") return loremSentences(count);
  return loremParagraphs(count);
}
