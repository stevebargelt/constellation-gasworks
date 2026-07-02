export function validateSupabaseConfig(url: string, publishableKey: string): void {
  const missing: string[] = [];
  if (!url) missing.push("url (EXPO_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL)");
  if (!publishableKey) missing.push("publishableKey (EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY)");
  if (missing.length > 0) {
    throw new Error(`initSupabase: missing required config: ${missing.join(", ")}`);
  }
}
