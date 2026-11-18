import { describe, expect, it } from "vitest";
import "../src/shared/messages-all";
import { countriesPageHtml } from "../src/shared/countries-page";
import { countryBreadcrumbJsonLd } from "../src/shared/countries-i18n";
import { caloriesPageHtml } from "../src/shared/calories-page";
import { caloriesBreadcrumbJsonLd } from "../src/shared/calories-i18n";
import { elementsPageHtml } from "../src/shared/elements-page";
import { elementsBreadcrumbJsonLd } from "../src/shared/elements-i18n";
import { datasetStaticHtml } from "../src/shared/datasets-i18n";

const trail = (html: string): string => html.match(/<nav class="device-crumb"[^]*?<\/nav>/)![0];
const steps = (ld: Record<string, unknown>): string[] => (ld.itemListElement as { item: string }[]).map((i) => i.item);

describe("reference channels sit under Data", () => {
  it("shows Home / Data / channel / page in the trail and the BreadcrumbList", () => {
    expect(trail(countriesPageHtml("zh-CN", "japan"))).toMatch(/data-nav="home"[^]*data-nav="datasets"[^]*data-nav="countries"/);
    expect(trail(caloriesPageHtml("en", "banana"))).toMatch(/data-nav="home"[^]*data-nav="datasets"[^]*data-nav="calories"/);
    expect(trail(elementsPageHtml("ja", "carbon"))).toMatch(/data-nav="home"[^]*data-nav="datasets"[^]*data-nav="elements"/);
    expect(steps(countryBreadcrumbJsonLd("en", "japan"))).toEqual(["https://cv.cm/en/", "https://cv.cm/en/datasets/", "https://cv.cm/en/countries/", "https://cv.cm/en/countries/japan/"]);
    expect(steps(caloriesBreadcrumbJsonLd("en", null))).toEqual(["https://cv.cm/en/", "https://cv.cm/en/datasets/", "https://cv.cm/en/calories/"]);
    expect(steps(elementsBreadcrumbJsonLd("en", "carbon"))[1]).toBe("https://cv.cm/en/datasets/");
  });

  it("lists the three channels on the data hub", () => {
    const hub = datasetStaticHtml("en", null);
    for (const href of ["/en/countries/", "/en/calories/", "/en/periodic-table/"]) expect(hub).toContain(`href="${href}"`);
  });
});
