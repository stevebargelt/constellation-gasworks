import { useCallback, useEffect, useRef, useState } from "react";
import type { LivingSpace } from "@constellation/types";
import {
  supabase,
  getLivingSpaces,
  createLivingSpace,
  updateLivingSpace,
  deleteLivingSpace,
} from "@constellation/api";

interface LivingSpacesState {
  livingSpaces: LivingSpace[];
  loading: boolean;
  error: Error | null;
  create: (name: string, address?: string | null) => Promise<LivingSpace | null>;
  update: (id: string, updates: { name?: string; address?: string | null }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useLivingSpaces(): LivingSpacesState {
  const [livingSpaces, setLivingSpaces] = useState<LivingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelName = useRef(`living_spaces_changes-${Math.random()}`).current;

  const load = useCallback(() => {
    setLoading(true);
    getLivingSpaces()
      .then(setLivingSpaces)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "living_spaces" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "living_space_members" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const create = async (name: string, address?: string | null): Promise<LivingSpace | null> => {
    const result = await createLivingSpace(name, address);
    load();
    return result;
  };

  const update = async (
    id: string,
    updates: { name?: string; address?: string | null }
  ): Promise<void> => {
    await updateLivingSpace(id, updates);
    load();
  };

  const remove = async (id: string): Promise<void> => {
    await deleteLivingSpace(id);
    load();
  };

  return { livingSpaces, loading, error, create, update, remove };
}
