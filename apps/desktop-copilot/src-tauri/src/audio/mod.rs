//! Audio capture (UX_SPEC §7, docs/audio-capture-and-speaker-separation.md).
//!
//! Speaker separation is source-based, not ML-diarized: seller = mic input,
//! buyer = system/output audio. Each source opens at its native rate, downmixes
//! to mono linear16, and pushes PCM into a [`PcmSink`]. Increment 1 wires the
//! mic (seller); the macOS system tap (buyer) lands in increment 2 behind the
//! same [`CaptureHandle`] shape — mirroring Pluely's per-OS `speaker/` module
//! split (clean-room: read-for-approach, our own code).

pub mod mic;
#[cfg(target_os = "macos")]
pub mod system;

use tokio::sync::mpsc::UnboundedSender;

/// PCM frames handed from a capture source to the STT task: little-endian mono
/// linear16 (i16) bytes at [`CaptureHandle::sample_rate`]. A tokio channel is
/// fine for the spike; a lock-free ringbuf is the production refinement so the
/// real-time audio callback never contends.
pub type PcmSink = UnboundedSender<Vec<u8>>;

/// A running capture source. Reports the rate it actually opened (so STT can
/// declare it to Deepgram without resampling); send `()` on `stop` (or drop it)
/// to release the OS device and end capture.
pub struct CaptureHandle {
    pub sample_rate: u32,
    pub stop: std::sync::mpsc::Sender<()>,
}
