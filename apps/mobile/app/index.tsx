import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@constellation/api";
import { useAuth } from "@constellation/hooks";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Constellation</Text>
      {user ? (
        <>
          <Text style={styles.email}>{user.email}</Text>
          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>Sign out</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030712",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#f9fafb",
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#1f2937",
    borderRadius: 6,
  },
  buttonText: {
    color: "#f9fafb",
    fontSize: 14,
  },
});
