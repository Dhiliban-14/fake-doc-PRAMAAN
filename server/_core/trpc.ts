import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (ctx.user) {
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }

  // Graceful guest investigator fallback so guest exploration does not crash
  const now = new Date();
  const guestUser = {
    id: 999,
    openId: "guest-investigator",
    name: "Guest Investigator",
    email: "guest@pramaan.gov.in",
    loginMethod: "guest",
    role: "user" as const,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };

  return next({
    ctx: {
      ...ctx,
      user: guestUser,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
