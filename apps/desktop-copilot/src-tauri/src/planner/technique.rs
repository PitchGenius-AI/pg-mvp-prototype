//! Rules-based technique matching — the Rust mirror of the canonical `@pg/shared`
//! `matchTechnique` engine and `docs/sales-technique-matching.md`. Pure Rust, **no
//! LLM**: maps the live DISC/OCEAN buyer read to a SPIN / Challenger / NEPQ
//! recommendation, a confidence tier, and a one-line rationale.
//!
//! Why rules, not a model call: the [`super::ScriptedPlanner`] (the no-API-key dev
//! run + browser fixture) has no haiku, so the mapping must be deterministic to run
//! at all — and the [`super::LlmPlanner`] already pays one haiku round-trip per
//! buyer answer for the profile, so deriving the technique from that *same* score
//! adds zero latency and zero cost.
//!
//! Implements the guide's §5 scoring formula **verbatim** (weighs all DISC/OCEAN
//! signals, not a single letter), §6 gap-based confidence, and §8 archetype map —
//! kept in lock-step with the shared TS engine (PG-310). The wire event still
//! carries `{technique, tier, rationale}`; the secondary technique + buyer
//! archetype are surfaced inside `rationale` (the live overlay shows a string, not
//! a data object — the structured §9 fields live in the backend pre-call chain).

use crate::realtime::{DiscProfile, OceanProfile};

/// A matched technique + how firmly we believe it + why. Mirrors the
/// `technique_update` wire fields (technique/tier are the `salesTechniqueSchema` /
/// `confidenceTierSchema` string values).
#[derive(Clone)]
pub struct TechniqueMatch {
    pub technique: &'static str, // "spin" | "challenger" | "nepq"
    pub tier: &'static str,      // "suggested" | "recommended" | "locked"
    pub rationale: String,
}

fn label(t: &str) -> &'static str {
    match t {
        "challenger" => "Challenger",
        "spin" => "SPIN",
        _ => "NEPQ",
    }
}

// Confidence-tier ordering, so we can take the min of the evidence-based tier and
// the score-gap-based tier (the read can't be firmer than either supports).
fn tier_rank(t: &str) -> u8 {
    match t {
        "suggested" => 0,
        "recommended" => 1,
        _ => 2, // locked
    }
}

/// Score the three techniques from the buyer read and pick the strongest. `answers`
/// is how many buyer answers have been scored so far — the read firms over the call
/// (§6.2 Suggested → Recommended → Locked), but never beyond what the score gap
/// itself supports (§6).
pub fn match_technique(disc: &DiscProfile, ocean: &OceanProfile, answers: usize) -> TechniqueMatch {
    // Normalize to 0–1 (guide §5). DISC-C (`c_disc`) and OCEAN-Cn (`cn`) are
    // distinct inputs and both feed the formula.
    let d = disc.d as f64 / 100.0;
    let i = disc.i as f64 / 100.0;
    let s = disc.s as f64 / 100.0;
    let c_disc = disc.c as f64 / 100.0;
    let o = ocean.o as f64 / 100.0;
    let cn = ocean.c as f64 / 100.0;
    let e = ocean.e as f64 / 100.0;
    let a = ocean.a as f64 / 100.0;
    let n = ocean.n as f64 / 100.0;

    // §5 scoring formula (verbatim). Note: Influence → NEPQ (not Challenger) and
    // high-Agreeableness → NEPQ (not low) — the two signs the old mapping got wrong.
    let challenger = 0.25 * d + 0.20 * c_disc + 0.20 * o + 0.20 * cn + 0.10 * (1.0 - n) + 0.05 * (1.0 - a);
    let spin = 0.25 * c_disc + 0.20 * s + 0.25 * cn + 0.10 * a + 0.10 * n + 0.10 * (1.0 - d);
    let nepq = 0.25 * s + 0.20 * i + 0.25 * a + 0.15 * n + 0.10 * e + 0.05 * (1.0 - d);

    let mut ranked = [("spin", spin), ("challenger", challenger), ("nepq", nepq)];
    ranked.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap_or(std::cmp::Ordering::Equal));
    let (technique, top) = ranked[0];
    let (secondary, second_score) = ranked[1];
    let gap = top - second_score;

    // §6 gap-based confidence band.
    let band_tier = if gap >= 0.13 {
        "locked"
    } else if gap >= 0.06 {
        "recommended"
    } else {
        "suggested"
    };
    // Evidence-based tier (the read firms as buyer speech accumulates). Discovery is
    // a few cues, so the 3rd answer can land Locked — if the gap supports it.
    let answer_tier = match answers {
        0..=1 => "suggested",
        2 => "recommended",
        _ => "locked",
    };
    // The read can't be firmer than either the evidence or the score gap allows.
    let tier = if tier_rank(band_tier) <= tier_rank(answer_tier) {
        band_tier
    } else {
        answer_tier
    };

    let archetype = match_archetype(d, i, s, c_disc, o, cn, e, a, n, technique);

    let reason = match technique {
        "spin" => "SPIN's implication and need-payoff questions build the case through logic, without the tension that alienates a steady or analytical buyer.",
        "challenger" => "Challenger's teach-and-reframe suits a direct, time-pressured decision-maker who respects a strong point of view.",
        _ => "NEPQ's neutral, low-resistance questioning lets a guarded buyer surface their own reasons to act.",
    };
    let rationale = format!(
        "{} (backup: {}) — {}. {}",
        label(technique),
        label(secondary),
        archetype,
        reason,
    );

    TechniqueMatch {
        technique,
        tier,
        rationale,
    }
}

