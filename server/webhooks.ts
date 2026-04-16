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

function getWebhookSecret(kind: "post_call" | "consent") {
  return kind === "post_call"
    ? config.elevenLabsPostCallWebhookSecret
    : config.elevenLabsConsentWebhookSecret;
}

function verifyElevenLabsSignature(kind: "post_call" | "consent", req: RequestWithRawBody) {
  const signatureHeader = req.headers["elevenlabs-signature"];
  const secret = getWebhookSecret(kind);
  if (typeof signatureHeader !== "string" || !req.rawBody || !secret) {
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
    .createHmac("sha256", secret)
    .update(`${timestamp}.${req.rawBody}`)
    .digest("hex");

  return timingSafeEqualHex(expected, signature);
}

function isAuthorizedWebhook(kind: "post_call" | "consent", req: RequestWithRawBody) {
  const incomingSecret = req.headers["x-elevenlabs-secret"];
  if (typeof incomingSecret === "string" && verifyElevenLabsWebhookSecret(kind, incomingSecret)) {
    return true;
  }

  return verifyElevenLabsSignature(kind, req);
}

function unwrapWebhookPayload(payload: any) {
  if (payload && typeof payload === "object" && typeof payload.type === "string" && payload.data) {
    return payload.data;
  }

  return payload;
}

webhookRouter.post("/elevenlabs/post-call", async (req, res) => {
  const request = req as typeof req & { rawBody?: string };

  if (!isAuthorizedWebhook("post_call", request)) {
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

  if (!isAuthorizedWebhook("consent", request)) {
    console.error("[Webhook] consent auth failed - invalid secret or signature");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = unwrapWebhookPayload(req.body);
  const ghlContactId =
    payload?.ghl_contact_id ??
    payload?.wibiz_contact_id ??
    payload?.dynamic_variables?.ghl_contact_id ??
    payload?.dynamic_variables?.wibiz_contact_id;
  const conversationId = payload?.conversation_id ?? payload?.conversationId ?? "unknown";

  if (!ghlContactId) {
    return res.status(400).json({ error: "Missing ghl_contact_id or wibiz_contact_id" });
  }

  const consentTimestamp = new Date();

  console.log(`[Webhook] consent received for contact: ${ghlContactId}`);

  try {
    if (config.ghlApiKey) {
      await addTagsToContact(config.ghlApiKey, ghlContactId, ["Consent Verified"]);

      await updateContact(config.ghlApiKey, ghlContactId, {
        customFields: [
          { key: "consent_given", value: "true" },
          { key: "consent_channel", value: "Voice" },
          { key: "consent_timestamp", value: consentTimestamp.toISOString() },
        ],
      });
    }

    await updateConsentForContact(ghlContactId, consentTimestamp);

    console.log(`[Webhook] Consent verified for ${ghlContactId} at ${consentTimestamp.toISOString()}`);
    return res.status(200).json({ status: "consent_recorded" });
  } catch (err: any) {
    console.error("[Webhook] consent write failed:", err.message);

    try {
      await queueFailedSync({
        conversationId,
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
    webhookSecrets: {
      postCall: config.elevenLabsPostCallWebhookSecret ? "configured" : "missing",
      consent: config.elevenLabsConsentWebhookSecret ? "configured" : "missing",
    },
    ghl: config.ghlApiKey ? "configured" : "missing",
    elevenlabs: config.elevenLabsApiKey ? "configured" : "missing",
  });
});

export default webhookRouter;
