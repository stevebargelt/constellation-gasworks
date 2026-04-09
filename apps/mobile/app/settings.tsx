import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useProfile } from "@constellation/hooks";

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, loading, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setPreferredName(profile.preferred_name ?? "");
      setPronouns(profile.pronouns ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  async function handleSave() {
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        preferred_name: preferredName.trim() || null,
        pronouns: pronouns.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Edit profile</Text>

        {/* Avatar preview */}
        <View style={styles.avatarSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {displayName?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
        </View>

        {/* Avatar URL */}
        <Text style={styles.label}>Avatar URL <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="https://…"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          keyboardType="url"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
        />

        {/* Display name */}
        <Text style={styles.label}>Display name <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#6b7280"
          value={displayName}
          onChangeText={setDisplayName}
        />

        {/* Preferred name */}
        <Text style={styles.label}>Preferred name <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="What you like to be called"
          placeholderTextColor="#6b7280"
          value={preferredName}
          onChangeText={setPreferredName}
        />

        {/* Pronouns */}
        <Text style={styles.label}>Pronouns <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. she/her, they/them, he/him"
          placeholderTextColor="#6b7280"
          value={pronouns}
          onChangeText={setPronouns}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.success}>Profile saved.</Text> : null}

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#030712" },
  center: { flex: 1, backgroundColor: "#030712", alignItems: "center", justifyContent: "center" },
  container: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f9fafb", textAlign: "center", marginBottom: 24 },
  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: "#374151" },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 28, color: "#9ca3af" },
  label: { fontSize: 13, color: "#9ca3af", marginBottom: 4 },
  required: { color: "#f87171" },
  optional: { color: "#4b5563", fontSize: 11 },
  input: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f9fafb",
    marginBottom: 14,
  },
  muted: { color: "#9ca3af" },
  error: { color: "#f87171", fontSize: 13, marginBottom: 10 },
  success: { color: "#4ade80", fontSize: 13, marginBottom: 10 },
  row: { flexDirection: "row", gap: 12, marginTop: 4 },
  button: { flex: 1, borderRadius: 6, paddingVertical: 12, alignItems: "center" },
  cancelButton: { borderWidth: 1, borderColor: "#374151" },
  cancelText: { color: "#d1d5db", fontSize: 15 },
  saveButton: { backgroundColor: "#2563eb" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#f9fafb", fontWeight: "600", fontSize: 15 },
});
