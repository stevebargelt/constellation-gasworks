import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@constellation/hooks";

export default function HomeScreen() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Constellation</Text>
      {user ? (
        <>
          <Text style={styles.subtitle}>{user.email}</Text>
          <TouchableOpacity style={styles.signOutButton} onPress={() => signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
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
    gap: 16,
    backgroundColor: "#030712",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#f9fafb",
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
  },
  signOutButton: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  signOutText: {
    color: "#f9fafb",
    fontSize: 14,
  },
});
