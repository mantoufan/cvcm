import { copyWithFlash } from "../copy";
import { canvasToBlob, decodeImage } from "../decode";
import { downloadBlob, h } from "../dom";
import { locale, t } from "../i18n";
import {
  MAX_ITEMS,
  MAX_LABEL,
  MAX_TIERS,
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
const CONFIRM_MS = 4000;

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
let confirmTimer = 0;
let armedBtn: HTMLButtonElement | null = null;
let armedIdle = "";
let edgeFrame = 0;
let justDragged = false;
let dragY = 0;
let drag: { id: string; el: HTMLElement; ghost: HTMLElement | null; startX: number; startY: number; pointer: number; moved: boolean } | null = null;
/** The picked files behind each object URL: the PNG decodes these, so no page request is made. */
const files = new Map<string, File>();
/** One <img> per picture, moved between repaints instead of decoded again. */
const imageNodes = new Map<string, HTMLImageElement>();

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

/** Writes only a pending change, so a page that was only looked at leaves other tabs and locales alone. */
function flush(): void {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = 0;
  try {
    localStorage.setItem(STORE_KEY, serializeBoard(board));
  } catch {
    // Private windows may refuse: the board still works, it just is not remembered.
  }
}

/** Another tab saved: follow it, unless this tab has unsaved edits or pictures that only live here. */
function onStorage(e: StorageEvent): void {
  if (e.key !== STORE_KEY || saveTimer || files.size) return;
  const next = parseBoard(e.newValue);
  if (!next) return;
  board = next;
  selected = null;
  if (titleEl) titleEl.value = board.title;
  paint();
}

/** Pictures cannot be saved, so closing the page with some on the board asks first. */
function warnPictures(e: BeforeUnloadEvent): void {
  if (!files.size) return;
  e.preventDefault();
  // Chromium before 119, still common in QQ, 360 and in-app browsers, only asks when this is set.
  e.returnValue = "";
}

function note(message: string): void {
  if (noteEl) noteEl.textContent = message;
}

function imageLabel(): string {
  return t("tierList.picture");
}

function imageNode(src: string, name: string): HTMLImageElement {
  let node = imageNodes.get(src);
  if (!node) {
    node = h("img", { src, alt: name, draggable: "false", decoding: "async" });
    imageNodes.set(src, node);
  }
  return node;
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
    // Picking on click, not pointerup: a finger that drifts is still a tap, and nothing moves under it before the click lands.
    onClick: () => { if (justDragged) justDragged = false; else pick(id); },
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
    item.image ? imageNode(item.image, name) : h("span", null, item.text),
  );
}

function pick(id: string): void {
  selected = selected === id ? null : id;
  paint();
  rootOf()?.querySelector<HTMLElement>(`[data-item="${id}"]`)?.focus();
}

function rootOf(): HTMLElement | null {
  return rowsEl?.closest<HTMLElement>(".tier-tool") ?? null;
}

function drop(id: string): void {
  const item = removeItem(board, id);
  if (item?.image) {
    URL.revokeObjectURL(item.image);
    files.delete(item.image);
    imageNodes.delete(item.image);
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
        onInput: (e: Event) => { tier.label = (e.target as HTMLInputElement).value; syncPreset(); save(); },
      }),
    ),
    h("div", { class: "tier-items", "data-drop": tier.id }, ...tier.items.map(itemEl), placeButton(tier.id)),
    h("div", { class: "tier-row-actions" },
      h("select", {
        class: "tier-color",
        "data-focus": `${tier.id}:color`,
        "aria-label": t("tierList.rowColor"),
        "data-field": "color",
        style: { background: tier.color },
        onChange: (e: Event) => { tier.color = (e.target as HTMLSelectElement).value; paint(); save(); },
      }, ...colors.map((color) => h("option", { value: color, selected: color === tier.color, style: { background: color, color: textOn(color) } }, color))),
      h("button", { type: "button", class: "tier-mini", "data-focus": `${tier.id}:up`, "aria-label": t("tierList.rowUp"), disabled: index === 0, onClick: () => { moveTier(board, tier.id, -1); paint(); save(); } }, "↑"),
      h("button", { type: "button", class: "tier-mini", "data-focus": `${tier.id}:down`, "aria-label": t("tierList.rowDown"), disabled: index === board.tiers.length - 1, onClick: () => { moveTier(board, tier.id, 1); paint(); save(); } }, "↓"),
      h("button", { type: "button", class: "tier-mini", "data-focus": `${tier.id}:remove`, "data-action": "remove-row", "aria-label": t("tierList.rowRemove"), disabled: board.tiers.length === 1, onClick: () => { removeTier(board, tier.id); paint(); save(); } }, "×"),
    ),
  );
}

