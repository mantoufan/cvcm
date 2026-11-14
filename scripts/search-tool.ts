/**
 * Site search demand, run by the owner (never by the Worker or CI):
 *
 *   npm run search:demand [-- --days 30 --min 2 --json out.json]
 *     Queries that found nothing, grouped across locales, with distinct visitors, pending email requests and
 *     whether today's index (this checkout) now answers them. Feed the list to the SEO review in docs/search-demand.md.
 *
 *   npm run search:notify [-- --send]
 *     Pending email requests whose query now has results in this checkout's index. Without --send it only lists
 *     them. With --send it emails each address once (SMTP_USER / SMTP_PASS, m@cv.cm on Aliyun mail by default)
 *     and deletes the row, as the privacy policy promises.
 *
 * Reads and writes the remote D1 database through `wrangler d1 execute` (needs CLOUDFLARE_API_TOKEN or wrangler login).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { connect, type TLSSocket } from "node:tls";
import { randomUUID } from "node:crypto";
import "../src/shared/messages-all";
import "../src/shared/kb-code-meta";
import "../src/shared/kb-ai-meta";
import { isLocale, LOCALES, type Locale } from "../src/shared/locale";
import { searchEntries, type SearchEntry } from "../src/shared/search";
import { buildAllSearchIndexes } from "../src/shared/search-index";

const args = process.argv.slice(2);
const command = args[0];
function flag(name: string): boolean {
  return args.includes(`--${name}`);
}
function option(name: string, fallback: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function d1<T>(sql: string): T[] {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "cvcm", "--remote", "--json", "--command", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(out) as Array<{ results: T[]; success: boolean }>;
  if (!parsed[0]?.success) throw new Error(`D1 query failed: ${sql}`);
  return parsed[0].results;
}

let indexes: Record<Locale, SearchEntry[]> | null = null;
function hitsFor(q: string, locale: Locale): SearchEntry[] {
  indexes ??= buildAllSearchIndexes();
  return searchEntries(indexes[locale], q, 3);
}

type MissRow = { q: string; locale: string; count: number; visitors: number; first_at: number; last_at: number };
type RequestRow = { q: string; locale: string; email: string; created_at: number };

function day(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function demand(): void {
  const days = Number(option("days", "30"));
  const min = Number(option("min", "1"));
  const since = Date.now() - days * 86_400_000;
  const misses = d1<MissRow>(`SELECT q, locale, count, visitors, first_at, last_at FROM search_misses WHERE last_at >= ${since}`);
  const requests = d1<{ q: string; locale: string; n: number }>("SELECT q, locale, COUNT(*) AS n FROM search_requests GROUP BY q, locale");
  const asked = new Map(requests.map((r) => [`${r.locale}|${r.q}`, r.n]));
  type Row = { q: string; visitors: number; count: number; emails: number; locales: string[]; last: string; answered: string[] };
  const byQuery = new Map<string, Row>();
  for (const m of misses) {
    const row = byQuery.get(m.q) ?? { q: m.q, visitors: 0, count: 0, emails: 0, locales: [], last: "", answered: [] };
    row.visitors += m.visitors;
    row.count += m.count;
    row.emails += asked.get(`${m.locale}|${m.q}`) ?? 0;
    row.locales.push(m.locale);
    if (day(m.last_at) > row.last) row.last = day(m.last_at);
    if (isLocale(m.locale)) {
      const now = hitsFor(m.q, m.locale);
      if (now.length) row.answered.push(`${m.locale}: ${now[0][2]}`);
    }
    byQuery.set(m.q, row);
  }
  const rows = [...byQuery.values()]
    .filter((r) => r.visitors >= min)
    .sort((a, b) => b.emails - a.emails || b.visitors - a.visitors || b.count - a.count);
  console.log(`Searches with no result in the last ${days} days (≥${min} visitors): ${rows.length} queries\n`);
  console.log("| query | visitors | searches | emails | locales | last | answered now |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(`| ${r.q.replace(/\|/g, "\\|")} | ${r.visitors} | ${r.count} | ${r.emails} | ${r.locales.join(" ")} | ${r.last} | ${r.answered.join("; ")} |`);
  }
  const out = option("json", "");
  if (out) {
    writeFileSync(out, JSON.stringify(rows, null, 2));
    console.log(`\nwrote ${out}`);
  }
}

const MAIL: Record<Locale, { subject: string; intro: string; outro: string }> = {
  en: { subject: "“{q}” is now on cv.cm", intro: "You asked us to tell you when cv.cm had something for “{q}”. It does now:", outro: "This is the only email about this request. Your address has been deleted." },
  "zh-CN": { subject: "「{q}」已在 cv.cm 上线", intro: "你曾在 cv.cm 搜索「{q}」并请我们上线后通知你。现在可以用了：", outro: "这是关于此请求的唯一一封邮件，你的邮箱已删除。" },
  "zh-TW": { subject: "「{q}」已在 cv.cm 上線", intro: "你曾在 cv.cm 搜尋「{q}」並請我們上線後通知你。現在可以用了：", outro: "這是關於此請求的唯一一封信，你的 Email 已刪除。" },
  ja: { subject: "「{q}」が cv.cm に追加されました", intro: "cv.cm で「{q}」を検索し、追加時の通知をご希望いただきました。ご利用いただけるようになりました：", outro: "このリクエストに関するメールはこれ一通のみです。メールアドレスは削除しました。" },
  ko: { subject: "“{q}”이(가) cv.cm에 추가되었습니다", intro: "cv.cm에서 “{q}”를 검색하고 추가되면 알려 달라고 하셨습니다. 이제 이용할 수 있습니다:", outro: "이 요청에 관한 메일은 이번 한 통뿐이며, 이메일 주소는 삭제되었습니다." },
  vi: { subject: "“{q}” đã có trên cv.cm", intro: "Bạn đã nhờ chúng tôi báo khi cv.cm có nội dung cho “{q}”. Giờ đã có:", outro: "Đây là email duy nhất cho yêu cầu này. Địa chỉ của bạn đã được xóa." },
  id: { subject: "“{q}” sekarang ada di cv.cm", intro: "Anda meminta kami mengabari saat cv.cm punya sesuatu untuk “{q}”. Sekarang sudah ada:", outro: "Ini satu-satunya email untuk permintaan ini. Alamat Anda sudah dihapus." },
  es: { subject: "“{q}” ya está en cv.cm", intro: "Nos pediste que te avisáramos cuando cv.cm tuviera algo para “{q}”. Ya está disponible:", outro: "Este es el único correo sobre esta solicitud. Tu dirección se ha borrado." },
};

function fill(text: string, q: string): string {
  return text.replaceAll("{q}", q);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function b64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
}

function mimeWord(text: string): string {
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function buildMessage(from: string, to: string, locale: Locale, q: string, hits: SearchEntry[]): string {
  const copy = MAIL[locale];
  const links = hits.map(([, href, name]) => ({ name, url: `https://cv.cm${href}` }));
  const text = [fill(copy.intro, q), "", ...links.map((l) => `- ${l.name}: ${l.url}`), "", fill(copy.outro, q), "", "cv.cm"].join("\r\n");
  const html = `<p>${escapeHtml(fill(copy.intro, q))}</p><ul>${links
    .map((l) => `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.name)}</a></li>`)
    .join("")}</ul><p style="color:#77606c">${escapeHtml(fill(copy.outro, q))}</p><p>cv.cm</p>`;
  const boundary = `b-${randomUUID()}`;
  return [
    `From: cv.cm <${from}>`,
    `To: <${to}>`,
    `Subject: ${mimeWord(fill(copy.subject, q))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@cv.cm>`,
    `Reply-To: ${from}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** A small SMTP client over implicit TLS (port 465): EHLO, AUTH LOGIN, one message per session. */
