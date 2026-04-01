/**
 * ElevenLabs Webhook Routes
 * Registered as Express routes outside of tRPC so they can receive raw JSON payloads.
 *
 * Endpoints:
 *   POST /api/webhooks/elevenlabs/post-call  — receives post-call data from ElevenLabs
 *   POST /api/webhooks/elevenlabs/consent    — receives real-time consent confirmation
 */

import { Router } from "express";
import { config, verifyElevenLabsWebhookSecret } from "./config";
import {
  updateConsentForContact,
  queueFailedSync,
} from "./db";
import { addTagsToContact, updateContact } from "./services/ghl";
import { processPostCallWebhook } from "./services/postCallSync";

const webhookRouter = Router();

// ─── POST /api/webhooks/elevenlabs/post-call ─────────────────────────────────

webhookRouter.post("/elevenlabs/post-call", async (req, res) => {
  // Verify webhook secret
  const incomingSecret = req.headers["x-elevenlabs-secret"] as string | undefined;
  if (!verifyElevenLabsWebhookSecret(incomingSecret)) {
    console.error("[Webhook] post-call auth failed — invalid secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = req.body;
  const conversationId =
    payload.conversation_id ??
    payload.elevenlabs?.conversation_id ??
    "unknown";

  console.log(`[Webhook] post-call received for conversation: ${conversationId}`);

  try {
    const resolvedId = await processPostCallWebhook(payload);
    return res.status(200).json({ status: "ok", conversation_id: resolvedId });
  } catch (err: any) {
    console.error("[Webhook] post-call sync failed:", err.message);

    // Queue for retry — do not lose data
    try {
      await queueFailedSync({
        conversationId,
        webhookType: "post_call",
        payload: payload as any,
        errorMessage: err.message,
        retryCount: 0,
      });
    } catch (queueErr) {
      console.error("[Webhook] Failed to queue for retry:", queueErr);
    }

    return res.status(500).json({ error: "Sync failed — queued for retry" });
  }
});

// ─── POST /api/webhooks/elevenlabs/consent ───────────────────────────────────

webhookRouter.post("/elevenlabs/consent", async (req, res) => {
  // Verify webhook secret
  const incomingSecret = req.headers["x-elevenlabs-secret"] as string | undefined;
  if (!verifyElevenLabsWebhookSecret(incomingSecret)) {
    console.error("[Webhook] consent auth failed — invalid secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ghl_contact_id, consent_phrase, conversation_id } = req.body;

  if (!ghl_contact_id) {
    return res.status(400).json({ error: "Missing ghl_contact_id" });
  }

  const consentTimestamp = new Date();

  console.log(`[Webhook] consent received for contact: ${ghl_contact_id}`);

  try {
    if (config.ghlApiKey) {
      // 1. Add "Consent Verified" tag to GHL Contact
      await addTagsToContact(config.ghlApiKey, ghl_contact_id, ["Consent Verified"]);

      // 2. Update consent custom fields on GHL Contact
      await updateContact(config.ghlApiKey, ghl_contact_id, {
        customFields: [
          { key: "consent_given", value: "true" },
          { key: "consent_channel", value: "Voice" },
          { key: "consent_timestamp", value: consentTimestamp.toISOString() },
        ],
      });
    }

    // 3. Update portal DB
    await updateConsentForContact(ghl_contact_id, consentTimestamp);

    console.log(`[Webhook] Consent verified for ${ghl_contact_id} at ${consentTimestamp.toISOString()}`);
    return res.status(200).json({ status: "consent_recorded" });
  } catch (err: any) {
    console.error("[Webhook] consent write failed:", err.message);

    // Queue for retry
    try {
      await queueFailedSync({
        conversationId: conversation_id ?? "unknown",
        webhookType: "consent",
        payload: req.body,
        errorMessage: err.message,
        retryCount: 0,
      });
    } catch (queueErr) {
      console.error("[Webhook] Failed to queue consent for retry:", queueErr);
    }

    return res.status(500).json({ error: "Failed to record consent" });
  }
});

// ─── GET /api/webhooks/health ─────────────────────────────────────────────────

webhookRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    webhookSecret: config.elevenLabsWebhookSecret ? "configured" : "missing",
    ghl: config.ghlApiKey ? "configured" : "missing",
    elevenlabs: config.elevenLabsApiKey ? "configured" : "missing",
  });
});

export default webhookRouter;
