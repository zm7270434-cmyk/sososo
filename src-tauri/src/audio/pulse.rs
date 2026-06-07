//! Shared PulseAudio introspection helpers (Linux). cpal on Linux only exposes
//! ALSA, which can't cleanly enumerate PulseAudio/PipeWire **monitor** sources, so
//! the Linux audio backend talks to libpulse directly. This module runs one-shot
//! introspection queries against the default PulseAudio server using the standard
//! (single-threaded) mainloop: connect, iterate until the context is ready, issue
//! the query, iterate until the operation completes, then return the collected
//! results. Works on PipeWire too via its PulseAudio-compatibility layer.

use std::cell::RefCell;
use std::rc::Rc;

use pulse::callbacks::ListResult;
use pulse::context::introspect::{ServerInfo, SinkInfo, SourceInfo};
use pulse::context::{Context, FlagSet as ContextFlagSet, State as ContextState};
use pulse::mainloop::standard::{IterateResult, Mainloop};
use pulse::operation::{Operation, State as OperationState};

use crate::error::{AppError, AppResult};

/// One enumerated PulseAudio endpoint surfaced to the UI. `id` is the PA source
/// name (a microphone) or a sink's monitor-source name (system audio); capture
/// resolves the device by this name.
pub(crate) struct PaEndpoint {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

/// Connect to the default PulseAudio server, drive the connection handshake, then
/// run `f` (which issues introspection ops and iterates the mainloop). Centralizes
/// the connect + ready loop and always disconnects afterwards.
fn with_context<T>(f: impl FnOnce(&mut Mainloop, &Context) -> AppResult<T>) -> AppResult<T> {
    let mut mainloop = Mainloop::new()
        .ok_or_else(|| AppError::Audio("pulse: failed to create mainloop".into()))?;
    let mut context = Context::new(&mainloop, "sososo")
        .ok_or_else(|| AppError::Audio("pulse: failed to create context".into()))?;

    context
        .connect(None, ContextFlagSet::NOFLAGS, None)
        .map_err(|e| AppError::Audio(format!("pulse: connect: {e}")))?;

    // Drive the mainloop until the context becomes Ready (or fails).
    loop {
        match mainloop.iterate(true) {
            IterateResult::Success(_) => {}
            IterateResult::Quit(_) => {
                return Err(AppError::Audio(
                    "pulse: mainloop quit during connect".into(),
                ))
            }
            IterateResult::Err(e) => {
                return Err(AppError::Audio(format!("pulse: mainloop error: {e}")))
            }
        }
        match context.get_state() {
            ContextState::Ready => break,
            ContextState::Failed | ContextState::Terminated => {
                return Err(AppError::Audio("pulse: context connection failed".into()))
            }
            _ => {}
        }
    }

    let result = f(&mut mainloop, &context);
    context.disconnect();
    result
}

/// Block the mainloop until `op` finishes (or is cancelled).
fn wait_for_op<G: ?Sized>(mainloop: &mut Mainloop, op: &Operation<G>) -> AppResult<()> {
    loop {
        match mainloop.iterate(true) {
            IterateResult::Success(_) => {}
            IterateResult::Quit(_) => {
                return Err(AppError::Audio("pulse: mainloop quit during query".into()))
            }
            IterateResult::Err(e) => {
                return Err(AppError::Audio(format!("pulse: mainloop error: {e}")))
            }
        }
        match op.get_state() {
            OperationState::Done => return Ok(()),
            OperationState::Cancelled => {
                return Err(AppError::Audio("pulse: query cancelled".into()))
            }
            OperationState::Running => {}
        }
    }
}

/// The server's default sink and source names (used to flag defaults and resolve
/// the default monitor when nothing is explicitly selected).
fn server_defaults(
    mainloop: &mut Mainloop,
    context: &Context,
) -> AppResult<(Option<String>, Option<String>)> {
    let result = Rc::new(RefCell::new((None, None)));
    let sink = result.clone();
    let op = context
        .introspect()
        .get_server_info(move |info: &ServerInfo| {
            *sink.borrow_mut() = (
                info.default_sink_name.as_ref().map(|s| s.to_string()),
                info.default_source_name.as_ref().map(|s| s.to_string()),
            );
        });
    wait_for_op(mainloop, &op)?;
    let out = result.borrow().clone();
    Ok(out)
}

/// Microphones / line-in: all PA sources that are **not** sink monitors.
pub(crate) fn list_input_sources() -> AppResult<Vec<PaEndpoint>> {
    with_context(|mainloop, context| {
        let (_default_sink, default_source) = server_defaults(mainloop, context)?;
        let items: Rc<RefCell<Vec<PaEndpoint>>> = Rc::new(RefCell::new(Vec::new()));
        let collected = items.clone();
        let op = context
            .introspect()
            .get_source_info_list(move |res: ListResult<&SourceInfo>| {
                if let ListResult::Item(src) = res {
                    // Monitor sources belong to the "system audio" list, not mics.
                    if src.monitor_of_sink.is_some() {
                        return;
                    }
                    if let Some(name) = src.name.as_ref().map(|s| s.to_string()) {
                        let label = src
                            .description
                            .as_ref()
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| name.clone());
                        let is_default = default_source.as_deref() == Some(name.as_str());
                        collected.borrow_mut().push(PaEndpoint {
                            id: name,
                            name: label,
                            is_default,
                        });
                    }
                }
            });
        wait_for_op(mainloop, &op)?;
        let out = items.borrow_mut().drain(..).collect();
        Ok(out)
    })
}