/** Repainting replaces the board's elements, so keyboard focus moves to the same control in the new ones. */
function focusKey(): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !rootOf()?.contains(active)) return null;
  return active.dataset.focus ?? (active.dataset.item ? `item:${active.dataset.item}` : null);
}

function restoreFocus(key: string | null): void {
  if (!key) return;
  const root = rootOf();
  const selector = key.startsWith("item:") ? `[data-item="${key.slice(5)}"]` : `[data-focus="${key}"]`;
  // A button that just went disabled (top row's up) hands focus to its row, not away down the page.
  const row = key.split(":")[0];
  const next = root?.querySelector<HTMLElement>(`${selector}:not([disabled])`)
    ?? root?.querySelector<HTMLElement>(`[data-focus^="${row}:"]:not([disabled])`)
    ?? root?.querySelector<HTMLElement>("[data-action=add-row]");
  next?.focus({ preventScroll: true });
}

/** Shows the preset the rows match, or none, so any preset can always be chosen. */
function syncPreset(): void {
  if (!presetEl) return;
  const rows = board.tiers.map((tier) => tier.label).join("|");
  presetEl.selectedIndex = PRESET_IDS.findIndex((id) => presetLabels(id).join("|") === rows);
}

function paint(): void {
  if (!rowsEl || !poolEl) return;
  const focused = focusKey();
  rowsEl.replaceChildren(...board.tiers.map((tier, index) => rowEl(tier.id, index)));
  poolEl.replaceChildren(
    ...board.pool.map(itemEl),
    placeButton(null) ?? "",
  );
  poolEl.dataset.empty = board.pool.length ? "" : "1";
  const addRow = rootOf()?.querySelector<HTMLButtonElement>("[data-action=add-row]");
  if (addRow) addRow.disabled = board.tiers.length >= MAX_TIERS;
  const removeBtn = rootOf()?.querySelector<HTMLButtonElement>("[data-action=delete-item]");
  if (removeBtn) removeBtn.disabled = !selected;
  syncPreset();
  restoreFocus(focused);
  note(selected ? t("tierList.pickedHint", { name: board.items[selected]?.text || imageLabel() }) : t("tierList.count", { n: itemCount(board), max: MAX_ITEMS }));
}

function startDrag(e: PointerEvent, id: string): void {
  // One drag at a time: a second finger or the mouse must not orphan the first ghost.
  // Touch places by tap so a swipe scrolls; Ctrl+click on a Mac is a context menu, not a drag.
  if (e.button !== 0 || e.ctrlKey || e.pointerType === "touch" || drag) return;
  const el = e.currentTarget as HTMLElement;
  drag = { id, el, ghost: null, startX: e.clientX, startY: e.clientY, pointer: e.pointerId, moved: false };
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragEnd);
  window.addEventListener("pointercancel", cancelDrag);
}

function onDragMove(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointer) return;
  // The button came up where we could not see it (a context menu took the pointerup).
  if (!e.buttons) {
    cancelDrag(e);
    return;
  }
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
  const hit = document.elementFromPoint(x, y);
  // Anywhere on a row counts, its name and buttons too.
  const under = hit?.closest<HTMLElement>("[data-drop]") ?? hit?.closest<HTMLElement>("[data-tier]")?.querySelector<HTMLElement>("[data-drop]");
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
  if (!moved) return;
  justDragged = true;
  // The click after a drag only fires on the element it started on; clear the flag if none comes.
  setTimeout(() => { justDragged = false; }, 0);
  const target = dropTarget(e.clientX, e.clientY);
  if (target) {
    moveItem(board, id, target.tier, target.index);
    save();
  }
  paint();
}

function cancelDrag(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointer) return;
  const moved = drag.moved;
  endDrag();
  if (moved) paint();
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
  const existing = Object.values(board.items).filter((item) => !item.image).map((item) => item.text);
  const fresh = parseItems(entryEl.value, existing);
  const added = addItems(board, fresh.map((text) => ({ text })));
  // Lines that did not fit stay in the box, so they can go in after clearing space.
  entryEl.value = fresh.slice(added).join("\n");
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
  // Excel and Word put a picture of the text next to the text: into a text field, the text wins.
  const target = e.target as HTMLElement | null;
  if (target?.closest?.("input, textarea, select, [contenteditable]") && e.clipboardData?.getData("text/plain")) return;
  const pasted = e.clipboardData?.files;
  if (pasted?.length) {
    const images = Array.from(pasted).filter((file) => file.type.startsWith("image/"));
    if (images.length) {
      e.preventDefault();
      addFiles(images);
    }
  }
}

