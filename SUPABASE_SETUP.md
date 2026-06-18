# Supabase setup for this project

Project ref: **gzlbvdvocfgmnzzkvksd**

## Why `supabase db push` failed

1. **Not linked** — no `supabase link` was run (now fixed via `supabase/config.toml`).
2. **Not logged in** — CLI needs `supabase login` or `SUPABASE_ACCESS_TOKEN`.

## Option A — SQL Editor (no CLI, ~2 minutes)

1. Admin panel → Catalog → **Copy SQL fix**
2. Open [SQL Editor](https://supabase.com/dashboard/project/gzlbvdvocfgmnzzkvksd/sql/new)
3. Paste → **Run**

## Option B — npm script (needs DB password)

1. [Database settings](https://supabase.com/dashboard/project/gzlbvdvocfgmnzzkvksd/settings/database) → Connection string → URI
2. Add to `.env`:
   ```
   SUPABASE_DB_URL=postgresql://postgres.gzlbvdvocfgmnzzkvksd:[PASSWORD]@...
   ```
3. Run:
   ```
   npm run db:apply
   ```

## Option C — Supabase CLI

```powershell
supabase login
npm run supabase:link
npm run supabase:push
npm run supabase:deploy-excel
```

Or run `.\scripts\setup-supabase.ps1`

## What works without CLI

- **Excel import** — runs in the browser (admin session), no edge deploy needed.
- **Search** — RPC when SQL fix applied; otherwise deep scan including `extra` codes.
- **Unavailable Parts** — saves with `user_id` + `search_query` even if `client_name` column missing.
