# Coltasi Fit

Personal training app: The Split (Upper, Lower, Push, Pull, Legs) plus a kettlebell day,
per-set logging with last-time weights, weekly weigh-ins, Tanita scans, sleep, and a Coach
that writes a read after every session and Monday weigh-in.

Design source of truth: the Claude Design canvas "Coltasi Fit: App design v3".
Brand: Coltasa brand kit v1.1 (Deep Navy, Kingfisher, Lagoon, Ember, Rust, Cream, Slate,
Stone, Mist; Montserrat). Light mode only for now.

## Stack

- Next.js 16 (App Router, server actions, Turbopack), TypeScript
- Supabase: Postgres with row level security, Auth, Storage (`scan-photos`)
- Montserrat self-hosted via `@fontsource/montserrat`
- Installable PWA (`public/manifest.json`, `public/sw.js`)

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=        # optional: Coach uses Claude Haiku when set, simple rules otherwise
```

## Database

`supabase/migrations/` holds the schema. `20261001140000_fresh_schema_v3.sql` creates
everything from scratch, including the program seed.

## Local development

```bash
npm install
npm run dev
```
