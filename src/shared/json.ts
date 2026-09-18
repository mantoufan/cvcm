export function prettyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return null;
  }
}

export function minifyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return null;
  }
}
