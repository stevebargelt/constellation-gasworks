import { supabase } from "@constellation/api";

/**
 * Google OAuth for web — standard redirect flow.
 *
 * Calls supabase.auth.signInWithOAuth, which redirects the browser to Google
 * and then back to /auth/callback with a session. The useAuth hook picks up
 * the resulting session via onAuthStateChange.
 */
export function useGoogleAuth() {
  async function signInWithGoogle(): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return { signInWithGoogle };
}
