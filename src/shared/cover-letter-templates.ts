/**
 * The cover letter in each language's own format (not translations of one letter):
 * en / es cover letters, the Indonesian surat lamaran kerja, the Vietnamese đơn xin việc, the Japanese 送付状
 * (応募書類の送付状), the Korean 자기소개서, and the Chinese 求职信 / 求職信. Loaded with the tool only.
 */
import type { Locale } from "./locale";
import type { DocLine } from "./letter-doc";
import { dateParts, items, val, type BuiltLetter, type CoverData, type CoverTemplate } from "./cover-letter";

/** Lines in order; remembers which one is the date so the page can keep it out of the prerendered HTML. */
function lines(): { push: (line: DocLine, isDate?: boolean) => void; done: () => BuiltLetter["doc"]["lines"]; dateLine: () => number } {
  const out: DocLine[] = [];
  let date = -1;
  return {
    push: (line, isDate = false) => {
      if (isDate) date = out.length;
      out.push(line);
    },
    done: () => out,
    dateLine: () => date,
  };
}

const bullets = (list: string[], mark = "• ") => list.map((s) => `${mark}${s}`).join("\n");
const numbered = (list: string[]) => list.map((s, i) => `${i + 1}. ${s}`).join("\n");
const joinSentences = (parts: string[], sep = " ") => parts.filter(Boolean).join(sep);
/** The ticked enclosures, in list order. */
const picked = (tpl: { enclosures: readonly string[] }, d: CoverData) => d.enclosures.filter((i) => i < tpl.enclosures.length).map((i) => tpl.enclosures[i]);

/* ---------- English ---------- */

function article(word: string): string {
  if (word.startsWith("[")) return word;
  // By sound: "a European", "a one-person", "a university", "an hour", "an honest", "an MBA".
  if (/^(?:eu|ew|one\b|once|uni|use|usu|ura|uro)/i.test(word)) return `a ${word}`;
  if (/^(?:[aeiou]|hour|honest|heir)/i.test(word) || /^[FHLMNRSX](?:[A-Z]|$)/.test(word)) return `an ${word}`;
  return `a ${word}`;
}

function enDate(iso: string): string {
  const p = dateParts(iso);
  if (!p) return "[Date]";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(p.y, p.m - 1, p.d));
}

const en: CoverTemplate = {
  lang: "en",
  serif: false,
  fields: ["name", "address", "phone", "email", "date", "company", "manager", "companyAddress", "job", "source", "role", "years", "education", "achievements", "skills", "why", "availability"],
  keep: [],
  scenarios: true,
  editable: true,
  enclosures: [],
  defaultEnclosures: [],
  sample: {
    name: "Alex Morgan",
    birth: "",
    address: "Columbus, OH 43215",
    phone: "(614) 555-0142",
    email: "alex.morgan@example.com",
    place: "",
    date: "",
    company: "Brightside Foods",
    manager: "Jordan Lee",
    companyAddress: "200 Market Street\nColumbus, OH 43215",
    job: "Marketing Specialist",
    source: "your careers page",
    role: "marketing coordinator",
    years: "3",
    education: "a bachelor's degree in marketing from Ohio State University",
    achievements: "Planned and ran 12 email campaigns a year for a list of 40,000 customers\nGrew Instagram followers from 8,000 to 21,000 in 18 months\nCoordinated three product launches with the sales and design teams",
    skills: "email marketing, social media planning, Google Analytics and copywriting",
    why: "your products are on the shelves of the stores I shop at, and I would like to help more people find them",
    availability: "I can start with two weeks' notice.",
    growth: "", character: "", motive: "", plan: "",
  },
  body(d) {
    const job = val(d, "job", "[Job title]");
    const company = val(d, "company", "[Company]");
    const role = article(val(d, "role", "[your current job]"));
    const years = val(d, "years", "[number]");
    // "1 year", "1.5 years", "[number] years": only a lone 1 takes the singular.
    const yrs = `${years} ${/^0*1$/.test(years.trim()) ? "year" : "years"}`;
    const edu = val(d, "education", "[your degree or course]");
    const src = d.source.trim() ? `, as advertised on ${d.source.trim()}` : "";
    const open = {
      experienced: `I am writing to apply for the ${job} position at ${company}${src}. I have ${yrs} of experience as ${role}, and I would like to bring that experience to your team.`,
      graduate: `I am writing to apply for the ${job} position at ${company}${src}. I recently graduated with ${edu}, and I am ready to start my career in this field.`,
      internship: `I am writing to apply for the ${job} role at ${company}${src}. I am currently studying for ${edu}, and I am looking for practical experience in this field.`,
      change: `I am writing to apply for the ${job} position at ${company}${src}. After ${yrs} as ${role}, I am moving into this field, and many of the skills I built in that work apply directly to this role.`,
    }[d.scenario];
    const lead = { experienced: "Highlights of my experience:", graduate: "Highlights of my studies and projects:", internship: "Relevant coursework and projects:", change: "From my previous work, I bring:" }[d.scenario];
    const list = items(d.achievements);
    const skills = joinSentences([
      d.skills.trim() ? `My skills include ${d.skills.trim().replace(/[.。]$/, "")}.` : "",
      d.why.trim() ? `I am especially interested in ${company} because ${d.why.trim().replace(/[.。]$/, "")}.` : "",
    ]);
    const close = joinSentences([
      `I have attached my résumé and would welcome the chance to discuss how I can contribute to ${company}.`,
      d.availability.trim(),
      "Thank you for your time and consideration.",
    ]);
    return [open, list.length ? `${lead}\n${bullets(list)}` : "", skills, close].filter(Boolean);
  },
  doc(d, body) {
    const L = lines();
    L.push({ text: val(d, "name", "[Your name]"), bold: true, size: "title" });
    const contact = [d.address.trim(), [d.phone.trim(), d.email.trim()].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
    if (contact) L.push({ text: contact, size: "small" });
    L.push({ text: enDate(d.date), gap: 1 }, true);
    L.push({ text: [d.manager.trim(), val(d, "company", "[Company]"), d.companyAddress.trim()].filter(Boolean).join("\n"), gap: 1 });
    L.push({ text: `Dear ${d.manager.trim() || "Hiring Manager"},`, gap: 1 });
    body.forEach((p) => L.push({ text: p, gap: 1 }));
    L.push({ text: "Sincerely,", gap: 1 });
    L.push({ text: val(d, "name", "[Your name]"), gap: 2 });
    return { doc: { lines: L.done(), lang: "en" }, dateLine: L.dateLine() };
  },
};

/* ---------- Spanish ---------- */

function esDate(iso: string): string {
  const p = dateParts(iso);
  if (!p) return "[fecha]";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(p.y, p.m - 1, p.d));
}

