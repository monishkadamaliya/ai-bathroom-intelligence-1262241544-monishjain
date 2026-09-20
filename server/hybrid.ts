import { ENV } from "./_core/env";
import type { PlannerInput } from "./planner";

type HybridEnvelope = {
  provider?: string;
  version?: string;
  mode?: string;
  confidence?: number;
  signals?: Array<{ key: string; value: string | number | boolean; confidence?: number; source?: string }>;
  models?: { vision?: string; reasoning?: string; retrieval?: string };
  warnings?: string[];
};

export type HybridResult = {
  enabled: boolean;
  connected: boolean;
  provider: string;
  mode: "python-orchestrator" | "local-fallback";
  envelope?: HybridEnvelope;
  warning?: string;
};

function inputForPython(input: PlannerInput) {
  return {
    budget: input.budget,
    styles: input.styles,
    finish: input.finish,
    mood: input.mood,
    room: input.room,
    priorities: input.priorities,
  };
}

export async function callPythonOrchestrator(input: PlannerInput): Promise<HybridResult> {
  const endpoint = ENV.pythonOrchestratorUrl;
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
  const timeout = setTimeout(() => controller.abort(), ENV.pythonOrchestratorTimeoutMs);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(inputForPython(input)),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Python orchestrator returned HTTP ${response.status}`);
    const envelope = (await response.json()) as HybridEnvelope;
    return {
      enabled: true,
      connected: true,
      provider: envelope.provider ?? "python-fastapi",
      mode: "python-orchestrator",
      envelope,
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
    pythonModels: hybrid.envelope?.models ?? null,
    signals: hybrid.envelope?.signals ?? [],
  };
}
