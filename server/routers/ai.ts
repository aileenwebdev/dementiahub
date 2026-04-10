import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM, type Message } from "../_core/llm";
import { config } from "../config";
import {
  createAIChatConversation,
  createAIChatMessage,
  getActiveAIChatConversationByUserId,
  getAIChatConversationById,
  getAIChatMessagesByConversationId,
  getIdentityByUserId,
  touchAIChatConversation,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getSignedConversationUrl } from "../services/elevenlabs";

const CAREGIVER_SYSTEM_PROMPT = `You are DementiaHub's caregiver support assistant inside the caregiver portal.

Your job is to support the currently logged-in caregiver using the user profile provided in the system context.

Rules:
- Treat the provided caregiver profile as the source of truth for who is speaking.
- Do not invent a new account, user profile, or identity for the caregiver.
- Keep continuity with prior messages from this same conversation.
- If profile details are missing, say they are not yet available instead of guessing.
- Be supportive, concise, and practical for dementia care workflows.
- If asked who the user is, answer from the provided caregiver profile.
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
  const historyBlock = history
    .filter((message) => message.role !== "system")
    .slice(-12)
    .map((message) => `${message.role === "assistant" ? "Assistant" : "Caregiver"}: ${message.content}`)
    .join("\n");

  return [
    "Use this caregiver profile as the source of truth for this portal session.",
    `Portal user ID: ${user.id}`,
    `Open ID: ${user.openId}`,
    `Name: ${user.name ?? "Not provided"}`,
    `Email: ${user.email ?? "Not provided"}`,
    `Phone: ${identity?.phoneNumber ?? "Not provided"}`,
    `Wibiz contact ID: ${identity?.ghlContactId ?? "Not linked"}`,
    `Wibiz location ID: ${identity?.ghlLocationId ?? "Not linked"}`,
    `Preferred language: ${identity?.preferredLanguage ?? "en"}`,
    `Consent given: ${identity?.consentGiven ? "yes" : "no"}`,
    "Continue naturally with the same caregiver and preserve continuity with this recent saved portal history when relevant.",
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

export const aiRouter = router({
  getMyConversation: protectedProcedure.query(async ({ ctx }) => {
    const conversation = await ensureConversationForUser(ctx.user.id);
    const messages = await getAIChatMessagesByConversationId(conversation.id);

    return {
      conversation,
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

      const messages = await getAIChatMessagesByConversationId(conversation.id);

      return {
        conversationId: conversation.id,
        reply,
        messages,
      };
    }),
});
