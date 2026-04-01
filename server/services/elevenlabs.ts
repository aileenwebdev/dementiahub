/**
 * ElevenLabs Conversational AI API Service Layer
 * Base URL: https://api.elevenlabs.io
 * Authentication: xi-api-key header
 */

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";

function elevenLabsHeaders(apiKey: string) {
  return {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

export interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  call_duration_secs?: number;
  start_time_unix_secs?: number;
  call_successful?: string;
  metadata?: Record<string, any>;
  analysis?: {
    call_successful?: string;
    transcript_summary?: string;
    data_collection_results?: Record<string, any>;
  };
  transcript?: Array<{
    role: "agent" | "user";
    message: string;
    time_in_call_secs?: number;
  }>;
  dynamic_variables?: Record<string, string>;
  caller_phone?: string;
}

export interface InitiateCallParams {
  agentId: string;
  phoneNumber: string;
  dynamicVariables: {
    ghl_contact_id: string;
    ghl_location_id: string;
    portal_user_id: string;
    session_id: string;
  };
}

// ─── Conversation Operations ─────────────────────────────────────────────────

export async function getConversation(
  apiKey: string,
  conversationId: string
): Promise<ElevenLabsConversation | null> {
  const res = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/convai/conversations/${conversationId}`,
    { headers: elevenLabsHeaders(apiKey) }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`ElevenLabs getConversation failed: ${res.status} ${err}`);
    return null;
  }
  return res.json();
}

export async function getConversationTranscript(
  apiKey: string,
  conversationId: string
): Promise<Array<{ role: string; message: string; time_in_call_secs?: number }>> {
  const res = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/convai/conversations/${conversationId}/transcript`,
    { headers: elevenLabsHeaders(apiKey) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.transcript ?? [];
}

export async function getAllConversations(
  apiKey: string,
  agentId: string,
  limit = 50
): Promise<ElevenLabsConversation[]> {
  const res = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/convai/conversations?agent_id=${agentId}&page_size=${limit}`,
    { headers: elevenLabsHeaders(apiKey) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.conversations ?? [];
}

export async function initiateOutboundCall(
  apiKey: string,
  params: InitiateCallParams
): Promise<{ conversation_id: string } | null> {
  const body = {
    agent_id: params.agentId,
    customer_phone_number: params.phoneNumber,
    dynamic_variables: params.dynamicVariables,
    metadata: {
      source: "dementiahub_portal",
      initiated_by: "portal",
    },
  };

  const res = await fetch(`${ELEVENLABS_BASE_URL}/v1/convai/conversations`, {
    method: "POST",
    headers: elevenLabsHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs initiateOutboundCall failed: ${res.status} ${err}`);
  }

  return res.json();
}

// ─── Transcript Helpers ──────────────────────────────────────────────────────

export function formatTranscriptToText(
  transcript: Array<{ role: string; message: string }>
): string {
  return transcript
    .map((t) => `[${t.role.toUpperCase()}]: ${t.message}`)
    .join("\n");
}

// ─── Safety Keyword Detection ────────────────────────────────────────────────

const UNSAFE_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "hurt myself",
  "self harm",
  "overdose",
  "can't go on",
  "no reason to live",
];

export function checkForUnsafeKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return UNSAFE_KEYWORDS.some((kw) => lower.includes(kw));
}