/** Dragged text is left alone, so it can land in a text field. */
function carriesFiles(e: DragEvent): boolean {
  return Boolean(e.dataTransfer?.types.includes("Files"));
}

/** Back from the bfcache: this frozen page heard no storage events, so reload what another tab saved. */
function onPageShow(e: PageTransitionEvent): void {
  if (!e.persisted || saveTimer || files.size) return;
  const next = load();
  board = next;
  selected = null;
  if (titleEl) titleEl.value = board.title;
  paint();
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
  // Decoding takes a while with many photos and the board stays editable: draw what was there when asked.
  const shot: Board = structuredClone(board);
  const shotFiles = new Map(files);
  const layout = pngLayout(shot);
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
    drawCentered(ctx, shot.title.trim(), PNG_WIDTH / 2, layout.titleHeight / 2, PNG_WIDTH - 40, 28, 1);
  }
  for (const row of layout.rows) {
    const tier = shot.tiers.find((candidate) => candidate.id === row.tierId)!;
    ctx.fillStyle = tier.color;
    ctx.fillRect(0, row.y, PNG_LABEL, row.height);
    ctx.fillStyle = textOn(tier.color);
    drawCentered(ctx, tier.label, PNG_LABEL / 2, row.y + row.height / 2, PNG_LABEL - 12, 26, 3);
    for (const cell of row.cells) {
      const item = shot.items[cell.id];
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cell.x, cell.y, PNG_CELL, PNG_CELL);
      if (item.image) {
        try {
          const { bitmap, width, height } = await decodeImage(shotFiles.get(item.image)!);
          const side = Math.min(width, height);
          ctx.drawImage(bitmap, (width - side) / 2, (height - side) / 2, side, side, cell.x, cell.y, PNG_CELL, PNG_CELL);
          bitmap.close();
        } catch {
          // One picture the canvas cannot read (a sizeless SVG) shows its name; the chart still exports.
          ctx.fillStyle = "#1a1a1a";
          drawCentered(ctx, item.text || imageLabel(), cell.x + PNG_CELL / 2, cell.y + PNG_CELL / 2, PNG_CELL - 10, 15, 4);
        }
      } else {
        ctx.fillStyle = "#1a1a1a";
        drawCentered(ctx, item.text, cell.x + PNG_CELL / 2, cell.y + PNG_CELL / 2, PNG_CELL - 10, 15, 4);
      }
    }
  }
  return canvasToBlob(canvas, "image/png", 1);
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

/** Starting over or unranking everything cannot be undone, so a board with items asks for a second press. */
function pressTwice(btn: HTMLButtonElement, idle: string, act: () => void): void {
  const armed = armedBtn === btn;
  disarm();
  if (itemCount(board) && !armed) {
    armedBtn = btn;
    armedIdle = idle;
    btn.textContent = t("tierList.startOverConfirm");
    confirmTimer = window.setTimeout(disarm, CONFIRM_MS);
    return;
  }
  act();
}

function disarm(): void {
  clearTimeout(confirmTimer);
  confirmTimer = 0;
  if (armedBtn) armedBtn.textContent = armedIdle;
  armedBtn = null;
}

function startOver(): void {
  releaseUrls();
  selected = null;
  board = emptyBoard(presetLabels((presetEl?.value as PresetId) || defaultPreset()));
  if (titleEl) titleEl.value = "";
  paint();
  save();
}

function releaseUrls(): void {
  for (const url of files.keys()) URL.revokeObjectURL(url);
  files.clear();
  imageNodes.clear();
}

