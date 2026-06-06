import { invoke } from '@tauri-apps/api/core';
import type {
  ApiService,
  DeviceLists,
  SessionDetail,
  SessionSummary,
  StartResult,
  StopResult,
} from '../types/domain';

// Tauri maps camelCase JS keys to snake_case Rust params automatically.

export const listDevices = (): Promise<DeviceLists> => invoke('list_devices');

export const setDevices = (inputId: string | null, outputId: string | null): Promise<void> =>
  invoke('set_devices', { inputId, outputId });

export const startSession = (title?: string | null): Promise<StartResult> =>
  invoke('start_session', { title: title ?? null });

export const stopSession = (): Promise<StopResult> => invoke('stop_session');

export const setApiKey = (service: ApiService, value: string): Promise<void> =>
  invoke('set_api_key', { service, value });

export const hasApiKey = (service: ApiService): Promise<boolean> =>
  invoke('has_api_key', { service });

export const setTranscriptionOptions = (
  language: string | null,
  systemOnly: boolean | null,
): Promise<void> => invoke('set_transcription_options', { language, systemOnly });

/** Pause/resume the active session (backend stops/forwards audio to Deepgram). */
export const setPaused = (paused: boolean): Promise<void> => invoke('set_paused', { paused });

// --- Session history ---

export const listSessions = (): Promise<SessionSummary[]> => invoke('list_sessions');

export const getSession = (id: number): Promise<SessionDetail | null> =>
  invoke('get_session', { id });

export const deleteSession = (id: number): Promise<void> => invoke('delete_session', { id });

export const renameSession = (id: number, title: string): Promise<void> =>
  invoke('rename_session', { id, title });

/** Rename a speaker label across one session's transcript. `from` is the current
 *  stored label (null = the un-diarized group); `to` is the new name. Resolves to
 *  the number of transcript lines updated. */
export const renameSpeaker = (
  sessionId: number,
  from: string | null,
  to: string,
): Promise<number> => invoke('rename_speaker', { sessionId, from, to });

// --- AI summary ---

/** Read the persisted AI-summary output language (a language code or "auto"). */
export const getSummaryLanguage = (): Promise<string> => invoke('get_summary_language');

/** Persist the AI-summary output language (a language code or "auto"). */
export const setSummaryLanguage = (language: string): Promise<void> =>
  invoke('set_summary_language', { language });

/** Generate + persist an AI summary for a session; resolves to the Markdown text.
 *  `summaryLanguage` is the literal "auto" (match the transcript) or a
 *  human-readable language name like "Indonesian". */
export const summarizeSession = (id: number, summaryLanguage: string): Promise<string> =>
  invoke('summarize_session', { id, summaryLanguage });

// --- Live translation ---

/** Translate one finalized transcript line into `targetLang` (a display name
 *  like "English"); resolves to the translated text. The backend persists it and
 *  is idempotent, so a line is never translated twice. */
export const translateSegment = (
  sessionId: number,
  segmentId: string,
  text: string,
  targetLang: string,
): Promise<string> => invoke('translate_segment', { sessionId, segmentId, text, targetLang });
