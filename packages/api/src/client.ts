import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Initialize the Supabase client. Call this once at app startup
 * before using any API functions.
 *
 * Web:    initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
 * Mobile: initSupabase(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
 */
export function initSupabase(url: string, publishableKey: string): void {
  _client = createClient(url, publishableKey);
}

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    throw new Error(
      "Supabase client not initialized. Call initSupabase() at app startup."
    );
  }
  return _client;
}

/** Convenience export — valid after initSupabase() has been called. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
