import { copyWithFlash } from "../copy";
import { decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import { appHref } from "../../shared/path";
import {
  MAX_ITEMS,
  MAX_LABEL,
  MAX_ITEM_TEXT,
  PICK_COLORS,
  PNG_CELL,
  PNG_LABEL,
  PNG_WIDTH,
  PRESET_IDS,
  addItems,
  addTier,
  applyLabels,
  boardText,
  clearPlacements,
  emptyBoard,
  itemCount,
  moveItem,
  moveTier,
  parseBoard,
  parseItems,
  pngLayout,
  removeItem,
  removeTier,
  serializeBoard,
  textOn,
  wrapText,
  type Board,
  type PresetId,
} from "../../shared/tier-list";

const STORE_KEY = "cvcm_tier_list";
const SAVE_MS = 300;
/** A pointer that moves less than this is a tap (pick up, then tap a row), not a drag. */
const DRAG_PX = 6;
/** Dragging this close to the top or bottom of the window scrolls it, so far-apart rows stay reachable. */
const EDGE_PX = 70;
const EDGE_SPEED = 14;

let board: Board = emptyBoard([]);
let rowsEl: HTMLElement | null = null;
let poolEl: HTMLElement | null = null;
let entryEl: HTMLTextAreaElement | null = null;
let titleEl: HTMLInputElement | null = null;
let noteEl: HTMLElement | null = null;
let presetEl: HTMLSelectElement | null = null;
let fileEl: HTMLInputElement | null = null;
let selected: string | null = null;
let saveTimer = 0;
let edgeFrame = 0;
let dragY = 0;
let drag: { id: string; el: HTMLElement; ghost: HTMLElement | null; startX: number; startY: number; pointer: number; moved: boolean } | null = null;
/** The picked files behind each object URL: the PNG decodes these, so no page request is made. */
const files = new Map<string, File>();

function presetLabels(id: PresetId): string[] {
  return t(`tierList.preset.${id}Rows`).split("|");
}

function defaultPreset(): PresetId {
  return locale() === "zh-CN" || locale() === "zh-TW" ? "hang" : "sabcd";
}

function freshBoard(): Board {
  const next = emptyBoard(presetLabels(defaultPreset()));
  addItems(next, parseItems(t("tierList.sample")).map((text) => ({ text })));
  return next;
}

function load(): Board {
  try {
    return parseBoard(localStorage.getItem(STORE_KEY)) ?? freshBoard();
  } catch {
    return freshBoard();
  }
}

function save(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, SAVE_MS);
}

function flush(): void {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORE_KEY, serializeBoard(board));
  } catch {
    // Private windows may refuse: the board still works, it just is not remembered.
  }
}

function note(message: string): void {
  if (noteEl) noteEl.textContent = message;
}

function imageLabel(): string {
  return t("tierList.picture");
}

function itemEl(id: string): HTMLElement {
  const item = board.items[id];
  const name = item.text || imageLabel();
  return h("div", {
    class: `tier-item${selected === id ? " picked" : ""}`,
    role: "button",
    tabindex: "0",
    "data-item": id,
    "aria-pressed": selected === id ? "true" : "false",
    "aria-label": name,
    title: name,
    onPointerdown: (e: PointerEvent) => startDrag(e, id),
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        drop(id);
      }
    },
  },
    item.image ? h("img", { src: item.image, alt: name, draggable: "false" }) : h("span", null, item.text),
  );
}

function pick(id: string): void {
  selected = selected === id ? null : id;
  paint();
  const el = selected ? rootOf()?.querySelector<HTMLElement>(`[data-item="${selected}"]`) : null;
  el?.focus();
}

function rootOf(): HTMLElement | null {
  return rowsEl?.closest<HTMLElement>(".tier-tool") ?? null;
}

function drop(id: string): void {
  const item = removeItem(board, id);
  if (item?.image) {
    URL.revokeObjectURL(item.image);
    files.delete(item.image);
  }
  if (selected === id) selected = null;
  paint();
  save();
}

function placeSelected(tierId: string | null): void {
  if (!selected) return;
  const id = selected;
  selected = null;
  moveItem(board, id, tierId);
  paint();
  save();
  rootOf()?.querySelector<HTMLElement>(`[data-item="${id}"]`)?.focus();
}

function placeButton(tierId: string | null): HTMLElement | null {
  if (!selected) return null;
  return h("button", { type: "button", class: "btn ghost tier-place", "data-action": "place", onClick: () => placeSelected(tierId) }, t("tierList.placeHere"));
}