/// System-audio sources: each output sink's monitor source. No virtual device to
/// install (unlike macOS) — every sink exposes a `.monitor` source.
pub(crate) fn list_monitor_sources() -> AppResult<Vec<PaEndpoint>> {
    with_context(|mainloop, context| {
        let (default_sink, _default_source) = server_defaults(mainloop, context)?;
        let items: Rc<RefCell<Vec<PaEndpoint>>> = Rc::new(RefCell::new(Vec::new()));
        let collected = items.clone();
        let op = context
            .introspect()
            .get_sink_info_list(move |res: ListResult<&SinkInfo>| {
                if let ListResult::Item(sink) = res {
                    if let Some(monitor) = sink.monitor_source_name.as_ref().map(|s| s.to_string())
                    {
                        let label = sink
                            .description
                            .as_ref()
                            .map(|d| format!("Monitor of {d}"))
                            .unwrap_or_else(|| monitor.clone());
                        let is_default = default_sink.as_deref().is_some()
                            && default_sink.as_deref() == sink.name.as_deref();
                        collected.borrow_mut().push(PaEndpoint {
                            id: monitor,
                            name: label,
                            is_default,
                        });
                    }
                }
            });
        wait_for_op(mainloop, &op)?;
        let out = items.borrow_mut().drain(..).collect();
        Ok(out)
    })
}

/// The monitor source name of the default sink — what we record for "system audio"
/// when the user hasn't picked a specific output. Falls back to `<sink>.monitor`.
pub(crate) fn default_monitor_source() -> AppResult<String> {
    with_context(|mainloop, context| {
        let (default_sink, _) = server_defaults(mainloop, context)?;
        let sink = default_sink.ok_or_else(|| AppError::Audio("pulse: no default sink".into()))?;
        let monitor: Rc<RefCell<Option<String>>> = Rc::new(RefCell::new(None));
        let found = monitor.clone();
        let op =
            context
                .introspect()
                .get_sink_info_by_name(&sink, move |res: ListResult<&SinkInfo>| {
                    if let ListResult::Item(info) = res {
                        *found.borrow_mut() =
                            info.monitor_source_name.as_ref().map(|s| s.to_string());
                    }
                });
        wait_for_op(mainloop, &op)?;
        let resolved = monitor.borrow().clone();
        Ok(resolved.unwrap_or_else(|| format!("{sink}.monitor")))
    })
}
