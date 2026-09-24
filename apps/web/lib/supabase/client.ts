import type { Database } from "@smart-home/database-types";
import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

export function createClient() {
  const { url, publishableKey } = supabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}

/**
 * Password recovery links should work even when the user opens the email in a
 * different browser from the one that requested it. The normal SSR client uses
 * PKCE and stores its verifier in the requesting browser, so recovery requests
 * deliberately use the implicit flow instead. The returned session is moved
 * into the cookie-backed SSR client on the reset-password page.
 */
export function createRecoveryRequestClient() {
  const { url, publishableKey } = supabaseConfig();
  return createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
      persistSession: false,
    },
  });
}
