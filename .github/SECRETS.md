# Required GitHub Repository Secrets

Add these secrets to the GitHub repository under **Settings → Secrets and variables → Actions**.

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Production Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | Production Supabase publishable key (format: `sb_publishable_xxx`). **Do NOT use the legacy anon key.** |
| `VERCEL_TOKEN` | Vercel API token for deployment |
| `VERCEL_ORG_ID` | Vercel organization/team ID |
| `VERCEL_PROJECT_ID` | Vercel project ID for the web app |
| `EXPO_TOKEN` | Expo access token for EAS Build |

## Notes

- `SUPABASE_PUBLISHABLE_KEY` is injected as `VITE_SUPABASE_PUBLISHABLE_KEY` for the web app (Vite prefix) and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the mobile app (Expo prefix).
- EAS Build environment variables in `eas.json` are intentionally left empty — they are populated at build time via EAS secrets or GitHub Actions environment variables.
- No staging environment — local Supabase CLI for development, single production Supabase project.
