/**
 * Post-Call Sync Service
 * Receives ElevenLabs post-call webhook data, normalizes it,
 * and writes all relevant data to GHL (contact, opportunity, note).
 */

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
  updateContact,
  updateOpportunity,
} from "./ghl";
import {
  formatTranscriptToText,
  getConversation,
} from "./elevenlabs";
import {
  getCallSessionBySessionId,
  getCallSessionByConversationId,
  getTranscriptsBySessionId,
  insertTranscriptChunk,
  updateCallSession,
  updateCallSessionByConversationId,
} from "../db";
import { config } from "../config";

export interface PostCallPayload {
  schema_version?: string;
  event_type?: string;
  conversation_id?: string;
  elevenlabs?: {
    conversation_id: string;
    agent_id: string;
    call_duration_seconds?: number;
    call_start_time?: string;
    call_end_time?: string;
    asr_confidence?: string;
    transcript_raw?: string;
    dynamic_variables_echo?: {
      ghl_contact_id?: string;
      ghl_location_id?: string;
      wibiz_contact_id?: string;
      wibiz_location_id?: string;
      session_id?: string;
      portal_call_session_id?: string;
      portal_user_id?: string;
    };
  };
  call_outcome?: {
    safety_result?: string;
    safety_flag_type?: string;
    topic_classified?: string;
    callback_requested?: boolean;
    consent_verbally_confirmed?: boolean;
    consent_timestamp?: string;
    whatsapp_summary_requested?: boolean;
    call_summary?: string;
    resolution_type?: string;
    escalation_triggered?: boolean;
  };
  ghl_write_targets?: {
    contact_id?: string;
    location_id?: string;
    opportunity_id?: string;
  };
  // ElevenLabs native webhook format fields
  caller_phone?: string;
  dynamic_variables?: Record<string, string>;
  analysis?: {
    call_successful?: string;
    transcript_summary?: string;
    data_collection_results?: Record<string, any>;
  };
  transcript?: Array<{ role: string; message: string }>;
  metadata?: Record<string, any>;
}

/**
 * Main entry point: process a post-call webhook payload.
 * Returns the conversation_id on success.
 */
