/**
 * ElevenLabs Webhook Routes
 * Registered as Express routes outside of tRPC so they can receive raw JSON payloads.
 *
 * Endpoints:
 *   POST /api/webhooks/elevenlabs/post-call  - receives post-call data from ElevenLabs
 *   POST /api/webhooks/elevenlabs/consent    - receives real-time consent confirmation
 */

import crypto from "crypto";
import { Router } from "express";
import { config, verifyElevenLabsWebhookSecret } from "./config";
import { queueFailedSync, updateConsentForContact } from "./db";
import { addTagsToContact, updateContact } from "./services/ghl";
import { processPostCallWebhook } from "./services/postCallSync";

const webhookRouter = Router();

type RequestWithRawBody = {
  body: any;
  headers: Record<string, unknown>;
  rawBody?: string;
};

function timingSafeEqualHex(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function verifyElevenLabsSignature(req: RequestWithRawBody) {
  const signatureHeader = req.headers["elevenlabs-signature"];
  if (typeof signatureHeader !== "string" || !req.rawBody || !config.elevenLabsWebhookSecret) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((part) => part.trim())
      .map((part) => {
        const [key, value] = part.split("=");
        return [key, value];
      })
      .filter(([key, value]) => Boolean(key && value))
  );

  const timestamp = parts.t ?? parts.timestamp;
  const signature = parts.v1 ?? parts.signature;
  if (!timestamp || !signature) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 30) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.elevenLabsWebhookSecret)
    .update(`${timestamp}.${req.rawBody}`)
    .digest("hex");

  return timingSafeEqualHex(expected, signature);
}

function isAuthorizedWebhook(req: RequestWithRawBody) {
  const incomingSecret = req.headers["x-elevenlabs-secret"];
  if (typeof incomingSecret === "string" && verifyElevenLabsWebhookSecret(incomingSecret)) {
    return true;
  }

  return verifyElevenLabsSignature(req);
}

function unwrapWebhookPayload(payload: any) {
  if (payload && typeof payload === "object" && typeof payload.type === "string" && payload.data) {
    return payload.data;
  }

  return payload;
}

webhookRouter.post("/elevenlabs/post-call", async (req, res) => {
  const request = req as typeof req & { rawBody?: string };

  if (!isAuthorizedWebhook(request)) {
    console.error("[Webhook] post-call auth failed - invalid secret or signature");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = unwrapWebhookPayload(req.body);
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

    try {
      await queueFailedSync({
        conversationId,
        webhookType: "post_call",
        payload,
        errorMessage: err.message,
        retryCount: 0,
      });
    } catch (queueErr) {
      console.error("[Webhook] Failed to queue for retry:", queueErr);
    }

    return res.status(500).json({ error: "Sync failed - queued for retry" });
  }
});

webhookRouter.post("/elevenlabs/consent", async (req, res) => {
  const request = req as typeof req & { rawBody?: string };

  if (!isAuthorizedWebhook(request)) {
    console.error("[Webhook] consent auth failed - invalid secret or signature");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = unwrapWebhookPayload(req.body);
  const { ghl_contact_id, conversation_id } = payload;

  if (!ghl_contact_id) {
    return res.status(400).json({ error: "Missing ghl_contact_id" });
  }

  const consentTimestamp = new Date();

  console.log(`[Webhook] consent received for contact: ${ghl_contact_id}`);

  try {
    if (config.ghlApiKey) {
      await addTagsToContact(config.ghlApiKey, ghl_contact_id, ["Consent Verified"]);

      await updateContact(config.ghlApiKey, ghl_contact_id, {
        customFields: [
          { key: "consent_given", value: "true" },
          { key: "consent_channel", value: "Voice" },
          { key: "consent_timestamp", value: consentTimestamp.toISOString() },
        ],
      });
    }

    await updateConsentForContact(ghl_contact_id, consentTimestamp);

    console.log(`[Webhook] Consent verified for ${ghl_contact_id} at ${consentTimestamp.toISOString()}`);
    return res.status(200).json({ status: "consent_recorded" });
  } catch (err: any) {
    console.error("[Webhook] consent write failed:", err.message);

    try {
      await queueFailedSync({
        conversationId: conversation_id ?? "unknown",
        webhookType: "consent",
        payload,
        errorMessage: err.message,
        retryCount: 0,
      });
    } catch (queueErr) {
      console.error("[Webhook] Failed to queue consent for retry:", queueErr);
    }

    return res.status(500).json({ error: "Failed to record consent" });
  }
});

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
