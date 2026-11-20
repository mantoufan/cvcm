/** Crops a picked photo to 3:4 in the page (drag to move, slider to zoom) and returns a small JPEG data URL. */
import { h } from "../dom";

/** Output size: 300 × 400 px is 30 × 40 mm at about 254 dpi, sharp in print and ~40 KB as JPEG. */
export const PHOTO_W = 300;
export const PHOTO_H = 400;

export type CropLabels = { zoom: string; use: string; cancel: string; hint: string };

export function cropPanel(bitmap: ImageBitmap, labels: CropLabels, onDone: (dataUrl: string) => void, onCancel: () => void): HTMLElement {
  const W = 240;
  const H = 320;
  const canvas = h("canvas", { class: "rs-crop-canvas", width: W, height: H, "aria-label": labels.hint });
  const ctx = canvas.getContext("2d");
  const base = Math.max(W / bitmap.width, H / bitmap.height);
  let zoom = 1;
  let cx = bitmap.width / 2;
  let cy = bitmap.height / 2;

  const clamp = () => {
    const scale = base * zoom;
    const hw = W / scale / 2;
    const hh = H / scale / 2;
    cx = Math.min(Math.max(cx, hw), bitmap.width - hw);
    cy = Math.min(Math.max(cy, hh), bitmap.height - hh);
  };
  const draw = (target: CanvasRenderingContext2D | null, w: number, hgt: number) => {
    if (!target) return;
    const scale = base * zoom;
    const sw = W / scale;
    const sh = H / scale;
    target.fillStyle = "#fff";
    target.fillRect(0, 0, w, hgt);
    target.drawImage(bitmap, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, w, hgt);
  };
  const paint = () => { clamp(); draw(ctx, W, H); };

  let drag: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const ratio = W / (canvas.getBoundingClientRect().width || W);
    const scale = base * zoom;
    cx -= ((e.clientX - drag.x) * ratio) / scale;
    cy -= ((e.clientY - drag.y) * ratio) / scale;
    drag = { x: e.clientX, y: e.clientY };
    paint();
  });
  const stop = () => { drag = null; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  const slider = h("input", { type: "range", min: "1", max: "4", step: "0.01", value: "1", "data-field": "photoZoom", "aria-label": labels.zoom,
    onInput: () => { zoom = Number(slider.value) || 1; paint(); } });

  const use = () => {
    const out = h("canvas", { width: PHOTO_W, height: PHOTO_H });
    clamp();
    draw(out.getContext("2d"), PHOTO_W, PHOTO_H);
    onDone(out.toDataURL("image/jpeg", 0.85));
  };

  paint();
  return h("div", { class: "rs-crop" },
    canvas,
    h("p", { class: "hint" }, labels.hint),
    h("label", { class: "field" }, h("span", null, labels.zoom), slider),
    h("div", { class: "stage-actions" },
      h("button", { type: "button", class: "btn", "data-action": "photo-use", onClick: use }, labels.use),
      h("button", { type: "button", class: "btn ghost", "data-action": "photo-cancel", onClick: onCancel }, labels.cancel)),
  );
}
