import type { Source, StoredSegment } from '../../../../types/domain';

/** One distinct speaker in a session: the raw stored label (null = un-diarized),
 *  its display name, the source (for icon/colour), and how many lines it has. */
export interface SpeakerEntry {
  stored: string | null;
  display: string;
  source: Source;
  count: number;
}

/** Distinct speakers in first-appearance order. Lines sharing one stored label
 *  group together; a remote line with no diarization (`speaker == null`) becomes
 *  the "Speaker" group. */
export function distinctSpeakers(segments: StoredSegment[]): SpeakerEntry[] {
  const byKey = new Map<string, SpeakerEntry>();
  for (const s of segments) {
    const key = s.speaker ?? ' ';
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, {
        stored: s.speaker ?? null,
        display: s.speaker ?? (s.source === 'you' ? 'You' : 'Speaker'),
        source: s.source,
        count: 1,
      });
    }
  }
  return [...byKey.values()];
}
