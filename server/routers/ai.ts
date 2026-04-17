import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM, type Message } from "../_core/llm";
import { config } from "../config";
import {
  createAIChatConversation,
  createAIChatMessage,
  getActiveAIChatConversationByUserId,
  getAIChatConversationById,
  getAIChatConversationsByUserId,
  getAIChatMessagesByConversationId,
  getIdentityByUserId,
  touchAIChatConversation,
  updateAIChatConversation,
} from "../db";
import { hasStaffAccess, protectedProcedure, router } from "../_core/trpc";
import { getSignedConversationUrl } from "../services/elevenlabs";
import { triageConversation } from "../services/conversationTriage";
import { syncChatConversationToGHL } from "../services/chatSync";

const CAREGIVER_SYSTEM_PROMPT = `You are DementiaHub's caregiver support assistant inside the caregiver portal.

Your job is to support the currently logged-in caregiver using the user profile provided in the system context.

Rules:
- Treat the provided caregiver profile as the source of truth for who is speaking.
- Do not invent a new account, user profile, or identity for the caregiver.
- Keep continuity with prior messages from this same conversation.
- If profile details are missing, say they are not yet available instead of guessing.
- Be supportive, concise, and practical for dementia care workflows.
- If asked who the user is, answer from the provided caregiver profile.
- Treat any expression of self-harm, wanting life to end, wanting to die, not being able to go on, or asking for everything to end as an urgent safety risk.
- If the caregiver expresses possible self-harm risk, immediately switch into crisis support: respond calmly, encourage urgent human help, and do not minimize or reframe the risk as routine stress.
`;

