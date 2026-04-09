import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#030712" },
        headerTintColor: "#f9fafb",
        contentStyle: { backgroundColor: "#030712" },
        headerShown: false,
      }}
    />
  );
}