class Smtp {
  private buffer = "";
  private waiters: Array<(line: string) => void> = [];
  private constructor(private socket: TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.flush();
    });
  }

  static open(host: string, port: number): Promise<Smtp> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host, port, servername: host }, () => resolve(new Smtp(socket)));
      socket.once("error", reject);
      socket.setTimeout(30_000, () => socket.destroy(new Error("SMTP timeout")));
    });
  }

  private flush(): void {
    // A reply ends with a line "NNN text" (a space, not a dash, after the code).
    for (;;) {
      const match = this.buffer.match(/(^|\r\n)(\d{3}) [^\r\n]*\r\n/);
      if (!match || match.index === undefined || !this.waiters.length) return;
      const end = match.index + match[0].length;
      const reply = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end);
      this.waiters.shift()!(reply);
    }
  }

  private reply(): Promise<string> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      this.flush();
    });
  }

  async expect(code: number, line?: string): Promise<string> {
    if (line !== undefined) this.socket.write(`${line}\r\n`);
    const reply = await this.reply();
    const got = Number(reply.trim().split("\r\n").pop()!.slice(0, 3));
    if (got !== code) throw new Error(`SMTP ${line?.startsWith("AUTH") ? "AUTH" : line ?? "greeting"}: ${reply.trim()}`);
    return reply;
  }

  close(): void {
    this.socket.end();
  }
}

