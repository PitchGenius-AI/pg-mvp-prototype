mod audio;
mod planner;
mod realtime;
mod stt;

use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, State,
};
#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
};

use realtime::{emit, RealtimeEvent};

// — M22 real-time engine command surface —
//
// The capture→STT pipeline is owned by Rust and driven from the overlay's
// Start/End call control via these two commands. A live call's handles live in
// app-managed state so End (or app exit) can stop capture and the STT task.

struct CallHandles {
    /// One per live capture stream — send `()` (or drop) to release the device.
    /// Seller (mic) always present; buyer (system tap) present unless it degraded.
    stops: Vec<std::sync::mpsc::Sender<()>>,
    /// The Deepgram streaming tasks (one per stream); aborted on End.
    tasks: Vec<tauri::async_runtime::JoinHandle<()>>,
    /// Manual-skip input into the planner run loop (§5.2/§5.4): the overlay's skip
    /// button sends `()` here to advance the cue without a buyer score. Dropped on
    /// End, which closes the channel and (with `finals`) ends the run loop.
    skip_tx: tokio::sync::mpsc::UnboundedSender<()>,
}

#[derive(Default)]
struct EngineState(Mutex<Option<CallHandles>>);

/// Start capture → Deepgram STT → emit transcript/engine_state events for both
/// speakers: seller (mic) and buyer (macOS system-audio tap). Idempotent: a
/// second call while one is live is a no-op. The seller stream is required (a
/// missing mic / key errors out); the buyer stream is best-effort — if the
/// system tap is unavailable (permission, OS), we degrade to mic-only.
#[tauri::command]
fn start_call(app: AppHandle, state: State<'_, EngineState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "engine state poisoned".to_string())?;
    if guard.is_some() {
        return Ok(());
    }
    let api_key = std::env::var("DEEPGRAM_API_KEY")
        .map_err(|_| "DEEPGRAM_API_KEY is not set (add it to the repo .env)".to_string())?;

    let mut stops = Vec::new();
    let mut tasks = Vec::new();

    // Transcript finals fan into the planner (§5.3), which drives the cue
    // lifecycle off real turns. Both STT streams forward onto this one channel;
    // the planner task owns the receiver and is aborted on End along with the rest.
    let (finals_tx, finals_rx) = tokio::sync::mpsc::unbounded_channel::<planner::Final>();

    // Manual-skip input (§5.2/§5.4): the overlay's skip button → `skip_cue` command
    // → here → the planner advances without a score. The sender lives in
    // `CallHandles` so the command can reach this call's run loop; it drops on End.
    let (skip_tx, skip_rx) = tokio::sync::mpsc::unbounded_channel::<()>();

    // Echo filter shared by both STT tasks: the buyer task records its finals as a
    // clean reference; the seller task drops finals that are really buyer bleed
    // (the no-headphones stopgap, pending native AEC). One per call.
    let echo = Arc::new(Mutex::new(stt::echo::EchoFilter::new()));

    // Seller (mic) — required.
    let (mic_tx, mic_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
    let mic = audio::mic::start(mic_tx)?;
    stops.push(mic.stop);
    {
        let app = app.clone();
        let key = api_key.clone();
        let sr = mic.sample_rate;
        let finals_tx = finals_tx.clone();
        let echo = echo.clone();
        tasks.push(tauri::async_runtime::spawn(async move {
            stt::deepgram::run(app, key, sr, "seller", mic_rx, finals_tx, echo).await;
        }));
    }

    emit(&app, RealtimeEvent::engine("listening", "discovery"));

    // Buyer (system-audio tap) — best-effort; mic-only degrade on failure.
    #[cfg(target_os = "macos")]
    {
        let (sys_tx, sys_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
        match audio::system::start(sys_tx) {
            Ok(sys) => {
                eprintln!("[audio] buyer system tap started @ {} Hz", sys.sample_rate);
                stops.push(sys.stop);
                let app = app.clone();
                let key = api_key.clone();
                let sr = sys.sample_rate;
                let finals_tx = finals_tx.clone();
                let echo = echo.clone();
                tasks.push(tauri::async_runtime::spawn(async move {
                    stt::deepgram::run(app, key, sr, "buyer", sys_rx, finals_tx, echo).await;
                }));
            }
            Err(e) => eprintln!("[audio] system tap unavailable — mic-only: {e}"),
        }
    }

    // The planner / cue-lifecycle loop (§5.2, §5.3). With an ANTHROPIC_API_KEY the
    // live LlmPlanner scores each buyer answer with haiku (the Buyer panel fills
    // live); without one we degrade to the scripted planner's canned progression so
    // the audio path + cue lifecycle still run end-to-end. Drop our spare sender so
    // the channel closes once both STT tasks end (the loop then exits cleanly).
    drop(finals_tx);
    {
        let app = app.clone();
        let planner: Box<dyn planner::Planner> = match std::env::var("ANTHROPIC_API_KEY") {
            Ok(key) if !key.is_empty() => {
                eprintln!("[planner] live haiku planner (ANTHROPIC_API_KEY set)");
                Box::new(planner::LlmPlanner::discovery(key))
            }
            _ => {
                eprintln!("[planner] no ANTHROPIC_API_KEY — scripted planner (canned scores)");
                Box::new(planner::ScriptedPlanner::discovery())
            }
        };
        tasks.push(tauri::async_runtime::spawn(async move {
            planner::run(app, planner, finals_rx, skip_rx).await;
        }));
    }

    *guard = Some(CallHandles { stops, tasks, skip_tx });
    Ok(())
}

/// Manual-skip the current cue (§5.2/§5.4): advance the planner to the next PROMPT
/// without scoring a buyer answer — the stall-breaker for when STT mishears and the
/// cue won't auto-advance. No-op when no call is live (the overlay only shows the
/// skip control mid-call, but guard anyway). Drives the same run-loop input the
/// future global hotkey will.
#[tauri::command]
fn skip_cue(state: State<'_, EngineState>) -> Result<(), String> {
    let guard = state.0.lock().map_err(|_| "engine state poisoned".to_string())?;
    if let Some(handles) = guard.as_ref() {
        let _ = handles.skip_tx.send(()); // ignore if the run loop already ended
    }
    Ok(())
}

/// Stop all capture + STT and return to idle. Safe to call when nothing runs.
#[tauri::command]
fn stop_call(app: AppHandle, state: State<'_, EngineState>) -> Result<(), String> {
    if let Some(handles) = state
        .0
        .lock()
        .map_err(|_| "engine state poisoned".to_string())?
        .take()
    {
        for stop in &handles.stops {
            let _ = stop.send(()); // drops each capture → devices released
        }
        for task in &handles.tasks {
            task.abort();
        }
    }
    emit(&app, RealtimeEvent::engine("idle", "discovery"));
    Ok(())
}

// A plain NSWindow — even at screen-saver level with `canJoinAllSpaces` — cannot
// be drawn over OTHER apps' fullscreen Spaces on macOS; only an NSPanel can
// (tauri-apps/tauri#11488). This subclass converts our window into an NSPanel in
// place, preserving its vibrancy/transparency. `is_floating_panel` keeps it
// above ordinary windows; `can_become_key_window` lets the rep click its
// controls. The window level + collection behavior are applied in
// `promote_to_overlay_panel`.
#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(OverlayPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true,
            // CRITICAL: NSPanel.hidesOnDeactivate defaults to TRUE (unlike an
            // NSWindow). Left at the default, the overlay vanishes the moment
            // another app takes focus — e.g. when it goes fullscreen — which is
            // precisely the float-over-fullscreen failure. Must be false.
            hides_on_deactivate: false
        }
    })
}

