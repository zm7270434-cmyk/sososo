// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Yusup Supriyadi
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sososo_lib::run()
}
