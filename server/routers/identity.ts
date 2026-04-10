import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { config } from "../config";
import { getIdentityByUserId, upsertIdentityMap } from "../db";
import { getContactById } from "../services/ghl";
import { ensureGHLIdentity, syncProfileToGHL } from "../services/identitySync";

export const identityRouter = router({
  /**
   * Get the current user's identity mapping (portal ↔ GHL ↔ ElevenLabs).
   */
  getMyIdentity: protectedProcedure.query(async ({ ctx }) => {
    const identity = await getIdentityByUserId(ctx.user.id);
    return identity ?? null;
  }),

  /**
   * Set up or update the user's GHL identity mapping.
   * Called during profile setup or when the user provides their phone number.
   */
  setupIdentity: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().optional(),
        preferredLanguage: z.string().default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ghlContactId = await ensureGHLIdentity(
        {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
          openId: ctx.user.openId,
        },
        input.phoneNumber
      );

      if (input.preferredLanguage) {
        await upsertIdentityMap({
          portalUserId: ctx.user.id,
          ghlLocationId: config.ghlLocationId,
          preferredLanguage: input.preferredLanguage,
        });
      }

      return {
        success: true,
        ghlContactId,
        message: ghlContactId
          ? "Identity linked to Wibiz contact successfully"
          : "Identity saved (Wibiz contact creation pending)",
      };
    }),

  /**
   * Get the GHL contact record for the current user.
   */
  getGHLContact: protectedProcedure.query(async ({ ctx }) => {
    if (!config.ghlApiKey) return null;

    const identity = await getIdentityByUserId(ctx.user.id);
    if (!identity?.ghlContactId) return null;

    try {
      return await getContactById(config.ghlApiKey, identity.ghlContactId);
    } catch {
      return null;
    }
  }),

  /**
   * Update user profile and sync to GHL.
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().optional(),
        preferredLanguage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Sync to GHL if configured
      if (config.ghlApiKey) {
        await syncProfileToGHL(ctx.user.id, {
          name: ctx.user.name ?? undefined,
          email: ctx.user.email ?? undefined,
          phone: input.phoneNumber,
        });
      }

      // Update local identity map
      const identity = await getIdentityByUserId(ctx.user.id);
      await upsertIdentityMap({
        portalUserId: ctx.user.id,
        ghlLocationId: identity?.ghlLocationId ?? config.ghlLocationId,
        phoneNumber: input.phoneNumber ?? identity?.phoneNumber ?? undefined,
        preferredLanguage: input.preferredLanguage ?? identity?.preferredLanguage ?? "en",
      });

      return { success: true };
    }),

  /**
   * Check if the user's identity is fully set up.
   */
  checkSetupStatus: protectedProcedure.query(async ({ ctx }) => {
    const identity = await getIdentityByUserId(ctx.user.id);
    return {
      hasIdentity: Boolean(identity),
      hasGHLContact: Boolean(identity?.ghlContactId),
      hasPhone: Boolean(identity?.phoneNumber),
      consentGiven: identity?.consentGiven ?? false,
      ghlConfigured: Boolean(config.ghlApiKey && config.ghlLocationId),
      elevenLabsConfigured: Boolean(config.elevenLabsApiKey && config.elevenLabsAgentId),
    };
  }),
});