function toChatPromptContext(params: {
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
  return [
    CAREGIVER_SYSTEM_PROMPT.trim(),
    "",
    "Current caregiver profile:",
    `- portalUserId: ${user.id}`,
    `- openId: ${user.openId}`,
    `- name: ${user.name ?? "Not provided"}`,
    `- email: ${user.email ?? "Not provided"}`,
    `- phoneNumber: ${identity?.phoneNumber ?? "Not provided"}`,
    `- ghlContactId: ${identity?.ghlContactId ?? "Not linked"}`,
    `- ghlLocationId: ${identity?.ghlLocationId ?? "Not linked"}`,
    `- preferredLanguage: ${identity?.preferredLanguage ?? "en"}`,
    `- consentGiven: ${identity?.consentGiven ? "yes" : "no"}`,
  ].join("\n");
}

function toElevenLabsPromptContext(params: {
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
  history: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}) {
  const { user, identity, history } = params;
  const historyBlock = history
    .filter((message) => message.role !== "system")
    .slice(-16)
    .map((message) => `[${message.role.toUpperCase()}] ${message.content}`)
    .join("\n");

  return [
    CAREGIVER_SYSTEM_PROMPT.trim(),
    "",
    "You are running as the live ElevenLabs caregiver assistant inside the Dementia Singapore portal.",
    "Use the caregiver profile below as the source of truth for identity and continuity.",
    "Do not invent a new user or account.",
    "If the caregiver says they want to die, want to end it all, cannot go on, or asks for everything to end, treat that as high-risk and escalate urgently.",
    "",
    "Current caregiver profile:",
    `- portalUserId: ${user.id}`,
    `- openId: ${user.openId}`,
    `- name: ${user.name ?? "Not provided"}`,
    `- email: ${user.email ?? "Not provided"}`,
    `- phoneNumber: ${identity?.phoneNumber ?? "Not provided"}`,
    `- wibizContactId: ${identity?.ghlContactId ?? "Not linked"}`,
    `- wibizLocationId: ${identity?.ghlLocationId ?? "Not linked"}`,
    `- preferredLanguage: ${identity?.preferredLanguage ?? "en"}`,
    `- consentGiven: ${identity?.consentGiven ? "yes" : "no"}`,
    "",
    "Recent saved portal conversation history:",
    historyBlock || "No prior messages saved.",
    "",
    "Continue naturally from this caregiver's prior portal conversation when relevant.",
  ].join("\n");
}

function toElevenLabsContextualUpdate(params: {
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
  history: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}) {
  const { user, identity, history } = params;
  const firstName = user.name?.trim().split(/\s+/)[0] ?? "Caregiver";
  const hasHistory = history.some((message) => message.role !== "system");
  const historyBlock = history
    .filter((message) => message.role !== "system")
    .slice(-12)
    .map((message) => `${message.role === "assistant" ? "Assistant" : "Caregiver"}: ${message.content}`)
    .join("\n");

  return [
    "Use this caregiver profile as the source of truth for this portal session.",
    `When you greet the caregiver, greet them by name as ${firstName} and acknowledge that their portal details are already on file.`,
    hasHistory
      ? "This caregiver already has saved conversation history in the portal. Do not restart with a fresh welcome, repeated safety disclaimer, or repeated identity introduction. Continue naturally from the prior conversation."
      : "Keep that greeting natural and only do it once at the start of a fresh session.",
    `Portal user ID: ${user.id}`,
    `Open ID: ${user.openId}`,
    `Name: ${user.name ?? "Not provided"}`,
    `Email: ${user.email ?? "Not provided"}`,
    `Phone: ${identity?.phoneNumber ?? "Not provided"}`,
    `Wibiz contact ID: ${identity?.ghlContactId ?? "Not linked"}`,
    `Wibiz location ID: ${identity?.ghlLocationId ?? "Not linked"}`,
    `Preferred language: ${identity?.preferredLanguage ?? "en"}`,
    `Consent given: ${identity?.consentGiven ? "yes" : "no"}`,
    "Safety rule: self-harm, hopelessness with death language, or inability to keep going must be treated as urgent risk, not routine stress.",
    "Continue naturally with the same caregiver and preserve continuity with this recent saved portal history when relevant.",
    hasHistory
      ? "Because there is already saved history below, your next reply should continue the thread instead of sending a fresh opening message."
      : "If there is no saved history below, you may begin with a brief welcome and then help immediately.",
    historyBlock || "No prior saved portal messages.",
  ].join("\n");
}

async function ensureConversationForUser(portalUserId: number) {
  const existing = await getActiveAIChatConversationByUserId(portalUserId);
  if (existing) return existing;

  const conversationId = await createAIChatConversation({
    portalUserId,
    title: "Caregiver Support Chat",
    status: "active",
    lastMessageAt: new Date(),
  });

  if (!conversationId) {
    throw new Error("Failed to create AI chat conversation");
  }

  const created = await getAIChatConversationById(conversationId);
  if (!created) {
    throw new Error("Created AI chat conversation could not be loaded");
  }

  return created;
}

async function refreshConversationTriage(params: {
  conversationId: number;
  portalUserId: number;
  identity?: Awaited<ReturnType<typeof getIdentityByUserId>>;
}) {
  const { conversationId, portalUserId } = params;
  const conversation = await getAIChatConversationById(conversationId);
  if (!conversation || conversation.portalUserId !== portalUserId) {
    return null;
  }

  const messages = await getAIChatMessagesByConversationId(conversationId, 200);
  const triage = triageConversation(
    messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }))
  );

  await updateAIChatConversation(conversationId, {
    title:
      triage.topicClassified === "general"
        ? conversation.title ?? "Caregiver Support Chat"
        : triage.topicClassified
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" "),
    safetyResult: triage.safetyResult,
    safetyFlagType: triage.safetyFlagType === "none" ? null : triage.safetyFlagType,
    topicClassified: triage.topicClassified,
    callbackRequested: triage.callbackRequested,
    consentVerballyConfirmed: triage.consentVerballyConfirmed,
    conversationSummary: triage.conversationSummary,
    resolutionType: triage.resolutionType,
    escalationTriggered: triage.escalationTriggered,
    ghlSyncError: null,
  });

  const refreshedConversation = await getAIChatConversationById(conversationId);
  if (refreshedConversation) {
    await syncChatConversationToGHL({
      conversation: refreshedConversation,
      messages,
      triage,
      identity: params.identity,
    });
  }

  return {
    conversation: refreshedConversation,
    messages,
    triage,
  };
}

