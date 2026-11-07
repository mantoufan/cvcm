// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncPageJsonLd } from "../src/client/faq";

const ld = (id: string) => document.getElementById(id)?.textContent ?? "";

describe("ranking structured data on the client", () => {
  beforeEach(() => { document.head.replaceChildren(); });
  afterEach(() => { document.head.replaceChildren(); });

  it("keeps Dataset, FAQ and breadcrumb on a ranking page and clears them after", () => {
    const sync = (page: "ai-models" | "hub" | null) => syncPageJsonLd("en", null, null, null, false, null, null, null, false, null, null, null, null, null, null, null, page);
    sync("ai-models");
    expect(JSON.parse(ld("dataset-jsonld"))["@type"]).toBe("Dataset");
    expect(JSON.parse(ld("faq-jsonld"))["@type"]).toBe("FAQPage");
    expect(ld("breadcrumb-jsonld")).toContain("/en/rankings/ai-models/");
    sync("hub");
    expect(JSON.parse(ld("dataset-jsonld"))["@type"]).toBe("DataCatalog");
    sync(null);
    expect(document.getElementById("dataset-jsonld")).toBeNull();
  });
});
