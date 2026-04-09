import { useEffect, useState } from "react";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { supabase } from "@constellation/api";

interface SignInWithGoogleOptions {
  redirectTo: string;
  skipBrowserRedirect?: boolean;
}

interface AuthState {
  session: Session | null;
  user: SupabaseUser | null;
  loading: boolean;
  error: Error | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (options: SignInWithGoogleOptions) => Promise<{ url?: string }>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string): Promise<void> {
    setError(null);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) setError(new Error(authError.message));
  }

  async function signIn(email: string, password: string): Promise<void> {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(new Error(authError.message));
  }

  async function signInWithGoogle(options: SignInWithGoogleOptions): Promise<{ url?: string }> {
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: options.redirectTo,
        skipBrowserRedirect: options.skipBrowserRedirect ?? false,
      },
    });
    if (authError) {
      setError(new Error(authError.message));
      return {};
    }
    return { url: data.url ?? undefined };
  }

  async function signOut(): Promise<void> {
    setError(null);
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(new Error(authError.message));
  }

  return { session, user, loading, error, signUp, signIn, signInWithGoogle, signOut };
}
