import type { Database } from "@smart-home/database-types";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function createClient() {
  const { url, publishableKey } = supabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