export async function processPostCallWebhook(rawPayload: PostCallPayload): Promise<string> {
  // Normalize the payload — support both our custom schema and ElevenLabs native format
  const conversationId =
    rawPayload.conversation_id ??
    rawPayload.elevenlabs?.conversation_id ??
    "";

  if (!conversationId) {
    throw new Error("Missing conversation_id in webhook payload");
  }

  let conversationData = null as Awaited<ReturnType<typeof getConversation>> | null;
  let linkedSession = await getCallSessionByConversationId(conversationId);

  if (config.elevenLabsApiKey) {
    conversationData = await getConversation(config.elevenLabsApiKey, conversationId);
  }

  const portalCallSessionId =
    rawPayload.elevenlabs?.dynamic_variables_echo?.portal_call_session_id ??
    rawPayload.dynamic_variables?.portal_call_session_id ??
    rawPayload.elevenlabs?.dynamic_variables_echo?.session_id ??
    rawPayload.dynamic_variables?.session_id ??
    conversationData?.dynamic_variables?.portal_call_session_id ??
    conversationData?.dynamic_variables?.session_id ??
    null;

  if (!linkedSession && portalCallSessionId) {
    linkedSession = await getCallSessionBySessionId(portalCallSessionId);
  }

  // Resolve GHL contact ID from multiple sources
  let ghlContactId =
    rawPayload.ghl_write_targets?.contact_id ??
    rawPayload.elevenlabs?.dynamic_variables_echo?.ghl_contact_id ??
    rawPayload.elevenlabs?.dynamic_variables_echo?.wibiz_contact_id ??
    rawPayload.dynamic_variables?.ghl_contact_id ??
    rawPayload.dynamic_variables?.wibiz_contact_id ??
    linkedSession?.ghlContactId ??
    undefined;

  const ghlLocationId =
    rawPayload.ghl_write_targets?.location_id ??
    rawPayload.elevenlabs?.dynamic_variables_echo?.ghl_location_id ??
    rawPayload.elevenlabs?.dynamic_variables_echo?.wibiz_location_id ??
    rawPayload.dynamic_variables?.ghl_location_id ??
    rawPayload.dynamic_variables?.wibiz_location_id ??
    linkedSession?.ghlLocationId ??
    config.ghlLocationId;

  // Fallback: fetch full conversation from ElevenLabs to get dynamic_variables
  if (!ghlContactId && conversationData) {
    ghlContactId =
      conversationData.dynamic_variables?.ghl_contact_id ??
      conversationData.dynamic_variables?.wibiz_contact_id ??
      ghlContactId;

    // Last resort: phone-based lookup (inbound calls)
    if (!ghlContactId && conversationData.caller_phone && config.ghlApiKey) {
      const { searchContactByPhone } = await import("./ghl");
      const contact = await searchContactByPhone(
        config.ghlApiKey,
        ghlLocationId,
        conversationData.caller_phone
      );
      if (contact) ghlContactId = contact.id;
    }
  }

  if (!ghlContactId) {
    throw new Error(`Cannot resolve GHL contact for conversation ${conversationId}`);
  }

  // Build normalized payload
  const outcome = rawPayload.call_outcome ?? {} as NonNullable<PostCallPayload['call_outcome']>;
  const elevenlabsMeta = rawPayload.elevenlabs ?? {} as NonNullable<PostCallPayload['elevenlabs']>;
  const transcriptEntries = rawPayload.transcript ?? conversationData?.transcript ?? [];

  const transcript =
    rawPayload.elevenlabs?.transcript_raw ??
    (transcriptEntries.length ? formatTranscriptToText(transcriptEntries) : "") ??
    "";

  const normalizedPayload = {
    conversationId,
    ghlContactId,
    ghlLocationId,
    opportunityId: rawPayload.ghl_write_targets?.opportunity_id,
    transcriptRaw: transcript,
    callSummary: outcome.call_summary ?? rawPayload.analysis?.transcript_summary ?? "",
    safetyResult: outcome.safety_result ?? "SAFE",
    safetyFlagType: outcome.safety_flag_type ?? "none",
    topicClassified: outcome.topic_classified ?? "general",
    callbackRequested: outcome.callback_requested ?? false,
    consentVerballyConfirmed: outcome.consent_verbally_confirmed ?? false,
    consentTimestamp: outcome.consent_timestamp ? new Date(outcome.consent_timestamp) : null,
    whatsappSummaryRequested: outcome.whatsapp_summary_requested ?? false,
    resolutionType: outcome.resolution_type ?? "unknown",
    escalationTriggered: outcome.escalation_triggered ?? false,
    asrConfidence: elevenlabsMeta.asr_confidence ?? "unknown",
    callDurationSeconds: elevenlabsMeta.call_duration_seconds ?? 0,
    callEndTime: elevenlabsMeta.call_end_time ? new Date(elevenlabsMeta.call_end_time) : new Date(),
  };

  // Write to GHL
  await syncToGHL(normalizedPayload);

  if (linkedSession?.sessionId && transcriptEntries.length > 0) {
    const existingChunks = await getTranscriptsBySessionId(linkedSession.sessionId);
    if (existingChunks.length === 0) {
      for (const entry of transcriptEntries) {
        await insertTranscriptChunk({
          sessionId: linkedSession.sessionId,
          elevenlabsConversationId: conversationId,
          speaker: entry.role === "agent" ? "agent" : "user",
          text: entry.message,
          timestamp: normalizedPayload.callEndTime,
        });
      }
    }
  }

  const dbUpdate = {
    status: "synced" as const,
    ghlContactId,
    ghlLocationId,
    elevenlabsConversationId: conversationId,
    safetyResult: normalizedPayload.safetyResult as any,
    safetyFlagType: normalizedPayload.safetyFlagType,
    topicClassified: normalizedPayload.topicClassified,
    callbackRequested: normalizedPayload.callbackRequested,
    consentVerballyConfirmed: normalizedPayload.consentVerballyConfirmed,
    consentTimestamp: normalizedPayload.consentTimestamp ?? undefined,
    callSummary: normalizedPayload.callSummary,
    resolutionType: normalizedPayload.resolutionType,
    escalationTriggered: normalizedPayload.escalationTriggered,
    asrConfidence: normalizedPayload.asrConfidence,
    transcriptRaw: normalizedPayload.transcriptRaw,
    callDurationSeconds: normalizedPayload.callDurationSeconds,
    callEndTime: normalizedPayload.callEndTime,
    ghlSynced: true,
    ghlSyncedAt: new Date(),
  };

  if (linkedSession?.sessionId) {
    await updateCallSession(linkedSession.sessionId, dbUpdate);
  } else {
    await updateCallSessionByConversationId(conversationId, dbUpdate);
  }

  return conversationId;
}

interface NormalizedCallPayload {
  conversationId: string;
  ghlContactId: string;
  ghlLocationId: string;
  opportunityId?: string;
  transcriptRaw: string;
  callSummary: string;
  safetyResult: string;
  safetyFlagType: string;
  topicClassified: string;
  callbackRequested: boolean;
  consentVerballyConfirmed: boolean;
  consentTimestamp: Date | null;
  whatsappSummaryRequested: boolean;
  resolutionType: string;
  escalationTriggered: boolean;
  asrConfidence: string;
  callDurationSeconds: number;
  callEndTime: Date;
}

