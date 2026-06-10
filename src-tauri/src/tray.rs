// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Yusup Supriyadi
//! System-tray integration: the tray icon + menu, and the helpers behind the
//! close-to-tray behavior (see `on_window_event` in `lib.rs`). With close-to-tray
//! on (the default) the app keeps running — and keeps recording — after the
//! window is closed, so the tray is the way back in (and the real way to quit).

use std::time::Duration;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::state::AppState;

/// How long a tray `Quit` with an active session waits for the session teardown
/// (cancel → capture stop → DB finalize) before exiting anyway.
const QUIT_GRACE: Duration = Duration::from_millis(1500);

/// Build the tray icon + menu (lives for the whole app run). Left-click opens
/// the app; the menu (right-click) carries Open / Quit. On Linux
/// (appindicator) clicks aren't delivered, so the menu shows on any click there.
pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open sososo", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit sososo", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("sososo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main_window(app),
            "quit" => quit_app(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Bring the (possibly hidden or minimized) main window back to the foreground.
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Quit from the tray. If a session is recording, cancel it first and give the
/// teardown a short grace period (off the main thread) so the session row and
/// any video file are finalized before the process exits. The window hides
/// immediately so quitting feels instant either way.
fn quit_app(app: &AppHandle) {
    let active = app.state::<AppState>().session.lock().unwrap().take();
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    match active {
        Some(session) => {
            session.cancel.cancel();
            let app = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(QUIT_GRACE);
                app.exit(0);
            });
        }
        None => app.exit(0),
    }
}