export const aiRouter = router({
  getMyConversation: protectedProcedure.query(async ({ ctx }) => {
    const conversation = await ensureConversationForUser(ctx.user.id);
    const identity = await getIdentityByUserId(ctx.user.id);
    const refreshed =
      conversation.safetyResult || conversation.topicClassified
        ? null
        : await refreshConversationTriage({
            conversationId: conversation.id,
            portalUserId: ctx.user.id,
            identity,
          });
    const messages = refreshed?.messages ?? (await getAIChatMessagesByConversationId(conversation.id));

    return {
      conversation: refreshed?.conversation ?? conversation,
      messages,
    };
  }),

  getElevenLabsSession: protectedProcedure.query(async ({ ctx }) => {
    if (!config.elevenLabsApiKey || !config.elevenLabsAgentId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "ElevenLabs chat is not configured.",
      });
    }

    const conversation = await ensureConversationForUser(ctx.user.id);
    const identity = await getIdentityByUserId(ctx.user.id);
    const history = await getAIChatMessagesByConversationId(conversation.id, 50);
    const signedUrl = await getSignedConversationUrl(
      config.elevenLabsApiKey,
      config.elevenLabsAgentId
    );

    return {
      conversationId: conversation.id,
      agentId: config.elevenLabsAgentId,
      signedUrl,
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
      },
      contextualMemory: toElevenLabsContextualUpdate({
        user: {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
          openId: ctx.user.openId,
        },
        identity,
        history,
      }),
      overrides: {
        conversation: {
          textOnly: true,
        },
      },
    };
  }),

  bindElevenLabsConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        elevenlabsConversationId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await getAIChatConversationById(input.conversationId);
      if (!conversation || conversation.portalUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Conversation not found for current user" });
      }

      await updateAIChatConversation(input.conversationId, {
        elevenlabsConversationId: input.elevenlabsConversationId,
      });

      return { success: true } as const;
    }),

  getConversationHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const conversations = await getAIChatConversationsByUserId(ctx.user.id, input?.limit ?? 50);

      return Promise.all(
        conversations.map(async (conversation) => {
          const messages = await getAIChatMessagesByConversationId(conversation.id, 1);
          return {
            ...conversation,
            lastMessagePreview: messages.at(-1)?.content ?? null,
            messageCount: (await getAIChatMessagesByConversationId(conversation.id, 500)).length,
          };
        })
      );
    }),

  getConversationDetails: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const conversation = await getAIChatConversationById(input.conversationId);
      if (
        !conversation ||
        (conversation.portalUserId !== ctx.user.id && !hasStaffAccess(ctx.user.role))
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chat conversation not found" });
      }

      const identity = await getIdentityByUserId(conversation.portalUserId);
      const refreshed = await refreshConversationTriage({
        conversationId: conversation.id,
        portalUserId: conversation.portalUserId,
        identity,
      });
      return {
        conversation: refreshed?.conversation ?? conversation,
        messages: refreshed?.messages ?? (await getAIChatMessagesByConversationId(conversation.id, 200)),
      };
    }),

  appendPortalMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive().optional(),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = input.conversationId
        ? await getAIChatConversationById(input.conversationId)
        : await ensureConversationForUser(ctx.user.id);

      if (!conversation || conversation.portalUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Conversation not found for current user" });
      }

      await createAIChatMessage({
        conversationId: conversation.id,
        portalUserId: ctx.user.id,
        role: input.role,
        content: input.content.trim(),
      });
      await touchAIChatConversation(conversation.id);
      const identity = await getIdentityByUserId(ctx.user.id);
      await refreshConversationTriage({
        conversationId: conversation.id,
        portalUserId: ctx.user.id,
        identity,
      });

      return { success: true, conversationId: conversation.id } as const;
    }),

  chat: protectedProcedure
    .input(
      z.object({
        content: z.string().min(1, "Message is required").max(4000, "Message is too long"),
        conversationId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = input.conversationId
        ? await getAIChatConversationById(input.conversationId)
        : await ensureConversationForUser(ctx.user.id);

      if (!conversation || conversation.portalUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Conversation not found for current user" });
      }

      const identity = await getIdentityByUserId(ctx.user.id);
      const history = await getAIChatMessagesByConversationId(conversation.id, 50);

      await createAIChatMessage({
        conversationId: conversation.id,
        portalUserId: ctx.user.id,
        role: "user",
        content: input.content.trim(),
      });

      const llmMessages: Message[] = [
        {
          role: "system",
          content: toChatPromptContext({
            user: {
              id: ctx.user.id,
              name: ctx.user.name,
              email: ctx.user.email,
              openId: ctx.user.openId,
            },
            identity,
          }),
        },
        ...history.map<Message>((message) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: "user",
          content: input.content.trim(),
        },
      ];

      const response = await invokeLLM({ messages: llmMessages });
      const assistantContent = response.choices[0]?.message?.content;
      const reply =
        typeof assistantContent === "string"
          ? assistantContent
          : Array.isArray(assistantContent)
            ? assistantContent
                .map((part) => ("text" in part ? part.text : ""))
                .filter(Boolean)
                .join("\n")
            : "";

      if (!reply.trim()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI returned an empty response",
        });
      }

      await createAIChatMessage({
        conversationId: conversation.id,
        portalUserId: ctx.user.id,
        role: "assistant",
        content: reply,
      });
      await touchAIChatConversation(conversation.id);
      const refreshed = await refreshConversationTriage({
        conversationId: conversation.id,
        portalUserId: ctx.user.id,
        identity,
      });
      const messages = refreshed?.messages ?? (await getAIChatMessagesByConversationId(conversation.id));

      return {
        conversationId: conversation.id,
        reply,
        messages,
      };
    }),
});
