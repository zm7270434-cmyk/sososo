// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Yusup Supriyadi
//! Meeting auto-detection: match the open windows against known meeting apps
//! (native Zoom/Teams/Webex) and browser-tab titles (Google Meet, Zoom/Teams/
//! Webex web) so the app can offer to start recording. The matcher is pure and
//! platform-agnostic (tested everywhere); enumeration is Windows-only for now —
//! on macOS polling `SCShareableContent` would trigger the screen-recording
//! permission prompt for users who never touch the video feature, and the Linux
//! backend has no window enumeration.

use serde::Serialize;

/// A meeting that looks active right now.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedMeeting {
    /// Platform display name: "Zoom" | "Google Meet" | "Microsoft Teams" | "Webex".
    pub platform: String,
    /// The matched window's title (context for the prompt).
    pub title: String,
}

/// Enumerate windows (cheap, no thumbnails) and find an active-looking meeting.
pub fn detect() -> Option<DetectedMeeting> {
    #[cfg(target_os = "windows")]
    {
        let windows = crate::video::list_windows_meta().ok()?;
        match_meeting(windows.iter().map(|w| (w.app.as_str(), w.title.as_str())))
    }
    #[cfg(not(target_os = "windows"))]
    None
}

/// Browsers whose window titles mirror the active tab — only these get the
/// title-based web-meeting rules, so an editor showing "Google Meet" in a
/// document name can't match.
const BROWSERS: &[&str] = &[
    "chrome", "chromium", "msedge", "edge", "firefox", "brave", "opera", "vivaldi", "arc", "safari",
];

/// Pure matcher over `(app, title)` pairs. Native meeting windows win over
/// browser tabs; within each pass the first matching window wins.
pub fn match_meeting<'a>(
    windows: impl IntoIterator<Item = (&'a str, &'a str)>,
) -> Option<DetectedMeeting> {
    let mut browser_hit: Option<DetectedMeeting> = None;
    for (app, title) in windows {
        let app_lc = app.to_lowercase();
        if app_lc.contains("sososo") {
            continue;
        }
        let title_lc = title.to_lowercase();
        if let Some(platform) = match_native(&app_lc, &title_lc) {
            return Some(DetectedMeeting {
                platform: platform.to_string(),
                title: title.to_string(),
            });
        }
        if browser_hit.is_none() {
            if let Some(platform) = match_browser(&app_lc, &title_lc) {
                browser_hit = Some(DetectedMeeting {
                    platform: platform.to_string(),
                    title: title.to_string(),
                });
            }
        }
    }
    browser_hit
}

/// Native meeting clients. Zoom/Teams run idle in the background all day, so
/// their match needs a meeting-ish title; the Webex meeting processes only
/// exist during a meeting, so the app name alone is enough.
fn match_native(app: &str, title: &str) -> Option<&'static str> {
    if app.contains("zoom") && (title.contains("meeting") || title.contains("webinar")) {
        return Some("Zoom");
    }
    if app.contains("teams")
        && (title.contains("meeting") || title.contains("call") || title.contains("huddle"))
        && !title.starts_with("chat |")
    {
        return Some("Microsoft Teams");
    }
    if app.contains("webex") || app.contains("ciscocollab") || app.contains("atmgr") {
        return Some("Webex");
    }
    None
}

/// Web meeting tabs, matched by the browser window's (= active tab's) title.
fn match_browser(app: &str, title: &str) -> Option<&'static str> {
    if !BROWSERS.iter().any(|b| app.contains(b)) {
        return None;
    }
    if title.contains("google meet") || (title.contains("meet") && has_meet_code(title)) {
        return Some("Google Meet");
    }
    if title.contains("zoom meeting") || title.contains("zoom webinar") {
        return Some("Zoom");
    }
    if title.contains("microsoft teams") {
        return Some("Microsoft Teams");
    }
    if title.contains("webex") {
        return Some("Webex");
    }
    None
}

