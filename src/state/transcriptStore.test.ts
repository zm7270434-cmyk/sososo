import { beforeEach, describe, expect, test } from 'bun:test';

import { useTranscriptStore, type Segment } from './transcriptStore';

function seg(overrides: Partial<Segment> = {}): Segment {
  return {
    sessionId: 1,
    segmentId: '1:you:0',
    source: 'you',
    text: 'hello',
    tStart: 0,
    isFinal: false,
    ...overrides,
  };
}

describe('useTranscriptStore', () => {
  // The store is a module-level singleton; reset between tests for isolation.
  beforeEach(() => {
    useTranscriptStore.getState().reset();
  });

  test('upsert appends a new segment keyed by segmentId', () => {
    useTranscriptStore.getState().upsert(seg({ segmentId: 'a' }));
    useTranscriptStore.getState().upsert(seg({ segmentId: 'b' }));

    const { segments } = useTranscriptStore.getState();
    expect(segments.map((s) => s.segmentId)).toEqual(['a', 'b']);
  });

  test('upsert replaces a segment in place (interim → final), preserving order', () => {
    const { upsert } = useTranscriptStore.getState();
    upsert(seg({ segmentId: 'a', text: 'interim', isFinal: false }));
    upsert(seg({ segmentId: 'b', text: 'second' }));
    upsert(seg({ segmentId: 'a', text: 'final', isFinal: true }));

    const { segments } = useTranscriptStore.getState();
    expect(segments).toHaveLength(2);
    expect(segments.map((s) => s.segmentId)).toEqual(['a', 'b']);
    expect(segments[0].text).toBe('final');
    expect(segments[0].isFinal).toBe(true);
  });

  test('setTranslation stores an entry keyed by segmentId', () => {
    useTranscriptStore.getState().setTranslation('a', {
      status: 'done',
      text: 'hola',
      forText: 'hello',
      lang: 'Spanish',
    });

    expect(useTranscriptStore.getState().translations['a']).toEqual({
      status: 'done',
      text: 'hola',
      forText: 'hello',
      lang: 'Spanish',
    });
  });

  test('reset clears both segments and translations', () => {
    const { upsert, setTranslation, reset } = useTranscriptStore.getState();
    upsert(seg({ segmentId: 'a' }));
    setTranslation('a', { status: 'pending', forText: 'hello', lang: 'Spanish' });

    reset();

    const state = useTranscriptStore.getState();
    expect(state.segments).toEqual([]);
    expect(state.translations).toEqual({});
  });
});
