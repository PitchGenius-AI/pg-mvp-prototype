//! The Rust side of the realtime event contract (UX_SPEC §5, §7). These structs
//! mirror the Zod schemas in `@pg/shared/src/realtime.ts` exactly — same field
//! names (camelCase on the wire), same `type` tags — so the React overlay
//! validates and renders them without knowing whether the producer is the live
//! engine or the recorded-audio fixture. Keep them in lockstep with realtime.ts
//! (same discipline as the db-enum mirroring in packages/db).

use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// The single Tauri event channel the engine emits on (`REALTIME_EVENT_CHANNEL`
/// in realtime.ts). The overlay subscribes once and discriminates on `type`.
pub const REALTIME_EVENT_CHANNEL: &str = "pg:realtime";

/// A speaker-labeled transcript chunk. `tStart`/`tEnd` are seconds from call
/// start; `isFinal` distinguishes finals from interim partials (we only emit
/// finals in increment 1). `speaker` is source-based: seller = mic, buyer =
/// system audio (the buyer stream arrives in increment 2).
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEvent {
    pub id: String,
    pub speaker: &'static str,
    pub text: String,
    pub t_start: f64,
    pub t_end: f64,
    pub is_final: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryProgress {
    pub done: u32,
    pub total: u32,
}

/// A coaching cue in its lifecycle (§5.1, §5.2). `id` is stable across a cue's
/// state changes (prompt → processing → success) so the overlay animates one
/// element. Rendered two-tier: `trigger` is the glanceable line, `example` the
/// full-sentence fallback. `technique` is null during neutral discovery;
/// `takeaway` is the success-only one-glance read (null until SUCCESS). Mirrors
/// `cueEventSchema` in realtime.ts.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CueEvent {
    pub id: String,
    pub phase: &'static str,
    pub state: &'static str,
    pub trigger: String,
    pub example: String,
    pub technique: Option<&'static str>,
    pub takeaway: Option<String>,
}

/// Engine/status-line state. `state` is one of idle | listening | processing |
/// no_audio; `no_audio` must be loud + recoverable (a silently-broken mic kills
/// the call). `phase` is discovery | live.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EngineStateEvent {
    pub state: &'static str,
    pub phase: &'static str,
    pub discovery_progress: Option<DiscoveryProgress>,
    pub technique_confidence: Option<&'static str>,
}

/// A DISC profile — each axis 0–100, plus the dominant quadrant. Mirrors
/// `discProfileSchema` (precall.ts). `primary_type` is data-derived ("D" | "I" |
/// "S" | "C"), so it's an owned String, not a `&'static str` like the constants above.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscProfile {
    pub d: u32,
    pub i: u32,
    pub s: u32,
    pub c: u32,
    pub primary_type: String,
}

/// An OCEAN / Big-Five profile — each trait 0–100. Mirrors `oceanProfileSchema`.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OceanProfile {
    pub o: u32,
    pub c: u32,
    pub e: u32,
    pub a: u32,
    pub n: u32,
}

/// A live profile (re)score — the Buyer panel filling in as the buyer answers
/// (§5.4). Mirrors `profileUpdateEventSchema`. `subject` is "buyer" | "seller"
/// (only buyer is scored live today). The confidence creep + Discovery n/total
/// ride on EngineStateEvent; this carries just the bars + narrative.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileUpdateEvent {
    pub subject: &'static str,
    pub disc: DiscProfile,
    pub ocean: OceanProfile,
    pub summary: String,
}

/// A live technique match — the Technique panel filling in as the buyer read firms
/// up (§5.4), mirroring how `profile_update` fills the Buyer panel. Derived by the
/// rules matcher ([`crate::planner::technique`]) from the same scored answer that
/// produces a `profile_update`, so the two land together and stay consistent.
/// Mirrors `techniqueUpdateEventSchema`. `technique` is a `salesTechniqueSchema`
/// value and `tier` a `confidenceTierSchema` value (the Suggested → Recommended →
/// Locked creep), both data-derived `&'static str`s.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TechniqueUpdateEvent {
    pub technique: &'static str,
    pub tier: &'static str,
    pub rationale: String,
}

/// A material-signal beat (§5.3) — the planner caught something in the buyer's
/// speech (an objection, a buying signal, a new stakeholder, or pricing) and is
/// regenerating the coaching chain toward it. Surfaced as a brief acknowledgment
/// status beat so the seller sees the engine react; the chain reshuffle itself
/// stays off-screen (only the new head reaches the hero, §5.1). `signal` is one of
/// the four buyer-side classifier labels; the overlay maps it to display text.
/// Mirrors `materialSignalEventSchema`.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MaterialSignalEvent {
    pub signal: &'static str,
}

/// The wire event: one internally-tagged union over `type`, matching the
/// `realtimeEventSchema` discriminated union. As of M23 the planner loop emits
/// `cue` + `profile_update` + `technique_update` + `material_signal` events
/// alongside the M22 transcript + engine_state.
#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RealtimeEvent {
    Transcript(TranscriptEvent),
    Cue(CueEvent),
    EngineState(EngineStateEvent),
    ProfileUpdate(ProfileUpdateEvent),
    TechniqueUpdate(TechniqueUpdateEvent),
    MaterialSignal(MaterialSignalEvent),
}

impl RealtimeEvent {
    /// `engine_state` with the discovery defaults (no progress, no technique).
    pub fn engine(state: &'static str, phase: &'static str) -> Self {
        RealtimeEvent::EngineState(EngineStateEvent {
            state,
            phase,
            discovery_progress: None,
            technique_confidence: None,
        })
    }
}

impl EngineStateEvent {
    /// Full engine-state constructor for the planner: drives the `Discovery n/total`
    /// indicator and the Suggested → Recommended → Locked confidence creep (§5.1).
    pub fn new(
        state: &'static str,
        phase: &'static str,
        progress: Option<(u32, u32)>,
        technique_confidence: Option<&'static str>,
    ) -> Self {
        EngineStateEvent {
            state,
            phase,
            discovery_progress: progress.map(|(done, total)| DiscoveryProgress { done, total }),
            technique_confidence,
        }
    }
}

/// Emit one event on the shared channel. Errors are swallowed — a dropped event
/// must never panic the audio path.
pub fn emit(app: &AppHandle, event: RealtimeEvent) {
    let _ = app.emit(REALTIME_EVENT_CHANNEL, event);
}
