import { useCallback, useEffect, useState } from "react";
import type { UserColor } from "@constellation/types";
import {
  supabase,
  addLivingSpaceMember,
  removeLivingSpaceMember,
  getLivingSpaceMembersWithProfiles,
  getUserColors,
} from "@constellation/api";
import type { LivingSpaceMemberWithProfile } from "@constellation/api";

interface LivingSpaceMembersState {
  members: LivingSpaceMemberWithProfile[];
  userColors: Map<string, string>;
  loading: boolean;
  error: Error | null;
  addSelf: () => Promise<void>;
  addPartner: (userId: string) => Promise<void>;
  removeSelf: () => Promise<void>;
  removePartner: (userId: string) => Promise<void>;
}

export function useLivingSpaceMembers(livingSpaceId: string): LivingSpaceMembersState {
  const [members, setMembers] = useState<LivingSpaceMemberWithProfile[]>([]);
  const [colorRows, setColorRows] = useState<UserColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getLivingSpaceMembersWithProfiles(livingSpaceId),
      getUserColors(),
    ])
      .then(([memberData, colors]) => {
        setMembers(memberData);
        setColorRows(colors);
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [livingSpaceId]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`living_space_members_${livingSpaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "living_space_members",
          filter: `living_space_id=eq.${livingSpaceId}`,
        },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, livingSpaceId]);

  const userColors = new Map<string, string>(
    colorRows.map((c) => [c.target_user_id, c.color])
  );

  const addSelf = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await addLivingSpaceMember(livingSpaceId, user.id);
    load();
  };

  const addPartner = async (userId: string) => {
    await addLivingSpaceMember(livingSpaceId, userId);
    load();
  };

  const removeSelf = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await removeLivingSpaceMember(livingSpaceId, user.id);
    load();
  };

  const removePartner = async (userId: string) => {
    await removeLivingSpaceMember(livingSpaceId, userId);
    load();
  };

  return { members, userColors, loading, error, addSelf, addPartner, removeSelf, removePartner };
}
