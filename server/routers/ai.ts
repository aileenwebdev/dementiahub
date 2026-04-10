import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM, type Message } from "../_core/llm";
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
