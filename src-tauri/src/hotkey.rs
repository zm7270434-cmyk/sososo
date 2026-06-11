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

/// The toggle combos, in registration-preference order, with their UI labels.
/// The primary is deliberately NOT Ctrl+Shift+R / Cmd+Opt+R — those are the
/// browsers' hard-reload shortcuts, and a global hook would steal them. The
/// +Shift variant is the fallback for machines where another app (screen
/// recorders like to claim Ctrl+Alt+R) already owns the primary.
fn candidates() -> [(Shortcut, &'static str); 2] {
    #[cfg(target_os = "macos")]
    {
        let base = Modifiers::CONTROL | Modifiers::SUPER;
        [
            (Shortcut::new(Some(base), Code::KeyR), "Ctrl+Cmd+R"),
            (
                Shortcut::new(Some(base | Modifiers::SHIFT), Code::KeyR),
                "Ctrl+Cmd+Shift+R",
            ),
        ]
    }
    #[cfg(not(target_os = "macos"))]
    {
        let base = Modifiers::CONTROL | Modifiers::ALT;
        [
            (Shortcut::new(Some(base), Code::KeyR), "Ctrl+Alt+R"),
            (
                Shortcut::new(Some(base | Modifiers::SHIFT), Code::KeyR),
                "Ctrl+Alt+Shift+R",
            ),
        ]
    }
}

/// Whether a pressed shortcut is (any variant of) the recording toggle.
fn is_toggle(shortcut: &Shortcut) -> bool {
    candidates().iter().any(|(c, _)| c == shortcut)
}

/// The label of the combo that is actually registered right now, or `None`
/// when the shortcut is disabled — or every candidate is taken by another app.
pub fn active_label(app: &AppHandle) -> Option<&'static str> {
    let shortcuts = app.global_shortcut();
    candidates()
        .into_iter()
        .find(|(s, _)| shortcuts.is_registered(*s))
        .map(|(_, label)| label)
}

/// Install the plugin + handler and register the first available combo (the
/// pref defaults to on; the frontend re-syncs the persisted value on mount via
/// [`set_enabled`]). Failing every candidate (all taken by other apps) is
/// logged and non-fatal — the app must still start.
pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state() == ShortcutState::Pressed && is_toggle(shortcut) {
                    on_toggle(app);
                }
            })
            .build(),
    )?;
    if let Err(e) = register_first_available(app.handle()) {
        eprintln!("[hotkey] {e}");
    }
    Ok(())
}

/// Register the first candidate the OS will give us; on success the rest stay
/// unregistered (one active combo at a time).
fn register_first_available(app: &AppHandle) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    let mut errors = Vec::new();
    for (shortcut, label) in candidates() {
        match shortcuts.register(shortcut) {
            Ok(()) => return Ok(()),
            Err(e) => errors.push(format!("{label}: {e}")),
        }
    }
    Err(format!(
        "no toggle combo could be registered (all taken by other apps?) — {}",
        errors.join("; ")
    ))
}

/// (Un)register the toggle shortcut to match the Settings → Behavior pref.
/// Idempotent, so the frontend can re-sync freely.
pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    if enabled {
        if active_label(app).is_some() {
            return Ok(()); // already on
        }
        register_first_available(app)
    } else {
        for (shortcut, _) in candidates() {
            if shortcuts.is_registered(shortcut) {
                shortcuts.unregister(shortcut).map_err(|e| e.to_string())?;
            }
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn candidates_are_labeled_for_windows_linux() {
        let c = candidates();
        assert_eq!(c[0].1, "Ctrl+Alt+R");
        assert_eq!(c[1].1, "Ctrl+Alt+Shift+R");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn candidates_are_labeled_for_macos() {
        let c = candidates();
        assert_eq!(c[0].1, "Ctrl+Cmd+R");
        assert_eq!(c[1].1, "Ctrl+Cmd+Shift+R");
    }

    #[test]
    fn every_candidate_is_recognized_as_the_toggle() {
        for (shortcut, _) in candidates() {
            assert!(is_toggle(&shortcut));
        }
    }

    #[test]
    fn unrelated_shortcuts_are_not_the_toggle() {
        let other = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN);
        assert!(!is_toggle(&other));
    }
}
