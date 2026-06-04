# SuiKa — Burnout Recovery Companion

A mobile-first dark-mode web app for nervous system recovery. Tracks body signals, guides breathwork, surfaces earth events, and surfaces insights using TCM organ clock concepts and regulation science.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / proxied at `/api`)
- `pnpm --filter @workspace/suika run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind v4, dark-only, mobile-first
- API: Express 5, session auth (express-session + bcryptjs)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- State: Zustand (i18n store), React Query (server state)

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth API contract (OpenAPI 3.0)
- `lib/api-client-react/src/generated/` — generated hooks (`api.ts`) and types (`api.schemas.ts`)
- `lib/db/src/schema/` — all 9 Drizzle schema files; `index.ts` re-exports all
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/suika/src/components/` — tab components: EarthTab, LocalTab, ActionTab, HealthTab, InsightsTab, AuthScreen

## Architecture decisions

- Contract-first: OpenAPI spec drives both server Zod validation and client React Query hooks via Orval codegen
- Session auth (not JWT) — express-session with PostgreSQL session store (SESSION_SECRET env var)
- Always dark mode — CSS custom properties set at `:root` level, `html.dark` class forced in `main.tsx`
- Default location: Vienna, Austria (lat 48.2082, lon 16.3738) when user has no saved location
- Earth feeds (GDACS + ReliefWeb) cached in-memory for 30 min on the API server
- TCM organ clock and body map are UI-only features (no dedicated DB columns) — data serialized as string arrays in health-logs

## Product

- **Auth** — username/password session auth with register/login screens
- **Home** — greeting, daily quote, quick-access grid to all 5 tabs
- **Earth tab** — live global crisis/disaster feeds (GDACS + ReliefWeb), filterable by type
- **Local tab** — TCM body map (SVG meridian points), environment snapshot logging
- **Action tab** — breathwork timer (box, 4-7-8, physiological sigh, coherent), regulation strategy log
- **Health tab** — daily check-in (physical pain 1-5, mental state 1-5, nervous system state, stress factors), TCM organ clock reference
- **Insights tab** — session totals, streak, top body regions/stressors/strategies, systems map

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Orval-generated hooks take `{ query?: UseQueryOptions, request?: ... }` — NOT bare query options. Always wrap: `useGetX({ query: { staleTime: ... } })`
- `useGetMe()` returns `User` where location is `defaultLat`/`defaultLon`/`defaultLocationName` (not `lat`/`lon`/`city`)
- TimerSession has `duration` (not `durationSec`) and `completedAt` (not `completed` boolean)
- HealthLog uses `physicalPain`/`mentalPain` (not `mood`/`energy`)
- StressFactor/RegulationStrategy use `label` (not `name`) and `id` is a string

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
