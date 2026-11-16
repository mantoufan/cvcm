import type { PhotoGroupId } from "./kb";
import type { ToolId } from "./path";

/** Photography shelf: `/{locale}/learn/photography/{id}/`, copy in src/locales/kb/<locale>/<id>.json, names in the core packs (`kb.<id>`). */
export const PHOTO_ARTICLES = [
  "exposure-triangle",
  "aperture-and-depth-of-field",
  "shutter-speed",
  "iso-and-noise",
  "white-balance",
  "focal-length",
  "rule-of-thirds",
  "photo-composition",
  "golden-hour",
  "backlit-photos",
  "how-to-pose-for-photos",
  "portrait-photography-tips",
  "selfie-tips",
  "self-portrait-photography",
  "solo-bridal-photoshoot",
  "bridal-poses",
  "pre-wedding-photoshoot",
  "phone-photography",
  "night-photography",
  "photograph-the-moon",
  "food-photography",
  "product-photography",
] as const;

export type PhotoId = (typeof PHOTO_ARTICLES)[number];

export const PHOTO_GROUPS: readonly { id: PhotoGroupId; articles: readonly PhotoId[] }[] = [
  { id: "exposure", articles: ["exposure-triangle", "aperture-and-depth-of-field", "shutter-speed", "iso-and-noise", "white-balance", "focal-length"] },
  { id: "composition", articles: ["rule-of-thirds", "photo-composition", "golden-hour", "backlit-photos"] },
  { id: "portraits", articles: ["how-to-pose-for-photos", "portrait-photography-tips", "selfie-tips", "self-portrait-photography"] },
  { id: "wedding", articles: ["solo-bridal-photoshoot", "bridal-poses", "pre-wedding-photoshoot"] },
  { id: "scenes", articles: ["phone-photography", "night-photography", "photograph-the-moon", "food-photography", "product-photography"] },
];

/** Tools a photography article puts to work (first is its call to action); tool pages list these, so they ship with the ids. */
export const PHOTO_ARTICLE_TOOLS: Partial<Record<PhotoId, readonly ToolId[]>> = {
  "exposure-triangle": ["portrait-sim", "exif"],
  "aperture-and-depth-of-field": ["portrait-sim"],
  "shutter-speed": ["portrait-sim", "exif"],
  "iso-and-noise": ["portrait-sim", "exif"],
  "white-balance": ["portrait-sim", "image-colors"],
  "focal-length": ["portrait-sim", "exif"],
  "rule-of-thirds": ["crop", "aspect"],
  "photo-composition": ["crop", "rotate"],
  "portrait-photography-tips": ["portrait-sim", "crop"],
  "selfie-tips": ["crop"],
  "self-portrait-photography": ["collage"],
  "solo-bridal-photoshoot": ["collage", "crop"],
  "bridal-poses": ["collage"],
  "pre-wedding-photoshoot": ["collage", "watermark"],
  "phone-photography": ["exif", "crop"],
  "night-photography": ["exif"],
  "photograph-the-moon": ["crop", "exif"],
  "food-photography": ["crop", "image-colors"],
  "product-photography": ["remove-background", "resize", "crop"],
};
