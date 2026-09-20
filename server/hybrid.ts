import { ENV } from "./_core/env";
import type { PlannerInput } from "./planner";
import { hybridPlanRequestSchema, hybridPlanResponseSchema, type HybridPlanResponse } from "./contracts";

type HybridEnvelope = HybridPlanResponse;

export type HybridResult = {
  enabled: boolean;
  connected: boolean;
  provider: string;
  mode: "python-orchestrator" | "local-fallback";
  envelope?: HybridEnvelope;
  warning?: string;
};

function inputForPython(input: PlannerInput) {
  return hybridPlanRequestSchema.parse({
    contractVersion: "1.0",
    requestId: crypto.randomUUID(),
    requestedAt: new Date().toISOString(),
    budget: input.budget,
    styles: input.styles,
    finish: input.finish,
    mood: input.mood,
    room: {
      widthMm: input.room.width,
      depthMm: input.room.depth,
      heightMm: input.room.height,
      doorPosition: input.room.doorPosition,
      doorWidthMm: input.room.doorWidth,
      windowPosition: input.room.windowPosition,
      windowWidthMm: input.room.windowWidth,
      fixedConstraints: input.room.fixedConstraints,
      source: input.room.imageProvided ? "mixed" : "user-entered",
    },
    priorities: input.priorities,
    catalogue: { datasetVersion: "kohler-india-pricebook-2026-v2" },
    options: {
      maxDesigns: 3,
      includeImageAnalysis: Boolean(input.room.imageProvided),
      includeSemanticRetrieval: true,
      includeLookbookEvidence: true,
    },
  });
}

export async function callPythonOrchestrator(input: PlannerInput): Promise<HybridResult> {
  const endpoint = process.env.PYTHON_ORCHESTRATOR_URL ?? ENV.pythonOrchestratorUrl;
  if (!endpoint) {
    return {
      enabled: false,
      connected: false,
      provider: "typescript-local-planner",
      mode: "local-fallback",
      warning: "Python orchestrator URL is not configured; deterministic TypeScript planner used.",
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.PYTHON_ORCHESTRATOR_TIMEOUT_MS ?? ENV.pythonOrchestratorTimeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const request = inputForPython(input);
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Python orchestrator returned HTTP ${response.status}`);
    const parsed = hybridPlanResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error(`Python response failed contract validation: ${parsed.error.issues[0]?.message ?? "invalid response"}`);
    if (parsed.data.requestId !== request.requestId) throw new Error("Python response requestId does not match the request");
    return {
      enabled: true,
      connected: true,
      provider: parsed.data.provider,
      mode: "python-orchestrator",
      envelope: parsed.data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Python orchestrator error";
    console.warn(`[Hybrid] Falling back to local planner: ${message}`);
    return {
      enabled: true,
      connected: false,
      provider: "typescript-local-planner",
      mode: "local-fallback",
      warning: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function hybridEngineMetadata(hybrid: HybridResult) {
  return {
    enabled: hybrid.enabled,
    connected: hybrid.connected,
    mode: hybrid.mode,
    provider: hybrid.provider,
    warning: hybrid.warning ?? null,
    pythonModels: hybrid.envelope?.trace?.models ?? null,
    signals: hybrid.envelope?.signals ?? [],
    contractVersion: hybrid.envelope?.contractVersion ?? "1.0",
    requestId: hybrid.envelope?.requestId ?? null,
  };
}
