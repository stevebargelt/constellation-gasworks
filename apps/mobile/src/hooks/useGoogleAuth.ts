import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@constellation/api";

// Required to dismiss the auth browser on iOS/Android after redirect
WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "constellation",
  path: "auth/callback",
});

/**
 * Google OAuth via PKCE for React Native / Expo.
 *
 * Flow:
 *   1. supabase.auth.signInWithOAuth generates an auth URL with code_challenge
 *   2. expo-web-browser opens the Google consent page in a secure in-app browser
 *   3. Google redirects to constellation://auth/callback?code=...
 *   4. exchangeCodeForSession swaps the code for a session
 *   5. onAuthStateChange in useAuth fires and updates auth state
 */
export function useGoogleAuth() {
  async function signInWithGoogle(): Promise<void> {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: REDIRECT_URI,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      throw error ?? new Error("Failed to get OAuth URL from Supabase");
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

    if (result.type === "success" && result.url) {
      const url = new URL(result.url);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw exchangeError;
        }
      }
    }
  }

  return { signInWithGoogle };
}
