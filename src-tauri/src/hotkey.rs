// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Yusup Supriyadi
//! Global start/stop-recording hotkey (Ctrl+Alt+R; Ctrl+Cmd+R on macOS).
//!
//! Registered Rust-side via `tauri-plugin-global-shortcut`, so it works while
//! any app has focus — including with the window hidden in the tray. A press
//! emits `recording://toggle`; the frontend decides start vs stop from its
//! session state (see `lib/recordingToggle.ts`), so mid-transition presses are
//! ignored there. Enable/disable from Settings → Behavior re-/un-registers the
//! OS hook so a disabled shortcut doesn't swallow the combo from other apps.

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::events;
use crate::state::AppState;

/// The toggle combo. Deliberately NOT Ctrl+Shift+R / Cmd+Opt+R — those are the
/// browsers' hard-reload shortcuts, and a global hook would steal them.
fn toggle_shortcut() -> Shortcut {
    #[cfg(target_os = "macos")]
    let mods = Modifiers::CONTROL | Modifiers::SUPER;
    #[cfg(not(target_os = "macos"))]
    let mods = Modifiers::CONTROL | Modifiers::ALT;
    Shortcut::new(Some(mods), Code::KeyR)
}

/// Install the plugin + handler and register the shortcut (the pref defaults to
/// on; the frontend re-syncs the persisted value on mount via
/// [`set_enabled`]). A failed registration (combo taken by another app) is
/// logged and non-fatal — the app must still start.
pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state() == ShortcutState::Pressed && *shortcut == toggle_shortcut() {
                    on_toggle(app);
                }
            })
            .build(),
    )?;
    if let Err(e) = app.global_shortcut().register(toggle_shortcut()) {
        eprintln!("[hotkey] register failed (combo in use elsewhere?): {e}");
    }
    Ok(())
}

/// (Un)register the toggle shortcut to match the Settings → Behavior pref.
/// Idempotent, so the frontend can re-sync freely.
pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    let shortcut = toggle_shortcut();
    if enabled && !shortcuts.is_registered(shortcut) {
        shortcuts.register(shortcut).map_err(|e| e.to_string())
    } else if !enabled && shortcuts.is_registered(shortcut) {
        shortcuts.unregister(shortcut).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

/// One hotkey press. When no session is running this will start one, so bring
/// the (possibly tray-hidden) window forward first — the recording widget must
/// be visible. The frontend makes the actual start/stop/ignore decision.
fn on_toggle(app: &AppHandle) {
    if app.state::<AppState>().session.lock().unwrap().is_none() {
        crate::tray::show_main_window(app);
    }
    let _ = app.emit(events::RECORDING_TOGGLE, ());
}
