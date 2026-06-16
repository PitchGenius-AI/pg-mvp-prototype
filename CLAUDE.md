# Pitch Genius Buyer Readiness MVP

This file orients a Claude Code agent landing in this repo for the first time. Read it before you change anything.

## Key links

- **Linear project:** https://linear.app/pitch-genius/project/buyer-readiness-mvp-30ada7fd1617/overview
- **Decision history (the "why"):** [`docs/decision-log.md`](docs/decision-log.md)

**Canonical specs — which doc owns which surface:**

| Doc | Owns | Status |
| --- | --- | --- |
| [Desktop UX Spec](apps/desktop-copilot/docs/UX_SPEC.md) (in repo) | the **desktop Live Co-pilot** | current (Gen 3, Jun 2026) |
| [PG MVP UX Spec](https://docs.google.com/document/d/1WJYBzCplQmgZTiV6yuTO5Ui5jCQKh1ug2Okt38exX5g/edit) (Drive) | the **web app**, screen-by-screen | current (Gen 2, May 2026) |
| [MVP Scope Overview](https://docs.google.com/document/d/17vktxAiV_wli7mNhfBtB7PERhEVtwec4fDDjIm7UBVA/edit) (Drive) | high-level scope; companion to the web UX Spec | current (Gen 2, May 2026) |

When a spec and the code disagree, **the spec wins** (fix the code). Items marked `[FLAG]` / `[FLAG FOR RUSSELL]` are open product questions — don't build past them without checking. `[LEVER]` items can be cut or added depending on capacity.

## Scope status — May 2026 re-scope

A new MVP UX Spec materially expanded the product. Several earlier exclusions were **reversed**, and the codebase is mid-migration:

- **Now in scope:** DISC/OCEAN psychological profiling, a matched sales technique + generated pre-call scripts, a **Live Co-pilot** desktop app (real-time in-call transcription + coaching), multiple products per workspace, a Buyers screen, a Board (Kanban) workbench view, account signup + an 11-step onboarding + a Stripe hard paywall, and a bulk file-based CRM round-trip (Daily Workbench import / CRM Update Pack export).
- **Taxonomy change:** the readiness taxonomy is now **9 states** — At-Risk/Regression is a state, no longer a separate boolean.
- **Terminology:** what a rep adds to an opportunity is now an **activity** (earlier drafts called it "evidence").
- **Migration tracked in Linear milestones M9–M20 — all landed.** The shared contract (`@pg/shared`), the mock store + seed, and the `@pg/db` schema use the new model (9 readiness states, multiple products per workspace, the `activity` rename), and the UI surfaces were rebuilt on it: M10 (onboarding), M12 (workbench, superseding the old list), M13 (buyers), M14 (intake), M16 (products/scripts), M17 (opportunity detail). The web app then cut over to the real backend in **M27–M33** (see the note at the end of this section).

**The real backend has since landed (June 2026, milestones M27–M33) — the "mock-backed prototype, no real backend" status below is obsolete.** `apps/api` now runs real Hono + tRPC + Better Auth against Postgres (Drizzle), and `packages/ai` runs six live chains + a lead-enrichment pipeline against Anthropic. The web app's golden path (intake → diagnosis → pre-call) is cut over to the backend; the **Zustand mock store survives only in pre-auth onboarding/checkout** screens. The pre-M9 stubs are gone: multiple-products-per-workspace is wired, and the diagnosis prompt enumerates **all 9 states and enforces all 7 hard rules** server-side. Still mock/pending: **Stripe checkout + paywall (M31)**, the desktop companion saved-call vault, and desktop first-run onboarding. See [`docs/decision-log.md`](docs/decision-log.md) for the pivot history behind all this.

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
| AI | Anthropic SDK directly (claude-opus-4-8 / sonnet-4-6 / haiku-4-5) | Native prompt caching, tool-use for structured JSON |
| Validation | Zod (shared schemas in `@pg/shared`) | Single contract across DB, API, AI, UI |

## Repo layout

```
apps/
  web/                  React frontend (Vite) — workbench, intake, diagnosis, pre-call
  api/                  Hono + tRPC server — auth, routers, AI orchestration
  desktop-copilot/      Tauri 2 (Rust) + React — live in-call co-pilot overlay
packages/
  db/                   Drizzle schema, migrations, postgres client factory
  ai/                   Anthropic SDK — prompt chains (prompts/) + lead enrichment (enrichment/)
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
- `apps/desktop-copilot` is a separate Tauri app. It imports `@pg/shared` and calls `apps/api` over tRPC with a bearer token (deeplink auth). Rust owns audio capture + the planner loop; React owns the overlay.

## Hard product rules (must be enforced in the diagnosis prompt + validated server-side)

These come from the scope doc and are non-negotiable. Search `prompts/diagnosis-generator.ts` for the current prompt wording — if you change the rules in code, update them here.

1. **Buyer cannot be `commit_ready` without commitment signals.**
2. **Buyer cannot be `commercially_ready` without commercial evidence** (pricing / procurement / implementation / security).
3. **Buyer cannot be `solution_confident` without solution-confidence signals.**
4. **Late CRM stage + missing decision evidence = `high` or `critical` over-projection.**
5. **Weak / single-source evidence ⇒ `confidence_level` must be `low`.**
6. **AI never invents buyer quotes.** Every signal must cite evidence that actually appears in the transcript/notes/checklist.
7. **Rep subjective notes alone cannot produce a high-confidence diagnosis.**

## The prompt chains

Six live chains in [`packages/ai/src/prompts/`](packages/ai/src/prompts) (all real against Anthropic as of M30), plus a lead-enrichment pipeline in [`packages/ai/src/enrichment/`](packages/ai/src/enrichment):

| Chain | Input | Output (zod) | Model | Where used |
| --- | --- | --- | --- | --- |
| Opportunity Parser | Pasted free-text deal notes | `parsedOpportunitySchema` | haiku | `parser.parseQuickPaste` |
| CSV Column Mapper | Headers + sample rows | `csvColumnMappingSchema` | haiku | `parser.mapCsvColumns` |
| Website Extractor | Scraped site text | profile (industry / products / ICP / problem) | haiku/sonnet | onboarding prefill (`parser.scrapeWebsite`) |
| Readiness Signal Extractor | Product context + activity evidence | `signalExtractionSchema` | sonnet | inside `diagnosis.run` |
| Buyer Readiness Diagnosis Generator | Product + opportunity + signals | `readinessDiagnosisSchema` (9 states + 7 rules) | opus | inside `diagnosis.run` |
| Pre-call Generator | Opportunity + product + diagnosis | DISC/OCEAN + matched technique + script | sonnet | `precall.run` → `precall_intelligence` |

**Lead enrichment** (`enrichment/`, PG-288): a single email/LinkedIn URL → normalize → search (Perplexity / SerpAPI) → resolve candidates → structure → ranked candidate **buyer-contact** profiles that pre-fill the intake form (`enrichment.resolveLead`). It is *identity/contact resolution* for workbench intake — distinct from the buyer **psychology** (Pre-call Generator) and buyer **readiness** (diagnosis) chains, which it's easy to conflate. Belongs to the buyer/opportunity intake surface.

All chains use the `generateStructured` helper, which forces Claude to emit JSON via a `tool_use` block whose `input_schema` is the zod schema converted via `zod-to-json-schema`. **Do not** prompt for "respond in JSON" — use the tool. The system prompt is wrapped in `cache_control: ephemeral` to hit the prompt cache. Diagnosis runs as a **background job** (enqueue + poll). Model routing lives in [`packages/ai/src/models.ts`](packages/ai/src/models.ts).

## Data model semantics (read before touching `packages/db/src/schema`)

The `@pg/shared` zod **entity** schemas (`entities.ts`, `precall.ts`) are the canonical contract as of M9; the Zustand mock store types (`apps/web/src/mock/types.ts`) derive straight from `z.infer` of them, and the `@pg/db` Drizzle tables mirror them.

- **Workspaces** own the pipeline configuration (CRM stages). MVP enforces one workspace per user. As of M9 a workspace also carries a `subscriptionStatus` (the M11 hard-paywall gate) and an optional `crmType`. The `crmType` enum is `hubspot` / `pipedrive` / `salesforce` / `highlevel` (PG-263). HubSpot, Pipedrive, and HighLevel are export round-trip targets; Salesforce is **capture-only** (recorded at onboarding for context, but exports degrade to copy-ready notes). Branch on `crmSupportsExport()` from `@pg/shared`, never on `crmType !== null`.
- **Products** are 1:N to workspaces with exactly one `isPrimary` — the primary is the default product context for new opportunities. The old one-product-per-workspace check is **gone** (M27); multiple products with a primary are wired end to end.
- **Buyers are separate from opportunities.** A buyer is a person at a company; the same buyer can have many opportunities (current, historical, reframed). A buyer with **no** opportunity is "unassigned" — assigning a product turns it into an opportunity (M13). This separation also makes the reframe flow clean.
- **Opportunities** carry denormalized "current_*" columns (readiness state, score, alignment) so the list view doesn't have to join the latest diagnosis. They MUST be updated in the same transaction that inserts a new diagnosis. They also carry a nullable `crmRecordId` (HubSpot Record ID / Pipedrive System ID) that drives the two-tier export model and bulk-activity auto-join.
- **Activities** (renamed from "interactions" / "evidence" in M9) are the unit of buyer evidence a rep adds to an opportunity; one diagnosis is produced per activity.
- **Readiness taxonomy is 9 states** — `at_risk` (regression) is a first-class value in the `readiness_state` enum as of M9 (PG-183). A denormalized `atRisk` **boolean** is still kept on the opportunity as a list-rendering convenience; M12/M17 retire it once the workbench + detail surfaces read the state directly. (The diagnosis-generator prompt now enumerates all 9 states and enforces all 7 hard rules server-side — M30.)
- **Pre-call intelligence** (DISC/OCEAN profile + matched technique + generated script) is keyed per opportunity, mirroring how diagnoses are stored. Real as of M30 — generated by the Pre-call Generator chain and persisted to the `precall_intelligence` table (added in M27).
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
- **Workspace authorization on every protected procedure.** A user can only see/mutate their own workspace. Use the helpers in [apps/api/src/lib/authz.ts](apps/api/src/lib/authz.ts) (`assertWorkspaceAccess` / `assertOpportunityAccess` / `assertActivityAccess`) — every protected router routes through them.
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
- **No Salesforce _export_.** The file-based CRM round-trip (the Update Pack note-import file) targets HubSpot, Pipedrive, and HighLevel. Salesforce is admin-heavy and a poor fit for the individual-rep user; it's a post-MVP export candidate. As of PG-263 Salesforce **is** selectable in onboarding step 9 and recorded as the workspace `crmType` for context, but its exports degrade to copy-ready notes (the Daily Workbench CSV import is CRM-agnostic, so import still works).
- **No Sales Brain learning loop.** Outcomes are recorded but don't feed back into prompt updates in MVP.
- **No teams / manager views / multi-user.** Individual-rep product in MVP.

If a task asks you to build any of the above, push back and confirm — these are deliberate cuts, not omissions.

## Spec vs code

When the MVP UX Spec or scope doc disagrees with the code, **the spec wins** — fix the code and (if it's a recurring nuance) note it in this file. Spec + Linear URLs are at the top of this file under *Key links*.
