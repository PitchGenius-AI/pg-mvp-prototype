//! The bound-call pre-grounding payload (UX_SPEC §4.1/§5.3, PG-292). When the rep
//! launches the co-pilot FROM an opportunity (deeplink or picker), the desktop
//! resolves that deal's context — product, the prepped DISC/OCEAN buyer read, the
//! matched technique, and the generated pre-call script — and threads it in with
//! the `start_call` command. The planner then SKIPS the cold discovery script and
//! drives the live cue chain from the prepared script instead, with the Buyer and
//! Technique panels pre-filled from the read.
//!
//! These structs mirror the `StartCallContext` shape built in
//! `src/api/copilot-data.ts` (`toStartCallContext`) — same field names (camelCase
//! on the wire), same nullability — the same realtime.rs ↔ realtime.ts /
//! product.rs ↔ product.ts discipline. This is planner *input* (passed in, not
//! emitted), so it derives `Deserialize`. A cold start sends no context at all
//! (the command's `Option<StartCallContext>` is `None`) and the planner runs live
//! discovery, unchanged.

use serde::Deserialize;

use super::product::SellerProduct;
use crate::realtime::{DiscProfile, OceanProfile};

/// Everything the planner needs to pre-ground a bound call. Every field is
/// optional/defaulted: a deal with no precall yet still carries `product` +
/// `grounding_notes`, and the planner degrades to discovery when there's no read.
#[derive(Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct StartCallContext {
    /// The bound opportunity (for logging / future save-back, PG-294).
    pub opportunity_id: String,
    /// The deal's product, mapped to the planner's SellerProduct shape. Seeding it
    /// short-circuits the live product match (PG-286) for this call.
    pub product: Option<SellerProduct>,
    /// The prepped DISC/OCEAN read (from precall) — seeded so discovery is skipped.
    pub buyer_profile: Option<BuyerProfile>,
    /// The matched sales technique (from precall) — seeded locked.
    pub technique: Option<MatchedTechnique>,
    /// The generated pre-call script sections that become the live cue chain.
    #[serde(default)]
    pub script_sections: Vec<ScriptSection>,
    /// Free-text grounding (known pain/objection + diagnosis blocker) for the live
    /// cue generator.
    pub grounding_notes: Option<String>,
}

/// The prepped buyer read — DISC + OCEAN + a one-line narrative. Mirrors
/// `psychProfileSchema` (precall.ts); reuses the realtime profile structs so it
/// seeds straight into the planner's `last`-read snapshot and emits unchanged.
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BuyerProfile {
    pub disc: DiscProfile,
    pub ocean: OceanProfile,
    pub summary: String,
}

/// The matched technique + why. Mirrors `matchedTechniqueSchema` (precall.ts).
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MatchedTechnique {
    pub technique: String,
    pub reasoning: String,
}

/// One generated pre-call script section. Mirrors `generatedScriptSectionSchema`.
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScriptSection {
    pub heading: String,
    pub body: String,
}

impl StartCallContext {
    /// Whether there's a prepared read or script to ground on. False means the
    /// precall was unavailable (generation failed) — the planner keeps discovery so
    /// the buyer read still builds, rather than jumping into a profile-less live chain.
    pub fn has_read_or_script(&self) -> bool {
        self.buyer_profile.is_some() || !self.script_sections.is_empty()
    }
}

/// Normalize the wire technique string to the `&'static str` the planner + wire
/// events use. Unknown / absent → "spin" (the neutral default the live generator
/// also falls back to).
pub fn technique_static(t: &str) -> &'static str {
    match t {
        "challenger" => "challenger",
        "nepq" => "nepq",
        _ => "spin",
    }
}
