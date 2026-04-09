/// <reference types="expo/types" />

// Declare EXPO_PUBLIC_* environment variables for TypeScript
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_SUPABASE_URL: string;
    readonly EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  }
}
