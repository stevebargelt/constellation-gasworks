import { useEffect, useState } from "react";
import type { Relationship } from "@constellation/types";
import { getRelationships } from "@constellation/api";

interface RelationshipsState {
  relationships: Relationship[];
  loading: boolean;
  error: Error | null;
}

export function useRelationships(): RelationshipsState {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getRelationships()
      .then(setRelationships)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, []);

  return { relationships, loading, error };
}
