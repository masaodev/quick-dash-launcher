import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { IconProgress } from '@common/types';

import { useIconProgress } from './useIconProgress';

type EventType = 'start' | 'update' | 'complete';
type Listener = (data: IconProgress) => void;

let listeners: Record<EventType, Listener[]>;

function emit(eventType: EventType, data: IconProgress): void {
  act(() => listeners[eventType].forEach((listener) => listener(data)));
}

function progress(startTime: number, isComplete = false): IconProgress {
  return { currentPhase: 1, totalPhases: 1, phases: [], isComplete, startTime };
}

beforeEach(() => {
  listeners = { start: [], update: [], complete: [] };
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      onIconProgress: (eventType: EventType, callback: Listener) => {
        listeners[eventType].push(callback);
        return () => {
          listeners[eventType] = listeners[eventType].filter((l) => l !== callback);
        };
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('useIconProgress', () => {
  it('× で閉じた取得の進捗が届いても再表示しないこと', () => {
    const { result } = renderHook(() => useIconProgress());
    emit('start', progress(100));
    expect(result.current.progressState.isActive).toBe(true);

    act(() => result.current.resetProgress());
    emit('update', progress(100));
    emit('complete', progress(100, true));
    expect(result.current.progressState.isActive).toBe(false);
  });

  it('次の取得では再び表示すること', () => {
    const { result } = renderHook(() => useIconProgress());
    emit('start', progress(100));
    act(() => result.current.resetProgress());

    emit('start', progress(200));
    expect(result.current.progressState.isActive).toBe(true);
    expect(result.current.progressState.progress?.startTime).toBe(200);
  });
});
