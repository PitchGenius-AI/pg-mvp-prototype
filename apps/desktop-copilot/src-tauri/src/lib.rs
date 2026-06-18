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
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

use planner::grounding::StartCallContext;
use realtime::{emit, EngineStateEvent, ProfileUpdateEvent, RealtimeEvent, TechniqueUpdateEvent};

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
//
// `context` (PG-292) is present when the call is bound to an opportunity: it
// carries the deal's product, the prepped DISC/OCEAN read, the matched technique,
// and the generated pre-call script. When present (and it has a read or script)
// the planner SKIPS discovery and drives from the prepared script, and we pre-fill
// the Buyer/Technique panels up front. Absent (cold start) the path is unchanged:
// live discovery from zero.
#[tauri::command]
fn start_call(
    app: AppHandle,
    state: State<'_, EngineState>,
    context: Option<StartCallContext>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "engine state poisoned".to_string())?;
    if guard.is_some() {
        return Ok(());
    }
    // Bound + actually has a prepped read/script → we'll open in the live phase and
    // skip discovery; otherwise (cold start, or a bound deal whose precall was
    // unavailable) we discover as before.
    let grounded_live = context.as_ref().map(|c| c.has_read_or_script()).unwrap_or(false);
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

    // Initial status line: a bound call opens Live (technique locked from the prep);
    // a cold start opens in Discovery. The first surfaced cue re-asserts this.
    if grounded_live {
        emit(
            &app,
            RealtimeEvent::EngineState(EngineStateEvent::new("listening", "live", None, Some("locked"))),
        );
    } else {
        emit(&app, RealtimeEvent::engine("listening", "discovery"));
    }

    // Pre-fill the Buyer + Technique panels from the bound deal's prep (PG-292) so
    // they read "we already know this buyer" the moment the call starts, before any
    // live turn. The live planner keeps re-scoring from here as the call proceeds.
    if let Some(ctx) = &context {
        if let Some(bp) = &ctx.buyer_profile {
            emit(
                &app,
                RealtimeEvent::ProfileUpdate(ProfileUpdateEvent {
                    subject: "buyer",
                    disc: bp.disc.clone(),
                    ocean: bp.ocean.clone(),
                    summary: bp.summary.clone(),
                }),
            );
        }
        if let Some(t) = &ctx.technique {
            emit(
                &app,
                RealtimeEvent::TechniqueUpdate(TechniqueUpdateEvent {
                    technique: planner::grounding::technique_static(&t.technique),
                    tier: "locked",
                    rationale: t.reasoning.clone(),
                }),
            );
        }
    }

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
        // With a key, the live haiku planner; without one, the scripted fallback. A
        // bound `context` selects the `grounded` variant (skip discovery, drive from
        // the prepared script); a cold start keeps `discovery` (live, from zero).
        let key = std::env::var("ANTHROPIC_API_KEY").ok().filter(|k| !k.is_empty());
        let planner: Box<dyn planner::Planner> = match (&context, key) {
            (Some(ctx), Some(key)) => {
                eprintln!("[planner] live haiku planner — bound to {} (grounded)", ctx.opportunity_id);
                Box::new(planner::LlmPlanner::grounded(key, ctx))
            }
            (Some(ctx), None) => {
                eprintln!("[planner] scripted planner — bound to {} (grounded)", ctx.opportunity_id);
                Box::new(planner::ScriptedPlanner::grounded(ctx))
            }
            (None, Some(key)) => {
                eprintln!("[planner] live haiku planner (cold start)");
                Box::new(planner::LlmPlanner::discovery(key))
            }
            (None, None) => {
                eprintln!("[planner] no ANTHROPIC_API_KEY — scripted planner (cold start, canned scores)");
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

// — Desktop ↔ web auth handoff: OS keychain (M33/PG-289) —
//
// The session token the desktop exchanges the one-time deeplink token for is kept
// in the OS keychain (macOS Keychain via the `keyring` crate's apple-native store)
// so the rep stays signed in across launches. The frontend's auth boot calls these
// three commands; everything else is in the React `src/api/` layer. macOS-only —
// the rest of the app (NSPanel, Core Audio taps) is macOS-only too, so non-macOS
// builds get stubs that report the keychain as unavailable rather than failing to
// compile.
#[cfg(target_os = "macos")]
const KEYRING_SERVICE: &str = "com.pitchgenius.desktop-copilot";

/// Persist a secret (the bearer session token) under `account` in the OS keychain.
#[tauri::command]
fn secret_set(account: String, value: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| e.to_string())?;
        entry.set_password(&value).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (account, value);
        Err("keychain unavailable on this platform".to_string())
    }
}

