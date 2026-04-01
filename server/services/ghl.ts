/**
 * GoHighLevel (GHL) API V2 Service Layer
 * Base URL: https://services.leadconnectorhq.com
 * Authentication: Bearer token + Version header
 */

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

function ghlHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
  };
}

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  locationId: string;
  tags?: string[];
  customFields?: Array<{ key: string; value: string }>;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  status: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  locationId: string;
  customFields?: Array<{ key: string; value: string }>;
}

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
  isClosedStage: boolean;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLPipelineStage[];
}

// ─── Contact Operations ─────────────────────────────────────────────────────

export async function searchContactByPhone(
  apiKey: string,
  locationId: string,
  phone: string
): Promise<GHLContact | null> {
  const url = `${GHL_BASE_URL}/contacts/search?locationId=${locationId}&phone=${encodeURIComponent(phone)}`;
  const res = await fetch(url, { headers: ghlHeaders(apiKey) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL searchContactByPhone failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.contacts?.[0] ?? null;
}

export async function getContactById(
  apiKey: string,
  contactId: string
): Promise<GHLContact | null> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, {
    headers: ghlHeaders(apiKey),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.contact ?? null;
}

export async function createContact(
  apiKey: string,
  locationId: string,
  params: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    name?: string;
    tags?: string[];
    customFields?: Array<{ key: string; value: string }>;
  }
): Promise<GHLContact> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/`, {
    method: "POST",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({ locationId, ...params }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL createContact failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.contact;
}

export async function updateContact(
  apiKey: string,
  contactId: string,
  params: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
    customFields?: Array<{ key: string; value: string }>;
  }
): Promise<void> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, {
    method: "PUT",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL updateContact failed: ${res.status} ${err}`);
  }
}

export async function addTagsToContact(
  apiKey: string,
  contactId: string,
  tags: string[]
): Promise<void> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL addTagsToContact failed: ${res.status} ${err}`);
  }
}

export async function removeTagsFromContact(
  apiKey: string,
  contactId: string,
  tags: string[]
): Promise<void> {
  const res = await fetch(`${GHL_BASE_URL}/contacts/${contactId}/tags`, {
    method: "DELETE",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL removeTagsFromContact failed: ${res.status} ${err}`);
  }
}

// ─── Opportunity Operations ──────────────────────────────────────────────────

export async function getOpportunitiesForContact(
  apiKey: string,
  locationId: string,
  contactId: string
): Promise<GHLOpportunity[]> {
  const url = `${GHL_BASE_URL}/opportunities/search?location_id=${locationId}&contact_id=${contactId}`;
  const res = await fetch(url, { headers: ghlHeaders(apiKey) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.opportunities ?? [];
}

export async function createOpportunity(
  apiKey: string,
  params: {
    locationId: string;
    pipelineId: string;
    pipelineStageId: string;
    contactId: string;
    name: string;
    status?: string;
    customFields?: Array<{ key: string; value: string }>;
  }
): Promise<GHLOpportunity> {
  const res = await fetch(`${GHL_BASE_URL}/opportunities/`, {
    method: "POST",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({ status: "open", ...params }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL createOpportunity failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.opportunity;
}

export async function updateOpportunity(
  apiKey: string,
  opportunityId: string,
  params: {
    name?: string;
    status?: string;
    pipelineStageId?: string;
    customFields?: Array<{ key: string; value: string }>;
  }
): Promise<void> {
  const res = await fetch(`${GHL_BASE_URL}/opportunities/${opportunityId}`, {
    method: "PUT",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL updateOpportunity failed: ${res.status} ${err}`);
  }
}

// ─── Pipeline Operations ─────────────────────────────────────────────────────

export async function getPipelines(
  apiKey: string,
  locationId: string
): Promise<GHLPipeline[]> {
  const res = await fetch(
    `${GHL_BASE_URL}/opportunities/pipelines?locationId=${locationId}`,
    { headers: ghlHeaders(apiKey) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL getPipelines failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const pipelines: GHLPipeline[] = (data.pipelines ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    stages: (p.stages ?? []).map((s: any, idx: number) => ({
      id: s.id,
      name: s.name,
      position: idx + 1,
      isClosedStage: s.name?.startsWith("Closed") ?? false,
    })),
  }));
  return pipelines;
}

export function extractCaregiversPipeline(
  pipelines: GHLPipeline[]
): GHLPipeline | undefined {
  return pipelines.find((p) => p.name === "Caregiver Cases");
}

// ─── Conversation / Note Operations ─────────────────────────────────────────

export async function getConversationsForContact(
  apiKey: string,
  contactId: string
): Promise<any[]> {
  const res = await fetch(
    `${GHL_BASE_URL}/conversations/search?contactId=${contactId}`,
    { headers: ghlHeaders(apiKey) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.conversations ?? [];
}

export async function addNoteToConversation(
  apiKey: string,
  conversationId: string,
  noteBody: string
): Promise<void> {
  const res = await fetch(
    `${GHL_BASE_URL}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: ghlHeaders(apiKey),
      body: JSON.stringify({ type: "Note", body: noteBody }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`GHL addNoteToConversation failed: ${res.status} ${err}`);
    // Non-fatal — don't throw
  }
}

// ─── Stage Resolution Helpers ────────────────────────────────────────────────

export function resolveTargetStageName(
  safetyResult: string,
  callbackRequested: boolean,
  resolutionType: string
): string {
  if (safetyResult === "UNSAFE") return "Needs Staff - Awaiting Contact";
  if (safetyResult === "CAUTION") return "Needs Staff - Awaiting Contact";
  if (callbackRequested) return "Callback Scheduled";
  if (resolutionType === "self_serve") return "Self-Serve Resolved";
  return "Needs Staff - Awaiting Contact";
}

export function buildSOAPNote(payload: {
  callSummary?: string;
  safetyResult?: string;
  topicClassified?: string;
  resolutionType?: string;
  escalationTriggered?: boolean;
  callbackRequested?: boolean;
}): string {
  return `Situation: ${payload.callSummary ?? "N/A"}
Action: ElevenLabs Voice Agent (${payload.safetyResult ?? "N/A"} classification). Topic: ${payload.topicClassified ?? "N/A"}.
Outcome: ${payload.resolutionType ?? "N/A"}. Escalation triggered: ${payload.escalationTriggered ?? false}.
Next Step: ${payload.callbackRequested ? "Callback scheduled — staff to follow up." : "No further action required unless caregiver re-contacts."}`;
}

export function topicToCaseCategory(topic: string): string {
  const map: Record<string, string> = {
    caregiver_stress: "Caregiver Stress",
    medication: "Medication Management",
    behavior: "Behavioral Issues",
    safety: "Safety Concern",
    resources: "Resource Request",
    general: "General Inquiry",
  };
  return map[topic] ?? topic;
}
