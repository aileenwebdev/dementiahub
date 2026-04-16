import { aiChatConversations } from "../drizzle/schema";
import {
  getAIChatMessagesByConversationId,
  getDb,
  getIdentityByUserId,
  updateAIChatConversation,
} from "../server/db";
import { syncChatConversationToGHL } from "../server/services/chatSync";
import { triageConversation } from "../server/services/conversationTriage";

async function main() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const conversations = await db.select().from(aiChatConversations);

  let processed = 0;
  let unsafe = 0;
  let caution = 0;
  let safe = 0;

  for (const conversation of conversations) {
    const messages = await getAIChatMessagesByConversationId(conversation.id, 500);
    const triage = triageConversation(
      messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }))
    );

    await updateAIChatConversation(conversation.id, {
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

    const identity = await getIdentityByUserId(conversation.portalUserId);
    await syncChatConversationToGHL({
      conversation: {
        ...conversation,
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
      },
      messages,
      triage,
      identity,
    });

    processed += 1;
    if (triage.safetyResult === "UNSAFE") unsafe += 1;
    else if (triage.safetyResult === "CAUTION") caution += 1;
    else safe += 1;
  }

  console.log(
    JSON.stringify(
      {
        processed,
        unsafe,
        caution,
        safe,
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error("[BackfillChatTriage] Failed:", error);
  process.exit(1);
});
