import * as SecureStore from "expo-secure-store";

/**
 * expo-secure-store adapter for Supabase session persistence on mobile.
 *
 * Supabase auth requires a storage backend that implements getItem/setItem/removeItem.
 * On React Native, localStorage is unavailable, so we back it with SecureStore to
 * keep JWT access and refresh tokens in the device's secure enclave.
 *
 * Keys are sanitized because SecureStore only allows [A-Za-z0-9._-].
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(sanitizeKey(key));
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(sanitizeKey(key), value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(sanitizeKey(key));
  },
};
