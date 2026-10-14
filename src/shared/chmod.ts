/** Unix permission bits: 12 bits, special (setuid 4, setgid 2, sticky 1) then owner, group, others (r 4, w 2, x 1). */

export const MAX_MODE = 0o7777;

/** "755", "0755", "4755". Null for anything that is not 3–4 octal digits. */
export function parseOctal(raw: string): number | null {
  const text = raw.trim();
  if (!/^[0-7]{3,4}$/.test(text)) return null;
  return parseInt(text, 8);
}

/** Three digits when no special bit is set ("755"), else four ("4755"). */
export function toOctal(mode: number): string {
  const m = mode & MAX_MODE;
  return m > 0o777 ? m.toString(8).padStart(4, "0") : m.toString(8).padStart(3, "0");
}

/** ls-style string: rwxr-xr-x, with s/S for setuid and setgid and t/T for sticky. */
export function toSymbolic(mode: number): string {
  const m = mode & MAX_MODE;
  let out = "";
  for (let who = 0; who < 3; who++) {
    const bits = (m >> (6 - who * 3)) & 7;
    const special = (m >> (11 - who)) & 1;
    out += bits & 4 ? "r" : "-";
    out += bits & 2 ? "w" : "-";
    const exec = bits & 1;
    if (special) {
      const ch = who === 2 ? "t" : "s";
      out += exec ? ch : ch.toUpperCase();
    } else {
      out += exec ? "x" : "-";
    }
  }
  return out;
}

/** Reads rwxr-xr-x (or a 10-character ls string with a type letter such as -rwxr-xr-x or drwxr-xr-x). */
export function parseSymbolic(raw: string): number | null {
  let text = raw.trim();
  if (text.length === 10 && /^[-dlcbps]/.test(text)) text = text.slice(1);
  if (text.length !== 9) return null;
  let mode = 0;
  for (let who = 0; who < 3; who++) {
    const [r, w, x] = text.slice(who * 3, who * 3 + 3);
    if (r !== "r" && r !== "-") return null;
    if (w !== "w" && w !== "-") return null;
    const specialLower = who === 2 ? "t" : "s";
    const specialUpper = specialLower.toUpperCase();
    if (![ "x", "-", specialLower, specialUpper ].includes(x)) return null;
    const shift = 6 - who * 3;
    if (r === "r") mode |= 4 << shift;
    if (w === "w") mode |= 2 << shift;
    if (x === "x" || x === specialLower) mode |= 1 << shift;
    if (x === specialLower || x === specialUpper) mode |= 1 << (11 - who);
  }
  return mode;
}

/** Quotes a file name for a POSIX shell only when it needs it. */
export function shellQuote(name: string): string {
  if (/^[A-Za-z0-9._\/-]+$/.test(name)) return name;
  return `'${name.replace(/'/g, `'\\''`)}'`;
}

export function chmodCommand(mode: number, file: string, recursive = false): string {
  const target = file.trim() || "file";
  return `chmod ${recursive ? "-R " : ""}${toOctal(mode)} ${shellQuote(target)}`;
}
