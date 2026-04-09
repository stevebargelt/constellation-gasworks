import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useRelationships } from "@constellation/hooks";
import {
  getUser,
  getRelationshipPermissions,
  upsertRelationshipPermission,
  removeRelationship,
} from "@constellation/api";
import type { PermissionLevel, RelationshipPermission, User } from "@constellation/types";

const RESOURCE_TYPES = ["calendar", "tasks", "meals"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

const PERMISSION_LEVELS: PermissionLevel[] = ["full", "free_busy", "none"];

const LEVEL_LABEL: Record<PermissionLevel, string> = {
  full: "Full",
  free_busy: "Free/Busy",
  none: "None",
};

function PermissionSelect({
  value,
  onChange,
}: {
  value: PermissionLevel;
  onChange: (v: PermissionLevel) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PermissionLevel)}
      className="bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
    >
      {PERMISSION_LEVELS.map((l) => (
        <option key={l} value={l}>
          {LEVEL_LABEL[l]}
        </option>
      ))}
    </select>
  );
}

interface RelationshipRowProps {
  relationshipId: string;
  partner: User;
  relType: string;
  customLabel: string | null;
  onRemove: (id: string) => void;
}

function RelationshipRow({
  relationshipId,
  partner,
  relType,
  customLabel,
  onRemove,
}: RelationshipRowProps) {
  const [permissions, setPermissions] = useState<Record<ResourceType, PermissionLevel>>({
    calendar: "free_busy",
    tasks: "free_busy",
    meals: "free_busy",
  });
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    getRelationshipPermissions(relationshipId).then((perms: RelationshipPermission[]) => {
      const map = { ...permissions };
      for (const p of perms) {
        if (RESOURCE_TYPES.includes(p.resource_type as ResourceType)) {
          map[p.resource_type as ResourceType] = p.level as PermissionLevel;
        }
      }
      setPermissions(map);
      setLoadingPerms(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipId]);

  async function handlePermissionChange(resource: ResourceType, level: PermissionLevel) {
    setPermissions((prev) => ({ ...prev, [resource]: level }));
    await upsertRelationshipPermission({
      relationship_id: relationshipId,
      grantor_id: "", // filled server-side from auth.uid()
      resource_type: resource,
      level,
    });
  }

  async function handleRemove() {
    setRemoving(true);
    await removeRelationship(relationshipId);
    onRemove(relationshipId);
  }

  const label = customLabel ?? relType.replace(/_/g, " ");

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-white">{partner.display_name}</p>
          <p className="text-xs text-gray-400 capitalize">{label}</p>
        </div>
        {confirmRemove ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Remove relationship?</span>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
            >
              {removing ? "Removing…" : "Yes, remove"}
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {/* Permission note */}
      <p className="text-xs text-gray-500 mb-3 italic">
        These control what <span className="text-gray-300">you share</span> — their settings are separate.
      </p>

      {loadingPerms ? (
        <p className="text-xs text-gray-500">Loading permissions…</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {RESOURCE_TYPES.map((resource) => (
            <div key={resource}>
              <p className="text-xs text-gray-400 mb-1 capitalize">{resource}</p>
              <PermissionSelect
                value={permissions[resource]}
                onChange={(v) => handlePermissionChange(resource, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RelationshipsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { relationships, loading } = useRelationships();
  const [partners, setPartners] = useState<Record<string, User>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const active = relationships.filter(
    (r) => r.status === "active" && !removed.has(r.id)
  );

  // Load partner user records
  useEffect(() => {
    if (!user || !active.length) return;
    const needed = active
      .map((r) => (r.user_a_id === user.id ? r.user_b_id : r.user_a_id))
      .filter((id) => !partners[id]);
    if (!needed.length) return;
    Promise.all(needed.map((id) => getUser(id))).then((users) => {
      const map: Record<string, User> = {};
      for (const u of users) {
        if (u) map[u.id] = u;
      }
      setPartners((prev) => ({ ...prev, ...map }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length, user?.id]);

  function handleRemoved(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">Relationships</h1>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-gray-400 text-sm">No active relationships yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {active.map((rel) => {
              const partnerId = rel.user_a_id === user?.id ? rel.user_b_id : rel.user_a_id;
              const partner = partners[partnerId];
              if (!partner) return null;
              return (
                <RelationshipRow
                  key={rel.id}
                  relationshipId={rel.id}
                  partner={partner}
                  relType={rel.rel_type}
                  customLabel={rel.custom_label}
                  onRemove={handleRemoved}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
