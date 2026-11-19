/**
 * The example résumé each language opens with (fictional people; example.com addresses, 555-01xx and placeholder
 * numbers) and the section headings the document prints in that language. Part of the résumé tool chunk only.
 */
import { defaultFormat, type Resume } from "./resume";

export type DocHeadings = {
  summary: string;
  experience: string;
  education: string;
  skills: string;
  languages: string;
  certs: string;
  extra: string;
  present: string;
  birth: string;
  /** Joins date ranges: "Apr 2021 – Present". */
  dash: string;
  /** Put the summary after the other sections (Chinese 自我评价 closes the page). */
  summaryLast?: boolean;
};

export const DOC_HEADINGS: Record<string, DocHeadings> = {
  en: { summary: "Summary", experience: "Experience", education: "Education", skills: "Skills", languages: "Languages", certs: "Certifications", extra: "Additional information", present: "Present", birth: "Date of birth", dash: " – " },
  es: { summary: "Perfil profesional", experience: "Experiencia laboral", education: "Formación académica", skills: "Habilidades", languages: "Idiomas", certs: "Certificaciones", extra: "Información adicional", present: "Actualidad", birth: "Fecha de nacimiento", dash: " – " },
  id: { summary: "Ringkasan profil", experience: "Pengalaman kerja", education: "Pendidikan", skills: "Keahlian", languages: "Bahasa", certs: "Sertifikasi", extra: "Informasi tambahan", present: "Sekarang", birth: "Tanggal lahir", dash: " – " },
  ja: { summary: "職務要約", experience: "職歴", education: "学歴", skills: "スキル", languages: "語学", certs: "資格", extra: "その他", present: "現在", birth: "生年月日", dash: " ～ " },
  ko: { summary: "자기소개", experience: "경력사항", education: "학력사항", skills: "보유 기술", languages: "어학", certs: "자격증", extra: "기타", present: "현재", birth: "생년월일", dash: " ~ " },
  vi: { summary: "Mục tiêu nghề nghiệp", experience: "Kinh nghiệm làm việc", education: "Học vấn", skills: "Kỹ năng", languages: "Ngoại ngữ", certs: "Chứng chỉ", extra: "Thông tin thêm", present: "Nay", birth: "Ngày sinh", dash: " – " },
  "zh-CN": { summary: "自我评价", experience: "工作经历", education: "教育背景", skills: "专业技能", languages: "语言能力", certs: "证书", extra: "其他", present: "至今", birth: "出生年月", dash: " – ", summaryLast: true },
  "zh-TW": { summary: "個人簡介", experience: "工作經歷", education: "學歷", skills: "專業技能", languages: "語言能力", certs: "證照", extra: "其他", present: "迄今", birth: "出生日期", dash: " – " },
};

export function docHeadings(loc: string): DocHeadings {
  return DOC_HEADINGS[loc] ?? DOC_HEADINGS.en;
}

type Sample = Omit<Resume, "v" | "format" | "era"> & { era?: Resume["era"] };

