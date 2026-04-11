import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { config } from "../config";
import {
  createCallSession,
  getCallSessionBySessionId,
  getCallSessionsByUserId,
  getIdentityByUserId,
  insertTranscriptChunk,
  getTranscriptsBySessionId,
  updateCallSession,
} from "../db";
import {
  getAllConversations,
  getConversation,
  getSignedConversationUrl,
  initiateOutboundCall,
} from "../services/elevenlabs";
import { triageConversation } from "../services/conversationTriage";

function toBrowserCallContext(params: {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    openId: string;
  };
  identity?: {
    ghlContactId?: string | null;
    ghlLocationId?: string | null;
    phoneNumber?: string | null;
    preferredLanguage?: string | null;
    consentGiven?: boolean | null;
  };
}) {
  const { user, identity } = params;
  const firstName = user.name?.trim().split(/\s+/)[0] ?? "Caregiver";
  return [
    "You are the live DementiaHub caregiver voice assistant inside the portal.",
    "Use the logged-in caregiver profile below as the source of truth.",
    `If you greet the caregiver at the beginning, greet them by name as ${firstName} and show that you already know their profile from the portal.`,
    `Portal user ID: ${user.id}`,
    `Open ID: ${user.openId}`,
    `Name: ${user.name ?? "Not provided"}`,
    `Email: ${user.email ?? "Not provided"}`,
    `Phone: ${identity?.phoneNumber ?? "Not provided"}`,
    `Wibiz contact ID: ${identity?.ghlContactId ?? "Not linked"}`,
    `Wibiz location ID: ${identity?.ghlLocationId ?? "Not linked"}`,
    `Preferred language: ${identity?.preferredLanguage ?? "en"}`,
    `Consent given: ${identity?.consentGiven ? "yes" : "no"}`,
    "Recognize this same logged-in caregiver throughout the conversation.",
  ].join("\n");
}

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
          message: "Voice calling is not configured yet. Please contact your administrator.",
        });
      }

      // Resolve GHL identity
      const identity = await getIdentityByUserId(userId);
      if (!identity?.ghlContactId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Your account is not yet linked to a Wibiz contact. Please complete your profile setup.",
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

  initiateWebCall: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const identity = await getIdentityByUserId(userId);
    const sessionId = `web_${Date.now()}_${userId}`;

    await createCallSession({
      sessionId,
      portalUserId: userId,
      ghlContactId: identity?.ghlContactId,
      ghlLocationId: identity?.ghlLocationId ?? config.ghlLocationId,
      elevenlabsAgentId: config.elevenLabsAgentId || "browser-call",
      status: "active",
      callStartTime: new Date(),
    });

    return {
      sessionId,
      status: "active",
      mode: "browser_voice" as const,
      message: "Browser voice call ready",
    };
  }),

  getBrowserCallSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found" });
      }
      if (session.portalUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (!config.elevenLabsApiKey || !config.elevenLabsAgentId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "ElevenLabs browser calling is not configured.",
        });
      }

      const identity = await getIdentityByUserId(ctx.user.id);
      const signedUrl = await getSignedConversationUrl(
        config.elevenLabsApiKey,
        config.elevenLabsAgentId
      );

      return {
        signedUrl,
        agentId: config.elevenLabsAgentId,
        dynamicVariables: {
          caregiver_name: ctx.user.name ?? "Caregiver",
          caregiver_email: ctx.user.email ?? "",
          portal_user_id: String(ctx.user.id),
          portal_open_id: ctx.user.openId,
          wibiz_contact_id: identity?.ghlContactId ?? "",
          wibiz_location_id: identity?.ghlLocationId ?? config.ghlLocationId,
          caregiver_language: identity?.preferredLanguage ?? "en",
          portal_call_session_id: input.sessionId,
        },
        contextualMemory: toBrowserCallContext({
          user: {
            id: ctx.user.id,
            name: ctx.user.name,
            email: ctx.user.email,
            openId: ctx.user.openId,
          },
          identity,
        }),
      };
    }),

  bindBrowserConversation: protectedProcedure
    .input(z.object({ sessionId: z.string(), conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found" });
      }
      if (session.portalUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await updateCallSession(input.sessionId, {
        elevenlabsConversationId: input.conversationId,
        elevenlabsAgentId: config.elevenLabsAgentId || session.elevenlabsAgentId,
      });

      return { success: true } as const;
    }),

  appendBrowserTranscriptChunk: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        conversationId: z.string().optional(),
        speaker: z.enum(["agent", "user"]),
        text: z.string().min(1),
        timestamp: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found" });
      }
      if (session.portalUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await insertTranscriptChunk({
        sessionId: input.sessionId,
        elevenlabsConversationId: input.conversationId ?? session.elevenlabsConversationId,
        speaker: input.speaker,
        text: input.text.trim(),
        timestamp: new Date(input.timestamp),
      });

      if (input.conversationId && !session.elevenlabsConversationId) {
        await updateCallSession(input.sessionId, {
          elevenlabsConversationId: input.conversationId,
        });
      }

      return { success: true } as const;
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

  completeWebCallDemo: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        transcript: z.array(
          z.object({
            speaker: z.enum(["agent", "user"]),
            text: z.string().min(1),
            timestamp: z.number(),
          })
        ),
        callSummary: z.string().min(1),
        topicClassified: z.string().default("general"),
        resolutionType: z.string().default("self_serve"),
        safetyResult: z.enum(["SAFE", "CAUTION", "UNSAFE"]).default("SAFE"),
        callbackRequested: z.boolean().default(false),
        consentVerballyConfirmed: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found" });
      }
      if (session.portalUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (!session.elevenlabsConversationId?.startsWith("web_demo_")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This session is not a browser demo call." });
      }

      for (const chunk of input.transcript) {
        await insertTranscriptChunk({
          sessionId: input.sessionId,
          elevenlabsConversationId: session.elevenlabsConversationId,
          speaker: chunk.speaker,
          text: chunk.text,
          timestamp: new Date(chunk.timestamp),
        });
      }

      const startedAt = session.callStartTime ? new Date(session.callStartTime).getTime() : Date.now();
      const endedAt = input.transcript.at(-1)?.timestamp ?? Date.now();
      const durationSeconds = Math.max(30, Math.round((endedAt - startedAt) / 1000));
      const transcriptRaw = input.transcript
        .map((chunk) => `[${chunk.speaker.toUpperCase()}]: ${chunk.text}`)
        .join("\n");

      await updateCallSession(input.sessionId, {
        status: "completed",
        callEndTime: new Date(endedAt),
        callDurationSeconds: durationSeconds,
        callSummary: input.callSummary,
        topicClassified: input.topicClassified,
        resolutionType: input.resolutionType,
        safetyResult: input.safetyResult,
        callbackRequested: input.callbackRequested,
        consentVerballyConfirmed: input.consentVerballyConfirmed,
        consentTimestamp: input.consentVerballyConfirmed ? new Date(endedAt) : null,
        escalationTriggered: input.safetyResult === "UNSAFE",
        transcriptRaw,
      });

      return { success: true } as const;
    }),

  completeBrowserVoiceCall: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getCallSessionBySessionId(input.sessionId);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found" });
      }
      if (session.portalUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const transcriptChunks = await getTranscriptsBySessionId(input.sessionId);
      const transcriptRaw = transcriptChunks
        .map((chunk) => `[${chunk.speaker.toUpperCase()}]: ${chunk.text}`)
        .join("\n");
      const triage = triageConversation(
        transcriptChunks.map((chunk) => ({
          role: chunk.speaker === "agent" ? "assistant" : "user",
          content: chunk.text,
        }))
      );
      const endTime = new Date();
      const startedAt = session.callStartTime ? new Date(session.callStartTime).getTime() : Date.now();
      const durationSeconds = Math.max(1, Math.round((endTime.getTime() - startedAt) / 1000));

      await updateCallSession(input.sessionId, {
        status: "completed",
        callEndTime: endTime,
        callDurationSeconds: durationSeconds,
        transcriptRaw: triage.transcriptRaw || transcriptRaw,
        callSummary: transcriptChunks.length
          ? triage.conversationSummary
          : "Browser voice conversation ended with no transcript captured.",
        topicClassified: transcriptChunks.length ? triage.topicClassified : "general",
        safetyResult: transcriptChunks.length ? triage.safetyResult : "SAFE",
        safetyFlagType: transcriptChunks.length ? triage.safetyFlagType : "none",
        callbackRequested: triage.callbackRequested,
        consentVerballyConfirmed: triage.consentVerballyConfirmed,
        resolutionType: transcriptChunks.length ? triage.resolutionType : "browser_voice_demo",
        escalationTriggered: triage.escalationTriggered,
      });

      return { success: true } as const;
    }),
});
