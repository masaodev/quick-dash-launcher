import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { RegisterItem } from '@common/types';

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
    useRegisterForm(
      true,
      null,
      droppedPaths,
      undefined,
      'datafiles/data.json',
      async () => {},
      noop,
      noop
    )
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

describe('useRegisterForm の初期値のアイテム（ワークスペースからの登録）', () => {
  const prefill: RegisterItem[] = [
    {
      displayName: 'メモ',
      path: '',
      type: 'clipboard',
      targetTab: '',
      itemCategory: 'clipboard',
      clipboardDataRef: 'clipboard-data/abc.json',
      clipboardFormats: ['text'],
      customIcon: 'memo.png',
    },
  ];

  it('渡したアイテムを、保存先を今のタブにして初期値にし、カスタムアイコンのプレビューを読む', async () => {
    const loadIcon = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useRegisterForm(
        true,
        null,
        droppedPaths,
        prefill,
        'datafiles/data.json',
        loadIcon,
        noop,
        noop
      )
    );
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]).toMatchObject({
      displayName: 'メモ',
      itemCategory: 'clipboard',
      clipboardDataRef: 'clipboard-data/abc.json',
      targetTab: 'datafiles/data.json',
      targetFile: 'datafiles/data.json',
    });
    expect(loadIcon).toHaveBeenCalledWith(0, 'memo.png');
  });
});

describe('useRegisterForm のクリップボードの一時データ', () => {
  it.each(['item', 'dir', 'set', 'window'])(
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