const SAMPLES: Record<string, Sample> = {
  en: {
    basics: { name: "Jordan Lee", kana: "", title: "Marketing Manager", email: "jordan.lee@example.com", phone: "(555) 010-2345", address: "Austin, TX", links: "linkedin.com/in/jordanlee-example", birth: "", gender: "", asOf: "", photo: "" },
    summary: "Marketing manager with seven years in consumer brands. I plan campaigns end to end, from research and budget to launch and reporting, and I grew online sales 38% in my current role.",
    experience: [
      { role: "Marketing Manager", org: "Brightline Foods", place: "Austin, TX", start: "2021-03", end: "", current: true, details: "Lead a team of four and a $1.2M yearly budget across search, social and retail media\nRelaunched the online store with the product team; online sales grew 38% in 18 months\nCut cost per acquisition 22% by moving spend to the best-performing channels" },
      { role: "Marketing Coordinator", org: "Northwind Travel", place: "Dallas, TX", start: "2018-06", end: "2021-02", current: false, details: "Ran email campaigns to 250,000 subscribers with a 31% average open rate\nWrote and scheduled social posts for five destinations" },
    ],
    education: [{ school: "Lakeview State University", degree: "B.A. in Communication", place: "Dallas, TX", start: "2014-09", end: "2018-05", details: "" }],
    skills: "Campaign planning\nGoogle Ads and Meta Ads\nGoogle Analytics 4\nEmail marketing\nBudget management",
    languages: "English (native)\nSpanish (professional working)",
    certs: [{ date: "2022-10", name: "Google Ads Search Certification" }],
    motivation: "", wishes: "", extra: "",
  },
  es: {
    basics: { name: "Lucía Martínez García", kana: "", title: "Técnica de Recursos Humanos", email: "lucia.martinez@example.com", phone: "+34 600 000 000", address: "Madrid", links: "linkedin.com/in/luciamartinez-ejemplo", birth: "", gender: "", asOf: "", photo: "" },
    summary: "Técnica de Recursos Humanos con seis años de experiencia en selección y administración de personal. Gestiono procesos completos de contratación y he reducido el tiempo medio de cobertura de vacantes un 30 %.",
    experience: [
      { role: "Técnica de Recursos Humanos", org: "Grupo Alameda Logística", place: "Madrid", start: "2021-01", end: "", current: true, details: "Gestión de 120 procesos de selección al año para almacén y oficinas\nCoordinación de altas, bajas y contratos con la gestoría laboral\nPuesta en marcha de un plan de acogida para nuevas incorporaciones" },
      { role: "Auxiliar de Recursos Humanos", org: "Hoteles Brisa del Sur", place: "Málaga", start: "2018-09", end: "2020-12", current: false, details: "Publicación de ofertas y primera criba de candidaturas\nControl de horarios y vacaciones de 80 empleados" },
    ],
    education: [{ school: "Universidad del Valle Central", degree: "Grado en Relaciones Laborales y Recursos Humanos", place: "Madrid", start: "2014-09", end: "2018-06", details: "" }],
    skills: "Selección por competencias\nNóminas y Seguridad Social\nExcel avanzado\nEntrevistas estructuradas",
    languages: "Español (nativo)\nInglés (B2)",
    certs: [{ date: "2020-05", name: "Curso de Prevención de Riesgos Laborales (nivel básico)" }],
    motivation: "", wishes: "", extra: "",
  },
  id: {
    basics: { name: "Rizky Pratama", kana: "", title: "Staf Administrasi", email: "rizky.pratama@example.com", phone: "0812-0000-1234", address: "Jakarta Selatan", links: "linkedin.com/in/rizkypratama-contoh", birth: "", gender: "", asOf: "", photo: "" },
    summary: "Staf administrasi dengan pengalaman 4 tahun mengelola dokumen, jadwal, dan laporan keuangan sederhana. Teliti, terbiasa bekerja dengan tenggat waktu, dan mahir Microsoft Excel.",
    experience: [
      { role: "Staf Administrasi", org: "PT Sinar Mandiri Logistik", place: "Jakarta", start: "2022-02", end: "", current: true, details: "Mengelola arsip kontrak dan surat masuk-keluar untuk 3 divisi\nMenyusun laporan biaya operasional bulanan di Excel\nMengatur jadwal rapat dan perjalanan dinas direksi" },
      { role: "Admin Gudang", org: "CV Berkah Abadi", place: "Bekasi", start: "2020-07", end: "2022-01", current: false, details: "Mencatat stok masuk dan keluar harian\nMembuat surat jalan dan faktur pengiriman" },
    ],
    education: [{ school: "Universitas Nusa Bangsa", degree: "S1 Manajemen", place: "Jakarta", start: "2016-08", end: "2020-06", details: "IPK 3,45" }],
    skills: "Microsoft Excel (VLOOKUP, pivot table)\nPengarsipan dokumen\nPembukuan sederhana\nKomunikasi",
    languages: "Bahasa Indonesia (penutur asli)\nBahasa Inggris (menengah)",
    certs: [{ date: "2021-09", name: "Sertifikasi Microsoft Office Specialist: Excel" }],
    motivation: "", wishes: "", extra: "",
  },
  ja: {
    era: "seireki",
    basics: { name: "山田 花子", kana: "やまだ はなこ", title: "法人営業", email: "hanako.yamada@example.com", phone: "090-0000-1234", address: "東京都新宿区西新宿1-2-3", links: "", birth: "1996-04-12", gender: "", asOf: "", photo: "" },
    summary: "大学卒業後、株式会社みどり商事にて法人営業として約6年間、オフィス用品の新規開拓と既存顧客の深耕に従事してまいりました。2023年度は担当エリア売上目標の124％を達成しています。",
    experience: [
      { role: "法人営業", org: "株式会社みどり商事", place: "東京都千代田区", start: "2019-04", end: "", current: true, details: "営業部に配属、中小企業向けにオフィス用品の提案営業を担当\n2022年4月 主任に昇格、後輩3名の指導を担当" },
    ],
    education: [
      { school: "東京都立青葉高等学校", degree: "", place: "", start: "2012-04", end: "2015-03", details: "" },
      { school: "桜ヶ丘大学", degree: "経済学部 経営学科", place: "", start: "2015-04", end: "2019-03", details: "" },
    ],
    skills: "法人向け提案営業（新規開拓・既存深耕）\nExcel（関数・ピボットテーブル）、PowerPoint\n営業チームのマネジメント補佐",
    languages: "英語（日常会話レベル）",
    certs: [
      { date: "2016-08", name: "普通自動車第一種運転免許 取得" },
      { date: "2018-06", name: "日商簿記検定試験2級 合格" },
      { date: "2018-12", name: "TOEIC Listening & Reading Test 750点 取得" },
    ],
    motivation: "顧客の課題に寄り添う提案営業を強みとしています。貴社の業務改善ソリューションは、私がこれまで中小企業のお客様から伺ってきた課題に直接応えるものであり、これまでの経験を活かして事業の拡大に貢献したいと考え、志望いたしました。",
    wishes: "貴社の規定に従います。",
    extra: "",
  },
  ko: {
    basics: { name: "김민준", kana: "", title: "마케팅", email: "minjun.kim@example.com", phone: "010-0000-1234", address: "서울특별시 마포구", links: "", birth: "1997-03-08", gender: "", asOf: "", photo: "" },
    summary: "데이터를 바탕으로 캠페인을 기획하고 성과를 개선해 온 4년 차 마케터입니다.",
    experience: [
      { role: "대리 / 퍼포먼스 마케팅", org: "주식회사 누리소프트", place: "서울", start: "2021-01", end: "", current: true, details: "검색·SNS 광고 운영, 월 광고비 8천만 원 관리\n광고 효율 개선으로 신규 가입 비용 25% 절감" },
      { role: "사원 / 콘텐츠 마케팅", org: "주식회사 하늘커머스", place: "서울", start: "2019-07", end: "2020-12", current: false, details: "브랜드 블로그·SNS 콘텐츠 기획 및 제작" },
    ],
    education: [
      { school: "한빛대학교", degree: "경영학과", place: "서울", start: "2015-03", end: "2019-02", details: "졸업" },
      { school: "한강고등학교", degree: "", place: "서울", start: "2012-03", end: "2015-02", details: "졸업" },
    ],
    skills: "Google Analytics 4, Google Ads, Meta 광고\nExcel, SQL 기초",
    languages: "영어 (TOEIC 850)",
    certs: [
      { date: "2018-08", name: "컴퓨터활용능력 1급 (대한상공회의소)" },
      { date: "2016-01", name: "자동차운전면허 2종 보통 (경찰청)" },
    ],
    motivation: "", wishes: "", extra: "",
  },
  vi: {
    basics: { name: "Nguyễn Thu Hà", kana: "", title: "Chuyên viên kế toán", email: "thuha.nguyen@example.com", phone: "0900 000 123", address: "TP. Hồ Chí Minh", links: "", birth: "1998-09-20", gender: "", asOf: "", photo: "" },
    summary: "Mong muốn phát triển ở vị trí kế toán tổng hợp trong doanh nghiệp sản xuất, đóng góp vào việc lập báo cáo chính xác và đúng hạn.",
    experience: [
      { role: "Kế toán viên", org: "Công ty TNHH Thương mại Sao Việt", place: "TP. Hồ Chí Minh", start: "2021-03", end: "", current: true, details: "Hạch toán chứng từ, theo dõi công nợ phải thu và phải trả\nLập tờ khai thuế GTGT hằng tháng\nĐối chiếu số liệu ngân hàng cuối kỳ" },
      { role: "Thực tập sinh kế toán", org: "Công ty Cổ phần Bình Minh", place: "TP. Hồ Chí Minh", start: "2020-06", end: "2020-12", current: false, details: "Nhập liệu chứng từ trên phần mềm MISA" },
    ],
    education: [{ school: "Trường Đại học Kinh tế Nam Thành", degree: "Cử nhân Kế toán", place: "TP. Hồ Chí Minh", start: "2016-09", end: "2020-06", details: "Tốt nghiệp loại Khá" }],
    skills: "Phần mềm kế toán MISA\nExcel (hàm, bảng tổng hợp)\nKê khai thuế GTGT, TNCN",
    languages: "Tiếng Anh (giao tiếp)",
    certs: [{ date: "2022-05", name: "Chứng chỉ Kế toán trưởng" }],
    motivation: "", wishes: "", extra: "",
  },
  "zh-CN": {
    basics: { name: "张晓雨", kana: "", title: "新媒体运营", email: "xiaoyu.zhang@example.com", phone: "138 0000 1234", address: "上海", links: "", birth: "1998-06-15", gender: "", asOf: "", photo: "" },
    summary: "三年新媒体运营经验，熟悉内容策划和数据复盘，做事细致、执行力强，乐于学习新的平台规则和工具。",
    experience: [
      { role: "新媒体运营专员", org: "杭州青禾文化传媒有限公司", place: "杭州", start: "2021-07", end: "", current: true, details: "负责公司公众号和小红书账号的选题、撰稿与排期\n一年内公众号粉丝从 2 万增长到 6.5 万\n每周整理运营数据，提出选题和投放调整建议" },
      { role: "运营实习生", org: "上海星禾电子商务有限公司", place: "上海", start: "2020-09", end: "2021-01", current: false, details: "协助策划店铺促销活动，撰写商品详情页文案" },
    ],
    education: [{ school: "华东商务学院", degree: "汉语言文学 本科", place: "上海", start: "2017-09", end: "2021-06", details: "" }],
    skills: "内容策划与文案写作\nExcel 数据分析\n剪映、Photoshop 基础",
    languages: "英语 CET-6",
    certs: [{ date: "2019-12", name: "全国大学英语六级考试（CET-6）" }],
    motivation: "", wishes: "", extra: "",
  },
  "zh-TW": {
    basics: { name: "陳怡君", kana: "", title: "行銷企劃", email: "yijun.chen@example.com", phone: "0900-000-123", address: "台北市", links: "", birth: "1997-11-02", gender: "", asOf: "", photo: "" },
    summary: "四年品牌行銷經驗，擅長活動企劃與社群經營，重視數據，能獨立完成從企劃到結案的專案。",
    experience: [
      { role: "行銷企劃專員", org: "晨光生活股份有限公司", place: "台北市", start: "2021-02", end: "", current: true, details: "規劃年度品牌活動與檔期促銷，年度預算新台幣 300 萬元\n經營 Facebook、Instagram 官方帳號，追蹤數成長 45%" },
      { role: "行銷助理", org: "藍海國際有限公司", place: "新北市", start: "2019-07", end: "2021-01", current: false, details: "協助展覽與記者會執行，撰寫新聞稿" },
    ],
    education: [{ school: "文心大學", degree: "企業管理學系 學士", place: "台中市", start: "2015-09", end: "2019-06", details: "" }],
    skills: "活動企劃\n社群經營與廣告投放\nGoogle Analytics、Excel",
    languages: "英文（TOEIC 800）",
    certs: [{ date: "2020-03", name: "Google Analytics 個人認證" }],
    motivation: "", wishes: "", extra: "",
  },
};

/** The example for a language, as a fresh copy (the page edits it in place). */
export function sampleResume(loc: string): Resume {
  const s = SAMPLES[loc] ?? SAMPLES.en;
  const copy = JSON.parse(JSON.stringify(s)) as Sample;
  return { v: 1, format: defaultFormat(loc), era: copy.era ?? "seireki", ...copy } as Resume;
}
