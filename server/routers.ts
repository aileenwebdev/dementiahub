import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { callsRouter } from "./routers/calls";
import { ghlRouter } from "./routers/ghl";
import { identityRouter } from "./routers/identity";
import { ensureGHLIdentity } from "./services/identitySync";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Called after OAuth login to ensure GHL identity is set up.
     * Non-blocking — won't fail login if GHL is unavailable.
     */
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
  identity: identityRouter,
  ghl: ghlRouter,
});

export type AppRouter = typeof appRouter;
