import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { config } from "../config";
import {
  createCallSession,
  getCallSessionBySessionId,
  getCallSessionsByUserId,
  getIdentityByUserId,
  getTranscriptsBySessionId,
  updateCallSession,
} from "../db";
import {
  getAllConversations,
  getConversation,
  initiateOutboundCall,
} from "../services/elevenlabs";

export const callsRouter = router({
  /**
   * Initiate an outbound voice call via ElevenLabs.
   * Resolves the user's GHL identity and passes it as dynamic variables.
   */
  initiateCall: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(7, "Invalid phone number"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      if (!config.elevenLabsApiKey || !config.elevenLabsAgentId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "ElevenLabs is not configured. Please contact your administrator.",
        });
      }

      // Resolve GHL identity
      const identity = await getIdentityByUserId(userId);
      if (!identity?.ghlContactId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Your account is not yet linked to a GHL contact. Please complete your profile setup.",
        });
      }

      // Generate session ID
      const sessionId = `sess_${Date.now()}_${userId}`;

      // Initiate ElevenLabs call
      const result = await initiateOutboundCall(config.elevenLabsApiKey, {
        agentId: config.elevenLabsAgentId,
        phoneNumber: input.phoneNumber,
        dynamicVariables: {
          ghl_contact_id: identity.ghlContactId,
          ghl_location_id: identity.ghlLocationId ?? config.ghlLocationId,
          portal_user_id: String(userId),
          session_id: sessionId,
        },
      });

      if (!result?.conversation_id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to initiate call. Please try again.",
        });
      }

      // Store session in DB
      await createCallSession({
        sessionId,
        portalUserId: userId,
        ghlContactId: identity.ghlContactId,
        ghlLocationId: identity.ghlLocationId ?? config.ghlLocationId,
        elevenlabsConversationId: result.conversation_id,
        elevenlabsAgentId: config.elevenLabsAgentId,
        status: "active",
        callStartTime: new Date(),
      });

      return {
        sessionId,
        conversationId: result.conversation_id,
        status: "active",
        message: "Call initiated successfully",
      };
    }),

  /**
   * Get call history for the current user.
   */
  getCallHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const sessions = await getCallSessionsByUserId(ctx.user.id, input?.limit ?? 50);
      return sessions;
    }),

  /**
   * Get details of a specific call session including transcript.
   */
  getCallDetails: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found" });
      }

      // Ensure the call belongs to the current user
      if (session.portalUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Get transcript chunks from DB
      const transcriptChunks = await getTranscriptsBySessionId(input.sessionId);

      // If no chunks in DB but we have a conversation ID, try fetching from ElevenLabs
      let elevenLabsData = null;
      if (
        session.elevenlabsConversationId &&
        config.elevenLabsApiKey &&
        session.status === "completed"
      ) {
        try {
          elevenLabsData = await getConversation(
            config.elevenLabsApiKey,
            session.elevenlabsConversationId
          );
        } catch {
          // Non-fatal — use DB data
        }
      }

      return {
        session,
        transcriptChunks,
        elevenLabsData,
      };
    }),

  /**
   * Get all conversations from ElevenLabs for the configured agent.
   * Admin only.
   */
  getAllConversations: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    if (!config.elevenLabsApiKey || !config.elevenLabsAgentId) {
      return [];
    }

    return getAllConversations(config.elevenLabsApiKey, config.elevenLabsAgentId);
  }),

  /**
   * Mark a call session as completed (for manual status updates).
   */
  markCallCompleted: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.portalUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateCallSession(input.sessionId, {
        status: "completed",
        callEndTime: new Date(),
      });

      return { success: true };
    }),
});
