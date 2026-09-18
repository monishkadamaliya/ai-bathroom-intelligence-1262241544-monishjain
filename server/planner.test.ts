import { describe, expect, it } from "vitest";
import { buildPlannerResult, getCatalogueMeta } from "./planner";

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
  });

  it("returns three grounded configurations with real SKUs and computed totals", () => {
    const result = buildPlannerResult(input);
    expect(result.designs).toHaveLength(3);
    expect(result.sourceHealth.relationshipRows).toBe(675);
    expect(result.sourceHealth.lookbookProducts).toBe(489);
    for (const design of result.designs) {
      expect(design.products.length).toBeGreaterThanOrEqual(4);
      expect(design.products.every((product: any) => product.sku && product.price > 0)).toBe(true);
      expect(design.total).toBe(design.products.reduce((sum: number, product: any) => sum + product.price, 0));
      expect(design.budget).toBe(input.budget);
      expect(design.validations.spatial.status).toBe("review");
      expect(design.products.some((product: any) => product.source.reviewRequired === true || product.source.reviewRequired === false)).toBe(true);
    }
  });

  it("does not fabricate sustainability claims when product fields are absent", () => {
    const result = buildPlannerResult(input);
    const products = result.designs[0].products;
    expect(products.every((product: any) => product.sustainability.status === "documented" || product.sustainability.status === "requires_confirmation")).toBe(true);
    expect(result.spaceAnalysis.note).toContain("Upload a bathroom image");
  });
});
