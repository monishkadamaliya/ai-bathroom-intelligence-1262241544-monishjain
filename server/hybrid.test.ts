import { describe, expect, it } from "vitest";
import { callPythonOrchestrator, hybridEngineMetadata } from "./hybrid";

const input = {
  budget: 300000,
  styles: ["Warm"],
  finish: "Brushed brass",
  mood: 40,
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

describe("hybrid Python bridge", () => {
  it("keeps the local planner available when the Python URL is not configured", async () => {
    const result = await callPythonOrchestrator(input);
    expect(result.mode).toBe("local-fallback");
    expect(result.connected).toBe(false);
    expect(result.warning).toContain("not configured");
    expect(hybridEngineMetadata(result)).toMatchObject({ enabled: false, provider: "typescript-local-planner" });
  });
});
