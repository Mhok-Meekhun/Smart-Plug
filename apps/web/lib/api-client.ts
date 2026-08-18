import { createClient } from "./supabase/client";

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("API URL is not configured");

  const { data, error } = await createClient().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Authentication session is unavailable");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as
      | { message?: string; messageKey?: string }
      | undefined;
    throw new Error(payload?.messageKey ?? payload?.message ?? `API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
