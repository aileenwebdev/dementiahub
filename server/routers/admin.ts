import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { config } from "../config";
import {
  getAdminOverviewStats,
  getAdminRecentAIConversations,
  getAdminRecentCallSessions,
  getAdminUserDetail,
  getAdminUsers,
  getPendingFailedSyncs,
} from "../db";
import { getAllConversations } from "../services/elevenlabs";
import { extractCaregiversPipeline, getPipelines } from "../services/ghl";
import { backfillPortalSignupConsentForAllUsers } from "../services/identitySync";

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
