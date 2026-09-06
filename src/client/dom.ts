type Props = Record<string, unknown> | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props,
  ...kids: Array<Node | string | number | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
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
