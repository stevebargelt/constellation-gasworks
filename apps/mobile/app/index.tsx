import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@constellation/hooks";

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Constellation</Text>
      {user ? (
        <>
          <Text style={styles.email}>{user.email}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/constellation")}>
            <Text style={styles.buttonText}>Graph</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/relationships")}>
            <Text style={styles.buttonText}>Relationships</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/calendar")}>
            <Text style={styles.buttonText}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/tasks")}>
            <Text style={styles.buttonText}>Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/living-spaces")}>
            <Text style={styles.buttonText}>Living Spaces</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/meal-plans")}>
            <Text style={styles.buttonText}>Meals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/invites")}>
            <Text style={styles.buttonText}>Invites</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/settings")}>
            <Text style={styles.buttonText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => signOut()}>
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
    gap: 16,
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