const es: CoverTemplate = {
  lang: "es",
  serif: false,
  fields: ["name", "address", "phone", "email", "place", "date", "company", "manager", "companyAddress", "job", "source", "role", "years", "education", "achievements", "skills", "why", "availability"],
  keep: [],
  scenarios: true,
  editable: true,
  enclosures: [],
  defaultEnclosures: [],
  sample: {
    name: "Lucía Fernández Ruiz",
    birth: "",
    address: "Calle de Alcalá 120, 28009 Madrid",
    phone: "612 345 678",
    email: "lucia.fernandez@example.com",
    place: "Madrid",
    date: "",
    company: "Viajes Horizonte S.L.",
    manager: "Carmen Ortega",
    companyAddress: "Paseo de la Castellana 45\n28046 Madrid",
    job: "Agente de atención al cliente",
    source: "InfoJobs",
    role: "dependienta en una tienda de electrónica",
    years: "4",
    education: "el Grado en Turismo por la Universidad Complutense de Madrid",
    achievements: "Atendía a unos 60 clientes al día en tienda y por teléfono\nFormé a cinco compañeros nuevos en el sistema de devoluciones\nMantuve una valoración media de 4,8 sobre 5 en las encuestas de clientes",
    skills: "atención telefónica, gestión de reclamaciones, inglés (nivel B2) y manejo de CRM",
    why: "organizan viajes que yo misma he hecho con mi familia y conozco bien el tipo de cliente que tienen",
    availability: "Tengo disponibilidad inmediata.",
    growth: "", character: "", motive: "", plan: "",
  },
  body(d) {
    const job = val(d, "job", "[puesto]");
    const company = val(d, "company", "[empresa]");
    const role = val(d, "role", "[su puesto actual]");
    const years = val(d, "years", "[número]");
    const yrs = `${years} ${/^0*1$/.test(years.trim()) ? "año" : "años"}`;
    const edu = val(d, "education", "[sus estudios]");
    const src = d.source.trim() ? `, publicado en ${d.source.trim()}` : "";
    const open = {
      experienced: `Me dirijo a ustedes para presentar mi candidatura al puesto de ${job} en ${company}${src}. Cuento con ${yrs} de experiencia como ${role} y me gustaría aportar esa experiencia a su equipo.`,
      graduate: `Me dirijo a ustedes para presentar mi candidatura al puesto de ${job} en ${company}${src}. Recientemente he terminado ${edu} y quiero comenzar mi carrera profesional en este campo.`,
      internship: `Me dirijo a ustedes para solicitar una plaza de prácticas como ${job} en ${company}${src}. Actualmente curso ${edu} y busco adquirir experiencia práctica en este campo.`,
      change: `Me dirijo a ustedes para presentar mi candidatura al puesto de ${job} en ${company}${src}. Tras ${yrs} como ${role}, quiero dar el paso a este campo, y muchas de las habilidades que he desarrollado se aplican directamente a este puesto.`,
    }[d.scenario];
    const lead = { experienced: "Entre mis logros destacan:", graduate: "De mis estudios y proyectos destaco:", internship: "Asignaturas y proyectos relacionados:", change: "De mi experiencia anterior aporto:" }[d.scenario];
    const list = items(d.achievements);
    const skills = joinSentences([
      d.skills.trim() ? `Entre mis habilidades se encuentran ${d.skills.trim().replace(/\.$/, "")}.` : "",
      d.why.trim() ? `Me interesa especialmente ${company} porque ${d.why.trim().replace(/\.$/, "")}.` : "",
    ]);
    const close = joinSentences([
      "Adjunto mi currículum y quedo a su disposición para ampliar cualquier información en una entrevista.",
      d.availability.trim(),
      "Muchas gracias por su tiempo y consideración.",
    ]);
    return [open, list.length ? `${lead}\n${bullets(list)}` : "", skills, close].filter(Boolean);
  },
  doc(d, body) {
    const L = lines();
    L.push({ text: val(d, "name", "[Nombre y apellidos]"), bold: true, size: "title" });
    const contact = [d.address.trim(), [d.phone.trim(), d.email.trim()].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
    if (contact) L.push({ text: contact, size: "small" });
    L.push({ text: d.place.trim() ? `${d.place.trim()}, ${esDate(d.date)}` : esDate(d.date), align: "end", gap: 1 }, true);
    L.push({ text: [d.manager.trim(), val(d, "company", "[Empresa]"), d.companyAddress.trim()].filter(Boolean).join("\n"), gap: 1 });
    L.push({ text: `Asunto: candidatura al puesto de ${val(d, "job", "[puesto]")}`, bold: true, gap: 1 });
    L.push({ text: d.manager.trim() ? `Estimado/a ${d.manager.trim()}:` : "Estimado equipo de selección:", gap: 1 });
    body.forEach((p) => L.push({ text: p, gap: 1 }));
    L.push({ text: "Atentamente,", gap: 1 });
    L.push({ text: val(d, "name", "[Nombre y apellidos]"), gap: 2 });
    return { doc: { lines: L.done(), lang: "es" }, dateLine: L.dateLine() };
  },
};

/* ---------- Indonesian: surat lamaran kerja ---------- */

function idDate(iso: string): string {
  const p = dateParts(iso);
  if (!p) return "[tanggal]";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(p.y, p.m - 1, p.d));
}

