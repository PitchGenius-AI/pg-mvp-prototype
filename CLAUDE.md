# Pitch Genius Buyer Readiness MVP

This file orients a Claude Code agent landing in this repo for the first time. Read it before you change anything.

## Key links

- **Scope doc:** https://docs.google.com/document/d/19SQHpRMS1OghLeCwZCOGACLo20_veArQy5r9Y0KbdlE/edit
- **Linear project:** https://linear.app/pitch-genius/project/buyer-readiness-mvp-30ada7fd1617/overview

The source of truth is the **MVP UX Spec** (a screen-by-screen spec iterated in markdown) together with its companion **MVP Scope Overview**. As of **May 2026** the scope was materially expanded — see *Scope status* below; the UX Spec is the most current artifact. The **MVP Scope Overview supersedes the older Google Doc scope doc** linked above — keep the Google Doc link for history, but defer to the Scope Overview + UX Spec wherever they disagree. _Add the UX Spec's and Scope Overview's canonical URLs here once they have a stable home._ Items marked `[FLAG]` / `[FLAG FOR RUSSELL]` in the specs are open questions awaiting product confirmation — don't build past them without checking. `[LEVER]` items can be cut or added depending on capacity.

## Scope status — May 2026 re-scope

A new MVP UX Spec materially expanded the product. Several earlier exclusions were **reversed**, and the codebase is mid-migration:

- **Now in scope:** DISC/OCEAN psychological profiling, a matched sales technique + generated pre-call scripts, a **Live Co-pilot** desktop app (real-time in-call transcription + coaching), multiple products per workspace, a Buyers screen, a Board (Kanban) workbench view, account signup + an 11-step onboarding + a Stripe hard paywall, and a bulk file-based CRM round-trip (Daily Workbench import / CRM Update Pack export).
- **Taxonomy change:** the readiness taxonomy is now **9 states** — At-Risk/Regression is a state, no longer a separate boolean.
- **Terminology:** what a rep adds to an opportunity is now an **activity** (earlier drafts called it "evidence").
- **Migration tracked in Linear milestones M9–M20.** **M9 has landed:** the shared contract (`@pg/shared`), the Zustand mock store + seed, and the `@pg/db` schema now use the new model — 9 readiness states, multiple products per workspace, and the `activity` rename. The **UI surfaces are still M5–M8 era** (list, opportunity detail, onboarding, intake) and consume the new data layer through back-compat shapes until they are rebuilt: M10 (onboarding), M12 (workbench, supersedes the list), M14 (intake), M17 (opportunity detail). Where the data-model section below diverges, it notes current-code vs. target.

The current build is a **mock-backed prototype** (Zustand mock store, fake AI, no real backend). Milestones M9–M20 extend that prototype; they do not yet wire a real backend — the `apps/api` + `packages/ai` code is a forward-looking stub and still carries a few pre-M9 assumptions (one product per workspace; the diagnosis prompt enumerates 8 states). Those reconcile when the real backend is wired.

## What the product is

Pitch Genius is **Buyer Readiness Intelligence for individual sales reps.** A rep adds an opportunity, pastes in an **activity** from a buyer interaction (transcript, notes, checklist), and the system produces:

1. A **buyer readiness diagnosis** — one of 9 readiness states, a 0–100 score, dimension-by-dimension breakdown with evidence, and primary/secondary blockers.
2. A **Pipeline Reality Check** — comparing the rep's CRM stage to the buyer's evidence-based readiness state. Flags over-projection (dangerous), aligned, or under-projection.
3. A **recommended next action**, a follow-up email ready to copy, and a manager coaching note.
4. **Pre-call intelligence** — a DISC/OCEAN buyer profile, a matched sales technique (Challenger / SPIN / NEPQ), and a generated pre-call script, produced from enrichment so the rep can prep before the conversation.

The flagship insight is the Pipeline Reality Check. The product also ships a **Live Co-pilot** desktop app for real-time in-call coaching. It is still intentionally **not a CRM replacement** — the CRM stays the system of record; Pitch Genius is the buyer-intelligence layer on top. If this file contradicts the MVP UX Spec, the spec wins and this file should be updated.

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
| Readiness Signal Extractor | Product context + activity evidence | `signalExtractionSchema` | sonnet | Inside `diagnosis.run` |
| Buyer Readiness Diagnosis Generator | Product + opportunity + extracted signals | `readinessDiagnosisSchema` | opus | Inside `diagnosis.run` |

