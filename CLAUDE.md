# Pitch Genius Buyer Readiness MVP

This file orients a Claude Code agent landing in this repo for the first time. Read it before you change anything.

## Key links

- **Scope doc (source of truth):** https://docs.google.com/document/d/19SQHpRMS1OghLeCwZCOGACLo20_veArQy5r9Y0KbdlE/edit
- **Linear project:** https://linear.app/pitch-genius/project/buyer-readiness-mvp-30ada7fd1617/overview

The scope doc is the source of truth. Items marked `[FLAG FOR RUSSELL]` in the doc are open questions awaiting product confirmation — don't build past them without checking. Items marked `[LEVER]` can be cut or added depending on capacity.

## What the product is

Pitch Genius is **Buyer Readiness Intelligence for individual sales reps.** A rep adds an opportunity, pastes in evidence from an interaction (transcript, notes, checklist), and the system produces:

1. A **buyer readiness diagnosis** — one of 8 readiness states, a 0–100 score, dimension-by-dimension breakdown with evidence, and primary/secondary blockers.
2. A **Pipeline Reality Check** — comparing the rep's CRM stage to the buyer's evidence-based readiness state. Flags over-projection (dangerous), aligned, or under-projection.
3. A **recommended next action**, a follow-up email ready to copy, and a manager coaching note.

The flagship insight is the Pipeline Reality Check. The product is intentionally **not** a live coach, not a script generator, not a psych profiler, not a CRM replacement. See the scope doc (Google Doc shared with the team) for full product positioning. The Google Doc is the source of truth — if you find a contradiction between this file and the doc, the doc wins and this file should be updated.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | Standard, fast, well-supported |
| Language | TypeScript everywhere | Strict mode, no implicit any |
| Frontend | Vite + React 19 + Mantine 7 + Tabler Icons | Mantine pairs naturally with Tabler |
| FE router | TanStack Router (file-based, with code-splitting) | End-to-end type safety, pairs with TanStack Query |
| FE data | TanStack Query + tRPC React client | Auto-typed from API, cache integration |
| Backend | Hono + tRPC | Lightweight, fast, type-safe end-to-end |
| Auth | Better Auth (email + password) | Self-hosted, owns its tables in our Postgres |
| Database | Postgres 16 (Docker locally) + Drizzle ORM | SQL-first, fast migrations, strong TS inference |
| AI | Anthropic SDK directly (claude-opus-4-7 / sonnet-4-6 / haiku-4-5) | Native prompt caching, tool-use for structured JSON |
| Validation | Zod (shared schemas in `@pg/shared`) | Single contract across DB, API, AI, UI |

## Repo layout

```
apps/
  web/                  React frontend (Vite)
  api/                  Hono + tRPC server
packages/
  db/                   Drizzle schema, migrations, postgres client factory
  ai/                   Anthropic SDK + the 4 prompt chains
  shared/               Zod schemas + enums + constants (the SHARED CONTRACT)
docker-compose.yml      Local Postgres
.env.example            Copy to .env at first run
```

### Package boundaries

- `@pg/shared` has **no runtime dependencies on db or api** — only zod. Both FE and BE import it.
- `@pg/db` exports a `createDbClient(url)` factory and re-exports the full schema. Never call `process.env` inside `packages/db` — pass URLs explicitly.
- `@pg/ai` takes an `AnthropicClient` instance and zod schemas from `@pg/shared`. It does not touch the DB.
- `apps/api` wires everything together: env validation, DB client, Anthropic client, Better Auth, tRPC routers.
- `apps/web` imports `AppRouter` type from `@pg/api/router` for tRPC client typing.

## Hard product rules (must be enforced in the diagnosis prompt + validated server-side)

These come from the scope doc and are non-negotiable. Search `prompts/diagnosis-generator.ts` for the current prompt wording — if you change the rules in code, update them here.

1. **Buyer cannot be `commit_ready` without commitment signals.**
2. **Buyer cannot be `commercially_ready` without commercial evidence** (pricing / procurement / implementation / security).
3. **Buyer cannot be `solution_confident` without solution-confidence signals.**
4. **Late CRM stage + missing decision evidence = `high` or `critical` over-projection.**
5. **Weak / single-source evidence ⇒ `confidence_level` must be `low`.**
6. **AI never invents buyer quotes.** Every signal must cite evidence that actually appears in the transcript/notes/checklist.
7. **Rep subjective notes alone cannot produce a high-confidence diagnosis.**

## The 4 prompt chains

Located in [`packages/ai/src/prompts/`](packages/ai/src/prompts):

| Chain | Input | Output (zod) | Model | Where used |
| --- | --- | --- | --- | --- |
| Opportunity Parser | Pasted free-text deal notes | `parsedOpportunitySchema` | haiku | `parser.parseQuickPaste` tRPC mutation |
| CSV Column Mapper | Headers + sample rows | `csvColumnMappingSchema` | haiku | `parser.mapCsvColumns` |
| Readiness Signal Extractor | Product context + interaction evidence | `signalExtractionSchema` | sonnet | Inside `diagnosis.run` |
| Buyer Readiness Diagnosis Generator | Product + opportunity + extracted signals | `readinessDiagnosisSchema` | opus | Inside `diagnosis.run` |

