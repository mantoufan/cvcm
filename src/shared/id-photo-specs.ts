/**
 * ID photo sizes for /id-photo/. Official presets restate the issuing authority's page (checked 2026-11-20, `source`);
 * "common" sizes are print sizes shops and forms use with no published head rule. Sizes are millimetres, width × height.
 */
import type { Locale } from "./locale";

export type IdPhotoSpec = {
  id: string;
  kind: "official" | "common";
  w: number;
  h: number;
  /** Top of the head (not the hair) to the chin, mm. */
  head?: readonly [number, number];
  /** Top of the head to the photo's top edge, mm (China only publishes this). */
  top?: readonly [number, number];
  /** The background the authority asks for, as the colour chip it starts on. */
  bg: string;
  /** Software-edited or composited photos are refused (background removal included). */
  noEdits?: boolean;
  /** Pixel size an online upload asks for. */
  px?: readonly [number, number];
  source?: string;
};

export const ID_PHOTO_SPECS: readonly IdPhotoSpec[] = [
  // "2 x 2 inches (51 x 51 mm)", head "1 inch to 1 3/8 inches (25 - 35 mm)" chin to top of head; plain white or
  // off-white background; photos with the background cut out by a retouching tool, or changed with software or AI, are rejected.
  { id: "us", kind: "official", w: 51, h: 51, head: [25, 35], bg: "#ffffff", noEdits: true, source: "https://travel.state.gov/en/passports/apply/help/photos.html" },
  // 45 mm high by 35 mm wide, crown to chin 29–34 mm, plain cream or light grey background, "unaltered by computer software".
  { id: "uk", kind: "official", w: 35, h: 45, head: [29, 34], bg: "#eeeeee", noEdits: true, source: "https://www.gov.uk/photos-for-passports/photo-requirements" },
  // 縦45×横35 mm, 頭頂からあごまで 34±2 mm, 無背景(白推奨). ICAO-based.
  { id: "jp", kind: "official", w: 35, h: 45, head: [32, 36], bg: "#ffffff", source: "https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html" },
  // 3.5 × 4.5 cm, 머리 길이(정수리~턱) 3.2–3.6 cm, 흰색 배경; 포토샵 등으로 배경을 지우거나 합성한 사진 불가; online 413 × 531 px.
  { id: "kr", kind: "official", w: 35, h: 45, head: [32, 36], bg: "#ffffff", noEdits: true, px: [413, 531], source: "https://overseas.mofa.go.kr/ca-toronto-ko/brd/m_5389/view.do?seq=1344544" },
  // 直4.5 × 橫3.5 公分, 頭頂至下顎 3.2–3.6 公分, 白色背景, 不得使用合成相片; online 413 × 531 px.
  { id: "tw", kind: "official", w: 35, h: 45, head: [32, 36], bg: "#ffffff", noEdits: true, px: [413, 531], source: "https://www.boca.gov.tw/np-16-1.html" },
  // 宽 33 × 高 48 mm, 头部高度(下巴至头顶) 28–33 mm, 头顶至上边 3–5 mm, 白色背景, 不得修改或合成.
  { id: "cn", kind: "official", w: 33, h: 48, head: [28, 33], top: [3, 5], bg: "#ffffff", noEdits: true, source: "https://us.china-embassy.gov.cn/lsfw/zj/hzlxz/201903/t20190309_5098803.htm" },
  // Hộ chiếu: cỡ 4 cm × 6 cm, phông nền trắng, khuôn mặt chiếm khoảng 75% diện tích ảnh (no head length in mm).
  { id: "vn", kind: "official", w: 40, h: 60, bg: "#ffffff", source: "https://dichvucong.bocongan.gov.vn/bocongan/tintuc/chitiet?matin=41" },
  // DNI y pasaporte: 32 × 26 mm (alto × ancho), fondo blanco liso y uniforme.
  { id: "es", kind: "official", w: 26, h: 32, bg: "#ffffff", source: "https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/tramites-y-gestiones/dni/documentacion-necesaria-para-su-tramitacion/" },
  // Common print sizes (no authority behind them; forms state their own).
  { id: "c25x35", kind: "common", w: 25, h: 35, bg: "#ffffff" },
  { id: "c35x49", kind: "common", w: 35, h: 49, bg: "#ffffff" },
  { id: "c35x45", kind: "common", w: 35, h: 45, bg: "#ffffff" },
  { id: "c28x35", kind: "common", w: 28, h: 35, bg: "#ffffff" },
  { id: "c30x40", kind: "common", w: 30, h: 40, bg: "#ffffff" },
  { id: "c20x30", kind: "common", w: 20, h: 30, bg: "#ffffff" },
  { id: "c40x60", kind: "common", w: 40, h: 60, bg: "#ffffff" },
  { id: "c25x30", kind: "common", w: 25, h: 30, bg: "#ffffff" },
];

/** The visitor's likely needs first; every preset stays available. */
const ORDER: Record<Locale, readonly string[]> = {
  en: ["us", "uk", "c35x45"],
  "zh-CN": ["c25x35", "c35x49", "cn", "c35x45"],
  "zh-TW": ["tw", "c35x45", "c28x35"],
  ja: ["c30x40", "jp", "c35x45"],
  ko: ["c30x40", "kr", "c35x45"],
  vi: ["c30x40", "c40x60", "vn", "c20x30"],
  id: ["c30x40", "c40x60", "c20x30"],
  es: ["es", "c25x30", "c35x45"],
};

export function specsFor(loc: Locale): IdPhotoSpec[] {
  const first = ORDER[loc] ?? [];
  const rank = (s: IdPhotoSpec) => {
    const i = first.indexOf(s.id);
    return i < 0 ? first.length + ID_PHOTO_SPECS.indexOf(s) : i;
  };
  return [...ID_PHOTO_SPECS].sort((a, b) => rank(a) - rank(b));
}

export function specById(id: string): IdPhotoSpec | undefined {
  return ID_PHOTO_SPECS.find((s) => s.id === id);
}

/** Background chips. Blue and red are the usual Chinese 蓝底 / 红底 (also Indonesian pas foto). */
export const BACKGROUNDS = [
  { id: "white", color: "#ffffff" },
  { id: "offwhite", color: "#eeeeee" },
  { id: "lightblue", color: "#a8cdf0" },
  { id: "blue", color: "#438edb" },
  { id: "red", color: "#d8212a" },
] as const;
