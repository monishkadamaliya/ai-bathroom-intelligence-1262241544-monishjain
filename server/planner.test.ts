import { describe, expect, it } from "vitest";
import { buildPlannerResult, getCatalogueMeta } from "./planner";
import { catalogueImageMap } from "./data/catalogueImageMap";

const input = {
  budget: 300000,
  styles: ["Warm", "Minimal"],
  finish: "Brushed brass",
  mood: 38,
  room: {
    width: 2400,
    depth: 3000,
    height: 2400,
    doorPosition: "South wall",
    doorWidth: 750,
    windowPosition: "North wall",
    windowWidth: 900,
    fixedConstraints: "",
    imageProvided: false,
  },
  priorities: { spaceEfficiency: 72, luxury: 54, sustainability: 48 },
};

describe("KOHLER planner engine", () => {
  it("reports the supplied catalogue and intelligence volumes", () => {
    const meta = getCatalogueMeta();
    expect(meta.catalogueRows).toBe(1477);
    expect(meta.pricedProducts).toBeGreaterThan(1000);
    expect(meta.styles).toContain("Warm");
    expect(meta.source).toContain("KOHLER India Price Book");
    expect(Object.keys(catalogueImageMap).length).toBeGreaterThan(100);
    expect(Object.values(catalogueImageMap)[0]).toContain("/manus-storage/");
  });

  it("returns three grounded configurations with real SKUs and computed totals", () => {
    const result = buildPlannerResult(input);
    expect(result.designs).toHaveLength(3);
    expect(result.sourceHealth.relationshipRows).toBe(675);
    expect(result.sourceHealth.lookbookProducts).toBe(489);
    expect(result.sourceHealth.integrityAuditRows).toBeGreaterThan(10);
    expect(result.sourceHealth.validationErrorRows).toBeGreaterThan(0);
    expect(result.sourceHealth.alternativeConfigurationRows).toBeGreaterThan(0);
    for (const design of result.designs) {
      expect(design.products.length).toBeGreaterThanOrEqual(4);
      expect(design.products.every((product: any) => product.sku && product.price > 0)).toBe(true);
      expect(design.total).toBe(design.products.reduce((sum: number, product: any) => sum + product.price, 0));
      expect(design.budget).toBe(input.budget);
      expect(design.validations.spatial.status).toBe("review");
      expect(design.products.some((product: any) => product.source.reviewRequired === true || product.source.reviewRequired === false)).toBe(true);
    }
  });

  it("avoids repeating exact SKUs across alternative designs", () => {
    const result = buildPlannerResult(input);
    const skus = result.designs.flatMap((design: any) => design.products.map((product: any) => product.sku));
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("surfaces relationship evidence from the supplied relationship dataset", () => {
    const result = buildPlannerResult(input);
    const linked = result.designs.flatMap((design: any) => design.products).filter((product: any) => product.relationships.length > 0);
    expect(linked.length).toBeGreaterThan(0);
    expect(linked[0].whyItFits).toContain("catalogue relationship");
    expect(linked[0].relationships[0]).toMatchObject({ type: expect.any(String), target: expect.any(String) });
  });

  it("surfaces direct pre-optimized lookbook configurations with evidence", () => {
    const result = buildPlannerResult(input);
    expect(result.lookbookSuggestions).toHaveLength(3);
    expect(result.lookbookSuggestions.every((look: any) => look.lookId && look.lookName && look.products.length > 0)).toBe(true);
    expect(result.lookbookSuggestions[0].evidence).toContain("Projectlookbook");
    expect(result.lookbookSuggestions.every((look: any) => look.total > 0)).toBe(true);
  });

  it("does not fabricate sustainability claims when product fields are absent", () => {
    const result = buildPlannerResult(input);
    const products = result.designs[0].products;
    expect(products.every((product: any) => product.sustainability.status === "documented" || product.sustainability.status === "requires_confirmation")).toBe(true);
    expect(result.spaceAnalysis.note).toContain("Upload a bathroom image");
  });

  it("selects different supplied Figma palettes for different style directions", () => {
    const minimal = buildPlannerResult({ ...input, styles: ["Minimal"], mood: 20 });
    const classic = buildPlannerResult({ ...input, styles: ["Classic"], mood: 20 });
    expect(minimal.styleProfile.palette.palette_id).toBe("minimal_mono_004");
    expect(classic.styleProfile.palette.palette_id).toBe("luxury_warm_007");
    expect(minimal.styleProfile.palette.palette_id).not.toBe(classic.styleProfile.palette.palette_id);
    expect(minimal.styleProfile.palette.provenance).toContain("Figma");
  });
});
