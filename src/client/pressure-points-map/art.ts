// Line drawings for the pressure points map. Each view's body is a set of plain shapes drawn twice (a wide stroke,
// then the fill on top), so only the outline of their union shows; `details` are thin lines on top (eyebrows,
// creases, tendons). Colours come from CSS (styles.css, .ppm-*), never from here.
import type { PpFoot, PpView, PpZone } from "../../shared/pressure-points";

export type ViewArt = { viewBox: string; body: string; details: string };

const mirror = (d: string, axis: number) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${+(2 * axis - Number(x)).toFixed(1)} ${y}`);

const FACE_HEAD = "M160 40 C230 40 262 95 262 165 C262 235 225 300 160 312 C95 300 58 235 58 165 C58 95 90 40 160 40 Z";
const BROW = "M184 148 Q210 136 238 146";
const EYE = "M181 172 Q205 159 229 172 Q205 183 181 172 Z";

/** Right hand, back view, fingers up (thumb on the left). */
const HAND_BODY = [
  '<rect x="108" y="160" width="112" height="130" rx="26"/>',
  '<rect x="118" y="260" width="92" height="140"/>',
  '<rect x="108" y="62" width="22" height="120" rx="11"/>',
  '<rect x="138" y="44" width="23" height="135" rx="11.5"/>',
  '<rect x="169" y="56" width="22" height="125" rx="11"/>',
  '<rect x="199" y="88" width="19" height="95" rx="9.5"/>',
  '<rect x="-14" y="-62" width="28" height="124" rx="14" transform="translate(88 214) rotate(-29)"/>',
].join("");

/** Right arm, palm towards you, fingers up: the thumb is on the right, the little finger on the left. */
const ARM_BODY = [
  '<rect x="100" y="110" width="112" height="125" rx="26"/>',
  '<path d="M110 200 L202 200 L226 420 L94 420 Z"/>',
  '<rect x="190" y="12" width="22" height="120" rx="11"/>',
  '<rect x="159" y="-6" width="23" height="135" rx="11.5"/>',
  '<rect x="129" y="6" width="22" height="125" rx="11"/>',
  '<rect x="102" y="38" width="19" height="95" rx="9.5"/>',
  '<rect x="-14" y="-58" width="28" height="116" rx="14" transform="translate(232 196) rotate(32)"/>',
].join("");

/** Right lower leg from the front: the outer side is on the left, the inner side (big toe) on the right. */
const LEG_BODY = [
  '<rect x="100" y="-4" width="120" height="70"/>',
  '<ellipse cx="160" cy="72" rx="60" ry="40"/>',
  '<path d="M104 80 C96 130 100 170 112 210 C126 260 134 320 136 352 L186 352 C188 320 194 260 206 210 C218 170 222 130 216 80 Z"/>',
  '<ellipse cx="135" cy="354" rx="11" ry="13"/>',
  '<ellipse cx="187" cy="346" rx="11" ry="13"/>',
  '<path d="M130 352 L190 352 C204 376 216 396 222 424 L98 424 C104 396 116 376 130 352 Z"/>',
].join("");

/** Top of the right foot, toes up: the big toe is on the left. */
const FOOT_BODY = [
  '<ellipse cx="116" cy="72" rx="21" ry="34"/>',
  '<ellipse cx="152" cy="64" rx="13" ry="26"/>',
  '<ellipse cx="180" cy="74" rx="12.5" ry="23"/>',
  '<ellipse cx="205" cy="88" rx="11.5" ry="20"/>',
  '<ellipse cx="228" cy="106" rx="10.5" ry="17"/>',
  '<path d="M96 84 C90 140 96 200 108 260 C116 320 122 370 130 424 L218 424 C220 360 228 300 236 240 C244 180 246 140 240 108 C210 92 140 86 96 84 Z"/>',
].join("");

/** Sole of the right foot (drawn on the right), toes up, big toe towards the middle. The left sole mirrors it. */
const SOLE_AXIS = 170;
const SOLE_TOES = [
  [222, 62, 20, 28],
  [253, 50, 12, 19],
  [276, 55, 11, 17],
  [296, 66, 10, 15],
  [313, 82, 9, 13],
] as const;
const SOLE_PATH = "M202 96 C198 140 214 175 226 205 C236 235 214 300 214 350 C214 405 296 410 298 355 C300 300 300 240 308 190 C314 150 326 120 322 94 C296 82 236 84 202 96 Z";

function soleShapes(foot: PpFoot): string {
  const mx = (x: number) => (foot === "right" ? x : 2 * SOLE_AXIS - x);
  const toes = SOLE_TOES.map(([cx, cy, rx, ry]) => `<ellipse cx="${mx(cx)}" cy="${cy}" rx="${rx}" ry="${ry}"/>`).join("");
  return `${toes}<path d="${foot === "right" ? SOLE_PATH : mirror(SOLE_PATH, SOLE_AXIS)}"/>`;
}

export const VIEW_ART: Record<PpView, ViewArt> = {
  face: {
    viewBox: "0 0 320 360",
    body: `<path d="${FACE_HEAD}"/><ellipse cx="57" cy="182" rx="13" ry="28"/><ellipse cx="263" cy="182" rx="13" ry="28"/><rect x="122" y="280" width="76" height="90"/>`,
    details: [
      `<path d="${BROW}"/><path d="${mirror(BROW, 160)}"/>`,
      `<path d="${EYE}"/><path d="${mirror(EYE, 160)}"/>`,
      '<circle class="ppm-fill-ink" cx="205" cy="171" r="5"/><circle class="ppm-fill-ink" cx="115" cy="171" r="5"/>',
      '<path d="M157 168 Q151 205 146 220 Q160 231 174 220"/>',
      '<path d="M138 256 Q160 267 182 256"/>',
      '<path class="ppm-faint" d="M188 178 Q205 186 222 178"/><path class="ppm-faint" d="M132 178 Q115 186 98 178"/>',
    ].join(""),
  },
  back: {
    viewBox: "0 0 320 360",
    body: '<ellipse cx="160" cy="112" rx="72" ry="86"/><rect x="128" y="170" width="64" height="100" rx="8"/><path d="M128 226 C105 250 70 258 40 270 C22 276 14 292 14 320 L14 370 L306 370 L306 320 C306 292 298 276 280 270 C250 258 215 250 192 226 Z"/>',
    details: [
      '<path d="M112 184 Q160 202 208 184"/>',
      '<path class="ppm-faint" d="M146 200 L140 236"/><path class="ppm-faint" d="M174 200 L180 236"/>',
      '<path class="ppm-faint" stroke-dasharray="4 6" d="M160 206 L160 360"/>',
      '<circle class="ppm-fill-ink" cx="160" cy="258" r="3"/>',
      '<path d="M268 268 Q282 272 286 284"/><path d="M52 268 Q38 272 34 284"/>',
      '<path class="ppm-faint" d="M100 100 Q160 70 220 100"/>',
    ].join(""),
  },
  hand: {
    viewBox: "0 0 320 380",
    body: HAND_BODY,
    details: [
      '<rect x="112" y="68" width="14" height="18" rx="6"/><rect x="142.5" y="50" width="14" height="18" rx="6"/><rect x="173" y="62" width="14" height="18" rx="6"/><rect x="201.5" y="94" width="13" height="16" rx="6"/>',
      '<rect x="-7" y="-58" width="14" height="18" rx="6" transform="translate(88 214) rotate(-29)"/>',
      '<path class="ppm-faint" d="M119 176 L131 286"/><path class="ppm-faint" d="M149.5 176 L150 286"/><path class="ppm-faint" d="M180 176 L168 286"/><path class="ppm-faint" d="M208.5 180 L186 286"/>',
      '<path class="ppm-faint" d="M112 130 Q119 126 126 130"/><path class="ppm-faint" d="M142 120 Q150 116 158 120"/><path class="ppm-faint" d="M172 124 Q180 120 188 124"/>',
    ].join(""),
  },
  arm: {
    viewBox: "0 0 320 420",
    body: ARM_BODY,
    details: [
      '<path d="M108 170 Q150 158 205 150"/><path d="M200 205 Q178 178 168 125"/><path class="ppm-faint" d="M106 196 Q140 186 170 190"/>',
      '<path d="M112 242 Q156 250 200 242"/><path class="ppm-faint" d="M113 252 Q156 260 201 252"/>',
      '<path class="ppm-faint" d="M150 258 L146 360"/><path class="ppm-faint" d="M167 258 L172 360"/>',
      '<path class="ppm-measure" d="M224 242 L224 302 M218 242 L230 242 M218 302 L230 302"/>',
    ].join(""),
  },
  leg: {
    viewBox: "0 0 320 420",
    body: LEG_BODY,
    details: [
      '<ellipse cx="160" cy="70" rx="22" ry="28"/>',
      '<path class="ppm-faint" d="M153 98 L155 118"/><path class="ppm-faint" d="M167 98 L165 118"/>',
      '<path d="M154 124 Q160 129 168 124"/>',
      '<path class="ppm-faint" d="M164 128 C168 200 168 280 174 338"/>',
      '<path class="ppm-faint" d="M120 412 L122 424 M142 410 L143 424 M162 410 L162 424 M182 410 L181 424"/>',
    ].join(""),
  },
  foot: {
    viewBox: "0 0 320 420",
    body: FOOT_BODY,
    details: [
      '<ellipse cx="116" cy="54" rx="11" ry="10"/><ellipse cx="152" cy="48" rx="7" ry="7"/><ellipse cx="180" cy="59" rx="6.5" ry="6.5"/><ellipse cx="205" cy="74" rx="6" ry="6"/><ellipse cx="228" cy="94" rx="5.5" ry="5.5"/>',
      '<path class="ppm-faint" d="M116 106 L128 250"/><path class="ppm-faint" d="M152 92 L150 250"/><path class="ppm-faint" d="M180 100 L170 250"/><path class="ppm-faint" d="M205 110 L190 250"/><path class="ppm-faint" d="M228 124 L210 250"/>',
      '<path d="M132 388 Q176 376 222 388"/>',
    ].join(""),
  },
  sole: {
    viewBox: "0 0 340 420",
    body: soleShapes("left") + soleShapes("right"),
    details: "",
  },
};

/** One sole's zone shapes (before clipping to the foot): band rectangles, the inner-edge strip and the organ areas. */
export function zoneShapes(foot: PpFoot): { zone: PpZone; d: string }[] {
  const mx = (x: number) => (foot === "right" ? x : 2 * SOLE_AXIS - x);
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const [a, b] = [mx(x0), mx(x1)].sort((p, q) => p - q);
    return `M${a} ${y0} H${b} V${y1} H${a} Z`;
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
    const x = mx(cx);
    return `M${x - rx} ${cy} A${rx} ${ry} 0 1 0 ${x + rx} ${cy} A${rx} ${ry} 0 1 0 ${x - rx} ${cy} Z`;
  };
  const spine = "M194 34 L214 34 L216 96 L222 150 L238 205 L236 255 L228 320 L228 410 L200 410 L204 320 L212 255 L214 205 L200 150 L194 96 Z";
  const out: { zone: PpZone; d: string }[] = [
    { zone: "toes", d: rect(180, 0, 340, 94) },
    { zone: "ball", d: rect(180, 94, 340, 158) },
    { zone: "arch", d: rect(180, 158, 340, 275) },
    { zone: "heel", d: rect(180, 275, 340, 420) },
    { zone: "spine", d: foot === "right" ? spine : mirror(spine, SOLE_AXIS) },
  ];
  if (foot === "left") {
    out.push({ zone: "heart", d: ellipse(246, 126, 17, 15) }, { zone: "spleen", d: ellipse(290, 194, 17, 20) });
  } else {
    out.push({ zone: "liver", d: ellipse(288, 196, 19, 27) });
  }
  return out;
}

/** The outline shapes of one sole, for its clip path. */
export function soleClip(foot: PpFoot): string {
  return soleShapes(foot);
}
