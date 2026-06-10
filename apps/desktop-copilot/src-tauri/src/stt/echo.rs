//! Echo suppression at the transcript-finals level — the no-DSP "headphones
//! optional" stopgap (docs/audio-capture-and-speaker-separation.md §3).
//!
//! When the seller is on **speakers**, the buyer's voice plays out loud and bleeds
//! into the mic, so the seller STT stream produces finals that are really the
//! buyer's words echoing back — transcribed twice and mis-attributed (buyer speech
//! tagged as the seller), which pollutes the transcript *and* trips the planner's
//! seller gate. The proper fix is acoustic echo cancellation (next increment: the
//! native macOS VoiceProcessing I/O audio unit). This is the cheap interim guard:
//! we already capture the buyer cleanly (the system tap), so we use the **buyer's
//! recent finals as an echo reference** and drop seller finals that are mostly the
//! buyer's words. Text-level, deterministic, no audio-thread work, no new deps.
//!
//! Precision over recall by design: we key off **token containment** (what fraction
//! of the seller final's words appear in a recent buyer final), so a *pure* echo
//! (~all words match) drops while a genuine seller turn that merely references the
//! buyer (adds its own words → low containment) survives. It can't catch an echo
//! that STT garbled past recognition, nor a seller-echo final that lands *before*
//! its buyer twin — those wait for real AEC.

use std::collections::{HashSet, VecDeque};
use std::time::{Duration, Instant};

/// How long a buyer final stays a candidate echo source. Covers STT/acoustic lag
/// between the clean buyer final and its mic echo without matching stale turns.
const WINDOW: Duration = Duration::from_secs(4);
/// Containment at/above which a seller final matches *any* buyer final in the
/// window — a near-verbatim echo regardless of exact timing.
const CONTAINMENT_HI: f32 = 0.7;
/// A looser bar that only applies while the buyer is essentially still mid-turn
/// (see [`RECENT`]) — catches partially-garbled bleed during active buyer speech
/// without dropping a genuine seller turn taken after the buyer finished.
const CONTAINMENT_LO: f32 = 0.4;
/// "The buyer is still talking" horizon for the [`CONTAINMENT_LO`] bar.
const RECENT: Duration = Duration::from_millis(1500);
/// Below this many tokens a final is too short to match reliably (backchannels
/// like "yeah", "right") — never treated as echo, so they can't false-drop.
const MIN_TOKENS: usize = 2;

struct BuyerFinal {
    tokens: Vec<String>,
    at: Instant,
}

/// Shared (one per call) between the buyer and seller STT tasks: the buyer task
/// records its finals as the reference; the seller task queries [`is_echo`] before
/// emitting/forwarding. Cheap to lock — finals are infrequent and the methods are
/// synchronous (no `.await` under the guard).
pub struct EchoFilter {
    recent: VecDeque<BuyerFinal>,
}

impl EchoFilter {
    pub fn new() -> Self {
        EchoFilter { recent: VecDeque::new() }
    }

    /// Record a buyer final as an echo reference for later seller finals.
    pub fn record_buyer(&mut self, text: &str, now: Instant) {
        self.evict(now);
        self.recent.push_back(BuyerFinal { tokens: tokenize(text), at: now });
    }

    /// True if this seller final looks like buyer bleed (drop it).
    pub fn is_echo(&mut self, text: &str, now: Instant) -> bool {
        self.evict(now);
        let tokens = tokenize(text);
        if tokens.len() < MIN_TOKENS {
            return false;
        }
        self.recent.iter().any(|b| {
            let c = containment(&tokens, &b.tokens);
            c >= CONTAINMENT_HI || (now.duration_since(b.at) <= RECENT && c >= CONTAINMENT_LO)
        })
    }

    fn evict(&mut self, now: Instant) {
        while let Some(f) = self.recent.front() {
            if now.duration_since(f.at) > WINDOW {
                self.recent.pop_front();
            } else {
                break;
            }
        }
    }
}

/// Lowercase alphanumeric word tokens. Punctuation/casing differences between the
/// clean buyer final and its mic echo are normalized away.
fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

/// Fraction of `seller` tokens that also appear in `buyer`. A verbatim echo → ~1.0;
/// a seller turn that adds its own words → lower. Directional on purpose: we ask
/// "is the seller line *subsumed by* the buyer line", not raw overlap.
fn containment(seller: &[String], buyer: &[String]) -> f32 {
    if seller.is_empty() {
        return 0.0;
    }
    let set: HashSet<&String> = buyer.iter().collect();
    let hits = seller.iter().filter(|t| set.contains(t)).count();
    hits as f32 / seller.len() as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verbatim_echo_is_dropped() {
        let mut f = EchoFilter::new();
        let now = Instant::now();
        f.record_buyer("Our manual process keeps breaking as we add reps", now);
        // The mic hears the same words back (minus a fragment, different casing).
        assert!(f.is_echo("our manual process keeps breaking", now));
    }

    #[test]
    fn genuine_seller_turn_survives() {
        let mut f = EchoFilter::new();
        let now = Instant::now();
        f.record_buyer("Our manual process keeps breaking as we add reps", now);
        // References the buyer's topic but adds its own words → low containment.
        assert!(!f.is_echo("so what's that costing you each quarter", now));
        // A fresh discovery question shares almost nothing.
        assert!(!f.is_echo("what made you start looking at this now", now));
    }

    #[test]
    fn short_backchannel_is_never_echo() {
        let mut f = EchoFilter::new();
        let now = Instant::now();
        f.record_buyer("yeah exactly that's the problem", now);
        assert!(!f.is_echo("yeah", now)); // below MIN_TOKENS
    }

    #[test]
    fn partial_bleed_drops_only_while_buyer_active() {
        let mut f = EchoFilter::new();
        let t0 = Instant::now();
        f.record_buyer("we dropped two deals last quarter because of it", t0);
        // 0.5 containment — "two"/"deals" of [two, deals, fell, through] match; the
        // other half (garbled by the bleed) doesn't. Caught while the buyer is still
        // mid-turn (LO bar)...
        let partial = "two deals fell through";
        assert!(f.is_echo(partial, t0));
        // ...but a later seller turn with that same modest overlap is let through
        // (past the RECENT horizon, below the HI bar).
        let later = t0 + RECENT + Duration::from_millis(500);
        assert!(!f.is_echo(partial, later));
    }

    #[test]
    fn stale_reference_is_evicted() {
        let mut f = EchoFilter::new();
        let t0 = Instant::now();
        f.record_buyer("our manual process keeps breaking", t0);
        let later = t0 + WINDOW + Duration::from_millis(1);
        assert!(!f.is_echo("our manual process keeps breaking", later));
    }
}
