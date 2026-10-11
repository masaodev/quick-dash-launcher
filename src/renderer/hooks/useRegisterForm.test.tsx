import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useRegisterForm } from './useRegisterForm';

const discardSession = vi.fn(async () => true);

beforeEach(() => {
  discardSession.mockClear();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      getSettings: async () => ({
        dataFileTabs: [{ name: 'メイン', files: ['datafiles/data.json'] }],
        dataFileLabels: {},
      }),
      loadCachedIcons: async () => ({}),
      clipboardAPI: { discardSession },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

const noop = () => undefined;
const droppedPaths: string[] = [];

async function renderWithCapturedClipboard() {
  const hook = renderHook(() =>
    useRegisterForm(true, null, droppedPaths, 'datafiles/data.json', async () => {}, noop, noop)
  );
  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
  await act(async () => {
    await hook.result.current.handleItemChange(0, 'itemCategory', 'clipboard');
  });
  await act(async () => {
    await hook.result.current.handleItemChange(0, 'clipboardSessionId', 'session-1');
  });
  return hook;
}

describe('useRegisterForm のクリップボードの一時データ', () => {
  it.each(['item', 'dir', 'group', 'window', 'layout'])(
    '種別を %s に変えると、取り込んだ一時データを破棄する',
    async (category) => {
      const { result } = await renderWithCapturedClipboard();
      await act(async () => {
        await result.current.handleItemChange(0, 'itemCategory', category);
      });
      expect(discardSession).toHaveBeenCalledWith('session-1');
      expect(result.current.items[0].clipboardSessionId).toBeUndefined();
    }
  );
});
