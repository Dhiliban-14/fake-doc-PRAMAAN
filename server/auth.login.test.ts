import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

function createTestContext(): { ctx: TrpcContext; setCookies: { name: string; val: string; opts: any }[] } {
  const setCookies: { name: string; val: string; opts: any }[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as any,
    res: {
      cookie: (name: string, val: string, opts: any) => {
        setCookies.push({ name, val, opts });
      },
      clearCookie: () => {},
    } as any,
  };

  return { ctx, setCookies };
}

describe("auth.login", () => {
  it("authenticates official investigator credentials and sets session cookie", async () => {
    const { ctx, setCookies } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const res = await caller.auth.login({
      usernameOrEmail: "investigator@pramaan.gov.in",
      password: "pramaan2026",
    });

    expect(res.success).toBe(true);
    expect(res.user?.name).toBe("Aarav Sharma");
    expect(res.token).toBeDefined();
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.opts.httpOnly).toBe(true);
  });

  it("rejects invalid password with UNAUTHORIZED error", async () => {
    const { ctx } = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        usernameOrEmail: "investigator@pramaan.gov.in",
        password: "wrong_password",
      })
    ).rejects.toThrow("Invalid credentials");
  });
});
