import { useEffect, useState } from "react";
import type { User } from "@constellation/types";
import { getUser, updateUser } from "@constellation/api";
import { useAuth } from "./useAuth";

interface ProfileState {
  profile: User | null;
  loading: boolean;
  error: Error | null;
  update: (updates: Partial<Omit<User, "id" | "created_at">>) => Promise<void>;
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
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const update = async (updates: Partial<Omit<User, "id" | "created_at">>) => {
    if (!user) return;
    const updated = await updateUser(user.id, updates);
    if (updated) setProfile(updated);
  };

  return { profile, loading, error, update };
}
