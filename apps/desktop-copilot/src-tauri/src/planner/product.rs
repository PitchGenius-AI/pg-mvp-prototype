//! The Rust mirror of the seller product / ICP / problem context (M24 / PG-282).
//! Mirrors the Zod shapes in `@pg/shared/src/product.ts` exactly — same field
//! names (camelCase on the wire), same nullability — so the desktop store can
//! hand this context to the Rust planner across the Tauri boundary without a
//! re-spec. Keep in lockstep with product.ts (same discipline as realtime.rs ↔
//! realtime.ts).
//!
//! Unlike the realtime structs (which the engine *emits*, hence `Serialize`),
//! this is planner *input* — passed in with the `start_call` command — so it
//! derives `Deserialize`. The planner does not consume it yet; PG-284 (skeleton
//! grounding) and PG-286 (live product match) are the first readers. This ticket
//! just lands the seam.

use serde::Deserialize;

/// One product the seller sells (UX_SPEC §6.3). `is_primary` starts false for
/// every product — none is primary at onboarding; one emerges over time (§4.6).
#[derive(Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SellerProduct {
    pub id: String,
    pub name: String,
    /// What it is / does, in a sentence or two — grounds generated cues.
    pub description: String,
    /// Who it is for (ideal customer profile) — read buyer-fit live.
    pub icp: String,
    /// The problem it solves — matched against the buyer's revealed pain (§5.3).
    pub problem: String,
    /// The scraped site this was prefilled from, if any. None for manual entry.
    pub source_url: Option<String>,
    pub is_primary: bool,
}

/// The seller's full "what I sell" context — all products captured at onboarding.
/// May be empty: the product step is fully skippable (2026-06-10), and with zero
/// products the planner falls back to product-neutral discovery. The active
/// product for a call is NOT stored here — it is inferred + confirmed live
/// (§5.3, PG-286) and belongs to the call/lead state.
#[derive(Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SellerProductContext {
    pub products: Vec<SellerProduct>,
}
