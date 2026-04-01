/**
 * Server-side configuration — reads from environment variables.
 * All secrets must be set via webdev_request_secrets, never hardcoded.
 */

export const config = {
  // GHL API
  ghlApiKey: process.env.GHL_API_KEY ?? "",
  ghlLocationId: process.env.GHL_LOCATION_ID ?? "",

  // ElevenLabs API
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenLabsAgentId: process.env.ELEVENLABS_AGENT_ID ?? "",

  // Webhook secrets (for verifying inbound webhook authenticity)
  elevenLabsWebhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET ?? "dementiahub-webhook-secret-2026",

  // App
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
};

/**
 * Verify that a webhook request has the correct shared secret.
 * ElevenLabs sends the secret in the X-ElevenLabs-Secret header.
 */
export function verifyElevenLabsWebhookSecret(
  incomingSecret: string | undefined
): boolean {
  if (!incomingSecret) return false;
  return incomingSecret === config.elevenLabsWebhookSecret;
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
