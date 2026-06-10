//! Mic (seller) capture via cpal. The cpal `Stream` is `!Send` on macOS, so it
//! is built and parked on a dedicated thread; the real-time callback downmixes
//! to mono, converts f32 → linear16, and pushes bytes into the [`PcmSink`].

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

use super::{CaptureHandle, PcmSink};

/// Open the default input device (seller's mic) and stream mono linear16 PCM
/// into `sink`. Blocks only until the device is open (so the caller gets the
/// real sample rate synchronously), then capture runs on its own thread until
/// the returned handle is stopped.
pub fn start(sink: PcmSink) -> Result<CaptureHandle, String> {
    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    // The capture thread reports the rate it opened (or an error) before `start`
    // returns, so the STT URL can be built without guessing the device rate.
    let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<u32, String>>();

    std::thread::spawn(move || {
        let host = cpal::default_host();
        let Some(device) = host.default_input_device() else {
            let _ = ready_tx.send(Err("no default input device".into()));
            return;
        };
        let supported = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                let _ = ready_tx.send(Err(format!("input config: {e}")));
                return;
            }
        };
        let sample_format = supported.sample_format();
        let config: cpal::StreamConfig = supported.into();
        let channels = config.channels as usize;
        let sample_rate = config.sample_rate.0;

        // Only f32 is wired (macOS input default). Other formats fail loudly
        // rather than silently mis-transcoding — handle them when a device needs it.
        let built = match sample_format {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let mut pcm = Vec::with_capacity(data.len() / channels.max(1) * 2);
                    for frame in data.chunks(channels.max(1)) {
                        let mono: f32 = frame.iter().copied().sum::<f32>() / channels as f32;
                        let s = (mono.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                        pcm.extend_from_slice(&s.to_le_bytes());
                    }
                    let _ = sink.send(pcm);
                },
                |e| eprintln!("[audio] mic stream error: {e}"),
                None,
            ),
            other => {
                let _ = ready_tx.send(Err(format!("unsupported sample format: {other:?}")));
                return;
            }
        };

        let stream = match built {
            Ok(s) => s,
            Err(e) => {
                let _ = ready_tx.send(Err(format!("build input stream: {e}")));
                return;
            }
        };
        if let Err(e) = stream.play() {
            let _ = ready_tx.send(Err(format!("play stream: {e}")));
            return;
        }
        let _ = ready_tx.send(Ok(sample_rate));

        // Park here keeping the stream alive until stopped. Dropping it releases
        // the device and ends capture; the sink also drops, closing the channel.
        let _ = stop_rx.recv();
        drop(stream);
    });

    match ready_rx.recv() {
        Ok(Ok(sample_rate)) => Ok(CaptureHandle { sample_rate, stop: stop_tx }),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("mic capture thread exited before reporting status".into()),
    }
}
