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

/**
 * Reads rwxr-xr-x, or the ls -l column with a type letter (-rwxr-xr-x, drwxr-xr-x) and an optional trailing
 * ACL / SELinux / extended-attribute marker (+, . or @), e.g. -rw-r--r--@.
 */
export function parseSymbolic(raw: string): number | null {
  let text = raw.trim();
  if ((text.length === 10 || text.length === 11) && /[+.@]$/.test(text)) text = text.slice(0, -1);
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

const SAFE = /^[A-Za-z0-9._\/@%+=:,~-]+$/;
const GLOB = /([*?[\]])/;

/**
 * Quotes a file name for a POSIX shell, leaving a leading ~ or ~/ and the glob characters * ? [ ] unquoted so the
 * shell still expands them. Every other piece that holds a space, quote, $, ;, & or similar is single-quoted.
 */
export function shellQuote(name: string): string {
  let rest = name;
  let head = "";
  const tilde = /^~(\/|$)/.exec(rest);
  if (tilde) {
    head = tilde[0];
    rest = rest.slice(head.length);
  }
  const body = rest
    .split(GLOB)
    .map((part) => {
      // zsh expands a word that starts with = (=cmd), so quote that too.
      if (!part || GLOB.test(part) || (SAFE.test(part) && !part.startsWith("="))) return part;
      return `'${part.replace(/'/g, `'\\''`)}'`;
    })
    .join("");
  return head + body;
}

export type ChmodOptions = {
  recursive?: boolean;
  /** The target is a folder (GNU chmod keeps a folder's setuid/setgid unless the mode has an extra leading 0). */
  directory?: boolean;
  /** The user just turned special bits off, so the mode should say so explicitly with a leading 0. */
  clearSpecial?: boolean;
};

/**
 * Mode digits for the command: special bits set → 4 digits (4755); folder (or -R) without special bits → 00755,
 * because GNU chmod only clears a folder's setuid/setgid with that extra 0 (BSD/macOS read it as 0755);
 * a file whose special bits were just cleared → 0755; otherwise 755.
 */
export function commandMode(mode: number, opts: ChmodOptions = {}): string {
  const m = mode & MAX_MODE;
  if (m > 0o777) return toOctal(m);
  const base = toOctal(m);
  if (opts.directory || opts.recursive) return `00${base}`;
  if (opts.clearSpecial) return `0${base}`;
  return base;
}

export function chmodCommand(mode: number, file: string, opts: ChmodOptions = {}): string {
  const target = file.trim() || "file";
  // "--" stops chmod reading a name such as -rf.txt as options.
  const dashes = target.startsWith("-") ? "-- " : "";
  return `chmod ${opts.recursive ? "-R " : ""}${commandMode(mode, opts)} ${dashes}${shellQuote(target)}`;
}
