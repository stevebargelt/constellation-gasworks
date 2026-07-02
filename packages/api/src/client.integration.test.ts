/**
 * Integration tests for the FG-37 fail-fast Supabase env guard.
 *
 * These tests exercise initSupabase() — the real integration point that
 * calls validateSupabaseConfig() before createClient() — across all
 * missing-env permutations (undefined vs empty string, url-only, key-only,
 * both) and verify the shared guard covers both the web call pattern
 * (no options) and the mobile call pattern (with auth options).
 *
 * vi.resetModules() + dynamic import gives each test a fresh _client=null
 * so initSupabase calls don't bleed state between tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClientOptions } from "@supabase/supabase-js";

type InitSupabaseFn = (url: string, key: string, opts?: SupabaseClientOptions<"public">) => void;
type GetClientFn = () => unknown;

async function freshModule(): Promise<{ initSupabase: InitSupabaseFn; getSupabaseClient: GetClientFn }> {
  return import("./client");
}

describe("initSupabase — url missing", () => {
  beforeEach(() => { vi.resetModules(); });

  it("throws when url is undefined (runtime value from unset VITE_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL)", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase(undefined as unknown as string, "sb-valid-key"))
      .toThrow(/initSupabase: missing required config:.*url/);
  });

  it("throws when url is empty string", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase("", "sb-valid-key"))
      .toThrow(/initSupabase: missing required config:.*url/);
  });
});

describe("initSupabase — publishableKey missing", () => {
  beforeEach(() => { vi.resetModules(); });

  it("throws when publishableKey is undefined (runtime value from unset env var)", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase("https://example.supabase.co", undefined as unknown as string))
      .toThrow(/initSupabase: missing required config:.*publishableKey/);
  });

  it("throws when publishableKey is empty string", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase("https://example.supabase.co", ""))
      .toThrow(/initSupabase: missing required config:.*publishableKey/);
  });
});

describe("initSupabase — both missing", () => {
  beforeEach(() => { vi.resetModules(); });

  it("error message names both vars when url=undefined and key=undefined", async () => {
    const { initSupabase } = await freshModule();
    let caught: Error | null = null;
    try {
      initSupabase(undefined as unknown as string, undefined as unknown as string);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toMatch(/url/);
    expect(caught!.message).toMatch(/publishableKey/);
  });

  it("error message names both vars when url='' and key=''", async () => {
    const { initSupabase } = await freshModule();
    let caught: Error | null = null;
    try {
      initSupabase("", "");
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toMatch(/url/);
    expect(caught!.message).toMatch(/publishableKey/);
  });
});

describe("initSupabase — both present, no throw", () => {
  beforeEach(() => { vi.resetModules(); });

  it("does not throw when both url and key are valid strings (web-style call, no options)", async () => {
    const { initSupabase } = await freshModule();
    await expect(() => initSupabase("https://example.supabase.co", "sb-anon-key-123")).not.toThrow();
  });

  it("does not throw when both valid + mobile auth options passed", async () => {
    const { initSupabase } = await freshModule();
    const mobileOpts: SupabaseClientOptions<"public"> = {
      auth: {
        storage: {
          getItem: vi.fn(),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        autoRefreshToken: true,
        persistSession: true,
      },
    };
    expect(() => initSupabase("https://example.supabase.co", "sb-anon-key-123", mobileOpts)).not.toThrow();
  });

  it("getSupabaseClient() returns an initialized client after successful initSupabase", async () => {
    const { initSupabase, getSupabaseClient } = await freshModule();
    initSupabase("https://example.supabase.co", "sb-anon-key-123");
    expect(getSupabaseClient()).toBeDefined();
  });
});

describe("initSupabase — error is validateSupabaseConfig error, not createClient error", () => {
  beforeEach(() => { vi.resetModules(); });

  it("thrown error message starts with 'initSupabase: missing required config' (not a supabase-js error)", async () => {
    const { initSupabase } = await freshModule();
    let caught: Error | null = null;
    try {
      initSupabase("", "valid-key");
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toMatch(/^initSupabase: missing required config/);
  });
});

describe("Web app call pattern — apps/web/src/main.tsx", () => {
  beforeEach(() => { vi.resetModules(); });

  it("throws when VITE_SUPABASE_URL is unset (undefined) — guard fires at startup before the app loads", async () => {
    const { initSupabase } = await freshModule();
    // Simulates: initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
    // where the env var is not defined → import.meta.env returns undefined
    expect(() => initSupabase(undefined as unknown as string, "sb-valid-key"))
      .toThrow(/url/);
  });

  it("throws when VITE_SUPABASE_PUBLISHABLE_KEY is unset — guard names the key var", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase("https://proj.supabase.co", undefined as unknown as string))
      .toThrow(/publishableKey/);
  });

  it("succeeds when both VITE_ env vars are set", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase("https://proj.supabase.co", "sb-anon-key")).not.toThrow();
  });
});

describe("Mobile app call pattern — apps/mobile/app/_layout.tsx", () => {
  beforeEach(() => { vi.resetModules(); });

  const secureStoreAdapter = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const mobileOpts: SupabaseClientOptions<"public"> = {
    auth: { storage: secureStoreAdapter, autoRefreshToken: true, persistSession: true },
  };

  it("throws when EXPO_PUBLIC_SUPABASE_URL is unset (undefined) even with auth options present", async () => {
    const { initSupabase } = await freshModule();
    // Simulates: initSupabase(process.env.EXPO_PUBLIC_SUPABASE_URL!, key, opts)
    // where the ! suppresses TS but the runtime value is undefined
    expect(() => initSupabase(undefined as unknown as string, "sb-valid-key", mobileOpts))
      .toThrow(/url/);
  });

  it("throws when EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is unset even with auth options present", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase("https://proj.supabase.co", undefined as unknown as string, mobileOpts))
      .toThrow(/publishableKey/);
  });

  it("throws naming both when both EXPO_ vars are unset", async () => {
    const { initSupabase } = await freshModule();
    let caught: Error | null = null;
    try {
      initSupabase(undefined as unknown as string, undefined as unknown as string, mobileOpts);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toMatch(/url/);
    expect(caught!.message).toMatch(/publishableKey/);
  });

  it("succeeds when both EXPO_PUBLIC_ env vars are set (full mobile call pattern)", async () => {
    const { initSupabase } = await freshModule();
    expect(() => initSupabase("https://proj.supabase.co", "sb-anon-key", mobileOpts)).not.toThrow();
  });
});
