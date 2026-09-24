import { describe, expect, it } from "vitest";
import {
  authErrorMessageKey,
  buildAuthCallbackUrl,
  parseRecoverySessionFragment,
  resolvePublicAuthOrigin,
} from "./auth";

describe("authentication helpers", () => {
  it("maps known Supabase errors without exposing raw messages", () => {
    expect(authErrorMessageKey({ code: "invalid_credentials" })).toBe(
      "invalidCredentials",
    );
    expect(authErrorMessageKey({ code: "email_not_confirmed" })).toBe(
      "emailNotConfirmed",
    );
    expect(authErrorMessageKey(new Error("sensitive provider message"))).toBe(
      "error",
    );
  });

  it("builds exact production callback URLs without user-controlled targets", () => {
    expect(
      buildAuthCallbackUrl(
        "https://smart-home.example",
        "en",
        "recovery",
      ),
    ).toBe(
      "https://smart-home.example/en/auth/recovery-callback",
    );
    expect(
      buildAuthCallbackUrl(
        "https://smart-home.example",
        "th",
        "confirmation",
      ),
    ).toBe("https://smart-home.example/th/auth/callback");
  });

  it("prefers Render's external URL over its internal request origin", () => {
    expect(
      resolvePublicAuthOrigin(
        "http://localhost:10000/en/auth/recovery-callback",
        "https://smart-home-web.onrender.com",
      ),
    ).toBe("https://smart-home-web.onrender.com");
  });

  it("uses the request origin outside Render", () => {
    expect(
      resolvePublicAuthOrigin("http://localhost:3000/th/auth/callback"),
    ).toBe("http://localhost:3000");
  });

  it("extracts a complete implicit recovery session without exposing it elsewhere", () => {
    expect(
      parseRecoverySessionFragment(
        "#access_token=access-value&refresh_token=refresh-value&type=recovery",
      ),
    ).toEqual({
      accessToken: "access-value",
      refreshToken: "refresh-value",
    });
  });

  it("rejects incomplete and failed recovery fragments", () => {
    expect(parseRecoverySessionFragment("#access_token=access-value")).toEqual({
      error: true,
    });
    expect(
      parseRecoverySessionFragment(
        "#error=access_denied&error_code=otp_expired",
      ),
    ).toEqual({ error: true });
    expect(parseRecoverySessionFragment("")).toBeUndefined();
  });
});
