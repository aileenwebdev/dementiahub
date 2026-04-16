import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV, isAdminEmail } from "./_core/env";
import { hashPassword, sdk, verifyPassword } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import * as db from "./db";
import { aiRouter } from "./routers/ai";
import { callsRouter } from "./routers/calls";
import { ghlRouter } from "./routers/ghl";
import { identityRouter } from "./routers/identity";
import { ensureGHLIdentity, recordPortalSignupConsent } from "./services/identitySync";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
        }

        const openId = nanoid();
        const passwordHash = await hashPassword(input.password);
        const isAdmin = isAdminEmail(input.email);

        await db.upsertUser({
          openId,
          name: input.name,
          email: input.email,
          passwordHash,
          loginMethod: "email",
          lastSignedIn: new Date(),
          role: isAdmin ? "admin" : "user",
        });

        const token = await sdk.createSessionToken(openId, {
          name: input.name,
          expiresInMs: ONE_YEAR_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: ONE_YEAR_MS,
        });

        const createdUser = await db.getUserByEmail(input.email);
        if (createdUser) {
          await recordPortalSignupConsent({
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            openId: createdUser.openId,
          }).catch((err) => {
            console.warn("[Register] Failed to record portal consent:", err);
          });
        }

        return { success: true } as const;
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        const invalid = !user || !user.passwordHash;
        const passwordOk = invalid ? false : await verifyPassword(input.password, user!.passwordHash!);
        const isAdmin = isAdminEmail(input.email);

        if (!passwordOk) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        const token = await sdk.createSessionToken(user!.openId, {
          name: user!.name ?? "",
          expiresInMs: ONE_YEAR_MS,
        });
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: ONE_YEAR_MS,
        });

        await db.upsertUser({
          openId: user!.openId,
          lastSignedIn: new Date(),
          role: isAdmin ? "admin" : user!.role,
        });
        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    postLoginSync: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        await ensureGHLIdentity({
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
          openId: ctx.user.openId,
        });
      } catch (err) {
        console.warn("[PostLoginSync] GHL identity sync failed:", err);
      }
      return { success: true };
    }),
  }),

  calls: callsRouter,
  ai: aiRouter,
  identity: identityRouter,
  ghl: ghlRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
