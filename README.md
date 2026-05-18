# Pitch Genius Buyer Readiness MVP

Monorepo for the Pitch Genius MVP — Buyer Readiness Intelligence for individual sales reps. See `CLAUDE.md` for project context, architecture decisions, and conventions.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend** (`apps/web`): Vite + React 19 + Mantine + TanStack Router + TanStack Query + tRPC client
- **Backend** (`apps/api`): Hono + tRPC + Better Auth
- **Database**: Postgres 16 (via Docker Compose) + Drizzle ORM
- **AI**: Anthropic SDK (Claude)
- **Language**: TypeScript everywhere

## Layout

```
apps/
  web/        React frontend
  api/        Hono + tRPC server
packages/
  db/         Drizzle schema, migrations, client
  ai/         Anthropic SDK + the 4 prompt chains
  shared/     Zod schemas, shared types (signals, dimensions, states)
```

## First-time setup

```sh
# Prereqs: Node 20+, pnpm 9+, Docker
pnpm install
cp .env.example .env       # then edit values
pnpm db:up                 # start Postgres
pnpm db:migrate            # apply schema
pnpm dev                   # web on :5173, api on :3000
```

## Common scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web + api in parallel |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | TS check across the workspace |
| `pnpm lint` | ESLint across the workspace |
| `pnpm test` | Vitest across the workspace |
| `pnpm db:up` / `db:down` | Start / stop local Postgres |
| `pnpm db:generate` | Generate a new migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:reset` | Destroy + recreate the local DB volume |
