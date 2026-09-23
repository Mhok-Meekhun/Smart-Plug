import { describe, expect, it } from "vitest";
import {
  authErrorMessageKey,
  buildAuthCallbackUrl,
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
});
