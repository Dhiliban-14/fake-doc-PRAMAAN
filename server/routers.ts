import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import { getLocalEvidencePath } from "./storage.local";
import {
  addCaseNote,
  addEvidenceRecord,
  addTimelineEvent,
  createCaseRecord,
  getCaseBundle,
  getCaseIntegrityAudit,
  listCases,
  listSourceRegistry,
  addSourceRegistry,
  updateSourceRegistry,
  getCaseEntitiesGraph,
  addInvestigatorFeedback,
  upsertUser,
  getUserByOpenId,
} from "./db";
import { generateLivenessChallenges, evaluateLivenessResponse } from "./services/livenessService";
import { compareDocumentVersions } from "./services/evolutionTracker";
import {
  isSupportedEvidenceMimeType,
  rejectMutableEvidenceOperation,
  rejectMutableTimelineOperation,
  safeEvidenceName,
  sha256Hex,
  validateEvidenceBytes,
} from "./evidence.helpers";
import { checkSourceHealth } from "./services/sourceRegistryService";
import { runAnalysisJob } from "./pipeline/analysisPipeline";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          usernameOrEmail: z.string().trim().min(3, "Username or email is required"),
          password: z.string().min(4, "Password must be at least 4 characters"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const identifier = input.usernameOrEmail.toLowerCase().trim();

        // Supported accounts: official credentials or any valid investigator credentials
        const validAccounts: Record<string, { openId: string; name: string; email: string; role: "admin" | "user" }> = {
          "investigator@pramaan.gov.in": {
            openId: "investigator-official",
            name: "Aarav Sharma",
            email: "investigator@pramaan.gov.in",
            role: "admin",
          },
          "aarav.sharma@pramaan.gov.in": {
            openId: "aarav-sharma-lead",
            name: "Aarav Sharma",
            email: "aarav.sharma@pramaan.gov.in",
            role: "admin",
          },
          "admin@pramaan.gov.in": {
            openId: "admin-root",
            name: "Chief Forensic Analyst",
            email: "admin@pramaan.gov.in",
            role: "admin",
          },
          "admin": {
            openId: "admin-root",
            name: "Chief Forensic Analyst",
            email: "admin@pramaan.gov.in",
            role: "admin",
          },
          "investigator": {
            openId: "investigator-general",
            name: "Investigating Officer",
            email: "investigator@pramaan.gov.in",
            role: "user",
          },
        };

        const account = validAccounts[identifier] || {
          openId: `user-${identifier.replace(/[^a-z0-9]/g, "-")}`,
          name: identifier.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          email: identifier.includes("@") ? identifier : `${identifier}@pramaan.gov.in`,
          role: identifier.includes("admin") ? "admin" : "user",
        };

        // Allowed passwords: "pramaan2026", "pramaan@123", "password", "admin123", "investigator", "password123"
        const allowedPasswords = ["pramaan2026", "pramaan@123", "password", "admin123", "investigator", "password123", "123456"];
        if (!allowedPasswords.includes(input.password)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid credentials. Use demo password 'pramaan2026' or click 'Autofill Demo Credentials'.",
          });
        }

        await upsertUser({
          openId: account.openId,
          name: account.name,
          email: account.email,
          loginMethod: "credentials",
          role: account.role,
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(account.openId);

        const sessionToken = await sdk.createSessionToken(account.openId, {
          name: account.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
          user: user || {
            id: 1,
            openId: account.openId,
            name: account.name,
            email: account.email,
            loginMethod: "credentials",
            role: account.role,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          },
          token: sessionToken,
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  cases: router({
    list: protectedProcedure.query(() => listCases()),
    get: protectedProcedure
      .input(z.object({ caseId: z.string().min(1) }))
      .query(({ input }) => getCaseBundle(input.caseId)),
    audit: protectedProcedure
      .input(z.object({ caseId: z.string().min(1) }))
      .query(({ input }) => getCaseIntegrityAudit(input.caseId)),
    registry: protectedProcedure.query(() => listSourceRegistry()),
    graph: protectedProcedure
      .input(z.object({ caseId: z.number().int().positive() }))
      .query(({ input }) => getCaseEntitiesGraph(input.caseId)),
    create: protectedProcedure
      .input(z.object({ title: z.string().trim().min(3).max(255) }))
      .mutation(({ input, ctx }) => createCaseRecord({ title: input.title, ownerId: ctx.user?.id })),
    addNote: protectedProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          note: z.string().trim().min(1).max(5000),
        })
      )
      .mutation(({ input, ctx }) =>
        addCaseNote({ caseId: input.caseId, authorId: ctx.user?.id, note: input.note })
      ),
    ingest: protectedProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          originalName: z.string().trim().min(1).max(255),
          mimeType: z.string().min(1),
          fileBase64: z.string().min(1).max(36_000_000),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
          pageCount: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // 1. Validate MIME type
        if (!isSupportedEvidenceMimeType(input.mimeType)) {
          throw new Error("Unsupported evidence MIME type. Use JPG, JPEG, PNG, WEBP, or PDF.");
        }
        // 2. Validate file size
        const bytes = Buffer.from(input.fileBase64, "base64");
        validateEvidenceBytes(bytes);

        // 3. Preserve original bytes & compute SHA-256
        const sha256 = sha256Hex(bytes);
        const safeName = safeEvidenceName(input.originalName);

        // 4. Store original evidence
        const stored = await storagePut(
          `evidence/${input.caseId}/${Date.now()}-${safeName}`,
          bytes,
          input.mimeType
        );

        // 5. Create immutable evidence record
        const item = await addEvidenceRecord({
          caseId: input.caseId,
          originalName: input.originalName,
          storageKey: stored.key,
          mimeType: input.mimeType,
          sha256,
          fileSize: bytes.length,
          width: input.width,
          height: input.height,
          pageCount: input.pageCount,
        });

        // 6. Create immutable timeline event
        await addTimelineEvent({
          caseId: input.caseId,
          eventType: "evidence_uploaded",
          detail: `Original evidence preserved as ${input.originalName}; cryptographic SHA-256 anchored.`,
          evidenceReference: item?.evidenceId,
        });

        // 7. Trigger asynchronous analysis job (Phase 4)
        if (item) {
          const localPath = getLocalEvidencePath(stored.key);
          if (localPath) {
            // Run analysis pipeline in background without blocking upload response
            void runAnalysisJob({
              caseId: input.caseId,
              evidenceId: item.id,
              evidenceRecordId: item.evidenceId,
              filePath: localPath,
              mimeType: input.mimeType,
              originalName: input.originalName,
            });
          }
        }

        // 8. Return Case ID and Evidence ID
        return {
          caseId: input.caseId,
          evidenceId: item?.evidenceId,
          evidence: item,
          url: stored.url,
          sha256,
        };
      }),
    runAnalysis: protectedProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          evidenceId: z.number().int().positive(),
          evidenceRecordId: z.string().min(1),
          storageKey: z.string().min(1),
          mimeType: z.string().min(1),
          originalName: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const localPath = getLocalEvidencePath(input.storageKey);
        if (!localPath) throw new Error("Evidence file not found on storage.");
        await runAnalysisJob({
          caseId: input.caseId,
          evidenceId: input.evidenceId,
          evidenceRecordId: input.evidenceRecordId,
          filePath: localPath,
          mimeType: input.mimeType,
          originalName: input.originalName,
        });
        return { success: true };
      }),
    addSource: protectedProcedure
      .input(
        z.object({
          organization: z.string().min(2),
          officialDomain: z.string().min(3),
          recruitmentPortal: z.string().optional(),
          officialApi: z.string().optional(),
          knownPatterns: z.array(z.string()).optional(),
        })
      )
      .mutation(({ input }) => addSourceRegistry(input)),
    updateSource: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          organization: z.string().optional(),
          officialDomain: z.string().optional(),
          recruitmentPortal: z.string().optional(),
          officialApi: z.string().optional(),
          knownPatterns: z.array(z.string()).optional(),
          active: z.number().int().min(0).max(1).optional(),
        })
      )
      .mutation(({ input }) => updateSourceRegistry(input.id, input)),
    deactivateSource: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => updateSourceRegistry(input.id, { active: 0 })),
    checkSourceHealth: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => checkSourceHealth(input.id)),
    addTimelineEvent: protectedProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          eventType: z.string().min(1).max(100),
          detail: z.string().min(1).max(5000),
          evidenceReference: z.string().max(64).optional(),
        })
      )
      .mutation(({ input }) => addTimelineEvent(input)),
    updateEvidence: protectedProcedure
      .input(z.object({ evidenceId: z.string().min(1) }))
      .mutation(() => rejectMutableEvidenceOperation("update")),
    deleteEvidence: protectedProcedure
      .input(z.object({ evidenceId: z.string().min(1) }))
      .mutation(() => rejectMutableEvidenceOperation("delete")),
    updateTimeline: protectedProcedure
      .input(z.object({ timelineId: z.number().int().positive() }))
      .mutation(() => rejectMutableTimelineOperation("update")),
    deleteTimeline: protectedProcedure
      .input(z.object({ timelineId: z.number().int().positive() }))
      .mutation(() => rejectMutableTimelineOperation("delete")),
    livenessChallenges: protectedProcedure.query(() => generateLivenessChallenges()),
    evaluateLiveness: protectedProcedure
      .input(
        z.object({
          framesCount: z.number().int().min(1),
          faceDetected: z.boolean(),
          averageBrightness: z.number(),
          movementVariance: z.number(),
        })
      )
      .mutation(({ input }) => evaluateLivenessResponse(input)),
    submitFeedback: protectedProcedure
      .input(
        z.object({
          caseId: z.number().int().positive(),
          tag: z.enum([
            "correct_detection",
            "false_positive",
            "false_negative",
            "missed_evidence",
            "incorrect_explanation",
          ]),
          comment: z.string().trim().min(2).max(2000),
          findingId: z.string().optional(),
        })
      )
      .mutation(({ input }) => addInvestigatorFeedback(input)),
    compareVersions: protectedProcedure
      .input(
        z.object({
          v1: z.object({
            version: z.number(),
            sha256: z.string(),
            claims: z.array(z.object({ claimType: z.string(), normalizedValue: z.string() })),
            hasTampering: z.boolean(),
          }),
          v2: z.object({
            version: z.number(),
            sha256: z.string(),
            claims: z.array(z.object({ claimType: z.string(), normalizedValue: z.string() })),
            hasTampering: z.boolean(),
          }),
        })
      )
      .query(({ input }) => compareDocumentVersions(input.v1, input.v2)),
  }),
});

export type AppRouter = typeof appRouter;
