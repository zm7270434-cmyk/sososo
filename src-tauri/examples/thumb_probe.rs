//! Window-thumbnail smoke test for the Start-screen picker (Windows only).
//!
//! Enumerates capturable windows exactly like the `list_windows` command and
//! dumps every thumbnail to `thumb_probe_out/<n>.jpg` (next to where you run
//! it) so a human can eyeball that previews are real content — not black or
//! torn. Run from `src-tauri/`: `cargo run --example thumb_probe`

#[cfg(target_os = "windows")]
fn main() {
    use base64::Engine as _;

    let windows = sososo_lib::video::list_windows().expect("list_windows failed");
    println!("{} capturable window(s)", windows.len());

    let dir = std::path::Path::new("thumb_probe_out");
    std::fs::create_dir_all(dir).expect("create thumb_probe_out/");

    let mut saved = 0usize;
    for (i, w) in windows.iter().enumerate() {
        match &w.thumbnail {
            Some(data_url) => {
                let b64 = data_url
                    .strip_prefix("data:image/jpeg;base64,")
                    .expect("thumbnail is a JPEG data URL");
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(b64)
                    .expect("valid base64");
                let path = dir.join(format!("{i:02}.jpg"));
                std::fs::write(&path, &bytes).expect("write jpeg");
                println!(
                    "[{i:02}] {} — {} ({} KB) -> {}",
                    w.app,
                    w.title,
                    bytes.len() / 1024,
                    path.display()
                );
                saved += 1;
            }
            None => println!("[{i:02}] {} — {} (no thumbnail)", w.app, w.title),
        }
    }
    println!("saved {saved}/{} thumbnails", windows.len());
}

#[cfg(not(target_os = "windows"))]
fn main() {
    println!("thumb_probe is Windows-only (thumbnails are not captured elsewhere yet)");
}
