/**
 * Server-side configuration reads from environment variables.
 * All secrets must be supplied via environment configuration, never hardcoded.
 */

function normalizeEnvValue(value: string | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  return unquoted;
}

export function normalizeBearerToken(value: string | undefined): string {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return "";

  return normalized.replace(/^Bearer\s+/i, "").trim();
}

export const config = {
  // GHL API
  ghlApiKey: normalizeBearerToken(process.env.GHL_API_KEY),
  ghlLocationId: normalizeEnvValue(process.env.GHL_LOCATION_ID),

  // ElevenLabs API
  elevenLabsApiKey: normalizeBearerToken(process.env.ELEVENLABS_API_KEY),
  elevenLabsAgentId: normalizeEnvValue(process.env.ELEVENLABS_AGENT_ID),

  // Webhook secrets (for verifying inbound webhook authenticity)
  elevenLabsPostCallWebhookSecret:
    normalizeEnvValue(process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET) ||
    normalizeEnvValue(process.env.ELEVENLABS_WEBHOOK_SECRET) ||
    "dementiahub-webhook-secret-2026",
  elevenLabsConsentWebhookSecret:
    normalizeEnvValue(process.env.ELEVENLABS_CONSENT_WEBHOOK_SECRET) ||
    normalizeEnvValue(process.env.ELEVENLABS_WEBHOOK_SECRET) ||
    "dementiahub-webhook-secret-2026",

  // App
  appUrl: normalizeEnvValue(process.env.APP_URL) || "http://localhost:3000",
};

/**
 * Verify that a webhook request has the correct shared secret.
 * ElevenLabs sends the secret in the X-ElevenLabs-Secret header.
 */
export function verifyElevenLabsWebhookSecret(
  kind: "post_call" | "consent",
  incomingSecret: string | undefined
): boolean {
  if (!incomingSecret) return false;
  return (
    incomingSecret ===
    (kind === "post_call"
      ? config.elevenLabsPostCallWebhookSecret
      : config.elevenLabsConsentWebhookSecret)
  );
}

/**
 * Check if GHL is properly configured.
 */
export function isGHLConfigured(): boolean {
  return Boolean(config.ghlApiKey && config.ghlLocationId);
}

/**
 * Check if ElevenLabs is properly configured.
 */
export function isElevenLabsConfigured(): boolean {
  return Boolean(config.elevenLabsApiKey && config.elevenLabsAgentId);
}
