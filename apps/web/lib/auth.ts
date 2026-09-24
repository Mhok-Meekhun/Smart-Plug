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

export function resolvePublicAuthOrigin(
  requestUrl: string,
  externalUrl?: string,
): string {
  const source = externalUrl?.trim() || requestUrl;
  const url = new URL(source);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Authentication redirects require an HTTP(S) origin");
  }

  return url.origin;
}

export type RecoverySessionFragment =
  | { accessToken: string; refreshToken: string }
  | { error: true }
  | undefined;

export function parseRecoverySessionFragment(
  fragment: string,
): RecoverySessionFragment {
  const params = new URLSearchParams(
    fragment.startsWith("#") ? fragment.slice(1) : fragment,
  );

  if (
    params.has("error") ||
    params.has("error_code") ||
    params.has("error_description")
  ) {
    return { error: true };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken && !refreshToken) return undefined;
  if (!accessToken || !refreshToken) return { error: true };

  return { accessToken, refreshToken };
}
