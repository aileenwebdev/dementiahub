import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router, staffProcedure } from "../_core/trpc";
import { config } from "../config";
import {
  createAIChatMessage,
  createCallbackAttempt,
  getAdminOverviewStats,
  getAdminRecentAIConversations,
  getAdminRecentCallSessions,
  getAdminStaffDashboard,
  getAIChatConversationById,
  getCallSessionBySessionId,
  getAdminUserDetail,
  getAdminUsers,
  getPendingFailedSyncs,
  getSupportCallCase,
  getSupportConversationCase,
  touchAIChatConversation,
  updateAIChatConversation,
  updateCallSession,
} from "../db";
import { getAllConversations } from "../services/elevenlabs";
import { extractCaregiversPipeline, getPipelines } from "../services/ghl";
import { backfillPortalSignupConsentForAllUsers } from "../services/identitySync";

const caseStatusEnum = z.enum([
  "new",
  "open",
  "in_progress",
  "pending_callback",
  "pending_caregiver",
  "pending_internal",
  "resolved",
  "closed",
  "escalated",
]);

const casePriorityEnum = z.enum(["low", "normal", "high", "urgent"]);
const callbackStatusEnum = z.enum([
  "scheduled",
  "attempted",
  "connected",
  "no_answer",
  "left_voicemail",
  "invalid_number",
  "cancelled",
]);

function getResolutionTimestamp(caseStatus?: z.infer<typeof caseStatusEnum>) {
  if (caseStatus === "resolved" || caseStatus === "closed") {
    return new Date();
  }
  if (caseStatus) {
    return null;
  }
  return undefined;
}

