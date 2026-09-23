import { describe, expect, it } from "vitest";
import {
  authErrorMessageKey,
  buildAuthCallbackUrl,
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
});
