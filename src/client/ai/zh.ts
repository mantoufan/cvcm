/** Traditional ↔ Simplified for Whisper's Chinese output. The table (~28 KB gzip) loads only when needed. */
export type ZhScript = "hans" | "hant";

let tables: Promise<{ t2s: Map<string, string>; s2t: Map<string, string> }> | null = null;

function pairs(packed: string): Map<string, string> {
  const chars = Array.from(packed);
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < chars.length; i += 2) map.set(chars[i], chars[i + 1]);
  return map;
}

export async function convertZh(text: string, to: ZhScript): Promise<string> {
  tables ??= import("./zh-chars").then((m) => ({ t2s: pairs(m.T2S), s2t: pairs(m.S2T) }));
  const { t2s, s2t } = await tables;
  const map = to === "hans" ? t2s : s2t;
  let out = "";
  for (const ch of text) out += map.get(ch) ?? ch;
  return out;
}
