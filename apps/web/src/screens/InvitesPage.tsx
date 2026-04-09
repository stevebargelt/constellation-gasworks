import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@constellation/hooks";
import {
  supabase,
  getPendingInvites,
  acceptRelationshipInvite,
  declineRelationshipInvite,
} from "@constellation/api";
import type { RelationshipWithUsers } from "@constellation/api";

function relTypeLabel(relType: string, customLabel: string | null): string {
  const labels: Record<string, string> = {
    partner: "Partner",
    nesting_partner: "Nesting Partner",
    metamour: "Metamour",
    coparent: "Co-Parent",
    roommate: "Roommate",
    family: "Family",
    custom: customLabel ?? "Custom",
  };
  return labels[relType] ?? relType;
}

export default function InvitesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invites, setInvites] = useState<RelationshipWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingInvites();
      setInvites(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("invites-page-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function handleAccept(id: string) {
    setActing(id);
    try {
      await acceptRelationshipInvite(id);
      await load();
    } finally {
      setActing(null);
    }
  }

  async function handleDecline(id: string) {
    setActing(id);
    try {
      await declineRelationshipInvite(id);
      await load();
    } finally {
      setActing(null);
    }
  }

  const incoming = invites.filter((inv) => inv.user_b?.id === user?.id);
  const outgoing = invites.filter((inv) => inv.user_a?.id === user?.id);

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 pt-16">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Invites</h1>
          <button
            onClick={() => navigate("/invites/send")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Send Invite
          </button>
        </div>

        {loading && (
          <p className="text-gray-400 text-sm">Loading…</p>
        )}

        {!loading && incoming.length === 0 && outgoing.length === 0 && (
          <p className="text-gray-500 text-sm">No pending invites.</p>
        )}

        {incoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Incoming
            </h2>
            <ul className="space-y-3">
              {incoming.map((inv) => (
                <li
                  key={inv.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                >
                  <p className="font-medium">
                    {inv.user_a?.display_name ?? "Unknown"}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {relTypeLabel(inv.rel_type, inv.custom_label)}
                  </p>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleAccept(inv.id)}
                      disabled={acting === inv.id}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(inv.id)}
                      disabled={acting === inv.id}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {outgoing.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Sent
            </h2>
            <ul className="space-y-3">
              {outgoing.map((inv) => (
                <li
                  key={inv.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {inv.user_b?.display_name ?? "Unknown"}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {relTypeLabel(inv.rel_type, inv.custom_label)}
                    </p>
                  </div>
                  <span className="text-xs text-yellow-400 font-medium">Pending</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
