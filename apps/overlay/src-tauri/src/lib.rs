use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

/// Apply the macOS-only overlay window behaviors that Tauri does not expose in
/// `tauri.conf.json`: the window level (to beat fullscreen apps) and the
/// collection behavior (to appear on every Space). Done via AppKit through the
/// raw `NSWindow` handle.
#[cfg(target_os = "macos")]
fn apply_overlay_window_behaviors(window: &tauri::WebviewWindow) {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::id;
    use cocoa::foundation::NSInteger;

    let Ok(handle) = window.ns_window() else {
        return;
    };
    let ns_window = handle as id;

    unsafe {
        // PG-244 (FR1/FR2): float above EVERYTHING, including other apps'
        // fullscreen Spaces. NSScreenSaverWindowLevel == 1000. Plain `.floating`
        // (what Tauri's `alwaysOnTop` sets) is not enough to beat fullscreen.
        ns_window.setLevel_(1000 as NSInteger);

        // PG-244 (FR3): show on every Space and over other apps' fullscreen
        // Spaces without forcing our app into fullscreen, and don't slide
        // between Spaces with the user.
        let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary;
        ns_window.setCollectionBehavior_(behavior);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // PG-245 (FR10): menu-bar-only — no Dock tile, no Cmd+Tab entry.
            // Set at runtime so it also holds in `tauri dev`, where the bundled
            // Info.plist `LSUIElement` key does not apply.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // PG-244: float-above-fullscreen + join-all-Spaces.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                apply_overlay_window_behaviors(&window);
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
                .tooltip("PG Overlay")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
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
