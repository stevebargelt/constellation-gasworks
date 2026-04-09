import { useEffect, useState } from "react";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { supabase } from "@constellation/api";

interface SignInWithGoogleOptions {
  skipBrowserRedirect?: boolean;
}

interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (
    redirectUri: string,
    options?: SignInWithGoogleOptions
  ) => Promise<{ url: string | null }>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string): Promise<void> {
    setError(null);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) setError(new Error(authError.message));
  }

  async function signIn(email: string, password: string): Promise<void> {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) setError(new Error(authError.message));
  }

  async function signInWithGoogle(
    redirectUri: string,
    options?: SignInWithGoogleOptions
  ): Promise<{ url: string | null }> {
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: options?.skipBrowserRedirect,
      },
    });
    if (authError) setError(new Error(authError.message));
    return { url: data?.url ?? null };
  }

  async function signOut(): Promise<void> {
    setError(null);
    await supabase.auth.signOut();
  }

  return { user, session, loading, error, signUp, signIn, signInWithGoogle, signOut };
}
