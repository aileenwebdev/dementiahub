/**
 * Identity Sync Service
 * Handles the creation and synchronization of user identities between
 * the portal, GHL, and ElevenLabs.
 */

import {
  addTagsToContact,
  createContact,
  searchContactByPhone,
  updateContact,
} from "./ghl";
import {
  getDb,
  getIdentityByUserId,
  upsertIdentityMap,
} from "../db";
import { config } from "../config";
import { users } from "../../drizzle/schema";

export interface PortalUser {
  id: number;
  name?: string | null;
  email?: string | null;
  openId: string;
}

export async function recordPortalSignupConsent(
  user: PortalUser,
  options?: { ghlContactId?: string | null }
): Promise<void> {
  const existingIdentity = await getIdentityByUserId(user.id);
  const consentTimestamp = existingIdentity?.consentTimestamp ?? new Date();

  await upsertIdentityMap({
    portalUserId: user.id,
    ghlContactId: options?.ghlContactId ?? existingIdentity?.ghlContactId ?? undefined,
    ghlLocationId: existingIdentity?.ghlLocationId ?? (config.ghlLocationId || undefined),
    elevenlabsAgentId:
      existingIdentity?.elevenlabsAgentId ?? (config.elevenLabsAgentId || undefined),
    consentGiven: true,
    consentTimestamp,
  });

  if (!config.ghlApiKey || !options?.ghlContactId) {
    return;
  }

  try {
    await addTagsToContact(config.ghlApiKey, options.ghlContactId, ["Consent Verified", "Portal Consent"]);
    await updateContact(config.ghlApiKey, options.ghlContactId, {
      customFields: [
        { key: "consent_given", value: "true" },
        { key: "consent_channel", value: "Portal Signup" },
        { key: "consent_timestamp", value: consentTimestamp.toISOString() },
      ],
    });
  } catch (err) {
    console.error("[IdentitySync] Failed to sync portal consent to GHL:", err);
  }
}

/**
 * Ensures a portal user has a corresponding GHL contact and identity mapping.
 * Called after user registration / first login.
 *
 * Flow:
 * 1. Check if identity mapping already exists
 * 2. If ghl_contact_id is already set, skip
 * 3. If phone number provided, search GHL for existing contact
 * 4. If not found, create new GHL contact
 * 5. Store mapping in user_identity_map
 */
export async function ensureGHLIdentity(
  user: PortalUser,
  phoneNumber?: string
): Promise<string | null> {
  if (!config.ghlApiKey || !config.ghlLocationId) {
    console.warn("[IdentitySync] GHL not configured, skipping identity sync");
    return null;
  }

  // Check existing identity
  const existing = await getIdentityByUserId(user.id);
  if (existing?.ghlContactId) {
    // Identity already mapped — optionally update phone if provided
    if (phoneNumber && !existing.phoneNumber) {
      await upsertIdentityMap({
        portalUserId: user.id,
        ghlLocationId: config.ghlLocationId,
        phoneNumber,
      });
    }
    return existing.ghlContactId;
  }

  let ghlContactId: string | null = null;

  // Try to find existing GHL contact by phone
  if (phoneNumber) {
    try {
      const contact = await searchContactByPhone(
        config.ghlApiKey,
        config.ghlLocationId,
        phoneNumber
      );
      if (contact) {
        ghlContactId = contact.id;
        console.log(`[IdentitySync] Found existing GHL contact: ${ghlContactId}`);
      }
    } catch (err) {
      console.warn("[IdentitySync] Phone search failed:", err);
    }
  }

  // Create new GHL contact if not found
  if (!ghlContactId) {
    try {
      const nameParts = (user.name ?? "Portal User").split(" ");
      const firstName = nameParts[0] ?? "Portal";
      const lastName = nameParts.slice(1).join(" ") || "User";

      const contact = await createContact(config.ghlApiKey, config.ghlLocationId, {
        firstName,
        lastName,
        email: user.email ?? undefined,
        phone: phoneNumber,
        tags: ["Portal User", "DementiaHub"],
        customFields: [
          { key: "portal_user_id", value: String(user.id) },
          { key: "source", value: "DementiaHub Portal" },
        ],
      });
      ghlContactId = contact.id;
      console.log(`[IdentitySync] Created new GHL contact: ${ghlContactId}`);
    } catch (err) {
      console.error("[IdentitySync] Failed to create GHL contact:", err);
      // Store partial identity even without GHL contact
    }
  }

  // Store identity mapping
  await upsertIdentityMap({
    portalUserId: user.id,
    ghlContactId: ghlContactId ?? undefined,
    ghlLocationId: config.ghlLocationId,
    elevenlabsAgentId: config.elevenLabsAgentId || undefined,
    phoneNumber: phoneNumber ?? undefined,
  });

  await recordPortalSignupConsent(user, { ghlContactId });

  return ghlContactId;
}

/**
 * Updates the GHL contact when the user updates their profile.
 */
export async function syncProfileToGHL(
  userId: number,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
  }
): Promise<void> {
  if (!config.ghlApiKey) return;

  const identity = await getIdentityByUserId(userId);
  if (!identity?.ghlContactId) return;

  try {
    const nameParts = (updates.name ?? "").split(" ");
    await updateContact(config.ghlApiKey, identity.ghlContactId, {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" ") || undefined,
      email: updates.email,
      phone: updates.phone,
    });

    if (updates.phone) {
      await upsertIdentityMap({
        portalUserId: userId,
        ghlLocationId: identity.ghlLocationId ?? config.ghlLocationId,
        phoneNumber: updates.phone,
      });
    }
  } catch (err) {
    console.error("[IdentitySync] Failed to sync profile to GHL:", err);
  }
}

export async function backfillPortalSignupConsentForAllUsers() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const allUsers = await db.select().from(users);

  let processed = 0;
  let consented = 0;
  let ghlLinked = 0;

  for (const user of allUsers) {
    processed += 1;

    const existingIdentity = await getIdentityByUserId(user.id);
    const ghlContactId =
      existingIdentity?.ghlContactId ??
      (await ensureGHLIdentity(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          openId: user.openId,
        },
        existingIdentity?.phoneNumber ?? undefined
      ));

    await recordPortalSignupConsent(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        openId: user.openId,
      },
      { ghlContactId }
    );

    const refreshedIdentity = await getIdentityByUserId(user.id);
    if (refreshedIdentity?.consentGiven) {
      consented += 1;
    }
    if (refreshedIdentity?.ghlContactId) {
      ghlLinked += 1;
    }
  }

  return {
    processed,
    consented,
    ghlLinked,
  };
}
