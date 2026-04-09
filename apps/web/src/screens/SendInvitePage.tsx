import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchUserByUsername, sendRelationshipInvite } from "@constellation/api";

const REL_TYPES = [
  { value: "partner", label: "Partner" },
  { value: "nesting_partner", label: "Nesting Partner" },
  { value: "metamour", label: "Metamour" },
  { value: "coparent", label: "Co-Parent" },
  { value: "roommate", label: "Roommate" },
  { value: "family", label: "Family" },
  { value: "custom", label: "Custom" },
] as const;

export default function SendInvitePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [relType, setRelType] = useState<string>("partner");
  const [customLabel, setCustomLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const target = await searchUserByUsername(username.trim());
      if (!target) {
        setError(`No user found with username "${username.trim()}".`);
        return;
      }
      await sendRelationshipInvite({
        to: target.id,
        rel_type: relType,
        custom_label: relType === "custom" ? customLabel.trim() || undefined : undefined,
      });
      navigate("/invites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate("/invites")}
          className="mb-6 text-sm text-indigo-400 hover:text-indigo-300"
        >
          ← Back to invites
        </button>

        <h1 className="text-2xl font-bold mb-6">Send Relationship Invite</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Relationship type
            </label>
            <select
              value={relType}
              onChange={(e) => setRelType(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {REL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {relType === "custom" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Custom label
              </label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Anchor partner"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !username.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
          >
            {submitting ? "Sending…" : "Send Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}
