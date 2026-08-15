import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";
import type { SupabaseJwtVerifier } from "./supabase-jwt.verifier.js";

function context(authorization?: string): ExecutionContext {
  const request = { headers: { authorization } };
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
}

describe("SupabaseAuthGuard", () => {
  it("rejects a missing bearer token", async () => {
    const verifier = { verify: vi.fn() } as unknown as SupabaseJwtVerifier;
    const guard = new SupabaseAuthGuard(new Reflector(), verifier);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("attaches a verified user to the request", async () => {
    const verifier = {
      verify: vi.fn().mockResolvedValue({
        id: "3f683723-da0e-42cd-8407-4b3f524f5af3",
        email: "owner@example.com",
        role: "authenticated"
      })
    } as unknown as SupabaseJwtVerifier;
    const executionContext = context("Bearer valid-token");
    const guard = new SupabaseAuthGuard(new Reflector(), verifier);

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith("valid-token");
    expect(
      executionContext.switchToHttp().getRequest<{ user?: { id: string } }>()
        .user?.id
    ).toBe("3f683723-da0e-42cd-8407-4b3f524f5af3");
  });
});