/// Whether the (lowercased) title carries a Google Meet code: a `xxx-xxxx-xxx`
/// token of lowercase letters, as in "Meet – abc-defg-hij".
fn has_meet_code(title: &str) -> bool {
    title
        .split(|c: char| !(c.is_ascii_lowercase() || c == '-'))
        .any(|token| {
            let parts: Vec<&str> = token.split('-').collect();
            parts.len() == 3
                && [3, 4, 3] == [parts[0].len(), parts[1].len(), parts[2].len()]
                && parts
                    .iter()
                    .all(|p| p.chars().all(|c| c.is_ascii_lowercase()))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn m(windows: &[(&str, &str)]) -> Option<String> {
        match_meeting(windows.iter().copied()).map(|d| d.platform)
    }

    #[test]
    fn zoom_meeting_window_matches() {
        assert_eq!(m(&[("Zoom.exe", "Zoom Meeting")]), Some("Zoom".to_string()));
        assert_eq!(
            m(&[("zoom.exe", "Budi's Personal Meeting Room")]),
            Some("Zoom".to_string())
        );
        assert_eq!(m(&[("zoom.exe", "Zoom Webinar")]), Some("Zoom".to_string()));
    }

    #[test]
    fn idle_zoom_home_window_does_not_match() {
        assert_eq!(m(&[("Zoom.exe", "Zoom Workplace")]), None);
        assert_eq!(m(&[("Zoom.exe", "Zoom")]), None);
    }

    #[test]
    fn teams_meeting_window_matches_but_chat_does_not() {
        assert_eq!(
            m(&[("ms-teams.exe", "Standup meeting | Microsoft Teams")]),
            Some("Microsoft Teams".to_string())
        );
        assert_eq!(
            m(&[("ms-teams.exe", "Call with Ana | Microsoft Teams")]),
            Some("Microsoft Teams".to_string())
        );
        assert_eq!(m(&[("ms-teams.exe", "Chat | Ana | Microsoft Teams")]), None);
    }

    #[test]
    fn webex_meeting_processes_match_by_app_alone() {
        assert_eq!(
            m(&[("atmgr.exe", "Cisco Webex Meetings")]),
            Some("Webex".to_string())
        );
        assert_eq!(
            m(&[("CiscoCollabHost.exe", "anything")]),
            Some("Webex".to_string())
        );
    }

    #[test]
    fn browser_meet_tab_matches_via_name_or_code() {
        assert_eq!(
            m(&[("chrome.exe", "Google Meet - Google Chrome")]),
            Some("Google Meet".to_string())
        );
        // In-call Meet tab: "Meet – <code>" (the title carries the meeting code).
        assert_eq!(
            m(&[("msedge.exe", "Meet – abc-defg-hij - Microsoft Edge")]),
            Some("Google Meet".to_string())
        );
    }

    #[test]
    fn browser_zoom_teams_webex_tabs_match() {
        assert_eq!(
            m(&[("firefox.exe", "Zoom Meeting - Mozilla Firefox")]),
            Some("Zoom".to_string())
        );
        assert_eq!(
            m(&[(
                "chrome.exe",
                "Weekly sync | Microsoft Teams - Google Chrome"
            )]),
            Some("Microsoft Teams".to_string())
        );
        assert_eq!(
            m(&[("brave.exe", "Webex Meetings - Brave")]),
            Some("Webex".to_string())
        );
    }

    #[test]
    fn unrelated_windows_do_not_match() {
        assert_eq!(
            m(&[
                ("chrome.exe", "meeting notes - Google Docs - Google Chrome"),
                ("Code.exe", "main.rs - sososo - Visual Studio Code"),
                ("explorer.exe", "Downloads"),
            ]),
            None
        );
    }

    #[test]
    fn non_browser_apps_never_match_by_title() {
        // Only real browsers get the title rules — an editor showing "Google
        // Meet" in a doc title must not count.
        assert_eq!(
            m(&[("notepad.exe", "Google Meet plan.txt - Notepad")]),
            None
        );
    }

    #[test]
    fn own_app_is_excluded() {
        assert_eq!(
            m(&[("sososo.exe", "Zoom Meeting transcript - sososo")]),
            None
        );
    }

    #[test]
    fn native_meeting_wins_over_browser_tab() {
        assert_eq!(
            m(&[
                ("chrome.exe", "Meet – abc-defg-hij - Google Chrome"),
                ("zoom.exe", "Zoom Meeting"),
            ]),
            Some("Zoom".to_string())
        );
    }

    #[test]
    fn meet_code_detection_is_strict() {
        // 3-4-3 lowercase letters; anything else is not a Meet code.
        assert_eq!(
            m(&[("chrome.exe", "meet the team - my-blog-post - Google Chrome")]),
            None
        );
        assert_eq!(
            m(&[("chrome.exe", "meet – ab-cd-ef - Google Chrome")]),
            None
        );
    }
}
