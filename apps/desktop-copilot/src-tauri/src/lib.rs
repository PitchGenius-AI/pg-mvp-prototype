use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt,
};

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
    let builder = tauri::Builder::default();

    // The NSPanel subclass + manager (macOS only).
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());

    builder
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