/// Read a secret by `account`; `Ok(None)` when nothing is stored (not an error).
#[tauri::command]
fn secret_get(account: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(v) => Ok(Some(v)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = account;
        Ok(None)
    }
}

/// Delete the secret at `account`; deleting a missing entry is a no-op success.
#[tauri::command]
fn secret_delete(account: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = account;
        Ok(())
    }
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

/// Detectable toggle (§5.4 / §8): screen-share invisibility. When the rep sets the
/// overlay to "Hidden" (the default), exclude it from screen capture/sharing so it
/// doesn't appear in a Zoom/Meet share or a recording; "Detectable" makes it
/// capturable again. On macOS this flips the window's NSWindowSharingType
/// (none ⇄ readOnly) via Tauri's content-protection API. The overlay keeps
/// rendering and stays interactive on-screen either way — this only changes what a
/// screen recorder/sharer sees.
#[tauri::command]
fn set_detectable(app: AppHandle, detectable: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // Hidden ⇒ content-protected (excluded from capture); Detectable ⇒ not.
        window
            .set_content_protected(!detectable)
            .map_err(|e| e.to_string())?;
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

/// Render the overlay's frosted-glass background natively (NSVisualEffectView)
/// instead of via CSS `backdrop-filter`. The overlay is a non-activating NSPanel
/// (see `promote_to_overlay_panel`), so it's almost never the key window — and
/// WebKit stops compositing a CSS backdrop on an inactive window, which made the
/// blur flicker out and the card unreadable over the desktop. `State::Active`
/// pins the material to its active appearance regardless of key state, so the
/// frost is constant. The radius rounds the effect view (and the native window
/// shadow follows it) — keep it in sync with `.overlay-shell` border-radius.
/// Applied BEFORE the panel conversion; `to_panel` swaps the window's class in
/// place and preserves the content view's subviews, so the effect view persists.
#[cfg(target_os = "macos")]
fn apply_native_frost(window: &tauri::WebviewWindow) {
    // HudWindow is the most translucent material (designed for HUD overlays), so the
    // blurred desktop shows through; with the window forced to dark appearance
    // (tauri.conf theme) it renders as a dark glass. The CSS navy tint
    // (--glass-fill) drives the colour. Material is the only native knob on the
    // frost's base opacity; the blue/alpha is tuned in CSS.
    let _ = apply_vibrancy(
        window,
        NSVisualEffectMaterial::HudWindow,
        Some(NSVisualEffectState::Active),
        Some(16.0),
    );
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

    // single-instance MUST be registered first (Tauri v2 guidance). With the
    // `deep-link` feature, a second launch carrying a `pitchgenius://` URL forwards
    // it to the running instance (which the deep-link plugin then surfaces via
    // onOpenUrl) instead of starting a duplicate overlay. We also bring the panel
    // forward so the handoff feels immediate.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            #[cfg(target_os = "macos")]
            if let Ok(panel) = app.get_webview_panel("main") {
                panel.show();
            }
            let _ = app;
        }))
        .plugin(tauri_plugin_deep_link::init());

    // The NSPanel subclass + manager (macOS only).
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());

    builder
        .manage(EngineState::default())
        .invoke_handler(tauri::generate_handler![
            start_call,
            stop_call,
            skip_cue,
            set_detectable,
            secret_set,
            secret_get,
            secret_delete
        ])
        .setup(|app| {
            // Dev convenience: register the `pitchgenius` scheme at runtime so
            // `tauri dev` (unbundled — no Info.plist) still receives deep links.
            // A bundled build registers the scheme from tauri.conf.json instead.
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register("pitchgenius");
            }
            // PG-245 (FR10): menu-bar-only — no Dock tile, no Cmd+Tab entry.
            // Set at runtime so it also holds in `tauri dev`, where the bundled
            // Info.plist `LSUIElement` key does not apply.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // PG-244: convert to a floating NSPanel so it floats above
            // fullscreen apps and joins all Spaces. Frost the background natively
            // first (NSVisualEffectView) — CSS backdrop-filter flickers out on the
            // non-activating panel once it's no longer the key window.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                apply_native_frost(&window);
                promote_to_overlay_panel(&window);
                // Default is "Hidden" (§5.4): start excluded from screen capture so
                // the overlay never leaks into a share before the rep touches the
                // toggle. Mirrors the overlay's initial `detectable = false`.
                let _ = window.set_content_protected(true);
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
