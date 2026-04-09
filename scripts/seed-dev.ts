/**
 * seed-dev.ts
 *
 * Seeds the local Supabase instance with a test polycule centered on steve@bargelt.com.
 *
 * Network:
 *   steve@bargelt.com  ← you
 *     ├── maggie@test.com    (partner)
 *     └── michal@test.com    (partner)
 *           └── charles@test.com  (partner to michal → metamour to steve)
 *
 * Usage:
 *   pnpm seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (the sb_secret_xxx key from `supabase status`).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local from monorepo root
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ SUPABASE_SERVICE_ROLE_KEY not set.\n" +
    "   Add it to .env.local — get the value from `supabase status` (the sb_secret_xxx key)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = "Test1234!";

const TEST_USERS = [
  { email: "maggie@test.com",  display_name: "Maggie",  username: "maggie",  pronouns: "she/her" },
  { email: "michal@test.com",  display_name: "Michal",  username: "michal",  pronouns: "they/them" },
  { email: "charles@test.com", display_name: "Charles", username: "charles", pronouns: "he/him" },
];

const STEVE_EMAIL = "steve@bargelt.com";

// relationship(a, b) — user_a_id must be < user_b_id (enforced by DB constraint)
type RelDef = { emailA: string; emailB: string; type: string };
const RELATIONSHIPS: RelDef[] = [
  { emailA: STEVE_EMAIL,      emailB: "maggie@test.com",  type: "partner" },
  { emailA: STEVE_EMAIL,      emailB: "michal@test.com",  type: "partner" },
  { emailA: "michal@test.com", emailB: "charles@test.com", type: "partner" },
];

async function getOrCreateUser(
  email: string,
  display_name: string,
  username: string,
  pronouns: string
): Promise<string> {
  // Check if auth user already exists
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);

  if (existing) {
    console.log(`  ✓ ${email} already exists (${existing.id})`);
    // Update public profile in case it's stale
    await supabase.from("users").upsert(
      { id: existing.id, display_name, username, pronouns },
      { onConflict: "id" }
    );
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name, username },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create ${email}: ${error?.message}`);
  }

  // Update pronouns (not in user_metadata trigger)
  await supabase
    .from("users")
    .update({ pronouns, display_name, username })
    .eq("id", data.user.id);

  console.log(`  ✓ Created ${email} (${data.user.id})`);
  return data.user.id;
}

async function createRelationship(
  idMap: Map<string, string>,
  rel: RelDef
): Promise<void> {
  const idA = idMap.get(rel.emailA)!;
  const idB = idMap.get(rel.emailB)!;

  // Enforce user_a_id < user_b_id constraint
  const [user_a_id, user_b_id] = idA < idB ? [idA, idB] : [idB, idA];

  // Check if already exists
  const { data: existing } = await supabase
    .from("relationships")
    .select("id, status")
    .eq("user_a_id", user_a_id)
    .eq("user_b_id", user_b_id)
    .maybeSingle();

  if (existing) {
    if (existing.status !== "active") {
      await supabase
        .from("relationships")
        .update({ status: "active", rel_type: rel.type })
        .eq("id", existing.id);
      console.log(`  ✓ Activated existing relationship: ${rel.emailA} ↔ ${rel.emailB} (${rel.type})`);
    } else {
      console.log(`  ✓ Relationship already active: ${rel.emailA} ↔ ${rel.emailB}`);
    }
    return;
  }

  const { error } = await supabase.from("relationships").insert({
    user_a_id,
    user_b_id,
    rel_type: rel.type,
    status: "active",
  });

  if (error) {
    throw new Error(`Failed to create relationship ${rel.emailA} ↔ ${rel.emailB}: ${error.message}`);
  }

  console.log(`  ✓ Created relationship: ${rel.emailA} ↔ ${rel.emailB} (${rel.type})`);
}

async function main() {
  console.log("🌟 Constellation dev seed\n");
  console.log("📍 Supabase URL:", SUPABASE_URL);

  const idMap = new Map<string, string>();

  // Get steve's existing ID
  console.log("\n👤 Looking up steve@bargelt.com...");
  const { data: list } = await supabase.auth.admin.listUsers();
  const steve = list?.users.find((u) => u.email === STEVE_EMAIL);
  if (!steve) {
    console.error(`❌ ${STEVE_EMAIL} not found. Sign up first via the app, then run this script.`);
    process.exit(1);
  }
  console.log(`  ✓ Found steve (${steve.id})`);
  idMap.set(STEVE_EMAIL, steve.id);

  // Create test users
  console.log("\n👥 Creating test users...");
  for (const u of TEST_USERS) {
    const id = await getOrCreateUser(u.email, u.display_name, u.username, u.pronouns);
    idMap.set(u.email, id);
  }

  // Create relationships
  console.log("\n🔗 Creating relationships...");
  for (const rel of RELATIONSHIPS) {
    await createRelationship(idMap, rel);
  }

  console.log("\n✅ Seed complete!\n");
  console.log("Test accounts (password: Test1234!):");
  for (const u of TEST_USERS) {
    console.log(`  ${u.email}`);
  }
  console.log(`\nLog in as any of these at http://localhost:5173/auth/login`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
