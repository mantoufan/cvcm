import { fill } from "../../shared/fill";
import type { Locale } from "../../shared/locale";
import { HREFLANG } from "../../shared/sitemap";
import type { BreedId } from "../../shared/breeds";
import { breedsHub } from "../../shared/breeds-i18n";
import { breedsPageHtml } from "../../shared/breeds-page";

/** Whether a list item passes the hub filters: words in its names, its size group and (dogs) its FCI group ("0" = none). */
export function breedMatches(item: { words: string; size: string; group: string; kind: string }, query: string, size: string, group: string): boolean {
  if (query && !item.words.includes(query)) return false;
  if (size && item.size !== size) return false;
  // The FCI group filter applies to dogs; with it set, cats (no FCI) are hidden.
  if (group && (item.kind !== "dogs" || item.group !== group)) return false;
  return true;
}

/** Search box and size / FCI group filters over both lists; counts per list, a note when a list is empty. */
function wireHub(host: HTMLElement, locale: Locale): void {
  const hub = breedsHub(locale);
  const search = host.querySelector<HTMLInputElement>(".breed-search");
  const size = host.querySelector<HTMLSelectElement>(".breed-size");
  const group = host.querySelector<HTMLSelectElement>(".breed-group");
  if (!search || !size || !group) return;
  const lists = [...host.querySelectorAll<HTMLElement>(".breed-list")];
  const apply = (): void => {
    const query = search.value.trim().toLocaleLowerCase(HREFLANG[locale]);
    for (const list of lists) {
      const items = [...list.querySelectorAll<HTMLLIElement>("li[data-kind]")];
      let shown = 0;
      for (const li of items) {
        const ok = breedMatches({ words: li.dataset.words ?? "", size: li.dataset.size ?? "", group: li.dataset.group ?? "", kind: li.dataset.kind ?? "" }, query, size.value, group.value);
        li.hidden = !ok;
        if (ok) shown++;
      }
      const count = list.querySelector<HTMLElement>(".breed-count");
      if (count) count.textContent = fill(hub.shown, { n: shown, total: items.length });
      const none = list.querySelector<HTMLElement>(".breed-none");
      if (none) none.hidden = shown > 0;
    }
  };
  search.addEventListener("input", apply);
  size.addEventListener("change", apply);
  group.addEventListener("change", apply);
}

/** The breeds hub (null) or one breed. Static text, so the page is the same HTML the Worker serves. */
export function mountBreeds(host: HTMLElement, locale: Locale, id: BreedId | null): void {
  host.innerHTML = breedsPageHtml(locale, id);
  if (!id) wireHub(host, locale);
}
