# Coltasi Fit

Workout tracking, nutrition logging, and body composition progress, built
around the Built With Science program. Next.js (App Router) + Supabase
(Postgres, Auth, Storage).

Separate, from-scratch build — no code or data crossover with the old
`bws-shred-app` repo.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4, design tokens ported from the wireframe canvas
  (Archivo + Inter, self-hosted via Fontsource — no external font requests)
- Supabase: Postgres + Row Level Security, Auth, Storage (scan/meal photos)

## Local development

```bash
npm install
npm run dev
```

Requires `.env.local` (gitignored) with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Status

Scaffolded with real Supabase Auth (email/password, household invite codes)
and an initial schema (profiles, households, body comp scans + photos,
workouts, meals, sleep, nutrition targets), all RLS-protected per-user.
Actual app screens (workout tracking, nutrition logging, progress, coach)
are still to be built — this is the foundation.
