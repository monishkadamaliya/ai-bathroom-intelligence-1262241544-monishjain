import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("hybrid Python bridge", () => {
  it("keeps the local planner available when the Python URL is not configured", async () => {
    const result = await callPythonOrchestrator(input);
    expect(result.mode).toBe("local-fallback");
    expect(result.connected).toBe(false);
    expect(result.warning).toContain("not configured");
    expect(hybridEngineMetadata(result)).toMatchObject({ enabled: false, provider: "typescript-local-planner" });
  });

  it("sends the versioned request and accepts the versioned response contract", async () => {
    vi.stubEnv("PYTHON_ORCHESTRATOR_URL", "http://python.test");
    const response = {
      contractVersion: "1.0",
      requestId: "request-123456",
      status: "partial",
      provider: "python-fastapi",
      generatedAt: new Date().toISOString(),
      confidence: 0.68,
      observations: {
        roomGeometry: { widthMm: 2400, depthMm: 3000, heightMm: 2400, source: "user-entered", confidence: 0.95 },
        imageAnalysis: { status: "not_requested", observations: [], confidence: 0.5 },
      },
      retrieval: { status: "partial", backend: "node-catalogue-contract", candidates: [], evidence: [] },
      constraints: { status: "pass", checks: [] },
      optimization: { status: "not_run", objective: "deferred", selectedSkus: [], alternatives: [] },
      signals: [{ key: "retrieval", value: "catalogue-grounded", confidence: 0.9, source: "test" }],
      warnings: [],
      trace: { serviceVersion: "hybrid-v1", models: { vision: null, reasoning: null, retrieval: "node-catalogue-contract" }, latencyMs: 2 },
    };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      expect(request.contractVersion).toBe("1.0");
      expect(request.room.widthMm).toBe(2400);
      expect(request.options.includeSemanticRetrieval).toBe(true);
      response.requestId = request.requestId;
      return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callPythonOrchestrator(input);
    expect(result.connected).toBe(true);
    expect(result.envelope?.contractVersion).toBe("1.0");
    expect(result.envelope?.requestId).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
