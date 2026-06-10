//! Streaming speech-to-text. Deepgram is the chosen provider (UX_SPEC §7; key
//! verified). One connection per stream/speaker — mic → "seller" now, the
//! system tap → "buyer" in increment 2.

pub mod deepgram;
pub mod echo;
