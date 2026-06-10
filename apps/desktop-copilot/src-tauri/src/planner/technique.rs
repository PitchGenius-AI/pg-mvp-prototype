//! Rules-based technique matching (docs/sales-technique-matching.md). Pure Rust,
//! **no LLM**: maps the live DISC/OCEAN buyer read to a SPIN / Challenger / NEPQ
//! recommendation, a confidence tier, and a one-line rationale. It is the analog of
//! `packages/ai`'s deterministic mappings — the source-of-truth table re-expressed
//! in code.
//!
//! Why rules, not a model call: the [`super::ScriptedPlanner`] (the no-API-key dev
//! run + browser fixture) has no haiku, so the mapping must be deterministic to run
//! at all — and the [`super::LlmPlanner`] already pays one haiku round-trip per
//! buyer answer for the profile, so deriving the technique from that *same* score
//! adds zero latency and zero cost. The doc weighs all present DISC/OCEAN signals
//! rather than reading a single letter (real buyers are composites), so we score the
//! three techniques and take the argmax instead of a primary-letter lookup.

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

/// Score the three techniques from the buyer read and pick the strongest. `answers`
/// is how many buyer answers have been scored so far — it drives the confidence tier
/// (the read firms up as buyer speech accumulates, §6.2 Suggested → Recommended →
/// Locked), sharpened down a step when the separation between techniques is weak.
pub fn match_technique(disc: &DiscProfile, ocean: &OceanProfile, answers: usize) -> TechniqueMatch {
    let (d, i, s, c) = (disc.d as f64, disc.i as f64, disc.s as f64, disc.c as f64);
    let (o, cons, e, a, n) = (
        ocean.o as f64,
        ocean.c as f64,
        ocean.e as f64,
        ocean.a as f64,
        ocean.n as f64,
    );
    // OCEAN traits are centered at 50; `hi`/`lo` read only the side that leans.
    let hi = |v: f64| (v - 50.0).max(0.0);
    let lo = |v: f64| (50.0 - v).max(0.0);

    // DISC base leanings (doc §"DISC trait → leaning technique"):
    //   D → Challenger primary, NEPQ secondary · I → Challenger (warm Teach)
    //   S → SPIN primary, NEPQ secondary · C → SPIN primary, NEPQ for skepticism
    let mut challenger = d + 0.8 * i;
    let mut nepq = 0.4 * d;
    let mut spin = s + c;
    nepq += 0.4 * s + 0.3 * c;

    // OCEAN adjustments (doc §"OCEAN trait → leaning technique"):
    challenger += hi(o) + hi(e) + lo(n); // open / extraverted / unflappable tolerate tension
    spin += lo(o) + hi(cons) + 0.5 * hi(a) + 0.5 * hi(n); // structured, collaborative, low-pressure
    // anxious / reserved → neutral, low-resistance; agreeableness cuts BOTH ways —
    // high-A trusts (SPIN/NEPQ), low-A is guarded/skeptical and is NEPQ's core fit.
    nepq += hi(n) + 0.5 * hi(a) + lo(a) + lo(e);

    // argmax over the three labels (explicit so the winner + runner-up are both known).
    let mut ranked = [("spin", spin), ("challenger", challenger), ("nepq", nepq)];
    ranked.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap_or(std::cmp::Ordering::Equal));
    let (technique, top) = ranked[0];
    let second = ranked[1].1;
    let margin = if top > 0.0 { (top - second) / top } else { 0.0 };

    // Tier tracks accumulated evidence; a weak separation holds it back one step so
    // an ambiguous read never over-commits (the §5.3 "bias to discovery until it
    // firms" rule). Discovery is three cues, so the 3rd answer lands Locked.
    let mut tier = match answers {
        0..=1 => "suggested",
        2 => "recommended",
        _ => "locked",
    };
    if margin < 0.12 {
        tier = match tier {
            "locked" => "recommended",
            "recommended" => "suggested",
            t => t,
        };
    }

    let primary = disc.primary_type.as_str();
    let rationale = match technique {
        "spin" => format!(
            "{primary}-leaning, evidence-driven buyer: SPIN's implication and \
             need-payoff questions build the case through logic, without the tension \
             that alienates a steady or analytical buyer."
        ),
        "challenger" => format!(
            "{primary}-leaning, open buyer: Challenger's teach-and-reframe suits a \
             direct, time-pressured decision-maker who respects a strong point of view."
        ),
        _ => format!(
            "{primary}-leaning, guarded buyer: NEPQ's neutral, low-resistance \
             questioning lets a skeptical buyer surface their own reasons to act."
        ),
    };

    TechniqueMatch {
        technique,
        tier,
        rationale,
    }
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

    /// The §6.2 demo buyer: a steady, analytical, risk-averse read should land SPIN
    /// and firm Suggested → Recommended → Locked as the three discovery answers land.
    #[test]
    fn demo_buyer_reads_spin_firming_to_locked() {
        let steps = [
            (disc(45, 35, 50, 55, "C"), ocean(50, 58, 45, 55, 55), 1, "suggested"),
            (disc(40, 35, 62, 60, "S"), ocean(50, 64, 45, 66, 56), 2, "recommended"),
            (disc(40, 35, 70, 65, "S"), ocean(50, 68, 45, 72, 58), 3, "locked"),
        ];
        for (d, o, n, tier) in steps {
            let m = match_technique(&d, &o, n);
            assert_eq!(m.technique, "spin", "answers={n}");
            assert_eq!(m.tier, tier, "answers={n}");
        }
    }

    /// A direct, open, unflappable decision-maker leans Challenger.
    #[test]
    fn dominant_open_buyer_reads_challenger() {
        let m = match_technique(&disc(80, 45, 25, 30, "D"), &ocean(80, 40, 70, 35, 30), 3);
        assert_eq!(m.technique, "challenger");
    }

    /// A guarded, skeptical, anxious, reserved buyer (low Agreeableness = high sales
    /// resistance, low Extraversion, high Neuroticism) leans NEPQ.
    #[test]
    fn guarded_anxious_buyer_reads_nepq() {
        let m = match_technique(&disc(35, 15, 35, 30, "S"), &ocean(40, 40, 20, 25, 80), 3);
        assert_eq!(m.technique, "nepq");
    }

    /// A weak separation between techniques holds the tier back a step (never
    /// over-commits on an ambiguous read).
    #[test]
    fn ambiguous_read_holds_tier_back() {
        // Near-flat profile → small margin → 3 answers caps at recommended, not locked.
        let m = match_technique(&disc(50, 50, 50, 50, "S"), &ocean(50, 50, 50, 50, 50), 3);
        assert_ne!(m.tier, "locked");
    }
}
