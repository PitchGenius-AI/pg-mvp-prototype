# Pitch Genius

Monorepo for **Pitch Genius** — buyer-intelligence tooling for individual B2B sales reps. It ships as **two apps sharing one backend + contract**:

- **Web app** (`apps/web`) — the buyer/opportunity workbench: intake, the buyer-readiness diagnosis + Pipeline Reality Check, DISC/OCEAN pre-call intelligence, and the file-based CRM round-trip.
- **Desktop Live Co-pilot** (`apps/desktop-copilot`) — a Tauri overlay that listens to a live call (mic + system audio), transcribes both sides, and coaches the rep in real time.

For deeper context, read [`CLAUDE.md`](CLAUDE.md) (product rules, conventions, scope). For *why* the product is shaped this way, read [`docs/decision-log.md`](docs/decision-log.md).

## Stack

- **Monorepo**: pnpm workspaces + Turborepo, TypeScript everywhere (strict)
- **Web** (`apps/web`): Vite + React 19 + Mantine 7 + TanStack Router/Query + tRPC client
- **Desktop** (`apps/desktop-copilot`): Tauri 2 (Rust) + React 19; Deepgram streaming STT; Anthropic (Haiku) planner
- **Backend** (`apps/api`): Hono + tRPC + Better Auth
- **Database**: Postgres 16 (Docker Compose) + Drizzle ORM
- **AI** (`packages/ai`): Anthropic SDK — six prompt chains + a lead-enrichment pipeline
- **Contract** (`packages/shared`): Zod schemas/enums shared across DB, API, AI, and both apps

## Layout

```
apps/
  web/              React frontend (Vite) — workbench, intake, diagnosis, pre-call
  api/              Hono + tRPC server — auth, routers, AI orchestration
  desktop-copilot/  Tauri 2 (Rust) + React — live in-call co-pilot overlay
packages/
  db/               Drizzle schema, migrations, postgres client factory
  ai/               Anthropic SDK — prompt chains (prompts/) + lead enrichment (enrichment/)
  shared/           Zod schemas + enums + constants (the SHARED CONTRACT)
docker-compose.yml  Local Postgres
.env.example        Copy to .env at first run
```

## First-time setup (web + api)

```sh
# Prereqs: Node 20+, pnpm 9+, Docker
pnpm install
cp .env.example .env          # fill ANTHROPIC_API_KEY; generate BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:up                    # start Postgres (Docker)
pnpm db:migrate               # apply migrations
pnpm db:seed                  # demo workspace + products + buyers + opportunities + diagnoses
pnpm dev                      # web :5173, api :3000
```

## Running the desktop co-pilot

The Co-pilot is a Tauri app (macOS 14.4+ for system-audio capture) that talks to the same `apps/api` backend.

```sh
pnpm --filter @pg/desktop-copilot tauri:dev    # run the overlay in dev
pnpm --filter @pg/desktop-copilot tauri:build  # produce a distributable build
```

It needs `DEEPGRAM_API_KEY` (live STT) and `ANTHROPIC_API_KEY` (planner). Without those it degrades to a scripted planner / mic-only — fine for UI work, not live coaching.

## Environment

`.env.example` is the source of truth. Key vars:

| Var | For |
| --- | --- |
| `DATABASE_URL` | Postgres (local default port `5434`) |
| `ANTHROPIC_API_KEY` | all AI chains + the desktop planner |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | auth |
| `SERPAPI_KEY` / `PERPLEXITY_API_KEY` | lead-enrichment search providers (optional; without them `enrichment.resolveLead` is disabled) |
| `DEEPGRAM_API_KEY` | desktop live STT (+ the latency harness) |
| `STRIPE_*` | checkout + paywall — **not yet wired (M31)** |

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | web + api + package watch |
| `pnpm build` / `typecheck` / `lint` / `test` | across the workspace (Turborepo) |
| `pnpm db:up` / `db:down` / `db:reset` | local Postgres lifecycle |
| `pnpm db:generate` | generate a migration from schema changes |
| `pnpm db:migrate` | apply pending migrations |
| `pnpm db:seed` | seed demo data |
| `pnpm db:studio` | open Drizzle Studio |
| `pnpm --filter @pg/desktop-copilot tauri:dev` | run the desktop co-pilot |

## Status (June 2026)

The real backend is live: Better Auth, Drizzle/Postgres, tRPC, and six AI chains + lead enrichment run against real services. The web golden path (intake → diagnosis → pre-call) is cut over to the backend; the desktop co-pilot has working audio + planner + backend handoff. **Mock/pending:** Stripe checkout & paywall (M31), the companion saved-call vault, and desktop first-run onboarding. See [`docs/decision-log.md`](docs/decision-log.md) and [`CLAUDE.md`](CLAUDE.md) for specifics.

## Key references

- **Product context & conventions:** [`CLAUDE.md`](CLAUDE.md)
- **Decision history (the "why"):** [`docs/decision-log.md`](docs/decision-log.md)
- **Desktop UX spec:** [`apps/desktop-copilot/docs/UX_SPEC.md`](apps/desktop-copilot/docs/UX_SPEC.md)
- **Web UX spec & scope (Drive):** see [`CLAUDE.md`](CLAUDE.md) → *Key links*
- **Linear:** https://linear.app/pitch-genius/project/buyer-readiness-mvp-30ada7fd1617/overview
