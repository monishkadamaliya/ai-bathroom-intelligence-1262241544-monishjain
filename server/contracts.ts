import { z } from "zod";

export const hybridPlanRequestSchema = z.object({
  contractVersion: z.literal("1.0"),
  requestId: z.string().min(8).max(100).regex(/^[A-Za-z0-9._:-]+$/),
  requestedAt: z.string().datetime(),
  budget: z.number().int().min(10000).max(10000000),
  styles: z.array(z.string().min(1)).max(2).default([]),
  finish: z.string().min(1).max(100),
  mood: z.number().int().min(0).max(100),
  room: z.object({
    widthMm: z.number().int().min(1200).max(10000),
    depthMm: z.number().int().min(1200).max(10000),
    heightMm: z.number().int().min(1800).max(5000),
    doorPosition: z.string().min(1).max(100),
    doorWidthMm: z.number().int().min(400).max(1800),
    windowPosition: z.string().min(1).max(100),
    windowWidthMm: z.number().int().min(0).max(5000),
    fixedConstraints: z.string().max(2000),
    source: z.enum(["user-entered", "user-confirmed", "ai-estimate", "mixed"]),
    image: z.object({
      storagePath: z.string().min(1).max(500),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      widthPx: z.number().int().positive().max(20000).optional(),
      heightPx: z.number().int().positive().max(20000).optional(),
      sizeBytes: z.number().int().positive().max(10_000_000),
    }).optional(),
  }),
  priorities: z.object({
    spaceEfficiency: z.number().int().min(0).max(100),
    luxury: z.number().int().min(0).max(100),
    sustainability: z.number().int().min(0).max(100),
  }),
  catalogue: z.object({
    datasetVersion: z.string().max(100).optional(),
    candidateSkus: z.array(z.string()).max(200).max(200).optional(),
  }).optional(),
  options: z.object({
    maxDesigns: z.number().int().min(1).max(3),
    includeImageAnalysis: z.boolean(),
    includeSemanticRetrieval: z.boolean(),
    includeLookbookEvidence: z.boolean(),
  }),
});

export const hybridPlanResponseSchema = z.object({
  contractVersion: z.literal("1.0"),
  requestId: z.string(),
  status: z.enum(["ok", "partial", "failed"]),
  provider: z.string(),
  generatedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  observations: z.object({
    roomGeometry: z.object({
      widthMm: z.number().int().nonnegative(),
      depthMm: z.number().int().nonnegative(),
      heightMm: z.number().int().nonnegative(),
      source: z.enum(["user-entered", "user-confirmed", "ai-estimate", "mixed"]),
      confidence: z.number().min(0).max(1),
    }),
    imageAnalysis: z.object({
      status: z.enum(["not_requested", "not_configured", "completed", "failed"]),
      observations: z.array(z.object({ key: z.string(), value: z.unknown(), confidence: z.number().min(0).max(1), source: z.string() })).max(100),
      confidence: z.number().min(0).max(1),
      imageStoragePath: z.string().max(500).optional(),
    }),
  }),
  retrieval: z.object({
    status: z.enum(["not_requested", "completed", "partial", "failed"]),
    backend: z.enum(["chroma", "node-catalogue-contract", "none"]),
    candidates: z.array(z.object({ sku: z.string(), score: z.number(), reasons: z.array(z.string()).max(20) })).max(200),
    evidence: z.array(z.object({ type: z.string(), reference: z.string(), detail: z.string(), confidence: z.number().min(0).max(1) })).max(200),
  }),
  constraints: z.object({
    status: z.enum(["pass", "review", "conflict"]),
    checks: z.array(z.object({ key: z.string(), status: z.enum(["pass", "review", "conflict"]), detail: z.string() })).max(100),
  }),
  optimization: z.object({
    status: z.enum(["not_run", "completed", "partial", "failed"]),
    objective: z.string().max(1000),
    selectedSkus: z.array(z.string()).max(200),
    alternatives: z.array(z.object({ id: z.string(), skus: z.array(z.string()), score: z.number(), rationale: z.string() })).max(3),
  }),
  signals: z.array(z.object({ key: z.string(), value: z.unknown(), confidence: z.number().min(0).max(1), source: z.string() })).max(200),
  warnings: z.array(z.string().max(1000)).max(50),
  trace: z.object({ serviceVersion: z.string().optional(), models: z.record(z.string(), z.string().nullable()).optional(), latencyMs: z.number().int().nonnegative().optional() }).optional(),
});

export type HybridPlanRequest = z.infer<typeof hybridPlanRequestSchema>;
export type HybridPlanResponse = z.infer<typeof hybridPlanResponseSchema>;