All four use the `generateStructured` helper which forces Claude to emit JSON via a `tool_use` block whose `input_schema` is the zod schema converted via `zod-to-json-schema`. **Do not** prompt for "respond in JSON" — use the tool. The system prompt is wrapped in `cache_control: ephemeral` to hit the prompt cache.

## Data model semantics (read before touching `packages/db/src/schema`)

- **Workspaces** own the pipeline configuration (CRM stages). MVP enforces one workspace per user.
- **Products** are 1:N to workspaces in the schema — but MVP enforces one product per workspace via app-level check. The 1:N model exists so post-MVP multi-product needs no migration.
- **Buyers are separate from opportunities.** A buyer is a person at a company; the same buyer can have many opportunities (current, historical, reframed). This separation makes the post-MVP reframe flow clean.
- **Opportunities** carry denormalized "current_*" columns (readiness state, score, alignment) so the list view doesn't have to join the latest diagnosis. They MUST be updated in the same transaction that inserts a new diagnosis.
- **At-Risk is a `boolean` flag on the opportunity**, not a value in the `readiness_state` enum. The state taxonomy has 8 values; At-Risk surfaces independently.
- **Diagnoses store the full AI output as `jsonb`** (validated by the zod schemas in `@pg/shared`) plus discrete columns for filtering.
- **`closed_status` enum includes `reframed`** — when post-MVP multi-product ships, changing an opportunity's product closes the original as `reframed` and creates a new one linked via `reframed_from_opportunity_id`. The schema is ready; the UI flow is not.
- **CRM stages**: spec ships ONE template (`simple_b2b_sales`) + `custom`. Additional templates are post-MVP pending real-user pipeline observations. See the known design tension comment in [packages/db/src/schema/workspace.ts](packages/db/src/schema/workspace.ts) about JSON-vs-normalized stages.

## Commands

```sh
pnpm dev              # web (5173) + api (3000) + watch packages
pnpm build            # build everything
pnpm typecheck        # tsc across the workspace
pnpm test             # vitest across the workspace
pnpm lint             # eslint across the workspace
pnpm db:up            # start local Postgres in Docker
pnpm db:generate      # generate a new migration from schema changes
pnpm db:migrate       # apply pending migrations
pnpm db:studio        # open Drizzle Studio
pnpm db:reset         # destroy + recreate the local DB volume (DANGEROUS)
```

Filter to a single workspace package:

```sh
pnpm --filter @pg/api dev
pnpm --filter @pg/web dev
pnpm --filter @pg/db generate
```

## First-time setup

```sh
pnpm install
cp .env.example .env
# fill in ANTHROPIC_API_KEY and generate a BETTER_AUTH_SECRET:
#   openssl rand -base64 32
pnpm db:up
pnpm db:migrate     # will fail until first migration is generated
pnpm dev
```

## Conventions

- **Strict TS, no `any`** unless commented why. `noUncheckedIndexedAccess` is on — handle `undefined` from array access.
- **Validate all I/O boundaries with zod.** tRPC procedures take `.input(zod)`. AI outputs are validated by `generateStructured`. Don't trust unvalidated JSON from anywhere.
- **No `process.env` outside the env loader.** `apps/api/src/env.ts` is the only place that reads env vars; everything else imports `env`.
- **Workspace authorization on every protected procedure.** A user can only see/mutate their own workspace. The pattern is in [apps/api/src/router/opportunity.ts](apps/api/src/router/opportunity.ts) — extract it to a helper once it appears in 3+ routers.
- **Transactions for multi-table writes.** Creating an opportunity (buyer + opportunity) and running a diagnosis (diagnosis + opportunity denormalization) must be transactional.
- **Source of truth for enums lives in `@pg/shared`.** Mirror values to `packages/db/src/schema/enums.ts` exactly — these MUST stay in sync.
- **Never write AI output directly to the DB without zod validation.** Always parse first via the schemas in `@pg/shared`.

## Slash commands you can use here

- `/review` — review the current branch's changes.
- `/security-review` — full security review of pending changes (always run before merging anything that touches auth).
- `/ultrareview` (user-only) — multi-agent cloud review; tell the user to run it themselves.
- `/init` — re-generate this file if the codebase drifts materially.

## What's intentionally NOT here (and why)

- **No CRM integration.** Manual copy-paste export only in MVP.
- **No real-time / streaming / Chrome extension.** Async input only.
- **No audio/video transcription.** Reps paste from their existing notetaker.
- **No psych profiling (DISC/OCEAN).** The Pivot Brief drops these in favor of diagnostic depth on readiness state.
- **No Sales Brain learning loop.** Outcomes are recorded but don't feed back into prompt updates in MVP.
- **No multi-product UI.** Schema supports it; UI deferred.

If a task asks you to build any of the above, push back and confirm — these are deliberate cuts, not omissions.

## Spec vs code

When the scope doc disagrees with the code, **the doc wins** — fix the code and (if it's a recurring nuance) note it in this file. Doc + Linear URLs are at the top of this file under *Key links*.
