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
import { config, normalizePhoneForComparison, verifyElevenLabsWebhookSecret } from "./config";
import {
  createAIChatConversation,
  createAIChatMessage,
  getActiveAIChatConversationByUserId,
  getAIChatConversationById,
  getIdentityByPhoneNumber,
  queueFailedSync,
  touchAIChatConversation,
  updateAIChatConversation,
  updateConsentForContact,
} from "./db";
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlMessage(message?: string) {
  const body = message ? `<Message>${escapeXml(message)}</Message>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function twimlVoice(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(message)}</Say></Response>`;
}

function getRequestUrl(req: any) {
  const path = req.originalUrl ?? req.url ?? "";
  return `${config.appUrl.replace(/\/+$/, "")}${path}`;
}

function getBodyParams(body: any) {
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      Array.isArray(value) ? String(value[0] ?? "") : String(value ?? ""),
    ])
  );
}

function verifyTwilioSignature(req: any) {
  if (!config.twilioAuthToken) {
    return true;
  }

  const signature = req.headers["x-twilio-signature"];
  if (typeof signature !== "string") {
    return false;
  }

  const url = getRequestUrl(req);
  const params = getBodyParams(req.body);
  const data = Object.keys(params)
    .sort()
    .reduce((payload, key) => `${payload}${key}${params[key]}`, url);
  const expected = crypto.createHmac("sha1", config.twilioAuthToken).update(data).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function normalizeTwilioAddress(value?: string) {
  return normalizePhoneForComparison(value ?? "");
}

async function ensureConversationForTwilio(portalUserId: number) {
  const existing = await getActiveAIChatConversationByUserId(portalUserId);
  if (existing) return existing;

  const conversationId = await createAIChatConversation({
    portalUserId,
    title: "WhatsApp Support Chat",
    status: "active",
    caseStatus: "open",
    casePriority: "normal",
    lastMessageAt: new Date(),
  });

  if (!conversationId) {
    throw new Error("Failed to create Twilio support conversation");
  }

  const created = await getAIChatConversationById(conversationId);
  if (!created) {
    throw new Error("Created Twilio support conversation could not be loaded");
  }

  return created;
}

async function appendTwilioMessageToPortalCase(params: {
  from: string;
  to: string;
  body: string;
  messageSid?: string;
  channel: "whatsapp" | "sms";
}) {
  const identity = await getIdentityByPhoneNumber(params.from);
  if (!identity) {
    console.warn(`[Twilio] No portal identity matched inbound ${params.channel} from ${params.from}`);
    return { matched: false as const };
  }

  const conversation = await ensureConversationForTwilio(identity.portalUserId);
  const channelLabel = params.channel === "whatsapp" ? "WhatsApp" : "SMS";
  const content = [
    `[${channelLabel}] ${params.body.trim()}`,
    params.messageSid ? `\nTwilio message: ${params.messageSid}` : "",
  ].join("");

  await createAIChatMessage({
    conversationId: conversation.id,
    portalUserId: identity.portalUserId,
    role: "user",
    content,
  });
  await touchAIChatConversation(conversation.id);
  await updateAIChatConversation(conversation.id, {
    lastCaregiverResponseAt: new Date(),
    caseStatus: conversation.humanTakeover ? "in_progress" : "open",
    casePriority: conversation.casePriority ?? "normal",
  });

  console.log(
    `[Twilio] inbound ${params.channel} routed conversation=${conversation.id} user=${identity.portalUserId}`
  );

  return { matched: true as const, conversationId: conversation.id, portalUserId: identity.portalUserId };
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

webhookRouter.post("/twilio/messaging", async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    console.error("[Twilio] messaging auth failed - invalid signature");
    return res.status(401).type("text/xml").send(twimlMessage());
  }

  const from = normalizeTwilioAddress(req.body?.From);
  const to = normalizeTwilioAddress(req.body?.To);
  const body = String(req.body?.Body ?? "").trim();
  const messageSid = typeof req.body?.MessageSid === "string" ? req.body.MessageSid : undefined;
  const channel = String(req.body?.From ?? "").toLowerCase().startsWith("whatsapp:")
    ? "whatsapp"
    : "sms";

  if (!from || !body) {
    return res.status(200).type("text/xml").send(twimlMessage());
  }

  try {
    const result = await appendTwilioMessageToPortalCase({
      from,
      to,
      body,
      messageSid,
      channel,
    });

    const reply = result.matched
      ? "Thanks. Your message has reached DementiaHub support. A human staff member can review this case in the portal."
      : "Thanks for reaching DementiaHub. Please sign in to the caregiver portal so we can link this WhatsApp number to your support record.";

    return res.status(200).type("text/xml").send(twimlMessage(reply));
  } catch (err: any) {
    console.error("[Twilio] inbound messaging handler failed:", err?.message ?? err);
    return res
      .status(200)
      .type("text/xml")
      .send(twimlMessage("Thanks. We received your message, but support routing needs review."));
  }
});

webhookRouter.post("/twilio/status", async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    console.error("[Twilio] status auth failed - invalid signature");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[Twilio] message status", {
    messageSid: req.body?.MessageSid,
    status: req.body?.MessageStatus ?? req.body?.SmsStatus,
    to: req.body?.To,
    errorCode: req.body?.ErrorCode,
  });

  return res.status(200).json({ status: "ok" });
});

webhookRouter.post("/twilio/voice", async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    console.error("[Twilio] voice auth failed - invalid signature");
    return res.status(401).type("text/xml").send(twimlVoice("Unauthorized"));
  }

  console.log("[Twilio] inbound voice webhook", {
    callSid: req.body?.CallSid,
    from: req.body?.From,
    to: req.body?.To,
  });

  return res
    .status(200)
    .type("text/xml")
    .send(
      twimlVoice(
        "Thank you for calling DementiaHub. Voice AI handoff is being configured. Please use the caregiver portal or WhatsApp support message for now."
      )
    );
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
    twilio: config.twilioAuthToken ? "configured" : "missing",
  });
});

export default webhookRouter;
