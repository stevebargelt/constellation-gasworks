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
  dotenv.config({ path: envPath, override: true });
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

type RelDef = { emailA: string; emailB: string; type: string };
const RELATIONSHIPS: RelDef[] = [
  { emailA: STEVE_EMAIL,       emailB: "maggie@test.com",  type: "partner" },
  { emailA: STEVE_EMAIL,       emailB: "michal@test.com",  type: "partner" },
  { emailA: "michal@test.com", emailB: "charles@test.com", type: "partner" },
];

// Dates relative to today
function daysFromNow(d: number, hour = 12, minute = 0): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(hour, minute, 0, 0);
  return dt.toISOString();
}

type EventDef = {
  ownerEmail: string;
  title: string;
  description?: string;
  location?: string;
  startDaysFromNow: number;
  startHour: number;
  startMinute?: number;
  durationHours: number;
  is_private?: boolean;
  attendeeEmails?: string[];
};

// Events spread across the next two weeks — mix of personal, shared, and private
const EVENT_DEFS: EventDef[] = [
  // Steve's events
  {
    ownerEmail: STEVE_EMAIL,
    title: "Coffee with Maggie",
    description: "Catch up at the usual spot",
    location: "Analog Coffee",
    startDaysFromNow: 1, startHour: 9, durationHours: 1,
    attendeeEmails: ["maggie@test.com"],
  },
  {
    ownerEmail: STEVE_EMAIL,
    title: "Team standup",
    description: "Daily work sync",
    startDaysFromNow: 1, startHour: 10, durationHours: 0.5,
  },
  {
    ownerEmail: STEVE_EMAIL,
    title: "Dinner with Michal",
    location: "Canlis",
    startDaysFromNow: 3, startHour: 19, durationHours: 2,
    attendeeEmails: ["michal@test.com"],
  },
  {
    ownerEmail: STEVE_EMAIL,
    title: "Doctor's appointment",
    startDaysFromNow: 4, startHour: 14, durationHours: 1,
    is_private: true,
  },
  {
    ownerEmail: STEVE_EMAIL,
    title: "Polycule game night",
    description: "Board games at Steve's — everyone invited",
    location: "Steve's place",
    startDaysFromNow: 6, startHour: 18, durationHours: 4,
    attendeeEmails: ["maggie@test.com", "michal@test.com"],
  },
  {
    ownerEmail: STEVE_EMAIL,
    title: "Work conference",
    description: "Two-day industry conference downtown",
    location: "Seattle Convention Center",
    startDaysFromNow: 10, startHour: 8, durationHours: 9,
  },
  {
    ownerEmail: STEVE_EMAIL,
    title: "Work conference day 2",
    location: "Seattle Convention Center",
    startDaysFromNow: 11, startHour: 8, durationHours: 9,
  },

  // Maggie's events
  {
    ownerEmail: "maggie@test.com",
    title: "Yoga class",
    location: "CorePower Yoga",
    startDaysFromNow: 1, startHour: 7, durationHours: 1,
  },
  {
    ownerEmail: "maggie@test.com",
    title: "Coffee with Steve",
    location: "Analog Coffee",
    startDaysFromNow: 1, startHour: 9, durationHours: 1,
    attendeeEmails: [STEVE_EMAIL],
  },
  {
    ownerEmail: "maggie@test.com",
    title: "Therapy",
    startDaysFromNow: 2, startHour: 16, durationHours: 1,
    is_private: true,
  },
  {
    ownerEmail: "maggie@test.com",
    title: "Weekend trip — Portland",
    description: "Visiting friends for the weekend",
    startDaysFromNow: 7, startHour: 8, durationHours: 10,
  },
  {
    ownerEmail: "maggie@test.com",
    title: "Weekend trip — Portland day 2",
    startDaysFromNow: 8, startHour: 10, durationHours: 8,
  },

  // Michal's events
  {
    ownerEmail: "michal@test.com",
    title: "Dinner with Steve",
    location: "Canlis",
    startDaysFromNow: 3, startHour: 19, durationHours: 2,
    attendeeEmails: [STEVE_EMAIL],
  },
  {
    ownerEmail: "michal@test.com",
    title: "Date night with Charles",
    startDaysFromNow: 5, startHour: 18, durationHours: 3,
    attendeeEmails: ["charles@test.com"],
    is_private: false,
  },
  {
    ownerEmail: "michal@test.com",
    title: "Climbing gym",
    location: "Stone Gardens",
    startDaysFromNow: 2, startHour: 17, durationHours: 2,
  },
  {
    ownerEmail: "michal@test.com",
    title: "Family dinner",
    description: "Monthly family dinner at parents' house",
    startDaysFromNow: 9, startHour: 17, durationHours: 3,
  },

  // Charles's events
  {
    ownerEmail: "charles@test.com",
    title: "Date night with Michal",
    startDaysFromNow: 5, startHour: 18, durationHours: 3,
    attendeeEmails: ["michal@test.com"],
  },
  {
    ownerEmail: "charles@test.com",
    title: "Art class",
    location: "Gage Academy of Art",
    startDaysFromNow: 4, startHour: 18, durationHours: 2,
  },
  {
    ownerEmail: "charles@test.com",
    title: "Book club",
    startDaysFromNow: 8, startHour: 19, durationHours: 2,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateUser(
  email: string,
  display_name: string,
  username: string,
  pronouns: string
): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);

  if (existing) {
    console.log(`  ✓ ${email} already exists (${existing.id})`);
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
  const [user_a_id, user_b_id] = idA < idB ? [idA, idB] : [idB, idA];

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
      console.log(`  ✓ Activated: ${rel.emailA} ↔ ${rel.emailB} (${rel.type})`);
    } else {
      console.log(`  ✓ Already active: ${rel.emailA} ↔ ${rel.emailB}`);
    }
    return;
  }

  const { error } = await supabase.from("relationships").insert({
    user_a_id,
    user_b_id,
    rel_type: rel.type,
    status: "active",
  });

  if (error) throw new Error(`Failed: ${rel.emailA} ↔ ${rel.emailB}: ${error.message}`);
  console.log(`  ✓ Created: ${rel.emailA} ↔ ${rel.emailB} (${rel.type})`);
}

