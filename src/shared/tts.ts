export type VoicePick = { name: string; lang: string };

const SENTENCE_SPLIT = /(?<=[.!?。！？…]+)(?:\s+|$)/;

export function splitUtterances(text: string, maxLen = 160): string[] {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const sentences = raw.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences.length ? sentences : [raw]) {
    if (sentence.length <= maxLen) {
      out.push(sentence);
      continue;
    }
    let rest = sentence;
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf(" ", maxLen);
      if (cut < Math.floor(maxLen / 3)) cut = maxLen;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

export function pickVoice(
  voices: VoicePick[],
  locale: string,
  preferredName?: string,
): VoicePick | null {
  if (!voices.length) return null;
  if (preferredName) {
    const exact = voices.find((voice) => voice.name === preferredName);
    if (exact) return exact;
  }
  const wanted = locale.toLowerCase().replace(/_/g, "-");
  const lang = wanted.split("-")[0]!;
  return (
    voices.find((voice) => normalizeLang(voice.lang) === wanted)
    ?? voices.find((voice) => normalizeLang(voice.lang).startsWith(`${lang}-`) || normalizeLang(voice.lang) === lang)
    ?? voices[0]!
  );
}

function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace(/_/g, "-");
}
