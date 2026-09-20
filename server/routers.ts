import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { buildPlannerResult, getCatalogueMeta } from "./planner";
import { callPythonOrchestrator, hybridEngineMetadata } from "./hybrid";

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