async function seedEvents(idMap: Map<string, string>): Promise<void> {
  for (const def of EVENT_DEFS) {
    const creatorId = idMap.get(def.ownerEmail);
    if (!creatorId) continue;

    const startMinute = def.startMinute ?? 0;
    const start_time = daysFromNow(def.startDaysFromNow, def.startHour, startMinute);
    const endDate = new Date(start_time);
    endDate.setTime(endDate.getTime() + def.durationHours * 60 * 60 * 1000);
    const end_time = endDate.toISOString();

    // Check if event already exists (by title + creator + start_time)
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("title", def.title)
      .eq("start_time", start_time)
      .maybeSingle();

    if (existing) {
      console.log(`  ✓ Already exists: "${def.title}" (${def.ownerEmail})`);
      continue;
    }

    const { data: event, error } = await supabase
      .from("calendar_events")
      .insert({
        creator_id: creatorId,
        title: def.title,
        description: def.description ?? null,
        location: def.location ?? null,
        start_time,
        end_time,
        is_private: def.is_private ?? false,
        is_all_day: false,
      })
      .select("id")
      .single();

    if (error || !event) {
      console.warn(`  ⚠ Failed to create "${def.title}": ${error?.message}`);
      continue;
    }

    // Add attendees
    if (def.attendeeEmails?.length) {
      const attendees = def.attendeeEmails
        .map((email) => idMap.get(email))
        .filter(Boolean)
        .map((user_id) => ({ event_id: event.id, user_id, status: "accepted" }));

      if (attendees.length) {
        await supabase.from("event_attendees").insert(attendees);
      }
    }

    console.log(`  ✓ Created: "${def.title}" (${def.ownerEmail})`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌟 Constellation dev seed\n");
  console.log("📍 Supabase URL:", SUPABASE_URL);

  const idMap = new Map<string, string>();

  console.log("\n👤 Looking up steve@bargelt.com...");
  const { data: list } = await supabase.auth.admin.listUsers();
  const steve = list?.users.find((u) => u.email === STEVE_EMAIL);
  if (!steve) {
    console.error(`❌ ${STEVE_EMAIL} not found. Sign up via the app first, then run this script.`);
    process.exit(1);
  }
  console.log(`  ✓ Found steve (${steve.id})`);
  idMap.set(STEVE_EMAIL, steve.id);

  console.log("\n👥 Creating test users...");
  for (const u of TEST_USERS) {
    const id = await getOrCreateUser(u.email, u.display_name, u.username, u.pronouns);
    idMap.set(u.email, id);
  }

  console.log("\n🔗 Creating relationships...");
  for (const rel of RELATIONSHIPS) {
    await createRelationship(idMap, rel);
  }

  console.log("\n📅 Seeding calendar events...");
  await seedEvents(idMap);

  console.log("\n✅ Seed complete!\n");
  console.log("Test accounts (password: Test1234!):");
  for (const u of TEST_USERS) {
    console.log(`  ${u.email}`);
  }
  console.log(`\nLog in at http://localhost:5173/auth/login`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
