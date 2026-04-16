import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { config, isApprovedOutboundQaNumber } from "../config";
import {
  createCallSession,
  getPendingFailedSyncs,
  getCallSessionBySessionId,
  getCallSessionsByUserId,
  getIdentityByUserId,
  insertTranscriptChunk,
  getTranscriptsBySessionId,
  markSyncResolved,
  recordSyncRetryAttempt,
  updateCallSession,
} from "../db";
import {
  getAllConversations,
  getConversation,
  getConversationTranscript,
  getSignedConversationUrl,
  initiateOutboundCall,
} from "../services/elevenlabs";
import { triageConversation } from "../services/conversationTriage";
import { processPostCallWebhook, synthesizePostCallPayloadFromConversation } from "../services/postCallSync";

async function trySyncFinishedElevenLabsCall<T extends Awaited<ReturnType<typeof getCallSessionBySessionId>>>(
  session: T
): Promise<T> {
  if (!session?.elevenlabsConversationId || !config.elevenLabsApiKey) {
    return session;
  }

  const startedAt = session.callStartTime ? new Date(session.callStartTime).getTime() : 0;
  const secondsSinceStart = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
  const isStale = ["active", "completed"].includes(session.status);
  const needsRecoverySync =
    (isStale && secondsSinceStart > 15) ||
    (!session.transcriptRaw && !session.ghlSynced) ||
    (!session.safetyResult && !session.ghlSynced);

  if (!needsRecoverySync) {
    return session;
  }

  const conversation = await getConversation(config.elevenLabsApiKey, session.elevenlabsConversationId);
  if (!conversation) {
    return session;
  }

  const transcript: Array<{ role: "agent" | "user"; message: string; time_in_call_secs?: number }> =
    conversation.transcript?.length
      ? conversation.transcript
      : (
          await getConversationTranscript(config.elevenLabsApiKey, session.elevenlabsConversationId)
        ).map((entry): { role: "agent" | "user"; message: string; time_in_call_secs?: number } => ({
          role: entry.role === "agent" ? "agent" : "user",
          message: entry.message,
          time_in_call_secs: entry.time_in_call_secs,
        }));

  const normalizedStatus = conversation.status?.toLowerCase?.() ?? "";
  const hasCompletionArtifacts =
    transcript.length > 0 ||
    Boolean(conversation.analysis?.transcript_summary) ||
    Boolean(conversation.call_duration_secs);
  const isFinished =
    ["done", "completed", "ended", "disconnected"].includes(normalizedStatus) ||
    hasCompletionArtifacts;

  if (!isFinished) {
    return session;
  }

  console.log(
    `[Calls] recovery sync starting session=${session.sessionId} conversation=${session.elevenlabsConversationId} status=${normalizedStatus || "unknown"} transcript_chunks=${transcript.length}`
  );

  await processPostCallWebhook(
    await synthesizePostCallPayloadFromConversation(
      {
        ...conversation,
        transcript,
      },
      config.elevenLabsApiKey
    )
  );

  return (await getCallSessionBySessionId(session.sessionId)) as T;
}

function assertOutboundQaAllowed(phoneNumber: string) {
  if (!config.voiceQaMode) return;
  if (!config.approvedQaPhoneNumbers.length) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Outbound phone QA is locked. Add approved test numbers in QA_APPROVED_PHONE_NUMBERS before dialing.",
    });
  }
  if (!isApprovedOutboundQaNumber(phoneNumber)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Outbound phone QA blocks this number. Use an approved test number only.",
    });
  }
}

