import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase, createUser } from "@constellation/api";

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }
    if (data.user) {
      const displayName = email.split("@")[0];
      const username = displayName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      await createUser(data.user.id, displayName, username);
    }
    setLoading(false);
    if (data.session) {
      router.replace("/");
    } else {
      setMessage("Check your email to confirm your account before signing in.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Create account</Text>
      {message ? (
        <Text style={styles.success}>{message}</Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating account…" : "Create account"}
            </Text>
          </TouchableOpacity>
        </>
      )}
      <Link href="/(auth)/login" style={styles.link}>
        Already have an account? Sign in
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
    marginBottom: 24,
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
