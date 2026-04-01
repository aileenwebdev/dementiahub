import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { config } from "../config";
import {
  extractCaregiversPipeline,
  GHLPipeline,
  getPipelines,
} from "../services/ghl";

// ─── In-memory cache for pipeline stages ─────────────────────────────────────
let stageCache: { data: GHLPipeline[] | null; fetchedAt: number | null } = {
  data: null,
  fetchedAt: null,
};
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function getCachedPipelines(): Promise<GHLPipeline[]> {
  const now = Date.now();
  if (!stageCache.data || !stageCache.fetchedAt || now - stageCache.fetchedAt > CACHE_TTL_MS) {
    if (!config.ghlApiKey || !config.ghlLocationId) return [];
    const pipelines = await getPipelines(config.ghlApiKey, config.ghlLocationId);
    stageCache = { data: pipelines, fetchedAt: now };
  }
  return stageCache.data ?? [];
}

export const ghlRouter = router({
  /**
   * Get all GHL pipelines for the configured location.
   */
  getPipelines: protectedProcedure.query(async () => {
    if (!config.ghlApiKey || !config.ghlLocationId) {
      return [];
    }
    return getCachedPipelines();
  }),

  /**
   * Get the "Caregiver Cases" pipeline specifically.
   */
  getCaregiversPipeline: protectedProcedure.query(async () => {
    if (!config.ghlApiKey || !config.ghlLocationId) {
      return null;
    }
    const pipelines = await getCachedPipelines();
    return extractCaregiversPipeline(pipelines) ?? null;
  }),

  /**
   * Force-refresh the pipeline stage cache.
   * Admin only.
   */
  refreshPipelineCache: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    stageCache = { data: null, fetchedAt: null };
    const pipelines = await getCachedPipelines();
    return { success: true, pipelineCount: pipelines.length };
  }),

  /**
   * Get integration status for the dashboard.
   */
  getIntegrationStatus: protectedProcedure.query(async () => {
    const ghlConfigured = Boolean(config.ghlApiKey && config.ghlLocationId);
    const elevenLabsConfigured = Boolean(config.elevenLabsApiKey && config.elevenLabsAgentId);

    let ghlConnected = false;
    if (ghlConfigured) {
      try {
        const pipelines = await getCachedPipelines();
        ghlConnected = pipelines.length >= 0; // successful fetch = connected
      } catch {
        ghlConnected = false;
      }
    }

    return {
      ghl: {
        configured: ghlConfigured,
        connected: ghlConnected,
        locationId: config.ghlLocationId || null,
      },
      elevenlabs: {
        configured: elevenLabsConfigured,
        agentId: config.elevenLabsAgentId || null,
      },
      webhookUrl: `${config.appUrl}/api/webhooks/elevenlabs/post-call`,
      consentWebhookUrl: `${config.appUrl}/api/webhooks/elevenlabs/consent`,
    };
  }),
});
