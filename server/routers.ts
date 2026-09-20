import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { buildPlannerResult, getCatalogueMeta } from "./planner";
import { callPythonOrchestrator, hybridEngineMetadata } from "./hybrid";
import { storagePut } from "./storage";

const roomSchema = z.object({
  width: z.number().min(1200).max(10000),
  depth: z.number().min(1200).max(10000),
  height: z.number().min(1800).max(5000),
  doorPosition: z.string(),
  doorWidth: z.number().min(400).max(1800),
  windowPosition: z.string(),
  windowWidth: z.number().min(0).max(5000),
  fixedConstraints: z.string(),
  imageProvided: z.boolean().optional(),
  image: z.object({
    storagePath: z.string().min(1).max(500),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    widthPx: z.number().int().positive().max(20_000),
    heightPx: z.number().int().positive().max(20_000),
    sizeBytes: z.number().int().positive().max(10_000_000),
  }).optional(),
});

const plannerInput = z.object({
  budget: z.number().min(10000).max(10000000),
  styles: z.array(z.string()).max(2),
  finish: z.string(),
  mood: z.number().min(0).max(100),
  room: roomSchema,
  priorities: z.object({
    spaceEfficiency: z.number().min(0).max(100),
    luxury: z.number().min(0).max(100),
    sustainability: z.number().min(0).max(100),
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalogue: router({
    meta: publicProcedure.query(() => getCatalogueMeta()),
  }),
  room: router({
    uploadImage: publicProcedure
      .input(z.object({
        fileName: z.string().min(1).max(180),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        contentBase64: z.string().min(1).max(15_000_000),
        widthPx: z.number().int().positive().max(20_000),
        heightPx: z.number().int().positive().max(20_000),
        sizeBytes: z.number().int().positive().max(10_000_000),
      }))
      .mutation(async ({ input }) => {
        const bytes = Buffer.from(input.contentBase64, "base64");
        if (bytes.length === 0 || bytes.length > 10_000_000 || bytes.length !== input.sizeBytes) {
          throw new Error("Room image payload is invalid or exceeds the 10 MB limit");
        }
        const safeName = input.fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-120) || "room-image";
        const uploaded = await storagePut(`room-images/${crypto.randomUUID()}-${safeName}`, bytes, input.mimeType);
        return { ...uploaded, mimeType: input.mimeType, widthPx: input.widthPx, heightPx: input.heightPx, sizeBytes: bytes.length };
      }),
  }),
  planner: router({
    run: publicProcedure.input(plannerInput).mutation(async ({ input }) => {
      const result = buildPlannerResult(input);
      const hybrid = await callPythonOrchestrator(input);
      return {
        ...result,
        hybrid: hybridEngineMetadata(hybrid),
        engine: {
          ...result.engine,
          orchestration: hybrid.connected ? "Python FastAPI preflight + TypeScript deterministic design orchestrator" : result.engine.orchestration,
        },
      };
    }),
    ask: publicProcedure
      .input(
        z.object({
          question: z.string().min(1).max(500),
          designName: z.string(),
          total: z.number(),
          remaining: z.number(),
          fitConfidence: z.number(),
          spatialStatus: z.string(),
          compatibilityStatus: z.string(),
          productSkus: z.array(z.string()),
        }),
      )
      .mutation(({ input }) => {
        const question = input.question.toLowerCase();
        const focus = question.includes("budget") || question.includes("cost")
          ? `The selected ${input.designName} totals ₹${Math.round(input.total).toLocaleString("en-IN")}, leaving ₹${Math.max(0, Math.round(input.remaining)).toLocaleString("en-IN")} from the current budget.`
          : question.includes("space") || question.includes("efficient")
            ? `The spatial engine returned a ${input.spatialStatus} result with ${input.fitConfidence}% average fit confidence across the selected catalogue objects.`
            : question.includes("compatible") || question.includes("install")
              ? `The relationship check is ${input.compatibilityStatus}; the evidence is grounded in the supplied catalogue relationship records for ${input.productSkus.slice(0, 3).join(", ")}.`
              : `The recommendation is based on ${input.productSkus.length} actual catalogue SKUs, then checked against budget, spatial envelope, and relationship evidence.`;
        return {
          answer: `${focus} I can only speak to evidence returned by the planner; missing documentation is surfaced as review rather than inferred.`,
          attributions: ["AI · budget check", "AI · spatial check", "AI · compatibility check"],
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
