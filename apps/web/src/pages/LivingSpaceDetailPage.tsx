import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, useRelationships } from "@constellation/hooks";
import {
  getLivingSpaces,
  getLivingSpaceMembers,
  getUsersByIds,
  getUserColors,
  joinLivingSpace,
  addLivingSpaceMember,
  removeLivingSpaceMember,
} from "@constellation/api";
import type { LivingSpace, LivingSpaceMember, User, UserColor } from "@constellation/types";

const FALLBACK_COLOR = "#6366f1";

function partnerIdOf(rel: { user_a_id: string; user_b_id: string }, myId: string): string {
  return rel.user_a_id === myId ? rel.user_b_id : rel.user_a_id;
}

// ---------- MemberAvatar ----------

interface MemberAvatarProps {
  user: User | undefined;
  color: string;
  label?: string;
}

function MemberAvatar({ user, color, label }: MemberAvatarProps) {
  const initials = user?.display_name?.slice(0, 2).toUpperCase() ?? "??";
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
        style={{ backgroundColor: color }}
        title={user?.display_name}
      >
        {initials}
      </div>
      <span className="text-sm text-white">{label ?? user?.display_name ?? "Unknown"}</span>
    </div>
  );
}

// ---------- LivingSpaceDetailPage ----------

export default function LivingSpaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { relationships } = useRelationships();

  const [space, setSpace] = useState<LivingSpace | null>(null);
  const [members, setMembers] = useState<LivingSpaceMember[]>([]);
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());
  const [partners, setPartners] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const currentUserId = user?.id ?? "";

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [spaces, memberRows, colorRows] = await Promise.all([
        getLivingSpaces(),
        getLivingSpaceMembers(id),
        getUserColors(),
      ]);
      const found = spaces.find((s) => s.id === id) ?? null;
      setSpace(found);
      setMembers(memberRows);

      const colors = new Map<string, string>(
        colorRows.map((c: UserColor) => [c.target_user_id, c.color])
      );
      setColorMap(colors);

      const memberIds = memberRows.map((m) => m.user_id);
      if (memberIds.length) {
        const users = await getUsersByIds(memberIds);
        setUserMap(new Map(users.map((u) => [u.id, u])));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, currentUserId]);

  // Load partners for the add-member dropdown
  useEffect(() => {
    if (!user || !relationships.length) return;
    const activeIds = relationships
      .filter((r) => r.status === "active")
      .map((r) => partnerIdOf(r, user.id));
    if (!activeIds.length) { setPartners([]); return; }
    getUsersByIds(activeIds).then(setPartners);
  }, [relationships, user]);

  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const isMember = memberUserIds.has(currentUserId);
  const isCreator = space?.creator_id === currentUserId;

  // Partners not yet in the space — enforce direct-partner constraint in API layer
  const addablePartners = useMemo(
    () => partners.filter((p) => !memberUserIds.has(p.id)),
    [partners, memberUserIds]
  );

  async function handleJoin() {
    if (!id) return;
    setBusy(true);
    await joinLivingSpace(id);
    await loadData();
    setBusy(false);
  }

  async function handleLeave() {
    if (!id || !confirm("Leave this living space?")) return;
    setBusy(true);
    await removeLivingSpaceMember(id, currentUserId);
    await loadData();
    setBusy(false);
  }

  async function handleAddPartner(userId: string) {
    if (!id) return;
    setBusy(true);
    setAddOpen(false);
    await addLivingSpaceMember(id, userId);
    await loadData();
    setBusy(false);
  }

  async function handleRemoveMember(userId: string) {
    if (!id || !confirm("Remove this member?")) return;
    setBusy(true);
    await removeLivingSpaceMember(id, userId);
    await loadData();
    setBusy(false);
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;
  if (error) return <div className="p-8 text-red-400 text-sm">{error}</div>;
  if (!space) return <div className="p-8 text-gray-400 text-sm">Space not found.</div>;

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* nav */}
      <div className="flex items-center gap-3">
        <Link to="/living-spaces" className="text-sm text-gray-400 hover:text-white">
          ← Living Spaces
        </Link>
        <h1 className="text-xl font-semibold text-white">{space.name}</h1>
      </div>
      {space.address && (
        <p className="text-sm text-gray-400">{space.address}</p>
      )}

      {/* join / leave */}
      <div className="flex gap-3">
        {!isMember && (
          <button
            onClick={handleJoin}
            disabled={busy}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded"
          >
            Join space
          </button>
        )}
        {isMember && !isCreator && (
          <button
            onClick={handleLeave}
            disabled={busy}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded"
          >
            Leave space
          </button>
        )}
      </div>

      {/* members */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-300">Members</h2>
        {members.length === 0 ? (
          <p className="text-xs text-gray-500">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => {
              const u = userMap.get(m.user_id);
              const color = colorMap.get(m.user_id) ?? FALLBACK_COLOR;
              const isSelf = m.user_id === currentUserId;
              const label = isSelf
                ? `${u?.display_name ?? "You"} (you)`
                : u?.display_name;
              const canRemove = isCreator && !isSelf;
              return (
                <li key={m.user_id} className="flex items-center justify-between">
                  <MemberAvatar user={u} color={color} label={label} />
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* add partner dropdown */}
        {(isMember || isCreator) && addablePartners.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Add partner
            </button>
            {addOpen && (
              <div className="absolute top-5 left-0 z-20 bg-gray-800 border border-gray-700 rounded shadow-lg min-w-44">
                {addablePartners.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddPartner(p.id)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-700 text-left"
                  >
                    <div
                      className="w-5 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: colorMap.get(p.id) ?? FALLBACK_COLOR }}
                    />
                    {p.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
