import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const isDevelopment = process.env.NODE_ENV === "development";

const connectSources = [
  "'self'",
  isDevelopment ? "ws:" : undefined,
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "wss://")
].filter((source): source is string => Boolean(source));

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  isDevelopment ? undefined : "upgrade-insecure-requests"
].filter((directive): directive is string => Boolean(directive)).join("; ");

export default withNextIntl({
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" }
      ]
    }];
  }
});