async function sendMail(to: string, message: string, from: string, user: string, pass: string, host: string, port: number): Promise<void> {
  const smtp = await Smtp.open(host, port);
  try {
    await smtp.expect(220);
    await smtp.expect(250, "EHLO cv.cm");
    await smtp.expect(334, "AUTH LOGIN");
    await smtp.expect(334, Buffer.from(user).toString("base64"));
    await smtp.expect(235, Buffer.from(pass).toString("base64"));
    await smtp.expect(250, `MAIL FROM:<${from}>`);
    await smtp.expect(250, `RCPT TO:<${to}>`);
    await smtp.expect(354, "DATA");
    // Dot-stuffing: a line that starts with "." gets another one.
    await smtp.expect(250, `${message.replace(/\r\n\./g, "\r\n..")}\r\n.`);
    await smtp.expect(221, "QUIT").catch(() => undefined);
  } finally {
    smtp.close();
  }
}

async function notify(): Promise<void> {
  const send = flag("send");
  const pending = d1<RequestRow>("SELECT q, locale, email, created_at FROM search_requests ORDER BY created_at");
  const ready = pending
    .filter((r): r is RequestRow & { locale: Locale } => isLocale(r.locale))
    .map((r) => ({ ...r, hits: hitsFor(r.q, r.locale) }))
    .filter((r) => r.hits.length > 0);
  console.log(`${pending.length} pending requests, ${ready.length} now have results in this checkout's index.`);
  for (const r of ready) console.log(`- [${r.locale}] ${r.q} → ${r.hits.map((h) => `${h[2]} (${h[1]})`).join(", ")}  <${r.email}>`);
  if (!send) {
    if (ready.length) console.log("\nDry run. Check the matches above (the page must really answer the query), then rerun with --send.");
    return;
  }
  const user = process.env.SMTP_USER ?? "m@cv.cm";
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST ?? "smtp.qiye.aliyun.com";
  const port = Number(process.env.SMTP_PORT ?? "465");
  const from = process.env.SMTP_FROM ?? user;
  if (!pass) throw new Error("Set SMTP_PASS (and SMTP_USER if not m@cv.cm) to send.");
  for (const r of ready) {
    try {
      await sendMail(r.email, buildMessage(from, r.email, r.locale, r.q, r.hits), from, user, pass, host, port);
      d1(`DELETE FROM search_requests WHERE q = ${sqlString(r.q)} AND locale = ${sqlString(r.locale)} AND email = ${sqlString(r.email)}`);
      console.log(`sent and deleted: [${r.locale}] ${r.q} <${r.email}>`);
    } catch (err) {
      console.error(`failed: [${r.locale}] ${r.q} <${r.email}>: ${(err as Error).message}`);
    }
  }
}

if (command === "demand") demand();
else if (command === "notify") await notify();
else {
  console.error("usage: search-tool demand [--days 30] [--min 1] [--json file] | notify [--send]");
  console.error(`locales: ${LOCALES.join(", ")}`);
  process.exit(1);
}