function rowEl(tierId: string, index: number): HTMLElement {
  const tier = board.tiers.find((row) => row.id === tierId)!;
  const colors = Array.from(new Set([tier.color, ...PICK_COLORS]));
  return h("div", { class: "tier-row", "data-tier": tier.id },
    h("div", { class: "tier-label", style: { background: tier.color, color: textOn(tier.color) } },
      h("input", {
        type: "text",
        value: tier.label,
        maxlength: String(MAX_LABEL),
        "data-field": "label",
        "aria-label": t("tierList.rowName"),
        style: { color: textOn(tier.color) },
        onInput: (e: Event) => { tier.label = (e.target as HTMLInputElement).value; save(); },
      }),
    ),
    h("div", { class: "tier-items", "data-drop": tier.id }, ...tier.items.map(itemEl), placeButton(tier.id)),
    h("div", { class: "tier-row-actions" },
      h("select", {
        class: "tier-color",
        "aria-label": t("tierList.rowColor"),
        "data-field": "color",
        style: { background: tier.color },
        onChange: (e: Event) => { tier.color = (e.target as HTMLSelectElement).value; paint(); save(); },
      }, ...colors.map((color) => h("option", { value: color, selected: color === tier.color, style: { background: color, color: textOn(color) } }, color))),
      h("button", { type: "button", class: "tier-mini", "aria-label": t("tierList.rowUp"), disabled: index === 0, onClick: () => { moveTier(board, tier.id, -1); paint(); save(); } }, "↑"),
      h("button", { type: "button", class: "tier-mini", "aria-label": t("tierList.rowDown"), disabled: index === board.tiers.length - 1, onClick: () => { moveTier(board, tier.id, 1); paint(); save(); } }, "↓"),
      h("button", { type: "button", class: "tier-mini", "data-action": "remove-row", "aria-label": t("tierList.rowRemove"), disabled: board.tiers.length === 1, onClick: () => { removeTier(board, tier.id); paint(); save(); } }, "×"),
    ),
  );
}

function paint(): void {
  if (!rowsEl || !poolEl) return;
  rowsEl.replaceChildren(...board.tiers.map((tier, index) => rowEl(tier.id, index)));
  poolEl.replaceChildren(
    ...board.pool.map(itemEl),
    placeButton(null) ?? "",
  );
  poolEl.dataset.empty = board.pool.length ? "" : "1";
  const removeBtn = rootOf()?.querySelector<HTMLButtonElement>("[data-action=delete-item]");
  if (removeBtn) removeBtn.disabled = !selected;
  note(selected ? t("tierList.pickedHint", { name: board.items[selected]?.text || imageLabel() }) : t("tierList.count", { n: itemCount(board), max: MAX_ITEMS }));
}

function startDrag(e: PointerEvent, id: string): void {
  if (e.button !== 0) return;
  const el = e.currentTarget as HTMLElement;
  drag = { id, el, ghost: null, startX: e.clientX, startY: e.clientY, pointer: e.pointerId, moved: false };
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragEnd);
  window.addEventListener("pointercancel", cancelDrag);
}

function onDragMove(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointer) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_PX) return;
    drag.moved = true;
    const box = drag.el.getBoundingClientRect();
    const ghost = drag.el.cloneNode(true) as HTMLElement;
    ghost.classList.add("tier-ghost");
    ghost.removeAttribute("data-item");
    ghost.style.width = `${box.width}px`;
    ghost.style.height = `${box.height}px`;
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.el.classList.add("dragging");
    selected = null;
  }
  e.preventDefault();
  dragY = e.clientY;
  if (!edgeFrame) edgeFrame = requestAnimationFrame(edgeScroll);
  if (drag.ghost) drag.ghost.style.transform = `translate(${e.clientX + 6}px, ${e.clientY + 6}px)`;
}

function edgeScroll(): void {
  edgeFrame = 0;
  if (!drag?.moved) return;
  if (dragY < EDGE_PX) window.scrollBy(0, -EDGE_SPEED);
  else if (dragY > window.innerHeight - EDGE_PX) window.scrollBy(0, EDGE_SPEED);
  edgeFrame = requestAnimationFrame(edgeScroll);
}

/** The list under the pointer and the slot in it: before the first item whose middle is past the pointer. */
function dropTarget(x: number, y: number): { tier: string | null; index: number } | null {
  const under = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
  if (!under) return null;
  const tier = under.dataset.drop === "pool" ? null : under.dataset.drop!;
  const items = Array.from(under.querySelectorAll<HTMLElement>("[data-item]"));
  let index = items.length;
  for (let i = 0; i < items.length; i += 1) {
    const box = items[i].getBoundingClientRect();
    const sameLine = y >= box.top && y <= box.bottom;
    if ((sameLine && x < box.left + box.width / 2) || y < box.top) {
      index = i;
      break;
    }
  }
  return { tier, index };
}