export const adminRouter = router({
  overview: adminProcedure.query(async () => {
    const [stats, users, recentCalls, recentChats, failedSyncs] = await Promise.all([
      getAdminOverviewStats(),
      getAdminUsers({ limit: 8 }),
      getAdminRecentCallSessions(8),
      getAdminRecentAIConversations(8),
      getPendingFailedSyncs(8),
    ]);

    return {
      stats,
      users,
      recentCalls,
      recentChats,
      failedSyncs,
    };
  }),

  staffDashboard: staffProcedure.query(async () => {
    return getAdminStaffDashboard(60);
  }),

  staffConversationCase: staffProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const result = await getSupportConversationCase(input.conversationId);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation case not found" });
      }
      return result;
    }),

  staffCallCase: staffProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input }) => {
      const result = await getSupportCallCase(input.sessionId);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call case not found" });
      }
      return result;
    }),

  updateConversationCase: staffProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        caseStatus: caseStatusEnum.optional(),
        casePriority: casePriorityEnum.optional(),
        resolutionType: z.string().min(1).max(50).optional(),
        resolutionNotes: z.string().max(4000).optional(),
        humanTakeover: z.boolean().optional(),
        ownershipAction: z.enum(["claim", "release"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await getAIChatConversationById(input.conversationId);
      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation case not found" });
      }

      await updateAIChatConversation(input.conversationId, {
        caseStatus: input.caseStatus,
        casePriority: input.casePriority,
        resolutionType: input.resolutionType,
        resolutionNotes: input.resolutionNotes,
        humanTakeover: input.humanTakeover,
        humanTakeoverAt: input.humanTakeover ? new Date() : input.humanTakeover === false ? null : undefined,
        assignedStaffUserId:
          input.ownershipAction === "claim"
            ? ctx.user.id
            : input.ownershipAction === "release"
              ? null
              : undefined,
        resolvedAt: getResolutionTimestamp(input.caseStatus),
      });

      return getSupportConversationCase(input.conversationId);
    }),

  updateCallCase: staffProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        caseStatus: caseStatusEnum.optional(),
        casePriority: casePriorityEnum.optional(),
        resolutionType: z.string().min(1).max(50).optional(),
        resolutionNotes: z.string().max(4000).optional(),
        humanTakeover: z.boolean().optional(),
        ownershipAction: z.enum(["claim", "release"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call case not found" });
      }

      await updateCallSession(input.sessionId, {
        caseStatus: input.caseStatus,
        casePriority: input.casePriority,
        resolutionType: input.resolutionType,
        resolutionNotes: input.resolutionNotes,
        humanTakeover: input.humanTakeover,
        humanTakeoverAt: input.humanTakeover ? new Date() : input.humanTakeover === false ? null : undefined,
        assignedStaffUserId:
          input.ownershipAction === "claim"
            ? ctx.user.id
            : input.ownershipAction === "release"
              ? null
              : undefined,
        resolvedAt: getResolutionTimestamp(input.caseStatus),
      });

      return getSupportCallCase(input.sessionId);
    }),

  sendStaffChatReply: staffProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        content: z.string().min(1).max(8000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await getAIChatConversationById(input.conversationId);
      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation case not found" });
      }

      const now = new Date();
      await createAIChatMessage({
        conversationId: input.conversationId,
        portalUserId: conversation.portalUserId,
        role: "staff",
        content: input.content.trim(),
      });
      await touchAIChatConversation(input.conversationId);
      await updateAIChatConversation(input.conversationId, {
        humanTakeover: true,
        humanTakeoverAt: conversation.humanTakeover ? conversation.humanTakeoverAt : now,
        assignedStaffUserId: ctx.user.id,
        lastStaffResponseAt: now,
        caseStatus: "pending_caregiver",
      });

      return getSupportConversationCase(input.conversationId);
    }),

  shareManualCallTranscript: staffProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        phoneNumber: z.string().min(3).max(30),
        transcript: z.string().min(1).max(12000),
        notes: z.string().max(4000).optional(),
        callbackStatus: callbackStatusEnum.default("connected"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await getAIChatConversationById(input.conversationId);
      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation case not found" });
      }

      const now = new Date();
      const transcriptMessage = [
        "Manual call transcript shared by staff:",
        "",
        input.transcript.trim(),
      ].join("\n");

      await createAIChatMessage({
        conversationId: input.conversationId,
        portalUserId: conversation.portalUserId,
        role: "staff",
        content: transcriptMessage,
      });
      await createCallbackAttempt({
        portalUserId: conversation.portalUserId,
        staffUserId: ctx.user.id,
        conversationId: input.conversationId,
        phoneNumber: input.phoneNumber,
        status: input.callbackStatus,
        notes: input.notes?.trim() || "Manual call transcript shared in portal chat.",
        startedAt: now,
        endedAt: now,
      });
      await touchAIChatConversation(input.conversationId);
      await updateAIChatConversation(input.conversationId, {
        humanTakeover: true,
        humanTakeoverAt: conversation.humanTakeover ? conversation.humanTakeoverAt : now,
        assignedStaffUserId: ctx.user.id,
        lastStaffResponseAt: now,
        caseStatus: "pending_caregiver",
      });

      return getSupportConversationCase(input.conversationId);
    }),

  logCallbackAttempt: staffProcedure
    .input(
      z.object({
        portalUserId: z.number().int().positive(),
        conversationId: z.number().int().positive().optional(),
        sessionId: z.string().min(1).optional(),
        phoneNumber: z.string().min(3).max(30),
        status: callbackStatusEnum,
        notes: z.string().max(4000).optional(),
        startedAt: z.date().optional(),
        endedAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createCallbackAttempt({
        portalUserId: input.portalUserId,
        staffUserId: ctx.user.id,
        conversationId: input.conversationId,
        sessionId: input.sessionId,
        phoneNumber: input.phoneNumber,
        status: input.status,
        notes: input.notes,
        startedAt: input.startedAt ?? new Date(),
        endedAt: input.endedAt,
      });

      const nextCaseStatus =
        input.status === "connected"
          ? "in_progress"
          : input.status === "cancelled" || input.status === "invalid_number"
            ? "pending_internal"
            : "pending_callback";

      if (input.conversationId) {
        await updateAIChatConversation(input.conversationId, {
          assignedStaffUserId: ctx.user.id,
          caseStatus: nextCaseStatus,
          lastStaffResponseAt: new Date(),
        });
      }

      if (input.sessionId) {
        await updateCallSession(input.sessionId, {
          assignedStaffUserId: ctx.user.id,
          caseStatus: nextCaseStatus,
          lastStaffResponseAt: new Date(),
        });
      }

      return input.conversationId
        ? getSupportConversationCase(input.conversationId)
        : input.sessionId
          ? getSupportCallCase(input.sessionId)
          : null;
    }),

  users: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getAdminUsers({
        search: input?.search,
        limit: input?.limit ?? 50,
      });
    }),

  userDetail: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return getAdminUserDetail(input.userId);
    }),

  integration: adminProcedure.query(async () => {
    const ghlConfigured = Boolean(config.ghlApiKey && config.ghlLocationId);
    const elevenLabsConfigured = Boolean(config.elevenLabsApiKey && config.elevenLabsAgentId);

    let pipelines: Awaited<ReturnType<typeof getPipelines>> = [];
    let caregiversPipeline: ReturnType<typeof extractCaregiversPipeline> | null = null;
    let ghlConnected = false;

    if (ghlConfigured) {
      try {
        pipelines = await getPipelines(config.ghlApiKey, config.ghlLocationId);
        caregiversPipeline = extractCaregiversPipeline(pipelines) ?? null;
        ghlConnected = true;
      } catch {
        ghlConnected = false;
      }
    }

    let elevenLabsConversations: Awaited<ReturnType<typeof getAllConversations>> = [];
    if (elevenLabsConfigured) {
      try {
        elevenLabsConversations = await getAllConversations(
          config.elevenLabsApiKey,
          config.elevenLabsAgentId,
          20
        );
      } catch {
        elevenLabsConversations = [];
      }
    }

    const failedSyncs = await getPendingFailedSyncs(20);

    return {
      ghl: {
        configured: ghlConfigured,
        connected: ghlConnected,
        locationId: config.ghlLocationId || null,
        caregiversPipeline,
        pipelineCount: pipelines.length,
      },
      elevenlabs: {
        configured: elevenLabsConfigured,
        agentId: config.elevenLabsAgentId || null,
        recentConversations: elevenLabsConversations,
      },
      webhooks: {
        postCall: `${config.appUrl}/api/webhooks/elevenlabs/post-call`,
        consent: `${config.appUrl}/api/webhooks/elevenlabs/consent`,
        health: `${config.appUrl}/api/webhooks/health`,
        secretConfigured: {
          postCall: Boolean(config.elevenLabsPostCallWebhookSecret),
          consent: Boolean(config.elevenLabsConsentWebhookSecret),
        },
      },
      failedSyncs,
    };
  }),

  backfillPortalConsent: adminProcedure.mutation(async () => {
    const result = await backfillPortalSignupConsentForAllUsers();
    const stats = await getAdminOverviewStats();

    return {
      result,
      stats,
    };
  }),
});
