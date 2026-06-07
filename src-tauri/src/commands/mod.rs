//! Tauri command surface (frontend → backend), grouped by domain. Each command is
//! re-exported here so `tauri::generate_handler![commands::*]` in `lib.rs` keeps
//! referencing them as `commands::<name>`.

mod apikeys;
mod assistant;
mod devices;
mod history;
mod session;

pub use apikeys::*;
pub use assistant::*;
pub use devices::*;
pub use history::*;
pub use session::*;
