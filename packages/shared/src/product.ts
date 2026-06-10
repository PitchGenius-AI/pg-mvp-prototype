import { z } from 'zod';

// Seller product / ICP / problem context (desktop Co-pilot, M24 / PG-282).
//
// Captured at first-run onboarding (UX_SPEC §4.6) — prefilled from the seller's
// website (mocked scrape), editable, held in the desktop shared mock store. It
// grounds the generated call script (§5.3/§5.8) and the live product match
// (§5.3, PG-286). This file is the canonical contract both the capture UI and
// the Rust planner read; the Rust mirror lives in
// apps/desktop-copilot/src-tauri/src/planner/product.rs (kept in lockstep, same
// discipline as realtime.ts ↔ realtime.rs).
//
// Naming: §6.3 wrote these snake_case (source_url / is_primary); we use the
// codebase's camelCase wire convention (cf. precall.ts `primaryType`,
// realtime.ts `tStart`) so the Rust mirror is a plain `rename_all = "camelCase"`.
//
// Eventual DB swap path: this mirrors @pg/shared's 1:N products-per-workspace
// model (entities.ts `productSchema`), so moving it server-side later is a
// data-layer change, not a re-spec. The desktop shape is deliberately lighter
// than the full `Product` entity — `icp` ≈ `targetBuyer`, `problem` ≈
// `problemSolved` — carrying only what the call script needs.

// One product the seller sells. Prefilled from the website scrape (mocked),
// then edited. `isPrimary` starts false for every product — no product is
// primary at onboarding; one emerges over time (§4.6).
export const sellerProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().describe('What it is / does, in a sentence or two'),
  icp: z.string().describe('Who it is for (ideal customer profile)'),
  problem: z.string().describe('The problem it solves'),
  // The scraped site this product was prefilled from, if any. Null for manual entry.
  sourceUrl: z.string().nullable(),
  // None primary at start; emerges over time as a default product surfaces (§4.6).
  isPrimary: z.boolean(),
});
export type SellerProduct = z.infer<typeof sellerProductSchema>;

// The seller's full "what I sell" context — all products captured at onboarding.
//
// NOTE: no active product is chosen up front. The call's product is inferred +
// confirmed live (§5.3, PG-286) and is NOT stored here — it belongs to the
// call/lead state. This context is the static "what I sell".
//
// `products` may be empty: per the 2026-06-10 gating decision the product step
// is fully skippable, and with zero products the planner falls back to
// product-neutral discovery. So the ≥1 constraint is deliberately NOT enforced
// at the schema level.
export const sellerProductContextSchema = z.object({
  products: z.array(sellerProductSchema),
});
export type SellerProductContext = z.infer<typeof sellerProductContextSchema>;
