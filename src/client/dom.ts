type Props = Record<string, unknown> | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props,
  ...kids: Array<Node | string | number | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  // Set before src so the browser defers the fetch instead of starting it eagerly.
  if (props?.loading) el.setAttribute("loading", String(props.loading));
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false || key === "loading") continue;
      if (key === "class" || key === "className") {
        el.className = String(value);
      } else if (key === "style" && typeof value === "object") {
        Object.assign(el.style, value);
      } else if (key === "dataset" && typeof value === "object") {
        for (const [dk, dv] of Object.entries(value as Record<string, string>)) {
          el.dataset[dk] = dv;
        }
      } else if (key.startsWith("on") && typeof value === "function") {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, value as EventListener);
      } else if (key === "checked" && el instanceof HTMLInputElement) {
        el.checked = Boolean(value);
      } else if (key === "value" && "value" in el) {
        (el as HTMLInputElement).value = String(value);
      } else if (typeof value === "boolean") {
        if (value) el.setAttribute(key, "");
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  // happy-dom (the build-time prerender) does not honour a `selected` attribute set on an option before it joined the
  // select, so the static HTML showed a different default than browsers. Sync the value once the options are in.
  if (el instanceof HTMLSelectElement) {
    const marked = Array.from(el.options).filter((o) => o.hasAttribute("selected"));
    if (marked.length > 0) el.value = marked[marked.length - 1].value;
  }
  return el;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

/** Whether any part of `el` is inside the viewport (page-wide shortcuts only act on a tool the user can see). */
export function onScreen(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  // No layout at all (an empty box at 0,0) cannot tell; treat it as visible.
  if (r.width === 0 && r.height === 0 && r.top === 0) return true;
  return r.bottom > 0 && r.top < window.innerHeight;
}

/**
 * Mousedown on a tool's buttons: keep focus off them and drop focus held anywhere else (a field, a FAQ toggle, a link),
 * so the tool's Space and arrow shortcuts work after a mouse click.
 */
export function keepShortcutsOnClick(e: MouseEvent): void {
  if (!(e.target as HTMLElement | null)?.closest("button")) return;
  e.preventDefault();
  const focused = document.activeElement as HTMLElement | null;
  if (focused && focused !== document.body) focused.blur();
}
