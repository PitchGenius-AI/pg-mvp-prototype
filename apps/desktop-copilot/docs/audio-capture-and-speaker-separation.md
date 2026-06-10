# Audio Capture & Speaker Separation — Technical Guidance

> **Purpose.** The Co-pilot must reliably know **who is speaking — seller vs. buyer** —
> on every utterance, because we profile *both* (seller via onboarding, buyer derived
> live) and every coaching cue is attributed to one of them. Getting this wrong makes the
> product feel broken. This doc is our design for that subsystem.
>
> **Provenance / clean-room.** The approach below was learned by *reading* two GPL-3
> projects — **Pluely** (`iamsrikanthnani/pluely`, Tauri/Rust — our stack) and **Glass**
> (`pickle-com/glass`, Electron) — for *how the problem is solved*. We implement fresh in
> our own Rust/Tauri code. We do not copy their source. Ideas, OS APIs, and signal-flow
> are not copyrightable; their specific code is. Keep it that way.

## 1. The core principle: separate at the source, don't diarize

The naive approach is to capture one mixed stream and run **speaker diarization** (ML
that guesses "speaker A vs speaker B"). Don't. It's slower, less reliable, and adds
latency — fatal for live coaching.

Instead, exploit a fact the OS already gives us for free:

| Speaker | Audio source | How we capture it |
| --- | --- | --- |
| **Seller** (this machine's user) | **Microphone input** | Standard input-device capture |
| **Buyer(s)** (everyone else on the call) | **System / output audio** (Zoom/Meet/Teams playback) | System-audio loopback / process tap |

Two physically distinct streams ⇒ **speaker attribution is deterministic**, no ML
required. Both Pluely and Glass are built on exactly this split. This is the single most
important decision in the audio pipeline.

> **Limit to be honest about:** the system-output stream contains *all* remote
> participants mixed together. So this gives a clean **seller vs. buyer(s)** split, but
> not buyer-A vs. buyer-B. For MVP that's the meaningful axis. Per-remote-speaker
> diarization is a later add-on (§6), layered *on top of* the buyer stream only.

## 2. Capturing system (buyer) audio — per-OS

This is the hard, platform-specific part. Pluely isolates it in a
`src-tauri/src/speaker/` module with one file per OS behind a common
`SpeakerInput`/`SpeakerStream` interface that yields `f32` samples. **Mirror that
structure** — a trait/interface in `mod.rs`, `#[cfg(target_os = ...)]` implementations.

| OS | Mechanism | Notes |
| --- | --- | --- |
| **macOS 14.4+** | **Core Audio process tap** (`cidre` crate: `TapDesc::with_mono_global_tap_excluding_processes` → aggregate device → ring buffer). This is what Pluely uses. | Cleanest modern path. Taps system output directly; no virtual device. |
| **macOS 13–14.3** | **ScreenCaptureKit** audio (`SCStream` audio), or a native helper binary (Glass ships `SystemAudioDump`). | Fallback if we must support pre-14.4. |
| **macOS ≤12** | Virtual audio device (BlackHole/Loopback) — user-installed. | Avoid if possible; bad onboarding. |
| **Windows** | **WASAPI loopback** capture of the default render endpoint. | Pluely: `speaker/windows.rs`. |
| **Linux** | PulseAudio/PipeWire **monitor** source. | Pluely: `speaker/linux.rs`. Lowest priority for us. |

**MVP recommendation: macOS-first via Core Audio taps, requiring macOS 14.4+.**
It's the smallest, most reliable surface and matches Pluely's proven path. Gate older
macOS behind a clear "update macOS / use headphones" message rather than shipping the
virtual-device path.

> **Binding choice (M22, 2026-06-09): `objc2-core-audio`, not `cidre`.** Pluely uses
> `cidre`, but `cidre`'s build script shells out to `xcodebuild` and so requires a full
> **Xcode** install (Command Line Tools alone fail). `objc2-core-audio` is pure-Rust
> objc2 bindings — no Obj-C build step, builds on Command Line Tools — and exposes the
> same Core Audio tap technique (`CATapDescription` → `AudioHardwareCreateProcessTap` →
> private aggregate device → IO proc). Same approach, leaner toolchain. Implemented in
> [`src-tauri/src/audio/system.rs`](../src-tauri/src/audio/system.rs).

### Capture plumbing (both projects, same shape)
- A native callback delivers audio frames on a real-time thread.
- Frames are pushed into a **lock-free ring buffer** (`ringbuf::HeapRb`, producer in the
  callback, consumer on the async side) so the real-time audio thread never blocks.
- The consumer side exposes an async **`Stream<Item = f32>`** with a known `sample_rate`.
- Mic capture is the symmetric, easy case (standard input device → same ring-buffer
  pattern, or `cpal`).

## 3. The echo problem — and why you need AEC (or headphones)

When the seller uses **speakers** (not headphones), the buyer's voice plays out loud and
**bleeds back into the seller's microphone**. Without correction, the buyer's words appear
in *both* streams → double transcription and mis-attribution (buyer speech tagged as
seller). This is the subtle bug that makes naive implementations feel broken.

Two mitigations, use both:

1. **Acoustic Echo Cancellation (AEC).** Glass ships a WASM AEC (`aec.js` →
   `AecCancelEcho`) that takes the **mic** signal and the **system-audio reference**
   (which we already have, since we capture it) and subtracts the echo. For Rust, options:
   a WebRTC AEC binding (`webrtc-audio-processing`), Speex DSP, or a small DSP module. The
   key input you need — the clean system-audio reference signal — you already capture for
   the buyer stream, so AEC is "free" data-wise.
2. **Headphones = the trivial fix.** With headphones there's no acoustic path from
   speakers to mic, so no echo. **Strongly recommend headphones in onboarding** (and
   detect speaker-mode to nudge the user). This alone removes the hardest case; AEC then
   covers the users who ignore the advice.

### What the two refs actually do, and what we chose (2026-06-09, PG-280)

Re-read both projects specifically for *how they cancel echo without headphones*:

- **Pluely — nothing.** No AEC anywhere (no Speex/WebRTC dep; the macOS tap is raw
  passthrough; the mic doesn't even request browser `echoCancellation`). It relies on the
  user wearing headphones. Don't crib an echo strategy from Pluely — it has none.
- **Glass — a vendored Speex-DSP echo canceller compiled to WASM** (`AecNew` /
  `AecCancelEcho`): near-end = mic, far-end = the captured system audio, 160-sample
  (~6.7 ms) frames @ 24 kHz mono int16, ~67 ms adaptive tail. Two caveats: it *also* leans
  on the browser's `getUserMedia({echoCancellation:true})` as a **first pass**, and it does
  **no real delay alignment** (just "use the latest system chunk, length-matched" — it
  trusts the Speex filter tail to absorb a roughly-constant offset).

**Decision — macOS-first: native AEC, not ported Speex.** The real fix is Apple's
**Voice Processing I/O audio unit** (`kAudioUnitSubType_VoiceProcessingIO`) — the OS's VoIP
echo-canceller + noise-suppression + AGC, referencing system output, with the delay handled
**internally**. It's a better fit than porting Glass's Speex: we're Rust-native (no free
browser first-pass to lean on), it needs **no third-party DSP and no extra build-toolchain
risk** (system framework, builds on Command Line Tools), and it's the same Core-Audio-via-
`objc2` muscle as the buyer tap — just on the **input** side, replacing `cpal` for the mic.
Glass's Speex / a `webrtc-audio-processing` crate is the **cross-platform** answer; revisit
when Windows/Linux matters. (Tracked in PG-280; first step is validating the `objc2`
AudioUnit binding builds on CLT.)

**Shipped now — finals-level echo suppression (no DSP), the interim guard.**
[`stt/echo.rs`](../src-tauri/src/stt/echo.rs): the buyer STT stream is the clean reference,
so we record its finals; on the seller stream we drop any final whose tokens are mostly
**contained** in a recent buyer final (buyer bleed) — *before* the transcript emit and the
planner forward, so it pollutes neither. Token-containment (precision over recall): a
verbatim echo (~all words match) drops, a genuine seller turn that merely references the
buyer (adds its own words → low containment) survives. **Limits** (these are what real AEC
buys): can't catch an echo STT garbled past recognition, nor a seller-echo final that lands
*before* its buyer twin, nor true double-talk.

## 4. Turn segmentation (VAD) — the trigger, and a latency lever

Don't send a continuous stream to STT and don't fire coaching on every partial. Use
**Voice Activity Detection** to chop each stream into utterances on silence boundaries,
then transcribe + (maybe) coach on **turn boundaries**. Both projects do this:

- **Pluely** exposes a tuned VAD config (RMS sensitivity, peak threshold, silence-chunk
  count, min-speech chunks, **pre-speech** buffer so word onsets aren't clipped). Good
  starting values to mirror: sensitivity_rms ≈ 0.012, peak ≈ 0.035, ~1.0 s silence to
  close a turn, ~0.27 s pre-speech roll-in.
- **Glass** uses a simple RMS `isVoiceActive` gate per chunk.

Run VAD **independently on each stream** (mic and system). A closed turn on the mic stream
= a seller utterance; a closed turn on the system stream = a buyer utterance. That
timestamped, speaker-labeled utterance is the unit we transcribe and feed to coaching.

## 5. End-to-end data flow

```
 mic in ─────► VAD ─► [seller utterance] ─┐
                                          ├─► STT (per utterance, labeled)
 system tap ─► VAD ─► [buyer  utterance] ─┘        │
       │                                           ▼
       └─(reference)─► AEC cleans mic        { speaker, text, t_start, t_end }
                                                   │
                                                   ▼
                              Coaching trigger (objection / pricing / question / etc.)
                                                   │
                                  grounded by seeded buyer + seller profiles
                                                   ▼
                                   streamed cue → overlay (Tauri event)
```

Rust (`src-tauri`) owns capture → VAD → AEC → STT and emits **speaker-labeled transcript
events** + **coaching-cue events** to the React webview via Tauri events. The webview is
pure presentation (transcript with seller/buyer attribution + streamed cues).

## 6. Edge cases & later add-ons (don't build for v1, but design around)

- **Multiple distinct buyers** → diarize *the buyer stream only*, after capture. Optional.
- **Headphone vs speaker detection** → drive the AEC on/off + onboarding nudge.
- **Sample-rate alignment** → STT providers expect a fixed rate (Glass uses 24 kHz; many
  STT want 16 kHz). Resample once at the boundary; keep mic and system at the same rate
  so AEC lines up.
- **Mic-only fallback** → if system-audio capture is unavailable (permissions/OS), degrade
  to seller-only coaching rather than failing hard.
- **Recorded-audio fixture** → feed a canned 2-channel recording (mic + system) through
  the *same* VAD→STT→coaching path. This is both the dev fixture and the on-stage
  kill-switch (see UX_SPEC §7).

## 7. Recommended crates (our Tauri/Rust stack)

- `objc2-core-audio` (+ `objc2-core-foundation`, `objc2-foundation`) — pure-Rust Core
  Audio bindings for the process tap; no Xcode required (see §2 binding-choice note).
  (Pluely uses `cidre`, which needs full Xcode.)
- `ringbuf` — lock-free SPSC buffer between the audio callback and async consumer.
- `cpal` — cross-platform device enumeration + mic input (note: not great for loopback;
  use OS-specific loopback for system audio).
- `webrtc-audio-processing` (or Speex DSP) — AEC, if/when we support speaker mode.
- Streaming STT over WebSocket (Deepgram / AssemblyAI) for low-latency finals; or local
  whisper.cpp if we want offline (higher latency).

## 8. Reference index (read-for-approach only)

| Concern | Pluely (Tauri/Rust) | Glass (Electron) |
| --- | --- | --- |
| System-audio capture | `src-tauri/src/speaker/{mod,macos,windows,linux}.rs` | `src/ui/listen/audioCore/listenCapture.js`, native `SystemAudioDump` |
| Speaker split (mic vs system) | mic input vs `SpeakerInput` output tap | `micMediaStream` vs `systemAudioContext` |
| Echo cancellation | **none** — relies on headphones (no AEC code in the repo) | `audioCore/aec.js` (Speex-DSP → WASM) + browser `echoCancellation` first pass |
| VAD / turn segmentation | `src/hooks/useSystemAudio.ts` (`VadConfig`) | `isVoiceActive` RMS gate |
| STT wiring | `src/lib/functions/stt.function.ts` | `src/features/listen/stt/sttService.js` |