async function syncToGHL(payload: NormalizedCallPayload) {
  if (!config.ghlApiKey) {
    console.warn("[PostCallSync] GHL not configured, skipping sync");
    return;
  }

  const {
    ghlContactId,
    ghlLocationId,
    transcriptRaw,
    callSummary,
    safetyResult,
    safetyFlagType,
    topicClassified,
    callbackRequested,
    resolutionType,
    escalationTriggered,
    asrConfidence,
    callDurationSeconds,
    callEndTime,
    consentVerballyConfirmed,
  } = payload;

  // STEP 1: Update GHL Contact with callback and consent fields
  try {
    const tags: string[] = ["Voice Case - " + safetyResult];
    if (consentVerballyConfirmed) tags.push("Consent Verified");
    if (callbackRequested) tags.push("Callback Requested");

    await updateContact(config.ghlApiKey, ghlContactId, {
      tags,
      customFields: [
        { key: "callback_requested", value: String(callbackRequested) },
        { key: "last_call_safety_result", value: safetyResult },
        { key: "last_call_date", value: callEndTime.toISOString() },
      ],
    });
  } catch (err) {
    console.error("[PostCallSync] Failed to update GHL contact:", err);
  }

  // STEP 2: Find or create Opportunity
  let opportunityId = payload.opportunityId;
  if (!opportunityId) {
    try {
      const opportunities = await getOpportunitiesForContact(
        config.ghlApiKey,
        ghlLocationId,
        ghlContactId
      );
      // Use the most recent open opportunity
      const openOpp = opportunities.find((o) => o.status === "open");
      opportunityId = openOpp?.id;

      if (!opportunityId) {
        // Create a new opportunity
        const pipelines = await getPipelines(config.ghlApiKey, ghlLocationId);
        const pipeline = extractCaregiversPipeline(pipelines);
        if (pipeline) {
          const firstStage = pipeline.stages[0];
          const opp = await createOpportunity(config.ghlApiKey, {
            locationId: ghlLocationId,
            pipelineId: pipeline.id,
            pipelineStageId: firstStage?.id ?? "",
            contactId: ghlContactId,
            name: `Voice Case - ${new Date().toISOString().split("T")[0]}`,
          });
          opportunityId = opp.id;
        }
      }
    } catch (err) {
      console.error("[PostCallSync] Failed to find/create opportunity:", err);
    }
  }

  // STEP 3: Update Opportunity with call outcome
  if (opportunityId) {
    try {
      const pipelines = await getPipelines(config.ghlApiKey, ghlLocationId);
      const pipeline = extractCaregiversPipeline(pipelines);
      const targetStageName = resolveTargetStageName(
        safetyResult,
        callbackRequested,
        resolutionType
      );
      const targetStage = pipeline?.stages.find((s) => s.name === targetStageName);

      await updateOpportunity(config.ghlApiKey, opportunityId, {
        pipelineStageId: targetStage?.id,
        customFields: [
          { key: "voice_transcript", value: transcriptRaw },
          { key: "asr_confidence", value: asrConfidence },
          { key: "safety_gate_result", value: safetyResult },
          { key: "safety_flag_type", value: safetyFlagType },
          { key: "case_category", value: topicToCaseCategory(topicClassified) },
          { key: "callback_requested", value: String(callbackRequested) },
          { key: "resolution_type", value: resolutionType },
          { key: "escalation_triggered", value: String(escalationTriggered) },
          {
            key: "case_notes",
            value: buildSOAPNote({
              callSummary,
              safetyResult,
              topicClassified,
              resolutionType,
              escalationTriggered,
              callbackRequested,
            }),
          },
        ],
      });
    } catch (err) {
      console.error("[PostCallSync] Failed to update GHL opportunity:", err);
    }
  }

  // STEP 4: Add contact note with transcript
  try {
    
      const noteBody = `☎ VOICE CALL SUMMARY — ${callEndTime.toISOString()}

Duration: ${callDurationSeconds}s
Safety: ${safetyResult}
Topic: ${topicClassified}
Resolution: ${resolutionType}

--- CALL SUMMARY ---
${callSummary}

--- FULL TRANSCRIPT ---
${transcriptRaw}`;

      await addNoteToContact(config.ghlApiKey, ghlContactId, noteBody);
  } catch (err) {
    console.error("[PostCallSync] Failed to add GHL note:", err);
  }
}


