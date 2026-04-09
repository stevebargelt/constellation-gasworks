import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { initSupabase } from "@constellation/api";
import { useAuth } from "@constellation/hooks";
import { secureStoreAdapter } from "../src/supabaseStorage";

initSupabase(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { storage: secureStoreAdapter, autoRefreshToken: true, persistSession: true } }
);

function AuthGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [user, loading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <AuthGuard />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#030712" },
          headerTintColor: "#f9fafb",
          contentStyle: { backgroundColor: "#030712" },
        }}
      />
    </GestureHandlerRootView>
  );
}