/// Promote the "main" window to a floating overlay panel that draws over other
/// apps' fullscreen Spaces (PG-244 FR1/FR2) and appears on every Space (FR3).
/// Mirrors tauri-nspanel's own `examples/fullscreen` recipe.
#[cfg(target_os = "macos")]
fn promote_to_overlay_panel(window: &tauri::WebviewWindow) {
    let Ok(panel) = window.to_panel::<OverlayPanel>() else {
        return;
    };

    // Float above ordinary windows.
    panel.set_level(PanelLevel::Floating.value());

    // The crux: a non-activating panel does not activate the app when shown or
    // clicked. This is REQUIRED for the panel to display over another app's
    // fullscreen Space — an activating window forces a Space switch instead of
    // floating over the fullscreen one.
    panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());

    // canJoinAllSpaces -> present on every Space; fullScreenAuxiliary -> allowed
    // to coexist on another app's fullscreen Space.
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .full_screen_auxiliary()
            .can_join_all_spaces()
            .into(),
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Dev convenience: pull DEEPGRAM_API_KEY (and friends) from the repo-root
    // .env when running `tauri dev` (cwd is src-tauri/, so walk up to the
    // monorepo root). A bundled app reads the real process env instead, so this
    // is best-effort — first match wins, missing files are ignored.
    for candidate in ["../.env", "../../.env", "../../../.env", "../../../../.env"] {
        if dotenvy::from_filename(candidate).is_ok() {
            break;
        }
    }

    let builder = tauri::Builder::default();

    // The NSPanel subclass + manager (macOS only).
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());

    builder
        .manage(EngineState::default())
        .invoke_handler(tauri::generate_handler![start_call, stop_call, skip_cue])
        .setup(|app| {
            // PG-245 (FR10): menu-bar-only — no Dock tile, no Cmd+Tab entry.
            // Set at runtime so it also holds in `tauri dev`, where the bundled
            // Info.plist `LSUIElement` key does not apply.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // PG-244: convert to a floating NSPanel so it floats above
            // fullscreen apps and joins all Spaces.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                promote_to_overlay_panel(&window);
            }

            // PG-245 (FR7/FR8/FR9): persistent menu-bar status item with a menu
            // that drives Show / Hide / Quit. Reuses the single "main" window —
            // Show after Hide never recreates it (FR11).
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            TrayIconBuilder::with_id("overlay-tray")
                // Template image (black + alpha); macOS tints it for light/dark.
                .icon(tauri::include_image!("icons/tray.png"))
                .icon_as_template(true)
                .tooltip("PG Desktop Co-pilot")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    // Drive the panel (not the window) so Show re-asserts the
                    // panel ordering/level after a Hide.
                    "show" => {
                        #[cfg(target_os = "macos")]
                        if let Ok(panel) = app.get_webview_panel("main") {
                            panel.show();
                        }
                    }
                    "hide" => {
                        #[cfg(target_os = "macos")]
                        if let Ok(panel) = app.get_webview_panel("main") {
                            panel.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
