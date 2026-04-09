import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
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

export default function SendInviteScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [relType, setRelType] = useState<string>("partner");
  const [customLabel, setCustomLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username.trim()) return;
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
        custom_label:
          relType === "custom" ? customLabel.trim() || undefined : undefined,
      });
      router.replace("/invites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Send Invite</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder="Enter username"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Relationship type</Text>
      <View style={styles.typeList}>
        {REL_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            onPress={() => setRelType(t.value)}
            style={[
              styles.typeChip,
              relType === t.value && styles.typeChipActive,
            ]}
          >
            <Text
              style={[
                styles.typeChipText,
                relType === t.value && styles.typeChipTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {relType === "custom" && (
        <>
          <Text style={styles.label}>Custom label</Text>
          <TextInput
            style={styles.input}
            value={customLabel}
            onChangeText={setCustomLabel}
            placeholder="e.g. Anchor partner"
            placeholderTextColor="#6b7280"
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[
          styles.submitBtn,
          (submitting || !username.trim()) && styles.submitBtnDisabled,
        ]}
        onPress={handleSubmit}
        disabled={submitting || !username.trim()}
      >
        <Text style={styles.submitBtnText}>
          {submitting ? "Sending…" : "Send Invite"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === "android" ? 20 : 12,
    paddingBottom: 40,
  },
  title: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },
  label: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    color: "#f9fafb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  typeList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  typeChipActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  typeChipText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
  },
  typeChipTextActive: {
    color: "#fff",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
