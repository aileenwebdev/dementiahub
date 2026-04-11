import type { AIChatConversation, AIChatMessage } from "../../drizzle/schema";
import { config } from "../config";
import { updateAIChatConversation } from "../db";
import {
  addNoteToContact,
  addTagsToContact,
  buildSOAPNote,
  createOpportunity,
  extractCaregiversPipeline,
  getOpportunitiesForContact,
  getPipelines,
  resolveTargetStageName,
  topicToCaseCategory,
  updateOpportunity,
} from "./ghl";
import type { ConversationTriage } from "./conversationTriage";

type IdentityLike = {
  ghlContactId?: string | null;
  ghlLocationId?: string | null;
};

function shouldSyncChatConversation(params: {
  conversation: AIChatConversation;
  messageCount: number;
  triage: ConversationTriage;
}) {
  const { conversation, messageCount, triage } = params;
  if (messageCount < 2) return false;
  if (!conversation.lastSyncedMessageCount) return true;
  if (conversation.safetyResult !== triage.safetyResult) return true;
  if (conversation.callbackRequested !== triage.callbackRequested) return true;
  if (conversation.escalationTriggered !== triage.escalationTriggered) return true;
  return messageCount - (conversation.lastSyncedMessageCount ?? 0) >= 6;
}

export async function syncChatConversationToGHL(params: {
  conversation: AIChatConversation;
  messages: AIChatMessage[];
  triage: ConversationTriage;
  identity?: IdentityLike;
}) {
  const { conversation, messages, triage, identity } = params;
  const ghlContactId = identity?.ghlContactId ?? null;
  const ghlLocationId = identity?.ghlLocationId ?? config.ghlLocationId;

  if (!config.ghlApiKey || !ghlContactId || !ghlLocationId) {
    await updateAIChatConversation(conversation.id, {
      ghlSynced: false,
      ghlSyncedAt: null,
      ghlSyncError: !config.ghlApiKey
        ? "GHL API key is not configured."
        : "Chat conversation cannot sync because no GHL contact is linked.",
    });
    return;
  }

  if (!shouldSyncChatConversation({ conversation, messageCount: messages.length, triage })) {
    return;
  }

  try {
    const tagPrefix = "Portal Chat - ";
    await addTagsToContact(config.ghlApiKey, ghlContactId, [
      `${tagPrefix}${triage.safetyResult}`,
      `Case Topic - ${topicToCaseCategory(triage.topicClassified)}`,
      ...(triage.callbackRequested ? ["Callback Requested"] : []),
    ]);

    const opportunities = await getOpportunitiesForContact(
      config.ghlApiKey,
      ghlLocationId,
      ghlContactId
    );
    let opportunityId = opportunities.find((opportunity) => opportunity.status === "open")?.id;

    if (!opportunityId) {
      const pipelines = await getPipelines(config.ghlApiKey, ghlLocationId);
      const pipeline = extractCaregiversPipeline(pipelines);
      const firstStage = pipeline?.stages[0];
      if (pipeline && firstStage) {
        const opportunity = await createOpportunity(config.ghlApiKey, {
          locationId: ghlLocationId,
          pipelineId: pipeline.id,
          pipelineStageId: firstStage.id,
          contactId: ghlContactId,
          name: `Portal Chat Case - ${new Date().toISOString().split("T")[0]}`,
        });
        opportunityId = opportunity.id;
      }
    }

    if (opportunityId) {
      const pipelines = await getPipelines(config.ghlApiKey, ghlLocationId);
      const pipeline = extractCaregiversPipeline(pipelines);
      const targetStage = pipeline?.stages.find(
        (stage) =>
          stage.name ===
          resolveTargetStageName(
            triage.safetyResult,
            triage.callbackRequested,
            triage.resolutionType
          )
      );

      await updateOpportunity(config.ghlApiKey, opportunityId, {
        pipelineStageId: targetStage?.id,
        customFields: [
          { key: "case_channel", value: "portal_chat" },
          { key: "chat_transcript", value: triage.transcriptRaw },
          { key: "safety_gate_result", value: triage.safetyResult },
          { key: "safety_flag_type", value: triage.safetyFlagType },
          { key: "case_category", value: topicToCaseCategory(triage.topicClassified) },
          { key: "callback_requested", value: String(triage.callbackRequested) },
          { key: "resolution_type", value: triage.resolutionType },
          { key: "escalation_triggered", value: String(triage.escalationTriggered) },
          {
            key: "case_notes",
            value: buildSOAPNote({
              callSummary: triage.conversationSummary,
              safetyResult: triage.safetyResult,
              topicClassified: triage.topicClassified,
              resolutionType: triage.resolutionType,
              escalationTriggered: triage.escalationTriggered,
              callbackRequested: triage.callbackRequested,
            }),
          },
        ],
      });
    }

    const noteBody = `PORTAL CHAT SUMMARY - ${new Date().toISOString()}

Safety: ${triage.safetyResult}
Topic: ${triage.topicClassified}
Resolution: ${triage.resolutionType}

--- SUMMARY ---
${triage.conversationSummary}

--- FULL TRANSCRIPT ---
${triage.transcriptRaw}`;
    await addNoteToContact(config.ghlApiKey, ghlContactId, noteBody);

    await updateAIChatConversation(conversation.id, {
      ghlSynced: true,
      ghlSyncedAt: new Date(),
      ghlSyncError: null,
      lastSyncedMessageCount: messages.length,
    });
  } catch (error) {
    await updateAIChatConversation(conversation.id, {
      ghlSynced: false,
      ghlSyncError: error instanceof Error ? error.message : "Failed to sync chat conversation to GHL.",
    });
  }
}