const id: CoverTemplate = {
  lang: "id",
  serif: false,
  fields: ["name", "birth", "education", "address", "phone", "email", "place", "date", "company", "manager", "companyAddress", "job", "source", "role", "years", "achievements", "skills", "why", "availability"],
  keep: ["education"],
  scenarios: true,
  editable: true,
  enclosures: [
    "Daftar riwayat hidup (CV)",
    "Fotokopi ijazah dan transkrip nilai",
    "Fotokopi KTP",
    "Pas foto terbaru",
    "Fotokopi sertifikat pendukung",
    "Surat Keterangan Catatan Kepolisian (SKCK)",
    "Surat keterangan sehat",
  ],
  defaultEnclosures: [0, 1, 2, 3],
  sample: {
    name: "Rina Kartika Sari",
    birth: "Bandung, 14 Maret 2000",
    address: "Jl. Cempaka No. 21, Kebayoran Baru, Jakarta Selatan",
    phone: "0812-3456-7890",
    email: "rina.kartika@example.com",
    place: "Jakarta",
    date: "",
    company: "PT Sinar Niaga Utama",
    manager: "Manajer HRD",
    companyAddress: "",
    job: "Staf Administrasi",
    source: "situs Jobstreet",
    role: "staf administrasi gudang",
    years: "2",
    education: "S1 Manajemen, Universitas Padjadjaran",
    achievements: "Mengelola input data stok harian untuk lebih dari 300 jenis barang\nMenyusun laporan bulanan untuk kepala gudang\nMerapikan arsip surat jalan sehingga dokumen lebih mudah dicari",
    skills: "Microsoft Excel, pengarsipan dokumen, dan korespondensi kantor",
    why: "bidang usahanya sesuai dengan pengalaman saya di bagian administrasi",
    availability: "Saya siap bekerja penuh waktu dan dapat mulai bekerja segera.",
    growth: "", character: "", motive: "", plan: "",
  },
  body(d) {
    const company = val(d, "company", "[nama perusahaan]");
    const role = val(d, "role", "[jabatan]");
    const years = val(d, "years", "[jumlah]");
    const edu = val(d, "education", "[jurusan dan kampus]");
    const base = {
      experienced: `Saya memiliki pengalaman kerja selama ${years} tahun sebagai ${role}.`,
      graduate: `Saya adalah lulusan baru ${edu} dan siap memulai karier di bidang ini.`,
      internship: `Saat ini saya sedang menempuh pendidikan ${edu} dan ingin mendapatkan pengalaman kerja melalui program magang.`,
      change: `Saya memiliki pengalaman ${years} tahun sebagai ${role} dan kini ingin beralih ke bidang ini.`,
    }[d.scenario];
    const lead = { experienced: "Selama bekerja, saya:", graduate: "Selama masa studi, saya:", internship: "Selama kuliah, saya:", change: "Dari pekerjaan sebelumnya, saya membawa:" }[d.scenario];
    const list = items(d.achievements);
    const skills = joinSentences([
      d.skills.trim() ? `Saya menguasai ${d.skills.trim().replace(/\.$/, "")}.` : "",
      d.why.trim() ? `Saya tertarik bergabung dengan ${company} karena ${d.why.trim().replace(/\.$/, "")}.` : "",
      d.availability.trim(),
    ]);
    return [list.length ? `${base} ${lead}\n${bullets(list)}` : base, skills].filter(Boolean);
  },
  doc(d, body) {
    const L = lines();
    const files = picked(this, d);
    L.push({ text: d.place.trim() ? `${d.place.trim()}, ${idDate(d.date)}` : idDate(d.date), align: "end" }, true);
    L.push({ text: `Perihal: Lamaran Pekerjaan sebagai ${val(d, "job", "[posisi]")}\nLampiran: ${files.length ? `${files.length} berkas` : "-"}`, gap: 1 });
    L.push({ text: ["Kepada Yth.", `Bapak/Ibu ${d.manager.trim() || "Manajer HRD"}`, val(d, "company", "[nama perusahaan]"), d.companyAddress.trim() || "di Tempat"].join("\n"), gap: 1 });
    L.push({ text: "Dengan hormat,", gap: 1 });
    const company = val(d, "company", "[nama perusahaan]");
    const job = val(d, "job", "[posisi]");
    L.push({
      text: d.source.trim()
        ? `Berdasarkan informasi lowongan kerja dari ${d.source.trim()}, saya bermaksud melamar pekerjaan di ${company} sebagai ${job}. Saya yang bertanda tangan di bawah ini:`
        : `Melalui surat ini, saya bermaksud melamar pekerjaan di ${company} sebagai ${job}. Saya yang bertanda tangan di bawah ini:`,
      gap: 1,
    });
    L.push({
      text: "",
      table: [
        ["Nama", val(d, "name", "")],
        ["Tempat, tanggal lahir", val(d, "birth", "")],
        ["Pendidikan terakhir", val(d, "education", "")],
        ["Alamat", val(d, "address", "")],
        ["No. HP", val(d, "phone", "")],
        ["Email", val(d, "email", "")],
      ],
      gap: 1,
    });
    body.forEach((p) => L.push({ text: p, gap: 1 }));
    if (files.length) L.push({ text: `Sebagai bahan pertimbangan, saya lampirkan:\n${numbered(files)}`, gap: 1 });
    L.push({ text: "Demikian surat lamaran ini saya buat. Besar harapan saya untuk dapat diberikan kesempatan wawancara. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.", gap: 1 });
    L.push({ text: "Hormat saya,", gap: 1 });
    L.push({ text: val(d, "name", "[nama lengkap]"), gap: 3 });
    return { doc: { lines: L.done(), lang: "id" }, dateLine: L.dateLine() };
  },
};