// §8 archetype best-fit. Each archetype is a set of trait conditions on the
// normalized read; pick the highest match fraction, nudging ties toward the
// archetype whose canonical primary equals the computed primary. Kept in lock-step
// with the shared TS engine's `pickArchetype`.
#[allow(clippy::too_many_arguments)]
fn match_archetype(
    d: f64, i: f64, s: f64, c_disc: f64, o: f64, cn: f64, e: f64, a: f64, n: f64,
    primary: &str,
) -> &'static str {
    let hi = |v: f64| v >= 0.6;
    let lo = |v: f64| v <= 0.4;
    let mod_ = |v: f64| v > 0.4 && v < 0.7;
    let mod_hi = |v: f64| v >= 0.5;

    // (name, canonical primary, satisfied-count, total-count)
    let archetypes: [(&'static str, &str, &[bool]); 10] = [
        ("Strategic Skeptic", "challenger", &[hi(d), hi(c_disc), hi(o), hi(cn), lo(n)]),
        ("Structured Evaluator", "spin", &[hi(c_disc), hi(s), hi(cn), mod_(n)]),
        ("Trust-First Buyer", "nepq", &[hi(s), hi(a), mod_hi(n)]),
        ("Relationship Persuader", "nepq", &[hi(i), hi(a), hi(e)]),
        ("Power Buyer", "challenger", &[hi(d), lo(a), hi(o)]),
        ("Risk Controller", "spin", &[hi(c_disc), lo(o), hi(cn)]),
        ("Stability Seeker", "nepq", &[hi(s), lo(o), hi(a)]),
        ("Visionary Driver", "challenger", &[hi(d), hi(i), hi(o)]),
        ("Anxious Analyst", "spin", &[hi(c_disc), hi(n), hi(cn)]),
        ("Warm Collaborator", "nepq", &[hi(i), hi(s), hi(a)]),
    ];

    let mut best = archetypes[0].0;
    let mut best_score = -1.0_f64;
    for (name, canon_primary, conds) in archetypes {
        let frac = conds.iter().filter(|b| **b).count() as f64 / conds.len() as f64;
        let adjusted = frac + if canon_primary == primary { 0.001 } else { 0.0 };
        if adjusted > best_score {
            best_score = adjusted;
            best = name;
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    fn disc(d: u32, i: u32, s: u32, c: u32, p: &str) -> DiscProfile {
        DiscProfile { d, i, s, c, primary_type: p.into() }
    }
    fn ocean(o: u32, c: u32, e: u32, a: u32, n: u32) -> OceanProfile {
        OceanProfile { o, c, e, a, n }
    }

    /// Guide §8 sweep: each representative profile lands on its expected primary
    /// technique (mirrors the shared TS engine's permanent sweep — primary 10/10).
    #[test]
    fn guide_archetype_sweep_primary() {
        let cases: [(&str, DiscProfile, OceanProfile); 10] = [
            ("challenger", disc(85, 30, 25, 75, "D"), ocean(80, 75, 50, 30, 20)), // Strategic Skeptic
            ("spin", disc(35, 30, 70, 70, "C"), ocean(45, 70, 45, 55, 50)),       // Structured Evaluator
            ("nepq", disc(25, 40, 75, 35, "S"), ocean(40, 35, 45, 80, 60)),       // Trust-First Buyer
            ("nepq", disc(40, 80, 50, 40, "I"), ocean(55, 45, 75, 75, 40)),       // Relationship Persuader
            ("challenger", disc(85, 45, 25, 35, "D"), ocean(75, 35, 55, 25, 30)), // Power Buyer
            ("spin", disc(35, 25, 55, 75, "C"), ocean(25, 75, 40, 55, 50)),       // Risk Controller
            ("nepq", disc(25, 40, 80, 40, "S"), ocean(25, 45, 45, 75, 45)),       // Stability Seeker
            ("challenger", disc(80, 80, 30, 45, "D"), ocean(80, 45, 65, 50, 40)), // Visionary Driver
            ("spin", disc(30, 30, 55, 70, "C"), ocean(40, 75, 40, 55, 75)),       // Anxious Analyst
            ("nepq", disc(30, 75, 75, 40, "I"), ocean(50, 45, 60, 80, 45)),       // Warm Collaborator
        ];
        for (expect, d, o) in cases {
            let m = match_technique(&d, &o, 3);
            assert_eq!(m.technique, expect, "rationale={}", m.rationale);
        }
    }

    /// The two corrected signs: Influence → NEPQ (not Challenger); high-A → NEPQ.
    #[test]
    fn influence_and_agreeableness_route_to_nepq() {
        let hi_i = match_technique(&disc(40, 90, 50, 40, "I"), &ocean(50, 45, 60, 60, 45), 3);
        assert_eq!(hi_i.technique, "nepq");
        let hi_a = match_technique(&disc(40, 50, 55, 45, "S"), &ocean(45, 45, 50, 90, 50), 3);
        assert_eq!(hi_a.technique, "nepq");
    }

    /// Tier firms with answers when the score gap is clear (suggested→recommended→locked).
    #[test]
    fn clear_read_firms_with_answers() {
        let d = disc(85, 30, 25, 75, "D");
        let o = ocean(80, 75, 50, 30, 20);
        assert_eq!(match_technique(&d, &o, 1).tier, "suggested");
        assert_eq!(match_technique(&d, &o, 2).tier, "recommended");
        assert_eq!(match_technique(&d, &o, 3).tier, "locked");
    }

    /// A near-flat profile (tiny gap) is held at suggested no matter the answer count.
    #[test]
    fn weak_gap_holds_tier_back() {
        let m = match_technique(&disc(50, 50, 50, 50, "S"), &ocean(50, 50, 50, 50, 50), 5);
        assert_eq!(m.tier, "suggested");
    }
}
