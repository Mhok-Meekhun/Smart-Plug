export type AuthMessageKey =
  | "accountExists"
  | "emailNotConfirmed"
  | "emailRateLimited"
  | "error"
  | "invalidCredentials"
  | "recoveryExpired"
  | "weakPassword";

export function authErrorMessageKey(error: unknown): AuthMessageKey {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  switch (code) {
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "email_exists":
    case "user_already_exists":
      return "accountExists";
    case "invalid_credentials":
      return "invalidCredentials";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "emailRateLimited";
    case "same_password":
    case "weak_password":
      return "weakPassword";
    case "session_not_found":
      return "recoveryExpired";
    default:
      return "error";
  }
}

export function buildAuthCallbackUrl(
  origin: string,
  locale: string,
  purpose: "confirmation" | "recovery",
): string {
  const path =
    purpose === "recovery"
      ? `/${locale}/auth/recovery-callback`
      : `/${locale}/auth/callback`;
  return new URL(path, origin).toString();
}
