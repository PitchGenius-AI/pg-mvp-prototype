//! System-audio (buyer) capture via a macOS Core Audio process tap (macOS 14.4+).
//!
//! Speaker separation is source-based (audio doc §1): the buyer is *everyone
//! else on the call*, i.e. the machine's audio output. We create a global
//! process tap, wrap it in a private aggregate device, and read its IO proc —
//! the deterministic counterpart to the seller's mic ([`super::mic`]). Both
//! expose the same [`CaptureHandle`] shape, so STT treats them identically.
//!
//! Binding: `objc2-core-audio` (pure-Rust objc2 bindings — builds on Command
//! Line Tools, no full Xcode). Same *technique* the audio doc chose. The tap →
//! private-aggregate → IO-proc recipe was learned read-for-approach from Apple's
//! AudioCap sample (BSD-2) + Pluely (GPL-3); the code here is written fresh.

use std::ffi::c_void;
use std::ptr::NonNull;
use std::sync::mpsc;

use objc2::AllocAnyThread;
use objc2_core_audio::{
    kAudioAggregateDeviceIsPrivateKey, kAudioAggregateDeviceIsStackedKey,
    kAudioAggregateDeviceMainSubDeviceKey, kAudioAggregateDeviceNameKey,
    kAudioAggregateDeviceSubDeviceListKey, kAudioAggregateDeviceTapAutoStartKey,
    kAudioAggregateDeviceTapListKey, kAudioAggregateDeviceUIDKey, kAudioDevicePropertyDeviceUID,
    kAudioHardwarePropertyDefaultSystemOutputDevice, kAudioObjectPropertyElementMain,
    kAudioObjectPropertyScopeGlobal, kAudioObjectSystemObject, kAudioSubDeviceUIDKey,
    kAudioSubTapUIDKey, kAudioTapPropertyFormat, AudioDeviceCreateIOProcID,
    AudioDeviceDestroyIOProcID, AudioDeviceIOProcID, AudioDeviceStart, AudioDeviceStop,
    AudioHardwareCreateAggregateDevice, AudioHardwareCreateProcessTap,
    AudioHardwareDestroyAggregateDevice, AudioHardwareDestroyProcessTap, AudioObjectGetPropertyData,
    AudioObjectID, AudioObjectPropertyAddress, CATapDescription,
};
use objc2_core_audio_types::{AudioBufferList, AudioStreamBasicDescription, AudioTimeStamp};
use objc2_core_foundation::{kCFBooleanFalse, kCFBooleanTrue, CFArray, CFDictionary, CFRetained, CFString, CFType};
use objc2_foundation::{NSArray, NSNumber, NSUUID};

use super::{CaptureHandle, PcmSink};

/// Client data for the IO proc (an `unsafe extern "C"` fn that can't capture
/// environment). Boxed on the capture thread for the device's whole life; the
/// proc holds a raw pointer to it.
struct TapCtx {
    sink: PcmSink,
}

/// Read a fixed-size Core Audio property into `out`. Returns the raw OSStatus.
unsafe fn read_prop<T>(object: AudioObjectID, selector: u32, out: *mut T) -> i32 {
    let address = AudioObjectPropertyAddress {
        mSelector: selector,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain,
    };
    let mut size = std::mem::size_of::<T>() as u32;
    AudioObjectGetPropertyData(
        object,
        NonNull::from(&address),
        0,
        std::ptr::null(),
        NonNull::from(&mut size),
        NonNull::new(out as *mut c_void).unwrap(),
    )
}

