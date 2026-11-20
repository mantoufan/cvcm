/**
 * Resignation letter formats, one per site language, each written the way letters are written there (not translated
 * from English): the Japanese 退職届 / 退職願, the Korean 사직서 form, the Vietnamese đơn with its national motto, the
 * Indonesian surat pengunduran diri, the Chinese 辞职信 with 此致 敬礼 … Empty fields print as fill-in blanks, so an
 * untouched form is still a usable template.
 */
import type { Locale } from "./locale";
import { parseIso, type RlForm, type RlTemplate } from "./resignation-letter";
import { wareki } from "./resume";

const or = (value: string, blank: string): string => value.trim() || blank;
const opt = (value: string): string => value.trim();
const joinLines = (...parts: string[]): string => parts.filter((p) => p !== "").join("\n");

// ---------- English ----------

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function enDate(iso: string, blank: string): string {
  const p = parseIso(iso);
  return p ? `${EN_MONTHS[p[1] - 1]} ${p[2]}, ${p[0]}` : blank;
}

const en: RlTemplate = {
  lang: "en",
  kinds: [["letter", "Printed letter"], ["email", "Email"]],
  scenarios: [
    ["standard", "Standard (two weeks' notice)"],
    ["short", "Short and simple"],
    ["newJob", "Leaving for a new job"],
    ["personal", "Personal reasons"],
    ["immediate", "Effective immediately"],
    ["retirement", "Retirement"],
  ],
  fields: ["kind", "scenario", "name", "title", "company", "recipient", "recipientTitle", "lastDay", "date", "thanks", "handover"],
  fileStem: (f) => `resignation-letter-${f.name}`,
  build(f) {
    const name = or(f.name, "[Your name]");
    const title = or(f.title, "[Job title]");
    const company = or(f.company, "[Company name]");
    const last = enDate(f.lastDay, "[last working day]");
    const dear = `Dear ${or(f.recipient, "[Manager's name]")},`;
    const p: string[] = [];
    switch (f.scenario) {
      case "short":
        p.push(`I am writing to resign from my position as ${title} at ${company}. My last day will be ${last}.`);
        if (f.thanks) p.push("Thank you for the opportunity and for your support.");
        break;
      case "newJob":
        p.push(`Please accept this letter as notice of my resignation from my position as ${title} at ${company}. I have accepted a role with another organization, and my last day will be ${last}.`);
        if (f.thanks) p.push(`This was not an easy decision. I am grateful for everything I have learned at ${company} and for the support you and the team have given me.`);
        break;
      case "personal":
        p.push(`I am writing to let you know that I am resigning from my position as ${title} at ${company} for personal reasons. My last day will be ${last}.`);
        if (f.thanks) p.push("Thank you for your understanding, and for the support you have given me during my time here.");
        break;
      case "immediate":
        p.push(f.lastDay
          ? `Please accept this letter as notice of my resignation from my position as ${title} at ${company}, effective ${last}. I am sorry that I cannot give the usual notice.`
          : `Please accept this letter as notice of my resignation from my position as ${title} at ${company}, effective immediately. I am sorry that I cannot give the usual notice.`);
        if (f.thanks) p.push("Thank you for the opportunities I have had here.");
        break;
      case "retirement":
        p.push(`I am writing to let you know that I will retire from my position as ${title} at ${company}. My last day of work will be ${last}.`);
        if (f.thanks) p.push(`My years at ${company} have meant a great deal to me. Thank you for the trust you have placed in me and for the colleagues I have had the pleasure of working with.`);
        break;
      default:
        p.push(`Please accept this letter as formal notice of my resignation from my position as ${title} at ${company}. My last day will be ${last}.`);
        if (f.thanks) p.push("Thank you for the opportunities I have had here. I have learned a great deal, and I am grateful for your support.");
    }
    if (f.handover) {
      p.push(f.scenario === "short" || f.scenario === "immediate"
        ? "I will do what I can to hand over my work. Please let me know how I can help."
        : "Before I leave, I will finish my current work and hand over my responsibilities. Please let me know how I can help make the transition smooth.");
    }
    if (f.kind === "email") {
      return {
        head: [{ text: `Subject: Resignation – ${name}`, bold: true }, { text: dear, gap: 1 }],
        body: p.join("\n\n"),
        tail: [{ text: "Best regards,", gap: 1 }, { text: name }],
      };
    }
    const to = joinLines(opt(f.recipient), opt(f.recipientTitle), opt(f.company)) || "[Manager's name]\n[Title]\n[Company name]";
    return {
      head: [{ text: name }, { text: enDate(f.date, "[Date]"), gap: 1 }, { text: to, gap: 1 }, { text: dear, gap: 1 }],
      body: p.join("\n\n"),
      tail: [{ text: "Sincerely,", gap: 1 }, { text: name, gap: 2 }],
    };
  },
};

