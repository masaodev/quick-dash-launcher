import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AppItem } from '@common/types';
import type { WorkspaceChangeInfo } from '@common/types/electronApi';

import { useWsGroupReload } from './useWsGroupReload';

let onWorkspaceChanged: (change: WorkspaceChangeInfo) => void;
const wsGroupRow = { type: 'wsGroup', displayName: 'G' } as unknown as AppItem;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      onWorkspaceChanged: (callback: (change: WorkspaceChangeInfo) => void) => {
        onWorkspaceChanged = callback;
        return () => undefined;
      },
      hasWsGroupRows: async () => true,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWsGroupReload', () => {
  it('グループが変わったら、少し待ってから 1 回だけ読み直す', async () => {
    const reload = vi.fn(async () => undefined);
    renderHook(() => useWsGroupReload([wsGroupRow], reload));

    onWorkspaceChanged({});
    onWorkspaceChanged({});
    await vi.advanceTimersByTimeAsync(300);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('参照アイテムの中身だけの変更では読み直さない（起動して最初の読み込みで全件を読み直さない。A3-254）', async () => {
    const reload = vi.fn(async () => undefined);
    renderHook(() => useWsGroupReload([wsGroupRow], reload));

    onWorkspaceChanged({ refsOnly: true });
    await vi.advanceTimersByTimeAsync(300);

    expect(reload).not.toHaveBeenCalled();
  });
});
