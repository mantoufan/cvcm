export type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  text: string;
  children: XmlNode[];
};

export function parseXml(xml: string): XmlNode {
  const src = xml.replace(/^\uFEFF/, "").trim();
  if (!src) throw new Error("empty");
  const tokens = tokenize(src);
  const stack: XmlNode[] = [{ name: "root", attrs: {}, text: "", children: [] }];
  for (const tok of tokens) {
    const cur = stack[stack.length - 1];
    if (!cur) throw new Error("xml");
    if (tok.kind === "text") {
      cur.text += tok.value;
      continue;
    }
    if (tok.kind === "open") {
      const node: XmlNode = { name: tok.name, attrs: tok.attrs, text: "", children: [] };
      cur.children.push(node);
      if (!tok.self) stack.push(node);
      continue;
    }
    if (tok.kind === "close") {
      if (stack.length < 2 || cur.name !== tok.name) throw new Error("xml-mismatch");
      cur.text = cur.text.trim();
      stack.pop();
    }
  }
  if (stack.length !== 1) throw new Error("xml-unclosed");
  const root = stack[0]!;
  if (root.children.length === 1 && !root.text) return root.children[0]!;
  if (root.children.length === 0 && root.text) return { name: "text", attrs: {}, text: root.text, children: [] };
  return root;
}

export function xmlToJson(xml: string): unknown {
  return nodeToJson(parseXml(xml));
}

export function jsonToXml(data: unknown, root = "root"): string {
  return stringify(root, data, 0);
}

function nodeToJson(node: XmlNode): unknown {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.attrs)) obj[`@${key}`] = value;
  const grouped = new Map<string, XmlNode[]>();
  for (const child of node.children) {
    const list = grouped.get(child.name) ?? [];
    list.push(child);
    grouped.set(child.name, list);
  }
  for (const [name, list] of grouped) {
    const values = list.map(nodeToJson);
    obj[name] = values.length === 1 ? values[0] : values;
  }
  const text = node.text.trim();
  if (text) {
    if (Object.keys(obj).length === 0) return coerce(text);
    obj["#text"] = coerce(text);
  }
  return Object.keys(obj).length ? obj : "";
}

function coerce(text: string): string | number | boolean {
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function stringify(name: string, data: unknown, depth: number): string {
  const pad = "  ".repeat(depth);
  const tag = safeName(name);
  if (data == null) return `${pad}<${tag}/>\n`;
  if (typeof data !== "object") return `${pad}<${tag}>${escapeXml(String(data))}</${tag}>\n`;
  if (Array.isArray(data)) return data.map((item) => stringify(tag, item, depth)).join("");
  const rec = data as Record<string, unknown>;
  const attrs: string[] = [];
  const kids: string[] = [];
  let text = "";
  for (const [key, value] of Object.entries(rec)) {
    if (key.startsWith("@") && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
      attrs.push(`${safeName(key.slice(1))}="${escapeXml(String(value))}"`);
    } else if (key === "#text") {
      text = escapeXml(String(value ?? ""));
    } else {
      kids.push(stringify(key, value, depth + 1));
    }
  }
  const attr = attrs.length ? ` ${attrs.join(" ")}` : "";
  if (!kids.length && !text) return `${pad}<${tag}${attr}/>\n`;
  if (!kids.length) return `${pad}<${tag}${attr}>${text}</${tag}>\n`;
  return `${pad}<${tag}${attr}>\n${text ? `${pad}  ${text}\n` : ""}${kids.join("")}${pad}</${tag}>\n`;
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_") || "item";
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Token =
  | { kind: "open"; name: string; attrs: Record<string, string>; self: boolean }
  | { kind: "close"; name: string }
  | { kind: "text"; value: string };

function tokenize(xml: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < xml.length) {
    if (xml[i] !== "<") {
      const next = xml.indexOf("<", i);
      const chunk = xml.slice(i, next < 0 ? xml.length : next);
      const text = chunk.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/\s+/g, " ");
      if (text.trim()) out.push({ kind: "text", value: decode(text) });
      i = next < 0 ? xml.length : next;
      continue;
    }
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4);
      if (end < 0) throw new Error("xml-comment");
      i = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", i)) {
      const end = xml.indexOf("]]>", i + 9);
      if (end < 0) throw new Error("xml-cdata");
      out.push({ kind: "text", value: xml.slice(i + 9, end) });
      i = end + 3;
      continue;
    }
    if (xml.startsWith("<?", i) || xml.startsWith("<!", i)) {
      const end = xml.indexOf(">", i + 2);
      if (end < 0) throw new Error("xml");
      i = end + 1;
      continue;
    }
    const end = xml.indexOf(">", i + 1);
    if (end < 0) throw new Error("xml");
    const raw = xml.slice(i + 1, end).trim();
    i = end + 1;
    if (raw.startsWith("/")) {
      out.push({ kind: "close", name: raw.slice(1).trim() });
      continue;
    }
    const self = raw.endsWith("/");
    const body = self ? raw.slice(0, -1).trim() : raw;
    const match = body.match(/^([A-Za-z_][\w:.-]*)([\s\S]*)$/);
    if (!match) throw new Error("xml-name");
    out.push({ kind: "open", name: match[1]!, attrs: parseAttrs(match[2] || ""), self });
  }
  return out;
}

function parseAttrs(chunk: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) attrs[m[1]!] = decode(m[3] ?? m[4] ?? "");
  return attrs;
}

function decode(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
