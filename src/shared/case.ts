export const CASE_IDS = ["upper", "lower", "title", "sentence", "camel", "pascal", "snake", "kebab", "constant"] as const;
export type CaseId = (typeof CASE_IDS)[number];

export function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9\u00C0-\u024F]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export function convertCase(text: string, id: CaseId): string {
  if (id === "upper") return text.toUpperCase();
  if (id === "lower") return text.toLowerCase();
  if (id === "sentence") {
    const lower = text.toLowerCase();
    return lower.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase());
  }
  const parts = words(text);
  if (id === "title") return parts.map(cap).join(" ");
  if (id === "camel") return parts.map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join("");
  if (id === "pascal") return parts.map(cap).join("");
  if (id === "snake") return parts.map((w) => w.toLowerCase()).join("_");
  if (id === "kebab") return parts.map((w) => w.toLowerCase()).join("-");
  return parts.map((w) => w.toUpperCase()).join("_");
}

function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
