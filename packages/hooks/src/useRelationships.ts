import { useCallback, useEffect, useState } from "react";
import type { Relationship } from "@constellation/types";
import {
  supabase,
  getRelationships,
  sendRelationshipInvite,
  acceptRelationshipInvite,
  declineRelationshipInvite,
  removeRelationship as apiRemoveRelationship,
  upsertRelationshipPermission,
} from "@constellation/api";

interface SendInviteParams {
  to: string;
  rel_type: string;
  custom_label?: string;
}

interface UpdatePermissionParams {
  relationship_id: string;
  grantor_id: string;
  resource_type: "calendar" | "tasks" | "meals";
  level: "full" | "free_busy" | "none";
}

interface RelationshipsState {
  relationships: Relationship[];
  loading: boolean;
  error: Error | null;
  sendInvite: (params: SendInviteParams) => Promise<void>;
  acceptInvite: (relationshipId: string) => Promise<void>;
  declineInvite: (relationshipId: string) => Promise<void>;
  removeRelationship: (relationshipId: string) => Promise<void>;
  updatePermission: (params: UpdatePermissionParams) => Promise<void>;
}

export function useRelationships(): RelationshipsState {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRelationships();
      setRelationships(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Subscribe to realtime changes for the current user's relationships.
    // RLS ensures only rows visible to auth.uid() are returned on refetch.
    const channel = supabase
      .channel("relationships-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const sendInvite = useCallback(
    async (params: SendInviteParams) => {
      await sendRelationshipInvite(params);
      await load();
    },
    [load]
  );

  const acceptInvite = useCallback(
    async (relationshipId: string) => {
      await acceptRelationshipInvite(relationshipId);
      await load();
    },
    [load]
  );

  const declineInvite = useCallback(
    async (relationshipId: string) => {
      await declineRelationshipInvite(relationshipId);
      await load();
    },
    [load]
  );

  const removeRelationship = useCallback(
    async (relationshipId: string) => {
      await apiRemoveRelationship(relationshipId);
      await load();
    },
    [load]
  );

  const updatePermission = useCallback(
    async (params: UpdatePermissionParams) => {
      await upsertRelationshipPermission(params);
    },
    []
  );

  return {
    relationships,
    loading,
    error,
    sendInvite,
    acceptInvite,
    declineInvite,
    removeRelationship,
    updatePermission,
  };
}