export function mountTierList(host: HTMLElement): void {
  board = load();
  selected = null;
  rowsEl = h("div", { class: "tier-rows", "data-out": "rows" });
  poolEl = h("div", { class: "tier-items tier-pool", "data-drop": "pool", "data-out": "pool" });
  noteEl = h("p", { class: "hint", "aria-live": "polite", "data-out": "note" });
  entryEl = h("textarea", { rows: "3", "data-field": "entry", spellcheck: "false", placeholder: t("tierList.entryPlaceholder"), "aria-label": t("tierList.entry") });
  titleEl = h("input", { type: "text", maxlength: String(MAX_ITEM_TEXT), "data-field": "title", value: board.title, placeholder: t("tierList.titlePlaceholder"), "aria-label": t("tierList.titleField"), onInput: () => { board.title = titleEl?.value ?? ""; save(); } });
  if (board.title) titleEl.setAttribute("data-restored", "");
  fileEl = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, "data-field": "files", onChange: () => { if (fileEl?.files) addFiles(fileEl.files); if (fileEl) fileEl.value = ""; } });
  presetEl = h("select", { "data-field": "preset", "aria-label": t("tierList.presetLabel"), onChange: () => applyPreset(presetEl!.value as PresetId) },
    ...PRESET_IDS.map((id) => h("option", { value: id, selected: id === defaultPreset() }, t(`tierList.preset.${id}`))),
  );
  const copyBtn: HTMLButtonElement = h("button", { type: "button", class: "btn ghost", "data-action": "copy", onClick: () => void copyWithFlash(copyBtn, boardText(board, imageLabel(), t("tierList.separator")), { done: t("tierList.copied"), failed: t("tierList.copyFailed") }) }, t("tierList.copy"));
  const pngBtn: HTMLButtonElement = h("button", { type: "button", class: "btn", "data-action": "png", onClick: () => void exportPng(pngBtn) }, t("tierList.download"));
  host.append(
    h("header", { class: "tool-head" },
      h("h1", null, t("tierList.title")),
      h("p", { class: "lede" }, t("tierList.privacyNote")),
    ),
    h("div", { class: "tier-tool", onDragover: (e: DragEvent) => { if (carriesFiles(e)) e.preventDefault(); }, onDrop: (e: DragEvent) => { if (carriesFiles(e)) { e.preventDefault(); addFiles(e.dataTransfer!.files); } } },
      h("div", { class: "tier-setup" },
        h("label", { class: "tier-field" }, h("span", null, t("tierList.titleField")), titleEl),
        h("label", { class: "tier-field" }, h("span", null, t("tierList.presetLabel")), presetEl),
      ),
      rowsEl,
      h("div", { class: "tier-actions" },
        h("button", { type: "button", class: "btn ghost", "data-action": "add-row", onClick: () => { if (addTier(board, t("tierList.newRow"))) { paint(); save(); } } }, t("tierList.addRow")),
        h("button", { type: "button", class: "btn ghost", "data-action": "clear", onClick: (e: Event) => pressTwice(e.currentTarget as HTMLButtonElement, t("tierList.clear"), () => { clearPlacements(board); selected = null; paint(); save(); }) }, t("tierList.clear")),
        h("button", { type: "button", class: "btn ghost", "data-action": "start-over", onClick: (e: Event) => pressTwice(e.currentTarget as HTMLButtonElement, t("tierList.startOver"), startOver) }, t("tierList.startOver")),
      ),
      h("h2", { class: "tier-sub" }, t("tierList.pool")),
      poolEl,
      noteEl,
      h("div", { class: "tier-add" },
        entryEl,
        h("div", { class: "tier-actions" },
          h("button", { type: "button", class: "btn ghost", "data-action": "add", onClick: addFromEntry }, t("tierList.add")),
          h("button", { type: "button", class: "btn ghost", "data-action": "pictures", onClick: () => fileEl?.click() }, t("tierList.addPictures")),
          h("button", { type: "button", class: "btn ghost", "data-action": "delete-item", disabled: true, onClick: () => { if (selected) drop(selected); } }, t("tierList.deleteItem")),
          fileEl,
        ),
      ),
      h("p", { class: "hint" }, t("tierList.hint")),
      h("p", { class: "hint" }, t("tierList.picturesNote")),
      h("div", { class: "tier-actions" }, pngBtn, copyBtn),
    ),
  );
  window.addEventListener("pagehide", flush);
  window.addEventListener("paste", onPaste);
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("beforeunload", warnPictures);
  paint();
}

export function unmountTierList(): void {
  flush();
  disarm();
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("storage", onStorage);
  window.removeEventListener("pageshow", onPageShow);
  window.removeEventListener("beforeunload", warnPictures);
  window.removeEventListener("pagehide", flush);
  endDrag();
  releaseUrls();
  rowsEl = poolEl = entryEl = titleEl = noteEl = presetEl = fileEl = null;
  selected = null;
  board = emptyBoard([]);
}
