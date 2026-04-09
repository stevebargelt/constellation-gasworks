import React, { useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "@constellation/api";

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (authError) {
      setError("Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Reset password</Text>
      {sent ? (
        <Text style={styles.success}>
          If that email is registered, you'll receive a password reset link shortly.
        </Text>
      ) : (
        <>
          <Text style={styles.description}>
            Enter your email and we'll send you a link to reset your password.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Sending…" : "Send reset link"}
            </Text>
          </TouchableOpacity>
        </>
      )}
      <Link href="/(auth)/login" style={styles.link}>
        Back to sign in
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f9fafb",
    marginBottom: 16,
  },
  description: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    width: "100%",
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f9fafb",
    marginBottom: 12,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  success: {
    color: "#4ade80",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  button: {
    width: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#f9fafb",
    fontWeight: "600",
  },
  link: {
    marginTop: 16,
    color: "#9ca3af",
    fontSize: 14,
  },
});