function onDragEnd(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointer) return;
  const { id, moved } = drag;
  endDrag();
  if (!moved) {
    pick(id);
    return;
  }
  const target = dropTarget(e.clientX, e.clientY);
  if (target) {
    moveItem(board, id, target.tier, target.index);
    save();
  }
  paint();
}

function cancelDrag(): void {
  endDrag();
  paint();
}

function endDrag(): void {
  cancelAnimationFrame(edgeFrame);
  edgeFrame = 0;
  drag?.ghost?.remove();
  drag?.el.classList.remove("dragging");
  drag = null;
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragEnd);
  window.removeEventListener("pointercancel", cancelDrag);
}

function addFromEntry(): void {
  if (!entryEl) return;
  const existing = Object.values(board.items).map((item) => item.text);
  const fresh = parseItems(entryEl.value, existing);
  const added = addItems(board, fresh.map((text) => ({ text })));
  entryEl.value = "";
  paint();
  save();
  if (added < fresh.length) note(t("tierList.full", { max: MAX_ITEMS }));
}

function addFiles(picked: Iterable<File>): void {
  const images = Array.from(picked).filter((file) => file.type.startsWith("image/"));
  if (!images.length) return;
  const room = MAX_ITEMS - itemCount(board);
  const taken = images.slice(0, Math.max(0, room));
  addItems(board, taken.map((file) => {
    const image = URL.createObjectURL(file);
    files.set(image, file);
    return { text: file.name.replace(/\.[^.]+$/, "").slice(0, MAX_ITEM_TEXT), image };
  }));
  paint();
  if (taken.length < images.length) note(t("tierList.full", { max: MAX_ITEMS }));
}

function onPaste(e: ClipboardEvent): void {
  const pasted = e.clipboardData?.files;
  if (pasted?.length) {
    const images = Array.from(pasted).filter((file) => file.type.startsWith("image/"));
    if (images.length) {
      e.preventDefault();
      addFiles(images);
    }
  }
}

function applyPreset(id: PresetId): void {
  applyLabels(board, presetLabels(id));
  paint();
  save();
}

const FONT = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Hiragino Sans", "Noto Sans CJK SC", sans-serif';

function drawCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, box: number, size: number, maxLines: number): void {
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapText(text, (line) => ctx.measureText(line).width <= box, maxLines);
  const lineHeight = size * 1.2;
  lines.forEach((line, i) => ctx.fillText(line, cx, cy + (i - (lines.length - 1) / 2) * lineHeight));
}

async function renderPng(): Promise<Blob | null> {
  const layout = pngLayout(board);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#1f1f24";
  ctx.fillRect(0, 0, layout.width, layout.height);
  if (layout.titleHeight) {
    ctx.fillStyle = "#ffffff";
    drawCentered(ctx, board.title.trim(), PNG_WIDTH / 2, layout.titleHeight / 2, PNG_WIDTH - 40, 28, 1);
  }
  for (const row of layout.rows) {
    const tier = board.tiers.find((candidate) => candidate.id === row.tierId)!;
    ctx.fillStyle = tier.color;
    ctx.fillRect(0, row.y, PNG_LABEL, row.height);
    ctx.fillStyle = textOn(tier.color);
    drawCentered(ctx, tier.label, PNG_LABEL / 2, row.y + row.height / 2, PNG_LABEL - 12, 26, 3);
    for (const cell of row.cells) {
      const item = board.items[cell.id];
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cell.x, cell.y, PNG_CELL, PNG_CELL);
      if (item.image) {
        const { bitmap, width, height } = await decodeImage(files.get(item.image)!);
        const side = Math.min(width, height);
        ctx.drawImage(bitmap, (width - side) / 2, (height - side) / 2, side, side, cell.x, cell.y, PNG_CELL, PNG_CELL);
        bitmap.close();
      } else {
        ctx.fillStyle = "#1a1a1a";
        drawCentered(ctx, item.text, cell.x + PNG_CELL / 2, cell.y + PNG_CELL / 2, PNG_CELL - 10, 15, 4);
      }
    }
  }
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function exportPng(btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  try {
    const blob = await renderPng();
    if (blob) downloadBlob(blob, "tier-list.png");
    else note(t("tierList.exportFailed"));
  } catch {
    note(t("tierList.exportFailed"));
  } finally {
    btn.disabled = false;
  }
}

