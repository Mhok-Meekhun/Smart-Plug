import { createServerClient } from "@supabase/ssr";
import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "../../../../i18n/routing";
import { resolvePublicAuthOrigin } from "../../../../lib/auth";
import { supabaseConfig } from "../../../../lib/supabase/config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: requestedLocale } = await params;
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;
  const publicOrigin = resolvePublicAuthOrigin(
    request.url,
    process.env.RENDER_EXTERNAL_URL,
  );
  const failureUrl = new URL(`/${locale}/auth/login`, publicOrigin);
  failureUrl.searchParams.set("error", "auth_callback_failed");

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(failureUrl);

  const response = NextResponse.redirect(
    new URL(`/${locale}/dashboard`, publicOrigin),
  );
  const { url, publishableKey } = supabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? NextResponse.redirect(failureUrl) : response;
}