/// Core Audio IO proc — fires on a real-time thread whenever the tap has audio.
/// A global tap delivers 32-bit float; we downmix to mono and forward linear16
/// bytes, exactly like the mic callback.
unsafe extern "C-unwind" fn capture_proc(
    _device: AudioObjectID,
    _now: NonNull<AudioTimeStamp>,
    input: NonNull<AudioBufferList>,
    _input_time: NonNull<AudioTimeStamp>,
    _output: NonNull<AudioBufferList>,
    _output_time: NonNull<AudioTimeStamp>,
    client: *mut c_void,
) -> i32 {
    if client.is_null() {
        return 0;
    }
    let ctx = &mut *(client as *mut TapCtx);
    let list = input.as_ref();
    if list.mNumberBuffers == 0 {
        return 0;
    }
    let buf = &list.mBuffers[0];
    if buf.mData.is_null() {
        return 0;
    }
    let float_count = buf.mDataByteSize as usize / std::mem::size_of::<f32>();
    if float_count == 0 {
        return 0;
    }
    let channels = (buf.mNumberChannels as usize).max(1);
    let samples = std::slice::from_raw_parts(buf.mData as *const f32, float_count);

    let mut pcm = Vec::with_capacity(float_count / channels * 2);
    for frame in samples.chunks(channels) {
        let mono: f32 = frame.iter().copied().sum::<f32>() / channels as f32;
        let s = (mono.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        pcm.extend_from_slice(&s.to_le_bytes());
    }
    let _ = ctx.sink.send(pcm);
    0
}

/// The live capture's Core Audio handles + ctx, torn down in [`start`]'s thread.
struct Capture {
    tap_id: AudioObjectID,
    aggregate_id: AudioObjectID,
    proc_id: AudioDeviceIOProcID,
    _ctx: Box<TapCtx>,
}

/// Open a global system-audio tap and stream mono linear16 PCM into `sink`.
/// Best-effort: returns an error (caller degrades to mic-only) if the tap can't
/// be created — e.g. System Audio Recording permission not yet granted.
pub fn start(sink: PcmSink) -> Result<CaptureHandle, String> {
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<u32, String>>();

    std::thread::spawn(move || match build(sink) {
        Ok((sample_rate, capture)) => {
            let _ = ready_tx.send(Ok(sample_rate));
            let _ = stop_rx.recv();
            teardown(&capture);
            drop(capture); // frees ctx after the device is stopped
        }
        Err(e) => {
            let _ = ready_tx.send(Err(e));
        }
    });

    match ready_rx.recv() {
        Ok(Ok(sample_rate)) => Ok(CaptureHandle { sample_rate, stop: stop_tx }),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("system-audio capture thread exited before reporting status".into()),
    }
}

/// Stop + destroy the IO proc, aggregate device, and tap (reverse of `build`).
fn teardown(capture: &Capture) {
    unsafe {
        AudioDeviceStop(capture.aggregate_id, capture.proc_id);
        AudioDeviceDestroyIOProcID(capture.aggregate_id, capture.proc_id);
        AudioHardwareDestroyAggregateDevice(capture.aggregate_id);
        AudioHardwareDestroyProcessTap(capture.tap_id);
    }
}

/// CFString from a Core Audio `&CStr` key constant.
fn key(k: &std::ffi::CStr) -> CFRetained<CFString> {
    CFString::from_str(k.to_str().expect("Core Audio key is ASCII"))
}

fn build(sink: PcmSink) -> Result<(u32, Capture), String> {
    unsafe {
        // Mono global tap over all processes (exclude none — we want all remote
        // call audio). Tag it with a UUID we reuse as the aggregate's tap UID.
        let tap_desc = CATapDescription::initMonoGlobalTapButExcludeProcesses(
            CATapDescription::alloc(),
            &NSArray::<NSNumber>::new(),
        );
        let tap_uuid = NSUUID::new();
        tap_desc.setUUID(&tap_uuid);

        let mut tap_id: AudioObjectID = 0;
        let st = AudioHardwareCreateProcessTap(Some(&tap_desc), &mut tap_id);
        if st != 0 {
            return Err(format!(
                "create process tap failed ({st}) — grant Screen & System Audio Recording?"
            ));
        }

        // The tap's stream format gives the sample rate we declare to Deepgram.
        let mut asbd: AudioStreamBasicDescription = std::mem::zeroed();
        let st = read_prop(tap_id, kAudioTapPropertyFormat, &mut asbd);
        if st != 0 {
            AudioHardwareDestroyProcessTap(tap_id);
            return Err(format!("read tap format failed ({st})"));
        }
        let sample_rate = asbd.mSampleRate as u32;

        // Default system output device → its UID anchors the private aggregate's
        // clock (main + sole sub-device); the tap rides alongside as the input.
        let mut output_id: AudioObjectID = 0;
        let st = read_prop(
            kAudioObjectSystemObject as AudioObjectID,
            kAudioHardwarePropertyDefaultSystemOutputDevice,
            &mut output_id,
        );
        if st != 0 {
            AudioHardwareDestroyProcessTap(tap_id);
            return Err(format!("read default output device failed ({st})"));
        }
        let mut out_uid_ptr: *const CFString = std::ptr::null();
        let st = read_prop(output_id, kAudioDevicePropertyDeviceUID, &mut out_uid_ptr);
        if st != 0 || out_uid_ptr.is_null() {
            AudioHardwareDestroyProcessTap(tap_id);
            return Err(format!("read output device uid failed ({st})"));
        }
        // DeviceUID is a +1 copy — take ownership.
        let out_uid = CFRetained::from_raw(NonNull::new_unchecked(out_uid_ptr as *mut CFString));

        // Aggregate composition: { sub-device = output } + { tap = our tap UUID }.
        let tap_uid = CFString::from_str(&tap_uuid.UUIDString().to_string());
        let sub_device = CFDictionary::<CFString, CFString>::from_slices(
            &[&key(kAudioSubDeviceUIDKey)],
            &[&out_uid],
        );
        let sub_tap = CFDictionary::<CFString, CFString>::from_slices(
            &[&key(kAudioSubTapUIDKey)],
            &[&tap_uid],
        );
        let sub_device_list = CFArray::from_objects(&[&*sub_device]);
        let tap_list = CFArray::from_objects(&[&*sub_tap]);

        let name = CFString::from_str("PG Buyer Capture");
        let agg_uid = CFString::from_str(&NSUUID::new().UUIDString().to_string());
        let k_name = key(kAudioAggregateDeviceNameKey);
        let k_uid = key(kAudioAggregateDeviceUIDKey);
        let k_main = key(kAudioAggregateDeviceMainSubDeviceKey);
        let k_priv = key(kAudioAggregateDeviceIsPrivateKey);
        let k_stack = key(kAudioAggregateDeviceIsStackedKey);
        let k_auto = key(kAudioAggregateDeviceTapAutoStartKey);
        let k_subs = key(kAudioAggregateDeviceSubDeviceListKey);
        let k_taps = key(kAudioAggregateDeviceTapListKey);

        let keys: [&CFString; 8] =
            [&k_name, &k_uid, &k_main, &k_priv, &k_stack, &k_auto, &k_subs, &k_taps];
        let v_name: &CFType = &name;
        let v_uid: &CFType = &agg_uid;
        let v_main: &CFType = &out_uid;
        let v_priv: &CFType = kCFBooleanTrue.unwrap();
        let v_stack: &CFType = kCFBooleanFalse.unwrap();
        let v_auto: &CFType = kCFBooleanTrue.unwrap();
        let v_subs: &CFType = &sub_device_list;
        let v_taps: &CFType = &tap_list;
        let values: [&CFType; 8] =
            [v_name, v_uid, v_main, v_priv, v_stack, v_auto, v_subs, v_taps];

        let agg_desc = CFDictionary::<CFString, CFType>::from_slices(&keys, &values);
        // The C API wants the generic-erased `&CFDictionary` (Opaque, Opaque);
        // our typed dict is layout-identical, so reborrow through the base type.
        let agg_desc_opaque =
            &*(CFRetained::as_ptr(&agg_desc).as_ptr() as *const CFDictionary);

        let mut aggregate_id: AudioObjectID = 0;
        let st = AudioHardwareCreateAggregateDevice(agg_desc_opaque, NonNull::from(&mut aggregate_id));
        if st != 0 {
            AudioHardwareDestroyProcessTap(tap_id);
            return Err(format!("create aggregate device failed ({st})"));
        }

        // Install the IO proc and start. ctx is boxed so its address is stable
        // for the raw pointer the proc receives.
        let mut ctx = Box::new(TapCtx { sink });
        let mut proc_id: AudioDeviceIOProcID = None;
        let st = AudioDeviceCreateIOProcID(
            aggregate_id,
            Some(capture_proc),
            ctx.as_mut() as *mut TapCtx as *mut c_void,
            NonNull::from(&mut proc_id),
        );
        if st != 0 {
            AudioHardwareDestroyAggregateDevice(aggregate_id);
            AudioHardwareDestroyProcessTap(tap_id);
            return Err(format!("create io proc failed ({st})"));
        }
        let st = AudioDeviceStart(aggregate_id, proc_id);
        if st != 0 {
            AudioDeviceDestroyIOProcID(aggregate_id, proc_id);
            AudioHardwareDestroyAggregateDevice(aggregate_id);
            AudioHardwareDestroyProcessTap(tap_id);
            return Err(format!("start aggregate device failed ({st})"));
        }

        Ok((sample_rate, Capture { tap_id, aggregate_id, proc_id, _ctx: ctx }))
    }
}
