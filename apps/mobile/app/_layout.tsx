import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { initSupabase } from "@constellation/api";
import { secureStoreAdapter } from "../src/supabaseStorage";

initSupabase(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { storage: secureStoreAdapter, autoRefreshToken: true, persistSession: true } }
);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
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
