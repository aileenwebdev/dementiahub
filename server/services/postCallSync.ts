/**
 * Post-Call Sync Service
 * Receives ElevenLabs post-call webhook data, normalizes it,
 * stores the finished call locally, and then syncs to GHL.
 */

import {
  addNoteToContact,
  buildSOAPNote,
  createOpportunity,
  extractCaregiversPipeline,
  getOpportunitiesForContact,
  getPipelines,
  resolveTargetStageName,
  searchContactByPhone,
  topicToCaseCategory,
  updateContact,
  updateOpportunity,
} from "./ghl";
import {
  formatTranscriptToText,
  getConversation,
  getConversationTranscript,
  type ElevenLabsConversation,
} from "./elevenlabs";
import {
  getCallSessionByConversationId,
  getCallSessionBySessionId,
  getIdentityByUserId,
  getTranscriptsBySessionId,
  insertTranscriptChunk,
  updateCallSession,
  updateCallSessionByConversationId,
} from "../db";
import { config } from "../config";
import { triageConversation } from "./conversationTriage";
import type { InsertCallSession } from "../../drizzle/schema";

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

function readCollectedValue(results: Record<string, any> | undefined, ...keys: string[]) {
  if (!results) return undefined;

  for (const key of keys) {
    const value = results[key];
    if (value === undefined || value === null) continue;

    if (typeof value === "object") {
      const nested =
        value.value ??
        value.result ??
        value.answer ??
        value.string_value ??
        value.boolean_value ??
        value.enum_value ??
        value.text;
      if (nested !== undefined && nested !== null) {
        return nested;
      }
    }

    return value;
  }

  return undefined;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function toStringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function normalizeTranscriptEntries(
  transcript: Array<{ role: string; message: string; time_in_call_secs?: number }> | undefined
) {
  return (transcript ?? [])
    .filter((entry) => entry?.message?.trim())
    .map((entry) => ({
      role: entry.role === "agent" ? "agent" : "user",
      message: entry.message.trim(),
      time_in_call_secs: entry.time_in_call_secs,
    }));
}

async function persistTranscriptIfNeeded(params: {
  sessionId?: string;
  conversationId: string;
  transcriptEntries: Array<{ role: string; message: string; time_in_call_secs?: number }>;
  callEndTime: Date;
}) {
  if (!params.sessionId || params.transcriptEntries.length === 0) return;

  const existingChunks = await getTranscriptsBySessionId(params.sessionId);
  if (existingChunks.length > 0) return;

  for (let index = 0; index < params.transcriptEntries.length; index += 1) {
    const entry = params.transcriptEntries[index];
    const offsetSeconds = entry.time_in_call_secs ?? index;
    await insertTranscriptChunk({
      sessionId: params.sessionId,
      elevenlabsConversationId: params.conversationId,
      speaker: entry.role === "agent" ? "agent" : "user",
      text: entry.message,
      timestamp: new Date(params.callEndTime.getTime() + offsetSeconds * 1000),
    });
  }

  console.log(
    `[PostCallSync] transcript saved conversation=${params.conversationId} session=${params.sessionId} chunks=${params.transcriptEntries.length}`
  );
}

async function persistCallCompletion(
  conversationId: string,
  updates: Partial<InsertCallSession>,
  linkedSessionId?: string
) {
  if (linkedSessionId) {
    await updateCallSession(linkedSessionId, updates);
    return;
  }

  await updateCallSessionByConversationId(conversationId, updates);
}

function deriveOutcome(params: {
  outcome: NonNullable<PostCallPayload["call_outcome"]>;
  transcriptEntries: Array<{ role: string; message: string }>;
  fallbackSummary: string;
}) {
  const shouldRunLocalTriage =
    params.transcriptEntries.length > 0 &&
    (!params.outcome.safety_result ||
      !params.outcome.topic_classified ||
      !params.outcome.resolution_type ||
      params.outcome.callback_requested === undefined);

  if (!shouldRunLocalTriage) {
    return null;
  }

  console.log("[PostCallSync] safety started source=local-triage");
  const triage = triageConversation(
    params.transcriptEntries.map((entry) => ({
      role: entry.role === "agent" ? "assistant" : "user",
      content: entry.message,
    }))
  );
  console.log(
    `[PostCallSync] safety completed source=local-triage result=${triage.safetyResult} callback=${triage.callbackRequested}`
  );

  return {
    safety_result: triage.safetyResult,
    safety_flag_type: triage.safetyFlagType,
    topic_classified: triage.topicClassified,
    callback_requested: triage.callbackRequested,
    consent_verbally_confirmed: triage.consentVerballyConfirmed,
    call_summary: triage.conversationSummary || params.fallbackSummary,
    resolution_type: triage.resolutionType,
    escalation_triggered: triage.escalationTriggered,
  };
}

export async function synthesizePostCallPayloadFromConversation(
  conversation: ElevenLabsConversation,
  apiKey?: string
): Promise<PostCallPayload> {
  const analysisResults = conversation.analysis?.data_collection_results ?? {};
  const transcript =
    conversation.transcript?.length
      ? conversation.transcript.map((entry) => ({
          role: entry.role,
          message: entry.message,
          time_in_call_secs: entry.time_in_call_secs,
        }))
      : apiKey
        ? await getConversationTranscript(apiKey, conversation.conversation_id)
        : [];

  return {
    conversation_id: conversation.conversation_id,
    dynamic_variables: conversation.dynamic_variables,
    caller_phone: conversation.caller_phone,
    analysis: conversation.analysis,
    transcript: transcript.map((entry) => ({
      role: entry.role,
      message: entry.message,
    })),
    elevenlabs: {
      conversation_id: conversation.conversation_id,
      agent_id: conversation.agent_id,
      call_duration_seconds: conversation.call_duration_secs,
      transcript_raw: transcript.length ? formatTranscriptToText(transcript) : undefined,
      dynamic_variables_echo: {
        ghl_contact_id: conversation.dynamic_variables?.ghl_contact_id,
        ghl_location_id: conversation.dynamic_variables?.ghl_location_id,
        wibiz_contact_id: conversation.dynamic_variables?.wibiz_contact_id,
        wibiz_location_id: conversation.dynamic_variables?.wibiz_location_id,
        session_id: conversation.dynamic_variables?.session_id,
        portal_call_session_id: conversation.dynamic_variables?.portal_call_session_id,
        portal_user_id: conversation.dynamic_variables?.portal_user_id,
      },
    },
    call_outcome: {
      safety_result: toStringValue(
        readCollectedValue(analysisResults, "safety_result", "safety_gate_result"),
        ""
      ),
      safety_flag_type: toStringValue(
        readCollectedValue(analysisResults, "safety_flag_type", "flag_type"),
        ""
      ),
      topic_classified: toStringValue(
        readCollectedValue(analysisResults, "topic_classified", "case_category", "topic"),
        ""
      ),
      callback_requested: toBoolean(
        readCollectedValue(analysisResults, "callback_requested", "needs_callback"),
        false
      ),
      consent_verbally_confirmed: toBoolean(
        readCollectedValue(analysisResults, "consent_verbally_confirmed", "consent_given"),
        false
      ),
      consent_timestamp: toStringValue(readCollectedValue(analysisResults, "consent_timestamp")),
      whatsapp_summary_requested: toBoolean(
        readCollectedValue(analysisResults, "whatsapp_summary_requested"),
        false
      ),
      call_summary: toStringValue(
        readCollectedValue(analysisResults, "call_summary", "conversation_summary"),
        conversation.analysis?.transcript_summary ?? ""
      ),
      resolution_type: toStringValue(readCollectedValue(analysisResults, "resolution_type"), ""),
      escalation_triggered: toBoolean(
        readCollectedValue(analysisResults, "escalation_triggered"),
        false
      ),
    },
  };
}

/**
 * Main entry point: process a post-call webhook payload.
 * Returns the conversation_id on success.
 */
export async function processPostCallWebhook(rawPayload: PostCallPayload): Promise<string> {
  const conversationId = rawPayload.conversation_id ?? rawPayload.elevenlabs?.conversation_id ?? "";

  if (!conversationId) {
    throw new Error("Missing conversation_id in webhook payload");
  }

  console.log(`[PostCallSync] call ended conversation=${conversationId}`);

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

  const transcriptEntries = normalizeTranscriptEntries(
    rawPayload.transcript?.map((entry) => ({
      role: entry.role,
      message: entry.message,
    })) ??
      conversationData?.transcript ??
      (config.elevenLabsApiKey
        ? await getConversationTranscript(config.elevenLabsApiKey, conversationId)
        : [])
  );

  console.log(
    `[PostCallSync] transcript received conversation=${conversationId} chunks=${transcriptEntries.length}`
  );

  const transcriptRaw =
    rawPayload.elevenlabs?.transcript_raw ??
    (transcriptEntries.length ? formatTranscriptToText(transcriptEntries) : "") ??
    "";

  const baseOutcome = (rawPayload.call_outcome ?? {}) as NonNullable<PostCallPayload["call_outcome"]>;
  const localOutcome = deriveOutcome({
    outcome: baseOutcome,
    transcriptEntries,
    fallbackSummary: rawPayload.analysis?.transcript_summary ?? "",
  });
  const resolvedOutcome = {
    ...baseOutcome,
    ...localOutcome,
  };

  const callEndTime = rawPayload.elevenlabs?.call_end_time
    ? new Date(rawPayload.elevenlabs.call_end_time)
    : new Date();

  await persistTranscriptIfNeeded({
    sessionId: linkedSession?.sessionId,
    conversationId,
    transcriptEntries,
    callEndTime,
  });

  const normalizedPayload = {
    conversationId,
    ghlContactId:
      rawPayload.ghl_write_targets?.contact_id ??
      rawPayload.elevenlabs?.dynamic_variables_echo?.ghl_contact_id ??
      rawPayload.elevenlabs?.dynamic_variables_echo?.wibiz_contact_id ??
      rawPayload.dynamic_variables?.ghl_contact_id ??
      rawPayload.dynamic_variables?.wibiz_contact_id ??
      conversationData?.dynamic_variables?.ghl_contact_id ??
      conversationData?.dynamic_variables?.wibiz_contact_id ??
      linkedSession?.ghlContactId ??
      undefined,
    ghlLocationId:
      rawPayload.ghl_write_targets?.location_id ??
      rawPayload.elevenlabs?.dynamic_variables_echo?.ghl_location_id ??
      rawPayload.elevenlabs?.dynamic_variables_echo?.wibiz_location_id ??
      rawPayload.dynamic_variables?.ghl_location_id ??
      rawPayload.dynamic_variables?.wibiz_location_id ??
      conversationData?.dynamic_variables?.ghl_location_id ??
      conversationData?.dynamic_variables?.wibiz_location_id ??
      linkedSession?.ghlLocationId ??
      config.ghlLocationId,
    opportunityId: rawPayload.ghl_write_targets?.opportunity_id,
    transcriptRaw,
    callSummary:
      resolvedOutcome.call_summary ??
      rawPayload.analysis?.transcript_summary ??
      localOutcome?.call_summary ??
      "",
    safetyResult: resolvedOutcome.safety_result ?? "SAFE",
    safetyFlagType: resolvedOutcome.safety_flag_type ?? "none",
    topicClassified: resolvedOutcome.topic_classified ?? "general",
    callbackRequested: resolvedOutcome.callback_requested ?? false,
    consentVerballyConfirmed: resolvedOutcome.consent_verbally_confirmed ?? false,
    consentTimestamp: resolvedOutcome.consent_timestamp
      ? new Date(resolvedOutcome.consent_timestamp)
      : null,
    whatsappSummaryRequested: resolvedOutcome.whatsapp_summary_requested ?? false,
    resolutionType: resolvedOutcome.resolution_type ?? "unknown",
    escalationTriggered: resolvedOutcome.escalation_triggered ?? false,
    asrConfidence: rawPayload.elevenlabs?.asr_confidence ?? "unknown",
    callDurationSeconds:
      rawPayload.elevenlabs?.call_duration_seconds ?? conversationData?.call_duration_secs ?? 0,
    callEndTime,
  };

  if (!normalizedPayload.ghlContactId && conversationData?.caller_phone && config.ghlApiKey) {
    const contact = await searchContactByPhone(
      config.ghlApiKey,
      normalizedPayload.ghlLocationId,
      conversationData.caller_phone
    );
    if (contact) {
      normalizedPayload.ghlContactId = contact.id;
    }
  }

  if (!normalizedPayload.ghlContactId) {
    const rawPortalUserId =
      rawPayload.elevenlabs?.dynamic_variables_echo?.portal_user_id ??
      rawPayload.dynamic_variables?.portal_user_id ??
      conversationData?.dynamic_variables?.portal_user_id ??
      linkedSession?.portalUserId?.toString();

    if (rawPortalUserId) {
      const identity = await getIdentityByUserId(parseInt(rawPortalUserId, 10));
      if (identity?.ghlContactId) {
        normalizedPayload.ghlContactId = identity.ghlContactId;
        console.log(
          `[PostCallSync] resolved ghl contact via portal_user_id=${rawPortalUserId} contact=${identity.ghlContactId}`
        );
      }
    }
  }

  await persistCallCompletion(
    conversationId,
    {
      status: "completed",
      ghlContactId: normalizedPayload.ghlContactId,
      ghlLocationId: normalizedPayload.ghlLocationId,
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
      ghlSynced: false,
      ghlSyncedAt: null,
      ghlSyncError: null,
    },
    linkedSession?.sessionId
  );

  if (normalizedPayload.callbackRequested) {
    console.log(`[PostCallSync] callback flag set conversation=${conversationId}`);
  }
  if (normalizedPayload.safetyResult === "SAFE") {
    console.log(`[PostCallSync] safe flag set conversation=${conversationId}`);
  }
  console.log(
    `[PostCallSync] call marked completed conversation=${conversationId} result=${normalizedPayload.safetyResult}`
  );

  if (!normalizedPayload.ghlContactId) {
    const message = `Cannot resolve Wibiz contact for conversation ${conversationId}`;
    await persistCallCompletion(
      conversationId,
      {
        ghlSyncError: message,
      },
      linkedSession?.sessionId
    );
    throw new Error(message);
  }

  const ghlContactId = normalizedPayload.ghlContactId;

  try {
    const { opportunityId } = await syncToGHL({
      ...normalizedPayload,
      ghlContactId,
    });

    await persistCallCompletion(
      conversationId,
      {
        status: "synced",
        ghlContactId,
        ghlLocationId: normalizedPayload.ghlLocationId,
        ghlOpportunityId: opportunityId ?? undefined,
        ghlSynced: true,
        ghlSyncedAt: new Date(),
        ghlSyncError: null,
      },
      linkedSession?.sessionId
    );
  } catch (error: any) {
    await persistCallCompletion(
      conversationId,
      {
        status: "completed",
        ghlContactId,
        ghlLocationId: normalizedPayload.ghlLocationId,
        ghlSynced: false,
        ghlSyncError: error?.message ?? "Unknown Wibiz sync error",
      },
      linkedSession?.sessionId
    );
    throw error;
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

async function syncToGHL(payload: NormalizedCallPayload): Promise<{ opportunityId?: string }> {
  if (!config.ghlApiKey) {
    throw new Error("Wibiz integration not configured");
  }

  const {
    conversationId,
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

  const errors: string[] = [];
  let resolvedOpportunityId: string | undefined;

  try {
    const tags: string[] = [
      "Voice Case - " + safetyResult,
      "Wibiz Trigger - Voice Case",
      resolutionType === "self_serve"
        ? "Wibiz Trigger - Self Serve"
        : "Wibiz Trigger - Needs Staff",
    ];
    if (consentVerballyConfirmed) tags.push("Consent Verified", "Wibiz Trigger - Consent Verified");
    if (callbackRequested) tags.push("Callback Requested", "Wibiz Trigger - Callback Requested");
    if (escalationTriggered) tags.push("Wibiz Trigger - Escalation");

    await updateContact(config.ghlApiKey, ghlContactId, {
      tags,
      customFields: [
        { key: "callback_requested", value: String(callbackRequested) },
        { key: "last_call_safety_result", value: safetyResult },
        { key: "last_call_date", value: callEndTime.toISOString() },
        { key: "call_conversation_id", value: conversationId },
      ],
    });
  } catch (err: any) {
    errors.push(`contact update failed: ${err?.message ?? err}`);
  }

  let opportunityId = payload.opportunityId;
  if (!opportunityId) {
    try {
      const opportunities = await getOpportunitiesForContact(
        config.ghlApiKey,
        ghlLocationId,
        ghlContactId
      );
      const openOpp =
        opportunities.find(
          (opportunity) =>
            opportunity.status === "open" &&
            (opportunity.pipelineId === config.ghlCasesPipelineId || !config.ghlCasesPipelineId)
        ) ?? opportunities.find((opportunity) => opportunity.status === "open");
      opportunityId = openOpp?.id;

      if (!opportunityId) {
        const pipelines = await getPipelines(config.ghlApiKey, ghlLocationId);
        const pipeline = extractCaregiversPipeline(pipelines, config.ghlCasesPipelineId);
        if (!pipeline) {
          throw new Error("Caregiver Cases pipeline not found");
        }

        const firstStage = pipeline.stages[0];
        const opportunity = await createOpportunity(config.ghlApiKey, {
          locationId: ghlLocationId,
          pipelineId: pipeline.id,
          pipelineStageId: firstStage?.id ?? "",
          contactId: ghlContactId,
          name: `Voice Case - ${new Date().toISOString().split("T")[0]}`,
        });
        opportunityId = opportunity.id;
      }
    } catch (err: any) {
      errors.push(`opportunity lookup/create failed: ${err?.message ?? err}`);
    }
  }
  resolvedOpportunityId = opportunityId;

  if (opportunityId) {
    try {
      const pipelines = await getPipelines(config.ghlApiKey, ghlLocationId);
      const pipeline = extractCaregiversPipeline(pipelines, config.ghlCasesPipelineId);
      const targetStageName = resolveTargetStageName(
        safetyResult,
        callbackRequested,
        resolutionType
      );
      const targetStage = pipeline?.stages.find((stage) => stage.name === targetStageName);

      await updateOpportunity(config.ghlApiKey, opportunityId, {
        pipelineStageId: targetStage?.id,
        customFields: [
          { key: "elevenlabs_conversation_id", value: conversationId },
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
    } catch (err: any) {
      errors.push(`opportunity update failed: ${err?.message ?? err}`);
    }
  }

  try {
    const noteBody = `VOICE CALL SUMMARY - ${callEndTime.toISOString()}

Wibiz Voice ID: ${conversationId}
Duration: ${callDurationSeconds}s
Safety: ${safetyResult}
Topic: ${topicClassified}
Resolution: ${resolutionType}

--- CALL SUMMARY ---
${callSummary}

--- FULL TRANSCRIPT ---
${transcriptRaw}`;

    await addNoteToContact(config.ghlApiKey, ghlContactId, noteBody);
  } catch (err: any) {
    errors.push(`contact note failed: ${err?.message ?? err}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  return { opportunityId: resolvedOpportunityId };
}