/* ---------- Vietnamese: đơn xin việc ---------- */

/** "ngày 05 tháng 01 năm 2026": a day under 10 and the months January and February take a leading zero. */
function viDate(iso: string): string {
  const p = dateParts(iso);
  if (!p) return "ngày ..... tháng ..... năm ........";
  const day = p.d < 10 ? `0${p.d}` : String(p.d);
  const month = p.m < 3 ? `0${p.m}` : String(p.m);
  return `ngày ${day} tháng ${month} năm ${p.y}`;
}

const vi: CoverTemplate = {
  lang: "vi",
  serif: true,
  fields: ["name", "birth", "education", "address", "phone", "email", "place", "date", "company", "manager", "job", "source", "role", "years", "achievements", "skills", "why", "availability"],
  keep: ["education"],
  scenarios: true,
  editable: true,
  enclosures: [
    "Sơ yếu lý lịch",
    "Bản sao văn bằng, chứng chỉ",
    "Bản sao thẻ căn cước",
    "Giấy khám sức khỏe",
    "Ảnh 3x4",
  ],
  defaultEnclosures: [0, 1, 2],
  sample: {
    name: "Nguyễn Thị Lan",
    birth: "12/08/1999",
    address: "Số 15 ngõ 88 Trần Duy Hưng, Cầu Giấy, Hà Nội",
    phone: "0912 345 678",
    email: "nguyenthilan@example.com",
    place: "Hà Nội",
    date: "",
    company: "Công ty TNHH Thương mại Minh Phát",
    manager: "Ban Giám đốc và Phòng Nhân sự",
    companyAddress: "",
    job: "Nhân viên kế toán",
    source: "trang tuyển dụng của công ty",
    role: "kế toán viên",
    years: "3",
    education: "Cử nhân Kế toán, Học viện Tài chính",
    achievements: "Lập báo cáo thuế hằng tháng và quyết toán thuế cuối năm\nĐối chiếu công nợ với khoảng 50 nhà cung cấp\nSử dụng thành thạo phần mềm kế toán MISA",
    skills: "Excel, phần mềm MISA và tiếng Anh giao tiếp",
    why: "lĩnh vực hoạt động của Quý Công ty phù hợp với kinh nghiệm của tôi",
    availability: "",
    growth: "", character: "", motive: "", plan: "",
  },
  body(d) {
    const role = val(d, "role", "[vị trí]");
    const years = val(d, "years", "[số]");
    const edu = val(d, "education", "[chuyên ngành, trường]");
    const base = {
      experienced: `Tôi có ${years} năm kinh nghiệm làm ${role}.`,
      graduate: `Tôi vừa tốt nghiệp ${edu} và mong muốn bắt đầu sự nghiệp trong lĩnh vực này.`,
      internship: `Hiện tôi đang theo học ${edu} và mong muốn có cơ hội thực tập để tích lũy kinh nghiệm thực tế.`,
      change: `Tôi đã làm ${role} trong ${years} năm và đang chuyển sang lĩnh vực này.`,
    }[d.scenario];
    const lead = { experienced: "Trong quá trình làm việc, tôi đã:", graduate: "Trong thời gian học, tôi đã:", internship: "Trong thời gian học, tôi đã:", change: "Từ công việc trước, tôi có thể đóng góp:" }[d.scenario];
    const list = items(d.achievements);
    const skills = joinSentences([
      d.skills.trim() ? `Tôi có các kỹ năng: ${d.skills.trim().replace(/\.$/, "")}.` : "",
      d.why.trim() ? `Tôi mong muốn được làm việc tại Quý Công ty vì ${d.why.trim().replace(/\.$/, "")}.` : "",
      d.availability.trim(),
    ]);
    return [list.length ? `${base} ${lead}\n${bullets(list, "- ")}` : base, skills].filter(Boolean);
  },
  doc(d, body) {
    const L = lines();
    const files = picked(this, d);
    L.push({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập – Tự do – Hạnh phúc", align: "center", bold: true });
    L.push({ text: `${d.place.trim() || "........"}, ${viDate(d.date)}`, align: "end", gap: 1 }, true);
    L.push({ text: "ĐƠN XIN VIỆC", align: "center", bold: true, size: "title", gap: 1 });
    L.push({ text: `Kính gửi: ${d.manager.trim() || "Ban Giám đốc và Phòng Nhân sự"} ${val(d, "company", "[tên công ty]")}`, gap: 1 });
    const job = val(d, "job", "[vị trí]");
    L.push({
      text: d.source.trim()
        ? `Thông qua ${d.source.trim()}, tôi được biết Quý Công ty đang tuyển dụng vị trí ${job}. Tôi xin gửi đơn này để ứng tuyển vào vị trí trên. Thông tin về bản thân tôi như sau:`
        : `Tôi được biết Quý Công ty đang tuyển dụng vị trí ${job}. Tôi xin gửi đơn này để ứng tuyển vào vị trí trên. Thông tin về bản thân tôi như sau:`,
      gap: 1,
    });
    L.push({
      text: "",
      table: [
        ["Họ và tên", val(d, "name", "")],
        ["Ngày sinh", val(d, "birth", "")],
        ["Trình độ", val(d, "education", "")],
        ["Địa chỉ", val(d, "address", "")],
        ["Điện thoại", val(d, "phone", "")],
        ["Email", val(d, "email", "")],
      ],
      gap: 1,
    });
    body.forEach((p) => L.push({ text: p, gap: 1 }));
    if (files.length) L.push({ text: `Hồ sơ kèm theo gồm:\n${bullets(files, "- ")}`, gap: 1 });
    L.push({ text: "Nếu được tuyển dụng, tôi sẽ cố gắng hoàn thành tốt công việc được giao. Rất mong Quý Công ty xem xét và tạo điều kiện cho tôi được tham gia phỏng vấn. Tôi xin chân thành cảm ơn!", gap: 1 });
    L.push({ text: "Người làm đơn\n(Ký và ghi rõ họ tên)", align: "end", bold: true, gap: 1 });
    L.push({ text: val(d, "name", ""), align: "end", gap: 3 });
    return { doc: { lines: L.done(), lang: "vi", serif: true }, dateLine: L.dateLine() };
  },
};

/* ---------- Japanese: 送付状 ---------- */

function cjkDate(iso: string, blank: string, y = "年", m = "月", day = "日"): string {
  const p = dateParts(iso);
  if (!p) return blank;
  return `${p.y}${y}${p.m}${m}${p.d}${day}`;
}

const ja: CoverTemplate = {
  lang: "ja",
  serif: true,
  fields: ["name", "address", "phone", "email", "date", "company", "manager", "job", "source", "why"],
  keep: [],
  scenarios: false,
  editable: true,
  enclosures: ["履歴書　1通", "職務経歴書　1通", "ポートフォリオ　1部", "資格証明書の写し　1通"],
  defaultEnclosures: [0, 1],
  sample: {
    name: "山田 花子",
    birth: "",
    address: "〒150-0001\n東京都渋谷区神宮前1-2-3",
    phone: "090-1234-5678",
    email: "hanako.yamada@example.com",
    place: "",
    date: "",
    company: "株式会社みらい商事",
    manager: "人事部　採用ご担当者様",
    companyAddress: "",
    job: "営業職",
    source: "貴社採用サイト",
    role: "", years: "", education: "", achievements: "", skills: "",
    why: "前職では法人営業として5年間、新規顧客の開拓に取り組んでまいりました。この経験を貴社でも活かせるものと考えております。",
    availability: "",
    growth: "", character: "", motive: "", plan: "",
  },
  body(d) {
    const job = val(d, "job", "〇〇職");
    return [
      d.source.trim()
        // "貴社採用サイト" already names the company: do not write 貴社 twice.
        ? `このたび、${d.source.trim()}にて${d.source.includes("貴社") ? "" : "貴社の"}${job}の求人を拝見し、応募させていただきたく、応募書類をお送りいたします。`
        : `このたび、貴社の${job}の求人に応募させていただきたく、応募書類をお送りいたします。`,
      d.why.trim(),
      "ご多忙のところ恐縮ですが、ご検討のほどよろしくお願い申し上げます。",
    ].filter(Boolean);
  },
  doc(d, body) {
    const L = lines();
    const files = picked(this, d);
    L.push({ text: cjkDate(d.date, "　　年　　月　　日"), align: "end" }, true);
    L.push({ text: `${val(d, "company", "株式会社〇〇")}\n${d.manager.trim() || "人事部　採用ご担当者様"}`, gap: 1 });
    const sender = [d.address.trim(), val(d, "name", "氏名"), d.phone.trim() && `電話：${d.phone.trim()}`, d.email.trim() && `メール：${d.email.trim()}`].filter(Boolean).join("\n");
    L.push({ text: sender, align: "end", gap: 1 });
    L.push({ text: "応募書類の送付について", align: "center", bold: true, size: "title", gap: 1 });
    L.push({ text: "拝啓　時下ますますご清栄のこととお慶び申し上げます。", gap: 1 });
    body.forEach((p) => L.push({ text: p, indent: true }));
    L.push({ text: "敬具", align: "end" });
    if (files.length) {
      L.push({ text: "記", align: "center", gap: 1 });
      L.push({ text: files.join("\n"), align: "center", gap: 1 });
      L.push({ text: "以上", align: "end", gap: 1 });
    }
    return { doc: { lines: L.done(), lang: "ja", serif: true }, dateLine: L.dateLine() };
  },
};

/* ---------- Korean: 자기소개서 ---------- */

export const KO_SECTIONS = [
  ["growth", "성장과정"],
  ["character", "성격의 장단점"],
  ["motive", "지원동기"],
  ["plan", "입사 후 포부"],
] as const;

const ko: CoverTemplate = {
  lang: "ko",
  serif: false,
  fields: ["name", "phone", "email", "company", "job", "growth", "character", "motive", "plan"],
  keep: [],
  scenarios: false,
  editable: false,
  enclosures: [],
  defaultEnclosures: [],
  sample: {
    name: "김민지",
    birth: "",
    address: "",
    phone: "010-1234-5678",
    email: "minji.kim@example.com",
    place: "",
    date: "",
    company: "(주)한빛물산",
    manager: "",
    companyAddress: "",
    job: "경영지원 사무직",
    source: "",
    role: "", years: "", education: "", achievements: "", skills: "", why: "", availability: "",
    growth: "맞벌이 부모님 밑에서 자라며 중학생 때부터 동생 등하교와 집안일을 나눠 맡았습니다. 맡은 일은 끝까지 하는 습관이 이때 생겼습니다. 대학에서는 학생회 회계를 2년간 맡아 매달 예산 집행 내역을 정리해 공개했습니다.",
    character: "꼼꼼하게 확인하는 편이라 숫자가 틀리는 일이 적습니다. 다만 혼자 다시 확인하느라 시간이 걸릴 때가 있어, 지금은 마감 시간을 먼저 정해 두고 일합니다.",
    motive: "한빛물산이 최근 해외 거래처를 늘리면서 경영지원 업무가 늘어난 것을 채용 공고에서 보았습니다. 회계 동아리와 학생회 회계 경험을 살려 정확한 사무 처리로 도움이 되고 싶어 지원했습니다.",
    plan: "입사 후 1년 안에 회사의 결재와 정산 절차를 익혀 혼자 처리할 수 있도록 하겠습니다. 이후에는 반복되는 정산 업무를 엑셀 서식으로 정리해 팀의 업무 시간을 줄이는 데 기여하겠습니다.",
  },
  body: () => [],
  doc(d) {
    const L = lines();
    L.push({ text: "자기소개서", align: "center", bold: true, size: "title" });
    L.push({
      text: "",
      table: [
        ["지원 회사", val(d, "company", "")],
        ["지원 분야", val(d, "job", "")],
        ["성명", val(d, "name", "")],
        ["연락처", val(d, "phone", "")],
        ["이메일", val(d, "email", "")],
      ],
      gap: 1,
    });
    KO_SECTIONS.forEach(([key, label], i) => {
      L.push({ text: `${i + 1}. ${label}`, bold: true, gap: 1 });
      L.push({ text: d[key].trim() || "(내용을 입력하세요)" });
    });
    return { doc: { lines: L.done(), lang: "ko" }, dateLine: L.dateLine() };
  },
};

/* ---------- Chinese (simplified): 求职信 ---------- */

function zhBody(d: CoverData, trad: boolean): string[] {
  const T = (s: string, tw: string) => (trad ? tw : s);
  const job = val(d, "job", T("［应聘职位］", "［應徵職位］"));
  const company = val(d, "company", T("贵公司", "貴公司"));
  const role = val(d, "role", T("［目前职位］", "［目前職位］"));
  const years = val(d, "years", "［ ］");
  const edu = val(d, "education", T("［学校与专业］", "［學校與科系］"));
  const strip = (s: string) => s.trim().replace(/[。.]$/, "");
  const open = d.source.trim()
    ? T(`我在${d.source.trim()}上看到贵公司招聘${job}的信息，特此应聘。`, `我在${d.source.trim()}看到貴公司徵求${job}的職缺，特此寫信應徵。`)
    : T(`得知贵公司正在招聘${job}，特此应聘。`, `得知貴公司正在徵求${job}，特此寫信應徵。`);
  const intro = {
    experienced: T(`我目前担任${role}，有${years}年相关工作经验。`, `我目前擔任${role}，有${years}年相關工作經驗。`),
    graduate: T(`我毕业于${edu}，希望在这一领域开始自己的职业生涯。`, `我畢業於${edu}，希望在這個領域開始自己的職涯。`),
    internship: T(`我目前就读于${edu}，希望能获得在贵公司实习的机会。`, `我目前就讀${edu}，希望能有機會到貴公司實習。`),
    change: T(`我此前从事${role}工作${years}年，现希望转向这一领域，原有经验中有不少可以用在这个岗位上。`, `我先前從事${role}工作${years}年，現在希望轉換到這個領域，過去的經驗有不少能用在這個職位上。`),
  }[d.scenario];
  const lead = {
    experienced: T("在过去的工作中，我：", "在過去的工作中，我："),
    graduate: T("在校期间，我：", "在學期間，我："),
    internship: T("在校期间，我：", "在學期間，我："),
    change: T("从之前的工作中，我能带来：", "從之前的工作中，我能帶來："),
  }[d.scenario];
  const list = items(d.achievements);
  const skills = [
    d.skills.trim() ? T(`我掌握的技能包括${strip(d.skills)}。`, `我具備的技能包括${strip(d.skills)}。`) : "",
    d.why.trim() ? T(`我希望加入${company}，是因为${strip(d.why)}。`, `我希望加入${company}，是因為${strip(d.why)}。`) : "",
  ].join("");
  const close = T(
    `随信附上我的简历，期待有机会与您进一步沟通。${d.availability.trim()}感谢您在百忙之中阅读此信。`,
    `隨信附上我的履歷，盼能有機會與您進一步面談。${d.availability.trim()}感謝您撥冗閱讀。`,
  );
  return [open + intro, list.length ? `${lead}\n${numbered(list)}` : "", skills, close].filter(Boolean);
}

function zhContact(d: CoverData, trad: boolean): string {
  return [
    d.phone.trim() && `${trad ? "電話" : "电话"}：${d.phone.trim()}`,
    d.email.trim() && `${trad ? "電子郵件" : "邮箱"}：${d.email.trim()}`,
  ].filter(Boolean).join("\n");
}

const zhSample = (trad: boolean): Record<string, string> => trad
  ? {
    name: "林怡君",
    phone: "0912-345-678",
    email: "yijun.lin@example.com",
    company: "宏遠科技股份有限公司",
    job: "行政專員",
    source: "104人力銀行",
    role: "業務助理",
    years: "3",
    education: "國立政治大學企業管理學系",
    achievements: "負責每月約200筆訂單的建檔與出貨追蹤\n整理客戶資料，建立共用的聯絡清單\n協助籌辦年度客戶說明會，現場約150人",
    skills: "Excel、文書處理與基本英文書信",
    why: "貴公司重視流程與制度，與我過去的工作方式相近",
    availability: "",
  }
  : {
    name: "张伟",
    phone: "138 0013 8000",
    email: "zhangwei@example.com",
    company: "华信电子科技有限公司",
    job: "市场专员",
    source: "贵公司官网",
    role: "市场助理",
    years: "3",
    education: "南京大学市场营销专业",
    achievements: "负责公司公众号日常运营，粉丝从1万增长到3.5万\n策划并执行4场线下产品推广活动\n每月整理竞品价格与销量数据，形成报告",
    skills: "新媒体运营、活动策划与数据分析",
    why: "贵公司的产品我一直在用，也了解你们在消费电子领域的发展方向",
    availability: "",
  };

function zhTemplate(trad: boolean): CoverTemplate {
  const s = zhSample(trad);
  return {
    lang: trad ? "zh-TW" : "zh-CN",
    serif: true,
    fields: ["name", "phone", "email", "date", "company", "manager", "job", "source", "role", "years", "education", "achievements", "skills", "why", "availability"],
    keep: [],
    scenarios: true,
    editable: true,
    enclosures: [],
    defaultEnclosures: [],
    sample: {
      name: s.name, birth: "", address: "", phone: s.phone, email: s.email, place: "", date: "",
      company: s.company, manager: "", companyAddress: "", job: s.job, source: s.source,
      role: s.role, years: s.years, education: s.education, achievements: s.achievements, skills: s.skills, why: s.why,
      availability: s.availability, growth: "", character: "", motive: "", plan: "",
    },
    body: (d) => zhBody(d, trad),
    doc(d, body) {
      const L = lines();
      const name = val(d, "name", trad ? "［姓名］" : "［姓名］");
      L.push({ text: trad ? "求職信" : "求职信", align: "center", bold: true, size: "title" });
      if (trad) {
        L.push({ text: d.manager.trim() ? `${d.manager.trim()} 您好：` : "敬啟者：", gap: 1 });
        body.forEach((p) => L.push({ text: p, indent: true }));
        L.push({ text: "敬祝", indent: true, gap: 1 });
        L.push({ text: "商祺" });
        L.push({ text: `應徵者　${name}　敬上`, align: "end", gap: 1 });
      } else {
        L.push({ text: `尊敬的${d.manager.trim() || `${val(d, "company", "贵公司")}人力资源部负责人`}：`, gap: 1 });
        L.push({ text: "您好！", indent: true });
        body.forEach((p) => L.push({ text: p, indent: true }));
        L.push({ text: "此致", indent: true, gap: 1 });
        L.push({ text: "敬礼！" });
        L.push({ text: `求职人：${name}`, align: "end", gap: 1 });
      }
      const contact = zhContact(d, trad);
      if (contact) L.push({ text: contact, align: "end" });
      L.push({ text: cjkDate(d.date, "　　年　　月　　日"), align: "end" }, true);
      return { doc: { lines: L.done(), lang: trad ? "zh-TW" : "zh-CN", serif: true }, dateLine: L.dateLine() };
    },
  };
}

export const COVER_TEMPLATES: Record<Locale, CoverTemplate> = {
  en,
  es,
  id,
  vi,
  ja,
  ko,
  "zh-CN": zhTemplate(false),
  "zh-TW": zhTemplate(true),
};