// ---------- Japanese ----------

const KANJI_DIGITS = "〇一二三四五六七八九";

/** 1–99 as 縦書き kanji (十一, 二十); a western year digit by digit (二〇二六). */
function kanjiNumber(n: number, digitwise = false): string {
  if (digitwise || n >= 100) return String(n).split("").map((d) => KANJI_DIGITS[Number(d)]).join("");
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens > 1 ? KANJI_DIGITS[tens] : ""}${tens ? "十" : ""}${ones ? KANJI_DIGITS[ones] : ""}` || "〇";
}

/** A Japanese date. Vertical letters write kanji numerals: Arabic digits would lie on their side in a column. */
function jaDate(iso: string, f: RlForm): string {
  const p = parseIso(iso);
  if (!p) return f.era === "wareki" ? "令和　　年　　月　　日" : "　　　　年　　月　　日";
  // Any era, to the day (a back-dated 2019-04-30 is 平成31年), from the résumé builder's era table.
  const era = f.era === "wareki" ? wareki({ y: p[0], m: p[1], d: p[2] }) : null;
  if (f.vertical) {
    const year = era ? `${era.era}${era.year === "元" ? "元" : kanjiNumber(Number(era.year))}` : kanjiNumber(p[0], true);
    return `${year}年${kanjiNumber(p[1])}月${kanjiNumber(p[2])}日`;
  }
  const year = era ? `${era.era}${era.year}` : String(p[0]);
  return `${year}年${p[1]}月${p[2]}日`;
}

const ja: RlTemplate = {
  lang: "ja",
  serif: true,
  kinds: [["todoke", "退職届"], ["negai", "退職願"]],
  scenarios: [],
  fields: ["kind", "vertical", "era", "department", "name", "company", "recipientTitle", "recipient", "lastDay", "date"],
  fileStem: (f) => `${f.kind === "negai" ? "退職願" : "退職届"}-${f.name}`,
  build(f) {
    const title = f.kind === "negai" ? "退職願" : "退職届";
    const last = jaDate(f.lastDay, f);
    // 退職届 states the decision; 退職願 asks for consent. The reason is always 一身上の都合 for one's own resignation.
    const body = f.kind === "negai"
      ? `このたび一身上の都合により、${last}をもって退職いたしたく、ここにお願い申し上げます。`
      : `このたび一身上の都合により、${last}をもって退職いたします。`;
    const sender = `${or(f.department, "〇〇部")}　${or(f.name, "〇〇　〇〇")}　印`;
    const to = `${or(f.company, "株式会社〇〇")}\n${or(f.recipientTitle, "代表取締役社長")}　${or(f.recipient, "〇〇　〇〇")}　殿`;
    const date = jaDate(f.date, f);
    if (f.vertical) {
      // 縦書き: title, 私儀 at the foot, the body, the date, the sender at the foot, the addressee at the head.
      return {
        head: [{ text: title, size: "title", bold: true, align: "center" }, { text: "私儀", align: "end", gap: 1 }],
        body,
        indentBody: true,
        tail: [{ text: date, gap: 1, indent: true }, { text: sender, align: "end" }, { text: to, gap: 1 }],
      };
    }
    // 横書き: title, the date and sender at the right, the addressee at the left, then 私儀, the body and 以上.
    return {
      head: [
        { text: title, size: "title", bold: true, align: "center" },
        { text: date, align: "end", gap: 1 },
        { text: to, gap: 1 },
        { text: sender, align: "end", gap: 1 },
        { text: "私儀", gap: 1 },
      ],
      body,
      indentBody: true,
      tail: [{ text: "以上", align: "end", gap: 1 }],
    };
  },
};

// ---------- Chinese (simplified) ----------

function zhDate(iso: string): string {
  const p = parseIso(iso);
  return p ? `${p[0]}年${p[1]}月${p[2]}日` : "____年__月__日";
}

const ZH_CN_REASONS: Record<string, string> = {
  personal: "个人原因",
  career: "个人职业发展规划",
  family: "家庭原因",
  health: "身体原因",
  study: "计划继续深造",
};

const zhCN: RlTemplate = {
  lang: "zh-CN",
  serif: true,
  kinds: [["letter", "辞职信"], ["application", "离职申请书"]],
  scenarios: [["personal", "个人原因"], ["career", "职业发展"], ["family", "家庭原因"], ["health", "身体原因"], ["study", "继续深造"]],
  fields: ["kind", "scenario", "name", "department", "title", "company", "recipient", "lastDay", "date", "thanks", "handover"],
  fileStem: (f) => `${f.kind === "application" ? "离职申请书" : "辞职信"}-${f.name}`,
  build(f) {
    const app = f.kind === "application";
    const reason = ZH_CN_REASONS[f.scenario] ?? ZH_CN_REASONS.personal;
    const who = `${or(f.department, "____部门")}的${or(f.name, "____")}`;
    const p: string[] = [
      `我是${who}，目前担任${or(f.title, "____")}一职。因${reason}，经过慎重考虑，我决定辞去在${or(f.company, "公司")}的工作，${app ? "现正式提出离职申请" : "特此提出辞职"}。`,
      `我的最后工作日拟定为${zhDate(f.lastDay)}。`,
    ];
    if (f.handover) p[1] += "在此之前，我会站好最后一班岗，完成手头工作并做好交接，确保工作顺利过渡。";
    if (f.thanks) p.push("感谢公司和领导一直以来的培养与信任，在这里工作的经历让我收获良多。给您和公司带来的不便，敬请谅解。祝公司发展越来越好！");
    return {
      head: [
        { text: app ? "离职申请书" : "辞职信", size: "title", bold: true, align: "center" },
        { text: `尊敬的${or(f.recipient, "领导")}：`, gap: 1 },
        { text: "您好！", indent: true },
      ],
      body: p.join("\n\n"),
      indentBody: true,
      tail: [
        { text: "此致", indent: true, gap: 1 },
        { text: "敬礼！" },
        { text: `${app ? "申请人" : "辞职人"}：${or(f.name, "________")}`, align: "end", gap: 1 },
        { text: zhDate(f.date), align: "end" },
      ],
    };
  },
};

// ---------- Chinese (Taiwan) ----------

/** 民國 year (1912 = 民國元年). */
function twDate(iso: string): string {
  const p = parseIso(iso);
  if (!p) return "____年__月__日";
  const roc = p[0] - 1911;
  return `${roc === 1 ? "元" : roc}年${p[1]}月${p[2]}日`;
}

const ZH_TW_REASONS: Record<string, string> = {
  personal: "個人生涯規劃",
  career: "個人職涯發展",
  family: "家庭因素",
  health: "健康因素",
  study: "計畫進修",
};

const zhTW: RlTemplate = {
  lang: "zh-TW",
  serif: true,
  kinds: [["letter", "辭職信"], ["application", "離職申請書"]],
  scenarios: [["personal", "生涯規劃"], ["career", "職涯發展"], ["family", "家庭因素"], ["health", "健康因素"], ["study", "進修"]],
  fields: ["kind", "scenario", "name", "department", "title", "company", "recipient", "startDate", "lastDay", "date", "thanks", "handover"],
  fileStem: (f) => `${f.kind === "application" ? "離職申請書" : "辭職信"}-${f.name}`,
  build(f) {
    const app = f.kind === "application";
    const reason = ZH_TW_REASONS[f.scenario] ?? ZH_TW_REASONS.personal;
    const p: string[] = [
      `我是${or(f.department, "____部")}的${or(f.name, "____")}，目前擔任${or(f.title, "____")}。因${reason}，經慎重考慮後，決定辭去目前的職務，${app ? "特此提出離職申請" : "特此請辭"}，預計最後工作日為${twDate(f.lastDay)}。`,
    ];
    if (f.handover) p.push("離職前我會完成手邊的工作並妥善交接，如有需要協助的地方，請隨時告訴我。");
    if (f.thanks) p.push("感謝公司與主管這段時間的照顧與栽培，讓我學到許多。造成不便之處，敬請見諒。");
    return {
      head: [
        { text: app ? "離職申請書" : "辭職信", size: "title", bold: true, align: "center" },
        { text: `${or(f.recipient, "主管")}您好：`, gap: 1 },
      ],
      body: p.join("\n\n"),
      indentBody: true,
      tail: [
        { text: "此致", indent: true, gap: 1 },
        { text: or(f.company, "____公司") },
        { text: `${app ? "申請人" : ""}${or(f.name, "________")}　敬上`, align: "end", gap: 1 },
        { text: `中華民國${twDate(f.date)}`, align: "end" },
      ],
    };
  },
};

// ---------- Korean ----------

function koDate(iso: string): string {
  const p = parseIso(iso);
  return p ? `${p[0]}년 ${p[1]}월 ${p[2]}일` : "      년    월    일";
}

const KO_REASONS: Record<string, string> = {
  personal: "개인 사정",
  career: "이직",
  family: "가정 사정",
  health: "건강상의 이유",
  study: "학업 계속",
};

const ko: RlTemplate = {
  lang: "ko",
  kinds: [["form", "사직서"]],
  scenarios: [["personal", "개인 사정"], ["career", "이직"], ["family", "가정 사정"], ["health", "건강"], ["study", "학업"]],
  fields: ["scenario", "name", "department", "title", "company", "startDate", "lastDay", "date", "handover"],
  fileStem: (f) => `사직서-${f.name}`,
  build(f) {
    const p = [`상기 본인은 위와 같은 사유로 ${f.lastDay ? `${koDate(f.lastDay)}부로` : "퇴사 예정일에"} 사직하고자 하오니 허가하여 주시기 바랍니다.`];
    if (f.handover) p.push("퇴사일까지 담당 업무를 후임자에게 성실히 인계하겠습니다.");
    return {
      head: [
        { text: "사  직  서", size: "title", bold: true, align: "center" },
        {
          text: "",
          gap: 1,
          table: [
            ["소속", opt(f.department)],
            ["직위", opt(f.title)],
            ["성명", opt(f.name)],
            ["입사일", f.startDate ? koDate(f.startDate) : ""],
            ["퇴사 예정일", f.lastDay ? koDate(f.lastDay) : ""],
            ["사직 사유", KO_REASONS[f.scenario] ?? KO_REASONS.personal],
          ],
        },
      ],
      body: p.join("\n\n"),
      tail: [
        { text: koDate(f.date), align: "center", gap: 2 },
        { text: `신청인 : ${or(f.name, "            ")}  (인)`, align: "end", gap: 1 },
        { text: `${or(f.company, "주식회사 ○○○")} 대표이사 귀하`, bold: true, gap: 2 },
      ],
    };
  },
};

// ---------- Vietnamese ----------

function viDate(iso: string): string {
  const p = parseIso(iso);
  return p ? `ngày ${String(p[2]).padStart(2, "0")} tháng ${String(p[1]).padStart(2, "0")} năm ${p[0]}` : "ngày ..... tháng ..... năm ......";
}

const VI_REASONS: Record<string, string> = {
  personal: "lý do cá nhân",
  career: "muốn theo đuổi định hướng nghề nghiệp mới",
  family: "hoàn cảnh gia đình",
  health: "lý do sức khỏe",
  study: "muốn tiếp tục học tập",
};

const vi: RlTemplate = {
  lang: "vi",
  kinds: [["letter", "Đơn xin nghỉ việc"]],
  scenarios: [["personal", "Lý do cá nhân"], ["career", "Định hướng nghề nghiệp mới"], ["family", "Hoàn cảnh gia đình"], ["health", "Sức khỏe"], ["study", "Tiếp tục học tập"]],
  fields: ["scenario", "place", "name", "title", "department", "company", "recipient", "lastDay", "date", "thanks", "handover"],
  fileStem: (f) => `don-xin-nghi-viec-${f.name}`,
  build(f) {
    const reason = VI_REASONS[f.scenario] ?? VI_REASONS.personal;
    const p = [`Nay tôi làm đơn này xin được nghỉ việc kể từ ${f.lastDay ? viDate(f.lastDay) : "ngày ..... tháng ..... năm ......"} vì ${reason}.`];
    if (f.handover) p.push("Trong thời gian chờ Ban Giám đốc xem xét, tôi sẽ hoàn thành các công việc đang đảm nhận và bàn giao đầy đủ cho người được phân công.");
    if (f.thanks) p.push("Tôi xin chân thành cảm ơn Ban Giám đốc và các anh chị đồng nghiệp đã tạo điều kiện, giúp đỡ tôi trong thời gian làm việc tại công ty.");
    p.push("Kính mong Ban Giám đốc xem xét và chấp thuận. Tôi xin trân trọng cảm ơn!");
    return {
      head: [
        { text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, align: "center" },
        { text: "Độc lập – Tự do – Hạnh phúc", bold: true, align: "center" },
        { text: `${or(f.place, "..........")}, ${viDate(f.date)}`, align: "end", gap: 1 },
        { text: "ĐƠN XIN NGHỈ VIỆC", size: "title", bold: true, align: "center", gap: 1 },
        { text: `Kính gửi: ${or(f.recipient, `Ban Giám đốc ${or(f.company, "Công ty ..........")}`)}`, bold: true, gap: 1 },
        {
          text: joinLines(
            `Tôi tên là: ${or(f.name, "..............................")}`,
            `Chức vụ: ${or(f.title, "..............................")}`,
            `Bộ phận: ${or(f.department, "..............................")}`,
          ),
          gap: 1,
        },
      ],
      body: p.join("\n\n"),
      tail: [
        { text: "Người làm đơn", bold: true, align: "end", gap: 1 },
        { text: "(Ký và ghi rõ họ tên)", size: "small", align: "end" },
        { text: opt(f.name), align: "end", gap: 3 },
      ],
    };
  },
};

// ---------- Indonesian ----------

const ID_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function idDate(iso: string, blank: string): string {
  const p = parseIso(iso);
  return p ? `${p[2]} ${ID_MONTHS[p[1] - 1]} ${p[0]}` : blank;
}

const ID_REASONS: Record<string, string> = {
  personal: "alasan pribadi",
  career: "ingin mengembangkan karier di tempat lain",
  family: "alasan keluarga",
  health: "alasan kesehatan",
  study: "akan melanjutkan studi",
};

const id: RlTemplate = {
  lang: "id",
  kinds: [["letter", "Surat pengunduran diri"]],
  scenarios: [["personal", "Alasan pribadi"], ["career", "Pengembangan karier"], ["family", "Alasan keluarga"], ["health", "Alasan kesehatan"], ["study", "Melanjutkan studi"]],
  fields: ["scenario", "place", "name", "title", "department", "company", "recipientTitle", "recipient", "lastDay", "date", "thanks", "handover"],
  fileStem: (f) => `surat-pengunduran-diri-${f.name}`,
  build(f) {
    const company = or(f.company, "PT ..........");
    const to = joinLines(
      "Kepada Yth.",
      [opt(f.recipientTitle), opt(f.recipient)].filter(Boolean).join(" ") || "Bapak/Ibu Pimpinan",
      company,
      "di Tempat",
    );
    const p = [
      `Dengan ini saya mengajukan pengunduran diri dari jabatan saya sebagai ${or(f.title, "..........")} di ${company}, terhitung mulai tanggal ${idDate(f.lastDay, "..........")}. Keputusan ini saya ambil karena ${ID_REASONS[f.scenario] ?? ID_REASONS.personal}.`,
    ];
    if (f.handover) p.push("Sebelum hari terakhir saya, saya akan menyelesaikan pekerjaan yang menjadi tanggung jawab saya dan melakukan serah terima dengan baik.");
    if (f.thanks) p.push(`Saya mengucapkan terima kasih atas kesempatan dan pengalaman berharga selama bekerja di ${company}. Saya juga memohon maaf atas segala kekurangan selama masa kerja saya.`);
    p.push("Demikian surat pengunduran diri ini saya buat dengan sebenar-benarnya. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.");
    return {
      head: [
        { text: `${or(f.place, "..........")}, ${idDate(f.date, "..........")}`, align: "end" },
        { text: to, gap: 1 },
        { text: "Perihal: Pengunduran Diri", bold: true, gap: 1 },
        { text: "Dengan hormat,", gap: 1 },
        { text: "Yang bertanda tangan di bawah ini:", gap: 1 },
        { text: "", table: [["Nama", opt(f.name)], ["Jabatan", opt(f.title)], ["Divisi", opt(f.department)]] },
      ],
      body: p.join("\n\n"),
      tail: [
        { text: "Hormat saya,", align: "end", gap: 1 },
        { text: or(f.name, ".............................."), align: "end", gap: 3 },
      ],
    };
  },
};

// ---------- Spanish ----------

const ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function esDate(iso: string, blank: string): string {
  const p = parseIso(iso);
  return p ? `${p[2]} de ${ES_MONTHS[p[1] - 1]} de ${p[0]}` : blank;
}

const ES_REASONS: Record<string, string> = {
  personal: "motivos personales",
  career: "una nueva oportunidad profesional",
  family: "motivos familiares",
  health: "motivos de salud",
  study: "la decisión de continuar mis estudios",
};

const es: RlTemplate = {
  lang: "es",
  kinds: [["letter", "Carta de renuncia"]],
  scenarios: [["personal", "Motivos personales"], ["career", "Nueva oportunidad profesional"], ["family", "Motivos familiares"], ["health", "Motivos de salud"], ["study", "Continuar estudios"]],
  fields: ["scenario", "place", "name", "title", "company", "recipient", "recipientTitle", "lastDay", "date", "thanks", "handover"],
  fileStem: (f) => `carta-de-renuncia-${f.name}`,
  build(f) {
    const company = or(f.company, "[nombre de la empresa]");
    const to = joinLines(opt(f.recipient), opt(f.recipientTitle), opt(f.company)) || "[Nombre del destinatario]\n[Cargo]\n[Empresa]";
    const p = [
      `Por medio de la presente le comunico mi decisión de renunciar voluntariamente a mi puesto de ${or(f.title, "[puesto]")} en ${company}, con efecto a partir del ${esDate(f.lastDay, "[fecha]")}. Tomo esta decisión por ${ES_REASONS[f.scenario] ?? ES_REASONS.personal}.`,
    ];
    if (f.handover) p.push("Durante el periodo de preaviso me comprometo a terminar mis tareas pendientes y a facilitar el traspaso de mis funciones.");
    if (f.thanks) p.push("Quiero agradecerle la confianza que ha depositado en mí y las oportunidades de crecimiento profesional que he tenido durante este tiempo.");
    p.push("Le ruego que acuse recibo de esta carta.");
    return {
      head: [
        { text: `${or(f.place, "[Ciudad]")}, a ${esDate(f.date, "[fecha]")}`, align: "end" },
        { text: to, gap: 1 },
        { text: "Asunto: renuncia voluntaria", bold: true, gap: 1 },
        { text: `Estimado/a ${or(f.recipient, "señor/a")}:`, gap: 1 },
      ],
      body: p.join("\n\n"),
      tail: [
        { text: "Atentamente,", gap: 1 },
        { text: or(f.name, "[Nombre y apellidos]"), gap: 3 },
      ],
    };
  },
};

export const RL_TEMPLATES: Record<Locale, RlTemplate> = { en, ja, "zh-CN": zhCN, "zh-TW": zhTW, ko, vi, id, es };

