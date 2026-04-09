import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@constellation/hooks";
import { uploadAvatar } from "@constellation/api";
import { useAuth } from "@constellation/hooks";

interface Props {
  mode: "setup" | "edit";
}

export default function ProfilePage({ mode }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setPreferredName(profile.preferred_name ?? "");
      setPronouns(profile.pronouns ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile && user) {
        const ext = avatarFile.name.split(".").pop() ?? "jpg";
        finalAvatarUrl = await uploadAvatar(user.id, avatarFile, ext);
      }
      await updateProfile({
        display_name: displayName.trim(),
        preferred_name: preferredName.trim() || null,
        pronouns: pronouns.trim() || null,
        avatar_url: finalAvatarUrl || null,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  const previewSrc = avatarPreview ?? (avatarUrl || null);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          {mode === "setup" ? "Complete your profile" : "Edit profile"}
        </h1>
        {mode === "setup" && (
          <p className="text-gray-400 text-sm text-center mb-6">
            Tell people a little about yourself.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-2">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="Avatar preview"
                className="w-20 h-20 rounded-full object-cover border border-gray-700"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <span className="text-gray-500 text-2xl">
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Upload photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1" htmlFor="display_name">
              Display name <span className="text-red-400">*</span>
            </label>
            <input
              id="display_name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Your name"
            />
          </div>

          {/* Preferred name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1" htmlFor="preferred_name">
              Preferred name <span className="text-gray-600 text-xs">(optional)</span>
            </label>
            <input
              id="preferred_name"
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="What you like to be called"
            />
          </div>

          {/* Pronouns */}
          <div>
            <label className="block text-sm text-gray-400 mb-1" htmlFor="pronouns">
              Pronouns <span className="text-gray-600 text-xs">(optional)</span>
            </label>
            <input
              id="pronouns"
              type="text"
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="e.g. she/her, they/them, he/him"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            {mode === "edit" && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-2 border border-gray-700 rounded text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white font-medium transition-colors"
            >
              {saving ? "Saving…" : mode === "setup" ? "Continue" : "Save"}
            </button>
          </div>

          {mode === "setup" && (
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full text-sm text-gray-500 hover:text-gray-400 text-center"
            >
              Skip for now
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
