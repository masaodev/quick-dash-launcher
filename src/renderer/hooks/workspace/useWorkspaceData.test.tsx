import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceGroup } from '@common/types';

import { useWorkspaceData } from './useWorkspaceData';

/** loadGroups の応答を、テストの好きなときに返せるようにする */
let pendingGroupLoads: Array<(groups: WorkspaceGroup[]) => void>;
let onWorkspaceChanged: () => void;

function group(id: string, collapsed: boolean): WorkspaceGroup {
  return { id, displayName: id, collapsed, order: 0 } as unknown as WorkspaceGroup;
}

beforeEach(() => {
  pendingGroupLoads = [];
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      loadCachedIcons: async () => ({}),
      ensureIcons: async () => ({}),
      onWorkspaceChanged: (callback: () => void) => {
        onWorkspaceChanged = callback;
        return () => undefined;
      },
      workspaceAPI: {
        loadItems: async () => [],
        loadWorkspaces: async () => [],
        loadGroups: () =>
          new Promise<WorkspaceGroup[]>((resolve) => pendingGroupLoads.push(resolve)),
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('useWorkspaceData の折りたたみ', () => {
  it('開閉より前に送った読み込みの応答が後から届いても、開閉した状態は戻らない', async () => {
    const { result } = renderHook(() => useWorkspaceData());
    await waitFor(() => expect(pendingGroupLoads).toHaveLength(1));
    await act(async () => pendingGroupLoads[0]([group('a', false), group('b', false)]));

    // 別の変更の通知で読み込みが走り、その応答が届く前に a を畳む
    act(() => {
      onWorkspaceChanged();
    });
    await waitFor(() => expect(pendingGroupLoads).toHaveLength(2));
    act(() => {
      result.current.toggleGroupCollapsed('a');
    });
    expect(result.current.groups.find((g) => g.id === 'a')?.collapsed).toBe(true);

    // 開閉前の状態（a は開いている）の応答が届く。b の名前の変更は反映し、a の折りたたみは残す
    await act(async () =>
      pendingGroupLoads[1]([group('a', false), { ...group('b', false), displayName: 'B2' }])
    );
    expect(result.current.groups.find((g) => g.id === 'a')?.collapsed).toBe(true);
    expect(result.current.groups.find((g) => g.id === 'b')?.displayName).toBe('B2');

    // 開閉の後に送った読み込みの応答は、保存済みの状態としてそのまま使う
    act(() => {
      onWorkspaceChanged();
    });
    await waitFor(() => expect(pendingGroupLoads).toHaveLength(3));
    await act(async () => pendingGroupLoads[2]([group('a', false), group('b', true)]));
    expect(result.current.groups.find((g) => g.id === 'a')?.collapsed).toBe(false);
    expect(result.current.groups.find((g) => g.id === 'b')?.collapsed).toBe(true);
  });
});