async function retryFailedPostCallSyncs(limit = 5) {
  const queued = await getPendingFailedSyncs(limit);
  const postCallItems = queued.filter((item) => item.webhookType === "post_call");

  for (const item of postCallItems) {
    try {
      await processPostCallWebhook(item.payload as any);
      await markSyncResolved(item.id);
      console.log(
        `[Calls] replayed failed post-call sync queue_id=${item.id} conversation=${item.conversationId}`
      );
    } catch (error: any) {
      await recordSyncRetryAttempt(item.id, (item.retryCount ?? 0) + 1, error?.message);
      console.error(
        `[Calls] failed post-call replay queue_id=${item.id} conversation=${item.conversationId}:`,
        error
      );
    }
  }
}

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
      const dialNumber = input.phoneNumber.trim();

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

      assertOutboundQaAllowed(dialNumber);

      // Generate session ID
      const sessionId = `sess_${Date.now()}_${userId}`;

      // Initiate ElevenLabs call
      const result = await initiateOutboundCall(config.elevenLabsApiKey, {
        agentId: config.elevenLabsAgentId,
        phoneNumber: dialNumber,
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

      console.log(
        `[Calls] call started mode=phone session=${sessionId} conversation=${result.conversation_id} user=${userId} qa_mode=${config.voiceQaMode}`
      );

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

    console.log(`[Calls] call started mode=browser session=${sessionId} user=${userId}`);

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
          ghl_contact_id: identity?.ghlContactId ?? "",
          ghl_location_id: identity?.ghlLocationId ?? config.ghlLocationId,
          wibiz_contact_id: identity?.ghlContactId ?? "",
          wibiz_location_id: identity?.ghlLocationId ?? config.ghlLocationId,
          caregiver_language: identity?.preferredLanguage ?? "en",
          session_id: input.sessionId,
          portal_call_session_id: input.sessionId,
        },
        overridePrompt: toBrowserCallContext({
          user: {
            id: ctx.user.id,
            name: ctx.user.name,
            email: ctx.user.email,
            openId: ctx.user.openId,
          },
          identity,
        }),
        overrideFirstMessage: `Hi ${ctx.user.name?.trim().split(/\s+/)[0] ?? "Caregiver"}, you've reached DementiaHub Support. I already have your portal details on file, so we can go straight to helping you. If someone is in immediate danger right now, please hang up and call 995. Otherwise, what's happening today?`,
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

      console.log(
        `[Calls] browser conversation bound session=${input.sessionId} conversation=${input.conversationId}`
      );

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

      console.log(
        `[Calls] transcript saved mode=browser session=${input.sessionId} speaker=${input.speaker}`
      );

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
        source: z.string().min(1).max(50).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      console.log(
        `[Calls] dashboard refresh source=${input?.source ?? "unspecified"} user=${ctx.user.id} limit=${input?.limit ?? 50}`
      );
      await retryFailedPostCallSyncs(5);
      const sessions = await getCallSessionsByUserId(ctx.user.id, input?.limit ?? 50);
      return Promise.all(
        sessions.map(async (session) => {
          try {
            return await trySyncFinishedElevenLabsCall(session);
          } catch (error) {
            console.error(
              `[Calls] recovery sync failed session=${session.sessionId} conversation=${session.elevenlabsConversationId}:`,
              error
            );
            return session;
          }
        })
      );
    }),

  /**
   * Get details of a specific call session including transcript.
   */
  getCallDetails: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const originalSession = await getCallSessionBySessionId(input.sessionId);
      const session = await trySyncFinishedElevenLabsCall(originalSession);

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
        ["completed", "synced"].includes(session.status)
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

      console.log(`[Calls] call marked completed manually session=${input.sessionId}`);

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

      console.log(
        `[Calls] call marked completed mode=browser-demo session=${input.sessionId} safety=${input.safetyResult} callback=${input.callbackRequested}`
      );

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
      console.log(`[Calls] safety started mode=browser session=${input.sessionId}`);
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

      console.log(
        `[Calls] safety completed mode=browser session=${input.sessionId} result=${triage.safetyResult} callback=${triage.callbackRequested}`
      );
      if (triage.callbackRequested) {
        console.log(`[Calls] callback flag set mode=browser session=${input.sessionId}`);
      }
      if (triage.safetyResult === "SAFE") {
        console.log(`[Calls] safe flag set mode=browser session=${input.sessionId}`);
      }
      console.log(`[Calls] call marked completed mode=browser session=${input.sessionId}`);

      return { success: true } as const;
    }),
});
