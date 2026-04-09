import { useEffect, useState } from "react";
import type { User } from "@constellation/types";
import { getUser, updateUser, upsertUser } from "@constellation/api";
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
    getUser(user.id)
      .then(async (existing) => {
        if (existing) {
          setProfile(existing);
        } else {
          // First login via OAuth — no users row yet. Upsert with available info.
          const displayName =
            (user.user_metadata?.full_name as string | undefined) ??
            (user.email?.split("@")[0] ?? user.id);
          const username = displayName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
          const created = await upsertUser(user.id, displayName, username);
          setProfile(created);
        }
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const updateProfile = async (
    updates: Partial<Omit<User, "id" | "created_at">>
  ): Promise<void> => {
    if (!user) return;
    const updated = await updateUser(user.id, updates);
    if (updated) setProfile(updated);
  };

  return { profile, loading, error, updateProfile };
}
