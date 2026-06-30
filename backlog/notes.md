**Last session ended 2026-06-30.**

**Where we left off:** Mid-Gate-3. The self-hosted Supabase backend is fully stood up and validated on the live VM (all 11 migrations + 66 RLS policies + get_permission applied), and I was about to wire the web/mobile/local app env to point at it and run a real sign-in. Final exchange: user corrected me to STOP suggesting the VM be deallocated — it is the production backend and runs 24/7.

**Picked up next:**
1. Gate 3 / FG-13 (go-live): point the app at the live backend. Grab ANON_KEY from the VM (/opt/supabase-constellation/.env), set web (Vercel VITE_SUPABASE_URL=https://constellation.db.harebrained-apps.com + publishable key), mobile (EXPO_PUBLIC_*), and local .env.local; add Google OAuth redirect URI (https://constellation.db.harebrained-apps.com/auth/v1/callback); then smoke-test sign-up / sign-in / Google OAuth / realtime against it. Decommission Supabase Cloud only AFTER it validates.
2. Reconcile stale-open tickets validated live this session: FG-11 (Gate 1 provision — VM is up) and FG-12 (Gate 2 — verified, stack healthy, migrations applied) are effectively DONE; FG-6/FG-7/FG-9/FG-30/FG-31 were validated on the recreated VM. Walk each AC and close the ones met.
3. Remaining cutover verification: FG-10 (backup restore test), FG-34 (durable role-password fix — fresh-init verify is deploy-gated), FG-35 (add sslmode=disable note to the db-push runbook).

**External state to remember:**
- VM vm-constellation (RG constellation, IP 20.118.130.228, constellation.db.harebrained-apps.com) is the PRODUCTION backend — runs 24/7, do NOT deallocate. Full app schema + 66 RLS policies applied; stack healthy. SSH: ssh -i ~/.ssh/id_rsa_azure azureuser@20.118.130.228.
- Internal Supabase role passwords were fixed MANUALLY on the live VM (persists on /mnt/data); FG-34's durable cloud-init version is merged to main but only triggers on a fresh-disk init.
- EAS/iOS: ASC API key .p8 at ~/.appstoreconnect/private_keys/AuthKey_4UY322LZDB.p8 (key 4UY322LZDB, issuer 69a6de82-9d26-47e3-e053-5b8c7c11a4d1); also GitHub secrets EXPO_ASC_API_KEY_BASE64 / EXPO_ASC_KEY_ID / EXPO_ASC_ISSUER_ID. iOS dist cert + ad-hoc profile (1 registered device) live on EAS. Bundle ID = com.harebrainedapps.constellation.
- Gate 3 has dashboard-only steps for the user: Vercel env vars, Google OAuth redirect URI. Supabase Cloud project is still live — decommission at end of Gate 3.
- db push over the SSH tunnel needs local port 5432 (NOT 6543 = pooler) + ?sslmode=disable (FG-35).

**Decisions worth not relitigating:**
- Backend = self-hosted Supabase (co-kkd). The Azure-native PRD ec-m9r0wf is SUPERSEDED (archive via FG-23).
- The VM runs 24/7; never suggest stopping/deallocating it (it is the live backend; ~$44/mo within the $150 credit budget).
- Never mask CI failures — no ||true / ||echo / dropping a broken platform to fake green. Fix the real root cause; verify a failure's cause before asserting it.
- Infra safety model: NO production-env approval gate; infra/tofu changes go via PR (plan reviewed before merge), never direct-to-main (direct push = live apply).
- EAS authenticates to Apple via the ASC API key, not interactive login (the account's hardware-key-only 2FA blocks EAS interactive auth).

**Shipped (for reference):**
- Git branch cleanup + full gastown/gascity teardown; backlog created from scratch (FG-1..FG-35).
- VM provisioned/recreated + self-hosted Supabase stack validated live; all 11 app migrations applied (FG-8 closed).
- FG-30 data->/mnt/data, FG-31 apply-pipeline safety, FG-32 mobile typecheck, FG-34 role-password durable fix, FG-33 EAS build fixed (iOS .ipa + Android genuinely green), FG-29 bootstrap-secrets runbook. Cutover code fixes FG-6/7/9 committed.
- STILL UNCOMMITTED (FG-24): backlog/, .forge/, CLAUDE.md, modified .gitignore, docs/prds/ec-m9r0wf.md, supabase/.branches/ — the entire backlog lives in an untracked dir; commit it next session.