All four use the `generateStructured` helper which forces Claude to emit JSON via a `tool_use` block whose `input_schema` is the zod schema converted via `zod-to-json-schema`. **Do not** prompt for "respond in JSON" — use the tool. The system prompt is wrapped in `cache_control: ephemeral` to hit the prompt cache.

The May-2026 scope adds further AI capabilities — website-scrape profile extraction, DISC/OCEAN profiling, sales-technique matching, pre-call script generation. In the current prototype these are **mocked** (`apps/web/src/mock`); real chains for them would live here alongside the four above.

## Data model semantics (read before touching `packages/db/src/schema`)

The `@pg/shared` zod **entity** schemas (`entities.ts`, `precall.ts`) are the canonical contract as of M9; the Zustand mock store types (`apps/web/src/mock/types.ts`) derive straight from `z.infer` of them, and the `@pg/db` Drizzle tables mirror them.

- **Workspaces** own the pipeline configuration (CRM stages). MVP enforces one workspace per user. As of M9 a workspace also carries a `subscriptionStatus` (the M11 hard-paywall gate) and an optional `crmType` (`hubspot` / `pipedrive`).
- **Products** are 1:N to workspaces with exactly one `isPrimary` — the primary is the default product context for new opportunities. M9 lit this up in the shared contract + mock store + seed; the `apps/api` stub still has a one-product-per-workspace check (lifts when M16 wires it). The 1:N schema means lifting that check needs no migration.
- **Buyers are separate from opportunities.** A buyer is a person at a company; the same buyer can have many opportunities (current, historical, reframed). A buyer with **no** opportunity is "unassigned" — assigning a product turns it into an opportunity (M13). This separation also makes the reframe flow clean.
- **Opportunities** carry denormalized "current_*" columns (readiness state, score, alignment) so the list view doesn't have to join the latest diagnosis. They MUST be updated in the same transaction that inserts a new diagnosis. They also carry a nullable `crmRecordId` (HubSpot Record ID / Pipedrive System ID) that drives the two-tier export model and bulk-activity auto-join.
- **Activities** (renamed from "interactions" / "evidence" in M9) are the unit of buyer evidence a rep adds to an opportunity; one diagnosis is produced per activity.
- **Readiness taxonomy is 9 states** — `at_risk` (regression) is a first-class value in the `readiness_state` enum as of M9 (PG-183). A denormalized `atRisk` **boolean** is still kept on the opportunity as a list-rendering convenience; M12/M17 retire it once the workbench + detail surfaces read the state directly. (The `apps/ai` diagnosis-generator prompt still enumerates 8 states — a real-backend follow-up.)
- **Pre-call intelligence** (DISC/OCEAN profile + matched technique + generated script) is keyed per opportunity, mirroring how diagnoses are stored. Mock-only in the prototype; no `@pg/db` table yet.
- **Diagnoses store the full AI output as `jsonb`** (validated by the zod schemas in `@pg/shared`) plus discrete columns for filtering.
- **`closed_status` enum includes `reframed`** — changing an opportunity's product closes the original as `reframed` and creates a new one linked via `reframed_from_opportunity_id`. The schema is ready; the UI flow is not yet built.
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

- **No native CRM API integration.** The CRM round-trip is file-based — the rep exports a list out of their CRM and imports our Update Pack file back in. No live API sync; the CRM stays the system of record.
- **No Chrome extension.** The Live Co-pilot is a cross-platform **desktop app**, not a browser extension. (Real-time in-call transcription/coaching *is* now in scope, via that app.)
- **No Salesforce.** The CRM round-trip targets HubSpot and Pipedrive only — Salesforce is admin-heavy and a poor fit for the individual-rep user; a post-MVP candidate.
- **No Sales Brain learning loop.** Outcomes are recorded but don't feed back into prompt updates in MVP.
- **No teams / manager views / multi-user.** Individual-rep product in MVP.

If a task asks you to build any of the above, push back and confirm — these are deliberate cuts, not omissions.

## Spec vs code

When the MVP UX Spec or scope doc disagrees with the code, **the spec wins** — fix the code and (if it's a recurring nuance) note it in this file. Spec + Linear URLs are at the top of this file under *Key links*.
