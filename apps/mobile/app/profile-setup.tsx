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

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { profile, loading, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      await updateProfile({
        display_name: displayName.trim(),
        preferred_name: preferredName.trim() || null,
        pronouns: pronouns.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      router.replace("/");
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
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Tell people a little about yourself.</Text>

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

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>{saving ? "Saving…" : "Continue"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/")} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#030712" },
  center: { flex: 1, backgroundColor: "#030712", alignItems: "center", justifyContent: "center" },
  container: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f9fafb", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 24 },
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
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#f9fafb", fontWeight: "600", fontSize: 15 },
  skipButton: { marginTop: 16, alignItems: "center" },
  skipText: { color: "#4b5563", fontSize: 13 },
});
