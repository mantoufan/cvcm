/**
 * Draws a résumé into a paper sheet in the chosen layout. Everything is built with h() / text nodes. Dates that
 * depend on today (the "as of" date when none is typed, the age) are `data-volatile`, so the prerendered page does
 * not carry the build date.
 */
import { h } from "../dom";
import { ageOn, lines, parseYmd, todayYmd, wareki, type Era, type Resume, type Ymd } from "../../shared/resume";
import { docHeadings } from "../../shared/resume-samples";

type Kid = Node | string | null | false;

const MONTH_FMT = new Map<string, Intl.DateTimeFormat>();
function monthFmt(loc: string): Intl.DateTimeFormat {
  let f = MONTH_FMT.get(loc);
  if (!f) MONTH_FMT.set(loc, (f = new Intl.DateTimeFormat(loc, { month: "short", year: "numeric", timeZone: "UTC" })));
  return f;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A month in the document's language: Apr 2021, abr 2021, 04/2021, 2021.04, 2021年4月 (令和3年4月). */
export function formatYm(value: string, loc: string, era: Era = "seireki"): string {
  const p = parseYmd(value);
  if (!p) return value;
  if (!p.m) return loc === "ja" ? `${era === "wareki" ? jaYear(p) : p.y}年` : String(p.y);
  switch (loc) {
    case "ja": return `${era === "wareki" ? jaYear(p) : p.y}年${p.m}月`;
    case "zh-CN": case "zh-TW": case "ko": return `${p.y}.${pad(p.m)}`;
    case "vi": return `${pad(p.m)}/${p.y}`;
    default: return monthFmt(loc).format(Date.UTC(p.y, p.m - 1, 1));
  }
}

function jaYear(p: Ymd): string {
  const w = wareki(p);
  return `${w.era}${w.year}`;
}

/** A full date: 2026-11-20 → November 20, 2026 / 2026年11月20日 (令和8年11月20日) / 2026년 11월 20일 … */
export function formatDate(value: string, loc: string, era: Era = "seireki"): string {
  const p = parseYmd(value);
  if (!p || !p.m || !p.d) return formatYm(value, loc, era);
  if (loc === "ja") return `${era === "wareki" ? jaYear(p) : p.y}年${p.m}月${p.d}日`;
  if (loc === "ko") return `${p.y}년 ${p.m}월 ${p.d}일`;
  if (loc === "zh-CN" || loc === "zh-TW") return `${p.y}年${p.m}月${p.d}日`;
  if (loc === "vi") return `${pad(p.d)}/${pad(p.m)}/${p.y}`;
  return new Intl.DateTimeFormat(loc, { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(p.y, p.m - 1, p.d));
}

function range(start: string, end: string, current: boolean, loc: string, era: Era): string {
  const h1 = docHeadings(loc);
  const a = start ? formatYm(start, loc, era) : "";
  const b = current ? h1.present : end ? formatYm(end, loc, era) : "";
  if (!a && !b) return "";
  if (!a) return b;
  if (!b) return a;
  return `${a}${h1.dash}${b}`;
}

/** The document's date: the typed "as of" date, or today (volatile: filled in by the browser, not the build). */
function asOfEl(r: Resume, loc: string, suffix = ""): HTMLElement {
  if (r.basics.asOf) return h("span", null, formatDate(r.basics.asOf, loc, r.era) + suffix);
  return h("span", { "data-volatile": "" }, formatDate(todayYmd(), loc, r.era) + suffix);
}

function photoEl(r: Resume, label: string, cls: string): HTMLElement {
  return r.basics.photo
    ? h("img", { class: cls, src: r.basics.photo, alt: "" })
    : h("div", { class: `${cls} rs-photo-empty` }, label);
}

const section = (title: string, ...kids: Kid[]) =>
  h("section", { class: "rs-sec" }, h("p", { class: "rs-h" }, title), ...kids);

const bullets = (text: string) => {
  const items = lines(text);
  return items.length ? h("ul", { class: "rs-ul" }, ...items.map((l) => h("li", null, l))) : null;
};

/** ATS CV (no photo) and CV with photo: one column, standard headings, plain text a parser can read. */
function renderCv(r: Resume, loc: string, withPhoto: boolean): HTMLElement {
  const hd = docHeadings(loc);
  const b = r.basics;
  const contact = [b.email, b.phone, b.address, ...lines(b.links)].filter(Boolean);
  const head = h("header", { class: "rs-head" },
    h("div", { class: "rs-id" },
      b.name ? h("p", { class: "rs-name" }, b.name) : null,
      b.title ? h("p", { class: "rs-title" }, b.title) : null,
      withPhoto && b.birth ? h("p", { class: "rs-contact" }, `${hd.birth}: ${formatDate(b.birth, loc, r.era)}`) : null,
      contact.length ? h("p", { class: "rs-contact" }, contact.join(" · ")) : null,
    ),
    withPhoto ? photoEl(r, "", "rs-photo") : null,
  );
  const summary = r.summary.trim() ? section(hd.summary, h("p", { class: "rs-p" }, r.summary.trim())) : null;
  const exp = r.experience.filter((e) => e.role || e.org || e.details);
  const edu = r.education.filter((e) => e.school || e.degree);
  const certs = r.certs.filter((c) => c.name);
  return h("div", { class: `rs rs-cv${withPhoto ? " rs-withphoto" : ""}` },
    head,
    hd.summaryLast ? null : summary,
    exp.length ? section(hd.experience, ...exp.map((e) => h("div", { class: "rs-entry" },
      h("p", { class: "rs-row" },
        h("span", { class: "rs-what" }, h("b", null, e.role), e.role && e.org ? ", " : "", e.org, e.place ? ` — ${e.place}` : ""),
        h("span", { class: "rs-date" }, range(e.start, e.end, e.current, loc, r.era))),
      bullets(e.details)))) : null,
    edu.length ? section(hd.education, ...edu.map((e) => h("div", { class: "rs-entry" },
      h("p", { class: "rs-row" },
        h("span", { class: "rs-what" }, h("b", null, e.degree || e.school), e.degree && e.school ? `, ${e.school}` : "", e.place ? ` — ${e.place}` : ""),
        h("span", { class: "rs-date" }, range(e.start, e.end, false, loc, r.era))),
      bullets(e.details)))) : null,
    lines(r.skills).length ? section(hd.skills, h("p", { class: "rs-p" }, lines(r.skills).join(" · "))) : null,
    lines(r.languages).length ? section(hd.languages, h("p", { class: "rs-p" }, lines(r.languages).join(" · "))) : null,
    certs.length ? section(hd.certs, h("ul", { class: "rs-ul" }, ...certs.map((c) => h("li", null, c.name, c.date ? ` (${formatYm(c.date, loc, r.era)})` : "")))) : null,
    r.extra.trim() ? section(hd.extra, h("p", { class: "rs-p" }, r.extra.trim())) : null,
    hd.summaryLast ? summary : null,
  );
}

/** Year and month columns of the Japanese and Korean tables. */
function ymCells(value: string, era: Era): [string, string] {
  const p = parseYmd(value);
  if (!p) return [value, ""];
  return [era === "wareki" ? jaYear(p) : String(p.y), p.m ? String(p.m) : ""];
}

function later(a: string, b: string): boolean {
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  if (!pa || !pb) return false;
  return pa.y * 100 + pa.m > pb.y * 100 + pb.m;
}

const td = (text: string, cls = "") => h("td", cls ? { class: cls } : null, text);

/** 履歴書, after the MHLW example form of April 2021 (性別 optional; no 通勤時間, 扶養家族, 配偶者 boxes). */
function renderRirekisho(r: Resume): HTMLElement {
  const b = r.basics;
  const birth = parseYmd(b.birth);
  const today = parseYmd(b.asOf || todayYmd());
  const age = birth && birth.m && today && today.m ? ageOn(birth, { y: today.y, m: today.m, d: today.d ?? 1 }) : null;
  const birthCell = h("td", { colspan: "1" },
    b.birth ? `${formatDate(b.birth, "ja", r.era)}生` : "",
    age !== null && age >= 0 ? h("span", b.asOf ? null : { "data-volatile": "" }, `（満${age}歳）`) : null);
  const rows: HTMLElement[] = [];
  const head = (text: string) => rows.push(h("tr", null, td(""), td(""), td(text, "rs-center")));
  const row = (date: string, text: string, cls = "") => {
    const [y, m] = date ? ymCells(date, r.era) : ["", ""];
    rows.push(h("tr", null, td(y, "rs-y"), td(m, "rs-m"), td(text, cls)));
  };
  const asOf = b.asOf || todayYmd();
  head("学歴");
  for (const e of r.education.filter((x) => x.school)) {
    const name = [e.school, e.degree].filter(Boolean).join(" ");
    if (e.start) row(e.start, `${name} 入学`);
    if (e.end) {
      row(e.end, `${name} ${later(e.end, asOf) ? "卒業見込み" : "卒業"}`);
      // Without an as-of date, 見込み turns into 卒業 when the date passes: keep it out of public HTML.
      if (!b.asOf && later(e.end, asOf)) rows[rows.length - 1].lastElementChild?.setAttribute("data-volatile", "");
    }
  }
  head("職歴");
  const jobs = r.experience.filter((x) => x.org);
  if (!jobs.length) row("", "なし");
  for (const e of jobs) {
    row(e.start, `${e.org} 入社`);
    for (const l of lines(e.details)) row("", `　${l}`);
    if (!e.current && e.end) row(e.end, `${e.org} 一身上の都合により退社`);
  }
  if (jobs.some((e) => e.current)) row("", "現在に至る");
  row("", "以上", "rs-end");
  const certs = r.certs.filter((c) => c.name);
  return h("div", { class: "rs rs-jp" },
    h("div", { class: "rs-jp-top" },
      h("p", { class: "rs-jp-title" }, "履歴書"),
      h("p", { class: "rs-jp-date" }, asOfEl(r, "ja", "現在"))),
    h("div", { class: "rs-jp-id" },
      h("table", { class: "rs-tbl rs-jp-person" }, h("tbody", null,
        h("tr", null, h("th", null, "ふりがな"), td(b.kana, "rs-kana")),
        h("tr", null, h("th", null, "氏名"), td(b.name, "rs-jp-name")),
        h("tr", null, h("th", null, "生年月日"), birthCell),
        h("tr", null, h("th", null, "性別"), td(b.gender)),
      )),
      photoEl(r, "写真をはる位置\n縦 36～40mm\n横 24～30mm", "rs-jp-photo")),
    h("table", { class: "rs-tbl" }, h("tbody", null,
      h("tr", null, h("th", null, "現住所"), td(b.address)),
      h("tr", null, h("th", null, "電話"), td(b.phone)),
      h("tr", null, h("th", null, "メールアドレス"), td(b.email)),
    )),
    h("table", { class: "rs-tbl rs-jp-hist" },
      h("thead", null, h("tr", null, h("th", { class: "rs-y" }, "年"), h("th", { class: "rs-m" }, "月"), h("th", null, "学歴・職歴（各別にまとめて書く）"))),
      h("tbody", null, ...rows)),
    h("table", { class: "rs-tbl rs-jp-hist" },
      h("thead", null, h("tr", null, h("th", { class: "rs-y" }, "年"), h("th", { class: "rs-m" }, "月"), h("th", null, "免許・資格"))),
      h("tbody", null, ...(certs.length ? certs : [{ date: "", name: "" }]).map((c) => {
        const [y, m] = c.date ? ymCells(c.date, r.era) : ["", ""];
        return h("tr", null, td(y, "rs-y"), td(m, "rs-m"), td(c.name));
      }))),
    h("div", { class: "rs-jp-box" }, h("p", { class: "rs-jp-label" }, "志望の動機、特技、好きな学科、アピールポイントなど"), h("p", { class: "rs-p" }, r.motivation.trim())),
    h("div", { class: "rs-jp-box" }, h("p", { class: "rs-jp-label" }, "本人希望記入欄（特に給料・職種・勤務時間・勤務地・その他についての希望などがあれば記入）"), h("p", { class: "rs-p" }, r.wishes.trim())),
  );
}

/** 職務経歴書: free-form, the usual headings (職務要約, 職務経歴, 活かせる経験・知識・スキル, 資格, 自己PR). */
function renderShokumu(r: Resume): HTMLElement {
  const b = r.basics;
  const jp = (title: string, ...kids: Kid[]) => h("section", { class: "rs-sec" }, h("p", { class: "rs-h" }, `■${title}`), ...kids);
  const jobs = r.experience.filter((e) => e.org || e.role);
  const certs = r.certs.filter((c) => c.name);
  const skills = [...lines(r.skills), ...lines(r.languages)];
  return h("div", { class: "rs rs-cv rs-shokumu" },
    h("p", { class: "rs-jp-title rs-center" }, "職務経歴書"),
    h("p", { class: "rs-end" }, asOfEl(r, "ja", "現在")),
    h("p", { class: "rs-end" }, `氏名　${b.name}`),
    r.summary.trim() ? jp("職務要約", h("p", { class: "rs-p" }, r.summary.trim())) : null,
    jobs.length ? jp("職務経歴", ...jobs.map((e) => h("div", { class: "rs-entry" },
      h("p", { class: "rs-row" }, h("span", { class: "rs-what" }, h("b", null, e.org)), h("span", { class: "rs-date" }, range(e.start, e.end, e.current, "ja", r.era))),
      e.role ? h("p", { class: "rs-p" }, e.role) : null,
      bullets(e.details)))) : null,
    skills.length ? jp("活かせる経験・知識・スキル", h("ul", { class: "rs-ul" }, ...skills.map((s) => h("li", null, s)))) : null,
    certs.length ? jp("資格", h("ul", { class: "rs-ul" }, ...certs.map((c) => h("li", null, c.date ? `${formatYm(c.date, "ja", r.era)}　${c.name}` : c.name)))) : null,
    r.motivation.trim() ? jp("自己PR", h("p", { class: "rs-p" }, r.motivation.trim())) : null,
  );
}

/** 이력서: the common Korean table form, closing with the signed statement. */
function renderKr(r: Resume): HTMLElement {
  const b = r.basics;
  const th = (text: string) => h("th", null, text);
  const grid = (head: string[], body: string[][]) => h("table", { class: "rs-tbl rs-kr-grid" },
    h("thead", null, h("tr", null, ...head.map(th))),
    h("tbody", null, ...(body.length ? body : [head.map(() => "")]).map((cells) => h("tr", null, ...cells.map((c) => td(c))))));
  const photo = h("td", { rowspan: "5", class: "rs-kr-photocell" }, photoEl(r, "사진\n3×4 cm", "rs-kr-photo"));
  const period = (s: string, e: string, cur: boolean) => range(s, e, cur, "ko", "seireki");
  const other: string[][] = [];
  if (r.skills.trim()) other.push(["보유 기술", lines(r.skills).join(", ")]);
  if (r.languages.trim()) other.push(["어학", lines(r.languages).join(", ")]);
  if (r.extra.trim()) other.push(["기타", r.extra.trim()]);
  return h("div", { class: "rs rs-kr" },
    h("p", { class: "rs-kr-title" }, "이 력 서"),
    h("p", { class: "rs-h" }, "인적사항"),
    h("table", { class: "rs-tbl rs-kr-person" }, h("tbody", null,
      h("tr", null, th("성명"), td(b.name), photo),
      h("tr", null, th("생년월일"), td(b.birth ? formatDate(b.birth, "ko") : "")),
      h("tr", null, th("연락처"), td(b.phone)),
      h("tr", null, th("이메일"), td(b.email)),
      h("tr", null, th("주소"), td(b.address)),
    )),
    b.title ? h("p", { class: "rs-p" }, `지원 분야: ${b.title}`) : null,
    h("p", { class: "rs-h" }, "학력사항"),
    grid(["기간", "학교명", "전공", "비고"], r.education.filter((e) => e.school).map((e) => [period(e.start, e.end, false), e.school, e.degree, e.details])),
    h("p", { class: "rs-h" }, "경력사항"),
    grid(["근무기간", "회사명", "직위", "담당업무"], r.experience.filter((e) => e.org).map((e) => [period(e.start, e.end, e.current), e.org, e.role, lines(e.details).join("\n")])),
    h("p", { class: "rs-h" }, "자격증"),
    grid(["취득일", "자격증명"], r.certs.filter((c) => c.name).map((c) => [formatYm(c.date, "ko"), c.name])),
    other.length ? h("p", { class: "rs-h" }, "기타사항") : null,
    other.length ? h("table", { class: "rs-tbl" }, h("tbody", null, ...other.map(([k, v]) => h("tr", null, th(k), td(v))))) : null,
    r.summary.trim() ? h("p", { class: "rs-h" }, "자기소개") : null,
    r.summary.trim() ? h("p", { class: "rs-p" }, r.summary.trim()) : null,
    h("p", { class: "rs-kr-oath" }, "위의 기재 사항은 사실과 틀림없습니다."),
    h("p", { class: "rs-center" }, asOfEl(r, "ko")),
    h("p", { class: "rs-end" }, `작성자 ${b.name} (인)`),
  );
}

/** The résumé document for a sheet. `loc` is the page language (the ATS / photo layouts print in it). */
export function renderResume(r: Resume, loc: string): HTMLElement {
  switch (r.format) {
    case "rirekisho": return renderRirekisho(r);
    case "shokumu": return renderShokumu(r);
    case "kr": return renderKr(r);
    case "photo": return renderCv(r, loc, true);
    default: return renderCv(r, loc, false);
  }
}

/** The language a layout is written in (for the sheet's lang attribute). */
export function docLangOf(r: Resume, loc: string): string {
  if (r.format === "rirekisho" || r.format === "shokumu") return "ja";
  if (r.format === "kr") return "ko";
  return loc;
}
