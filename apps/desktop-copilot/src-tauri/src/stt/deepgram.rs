//! Deepgram streaming STT client. Forwards mic PCM over a WebSocket and emits
//! speaker-labeled transcript finals on the realtime channel. Runs on the Tauri
//! async runtime (tokio).

use std::sync::{Arc, Mutex};

use futures_util::{SinkExt, StreamExt};
use tauri::AppHandle;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header::AUTHORIZATION;
use tokio_tungstenite::tungstenite::Message;

use crate::planner::Final;
use crate::realtime::{emit, RealtimeEvent, TranscriptEvent};
use crate::stt::echo::EchoFilter;

/// Stream `audio_rx` PCM (mono linear16 at `sample_rate`) to Deepgram and emit a
/// `transcript` event per final, attributed to `speaker` ("seller" = mic, "buyer"
/// = system tap). One connection per stream. A connection/auth failure on the
/// *seller* stream surfaces the loud, recoverable `no_audio` state; a buyer-stream
/// failure is logged only (the seller half still works — mic-only degrade).
///
/// Each final is also forwarded on `finals_tx` so the planner (§5.3) can advance
/// the cue lifecycle off real turns. This is additive — the transcript-event emit
/// (the M22 path) is unchanged; a closed planner channel is ignored.
///
/// `echo` is shared across both speakers' tasks (the buyer task records its finals
/// as a reference; the seller task drops finals that are really buyer bleed — the
/// no-headphones stopgap, [`crate::stt::echo`]). The drop happens here, before the
/// transcript emit and the planner forward, so a bled buyer line pollutes neither.
pub async fn run(
    app: AppHandle,
    api_key: String,
    sample_rate: u32,
    speaker: &'static str,
    mut audio_rx: UnboundedReceiver<Vec<u8>>,
    finals_tx: UnboundedSender<Final>,
    echo: Arc<Mutex<EchoFilter>>,
) {
    // Raw linear16 mono at the device's native rate — no resampling, since
    // Deepgram honours the rate we declare. nova-2 server-side endpointing gives
    // utterance finals without a local VAD (local VAD arrives with the §5.3
    // material signals). interim_results off — the overlay appends finals.
    let url = format!(
        "wss://api.deepgram.com/v1/listen\
         ?encoding=linear16&sample_rate={sample_rate}&channels=1\
         &model=nova-2&punctuate=true&interim_results=false&endpointing=300"
    );

    let mut request = match url.into_client_request() {
        Ok(r) => r,
        Err(e) => return fail(&app, speaker, format!("bad Deepgram request: {e}")),
    };
    match format!("Token {api_key}").parse() {
        Ok(value) => {
            request.headers_mut().insert(AUTHORIZATION, value);
        }
        Err(e) => return fail(&app, speaker, format!("bad auth header: {e}")),
    }

    let ws = match connect_async(request).await {
        Ok((ws, _)) => ws,
        Err(e) => return fail(&app, speaker, format!("Deepgram connect failed: {e}")),
    };
    let (mut write, mut read) = ws.split();

    // Writer: forward captured PCM until the mic stops (sink dropped → recv
    // returns None), then ask Deepgram to flush + close cleanly.
    let writer = tauri::async_runtime::spawn(async move {
        while let Some(pcm) = audio_rx.recv().await {
            if write.send(Message::Binary(pcm)).await.is_err() {
                break;
            }
        }
        let _ = write
            .send(Message::Text("{\"type\":\"CloseStream\"}".into()))
            .await;
    });

    // Reader: parse Results frames → emit transcript finals.
    let mut seq: u64 = 0;
    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
                    continue;
                };
                if v.get("type").and_then(|t| t.as_str()) != Some("Results") {
                    continue;
                }
                let transcript = v["channel"]["alternatives"][0]["transcript"]
                    .as_str()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                let is_final = v["is_final"].as_bool().unwrap_or(false);
                if transcript.is_empty() || !is_final {
                    continue;
                }

                // Echo suppression (no-headphones stopgap): the buyer stream is the
                // clean reference, so record its finals; on the seller stream, drop
                // finals that are really the buyer's voice bleeding into the mic —
                // before they reach the transcript or the planner.
                {
                    let now = std::time::Instant::now();
                    let mut filter = echo.lock().expect("echo filter poisoned");
                    if speaker == "buyer" {
                        filter.record_buyer(&transcript, now);
                    } else if filter.is_echo(&transcript, now) {
                        eprintln!("[stt] dropped seller echo (buyer bleed): {transcript}");
                        continue;
                    }
                }

                let start = v["start"].as_f64().unwrap_or(0.0);
                let duration = v["duration"].as_f64().unwrap_or(0.0);
                seq += 1;
                // Feed the planner first (cheap clone) so the cue lifecycle can
                // advance off this turn; then emit the transcript event (M22 path).
                let _ = finals_tx.send(Final {
                    speaker,
                    text: transcript.clone(),
                });
                emit(
                    &app,
                    RealtimeEvent::Transcript(TranscriptEvent {
                        id: format!("{speaker}-{seq}"),
                        speaker,
                        text: transcript,
                        t_start: start,
                        t_end: start + duration,
                        is_final: true,
                    }),
                );
            }
            Ok(Message::Close(_)) => break,
            Err(e) => {
                eprintln!("[stt] Deepgram socket error: {e}");
                break;
            }
            _ => {}
        }
    }

    writer.abort();
}

/// Log, and for the seller stream surface the recoverable `no_audio` state, then
/// bail. A buyer-stream failure is logged only — losing the system tap degrades
/// to mic-only, it doesn't kill the call.
fn fail(app: &AppHandle, speaker: &str, reason: String) {
    eprintln!("[stt] {speaker}: {reason}");
    if speaker == "seller" {
        emit(app, RealtimeEvent::engine("no_audio", "discovery"));
    }
}
