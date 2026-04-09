import { useEffect, useState } from "react";
import type { User } from "@constellation/types";
import { getUser, createUser, updateUser } from "@constellation/api";
import { useAuth } from "./useAuth";

interface ProfileState {
  profile: User | null;
  loading: boolean;
  error: Error | null;
  updateProfile: (updates: Partial<Omit<User, "id" | "created_at">>) => Promise<void>;
}

export function useProfile(): ProfileState {
  const { user } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getUser(user.id)
      .then(async (existing) => {
        if (existing) return existing;
        // Upsert on first login — derive display name from OAuth metadata or email
        const rawName: string =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          user.email?.split("@")[0] ??
          "user";
        const username = rawName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
        return createUser(user.id, rawName, username);
      })
      .then((p) => setProfile(p))
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [user?.id]);

  async function updateProfile(updates: Partial<Omit<User, "id" | "created_at">>): Promise<void> {
    if (!user) return;
    setError(null);
    try {
      const updated = await updateUser(user.id, updates);
      if (updated) setProfile(updated);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }

  return { profile, loading, error, updateProfile };
}