function startOver(): void {
  releaseUrls();
  selected = null;
  board = emptyBoard(presetLabels((presetEl?.value as PresetId) ?? defaultPreset()));
  if (titleEl) titleEl.value = "";
  paint();
  save();
}

function releaseUrls(): void {
  for (const url of files.keys()) URL.revokeObjectURL(url);
  files.clear();
}

export function mountTierList(host: HTMLElement): void {
  board = load();
  selected = null;
  rowsEl = h("div", { class: "tier-rows", "data-out": "rows" });
  poolEl = h("div", { class: "tier-items tier-pool", "data-drop": "pool", "data-out": "pool" });
  noteEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "note" });
  entryEl = h("textarea", { rows: "3", "data-field": "entry", spellcheck: "false", placeholder: t("tierList.entryPlaceholder"), "aria-label": t("tierList.entry") });
  titleEl = h("input", { type: "text", maxlength: String(MAX_ITEM_TEXT), "data-field": "title", value: board.title, placeholder: t("tierList.titlePlaceholder"), "aria-label": t("tierList.titleField"), onInput: () => { board.title = titleEl?.value ?? ""; save(); } });
  fileEl = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, "data-field": "files", onChange: () => { if (fileEl?.files) addFiles(fileEl.files); if (fileEl) fileEl.value = ""; } });
  presetEl = h("select", { "data-field": "preset", "aria-label": t("tierList.presetLabel"), onChange: () => applyPreset(presetEl!.value as PresetId) },
    ...PRESET_IDS.map((id) => h("option", { value: id, selected: id === defaultPreset() }, t(`tierList.preset.${id}`))),
  );
  // A remembered board may use any preset or its own rows; show which, or none.
  const rows = board.tiers.map((tier) => tier.label).join("|");
  presetEl.selectedIndex = PRESET_IDS.findIndex((id) => presetLabels(id).join("|") === rows);
  const copyBtn: HTMLButtonElement = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, boardText(board, imageLabel(), t("tierList.separator")), { done: t("tierList.copied"), failed: t("tierList.copyFailed") }) }, t("tierList.copy"));
  const pngBtn: HTMLButtonElement = h("button", { type: "button", class: "btn", "data-action": "png", onClick: () => void exportPng(pngBtn) }, t("tierList.download"));
  host.append(
    h("header", { class: "tool-head" },
      h("a", { class: "back", href: appHref(locale(), null), "data-nav": "home" }, t("tierList.back")),
      h("h1", null, t("tierList.title")),
      h("p", { class: "lede" }, t("tierList.privacyNote")),
    ),
    h("div", { class: "tier-tool", onPaste, onDragover: (e: DragEvent) => e.preventDefault(), onDrop: (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files); } },
      h("div", { class: "tier-setup" },
        h("label", { class: "tier-field" }, h("span", null, t("tierList.titleField")), titleEl),
        h("label", { class: "tier-field" }, h("span", null, t("tierList.presetLabel")), presetEl),
      ),
      rowsEl,
      h("div", { class: "stage-actions" },
        h("button", { type: "button", class: "btn ghost", "data-action": "add-row", onClick: () => { if (addTier(board, t("tierList.newRow"))) { paint(); save(); } } }, t("tierList.addRow")),
        h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: () => { clearPlacements(board); selected = null; paint(); save(); } }, t("tierList.clear")),
        h("button", { type: "button", class: "btn ghost", "data-action": "start-over", onClick: startOver }, t("tierList.startOver")),
      ),
      h("h2", { class: "tier-sub" }, t("tierList.pool")),
      poolEl,
      noteEl,
      h("div", { class: "tier-add" },
        entryEl,
        h("div", { class: "stage-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: addFromEntry }, t("tierList.add")),
          h("button", { type: "button", class: "btn ghost", "data-action": "pictures", onClick: () => fileEl?.click() }, t("tierList.addPictures")),
          h("button", { type: "button", class: "btn ghost", "data-action": "delete-item", disabled: true, onClick: () => { if (selected) drop(selected); } }, t("tierList.deleteItem")),
          fileEl,
        ),
      ),
      h("p", { class: "hint" }, t("tierList.hint")),
      h("div", { class: "stage-actions" }, pngBtn, copyBtn),
    ),
  );
  window.addEventListener("pagehide", flush);
  paint();
}

export function unmountTierList(): void {
  if (saveTimer) flush();
  window.removeEventListener("pagehide", flush);
  endDrag();
  releaseUrls();
  rowsEl = poolEl = entryEl = titleEl = noteEl = presetEl = fileEl = null;
  selected = null;
  board = emptyBoard([]);
}
