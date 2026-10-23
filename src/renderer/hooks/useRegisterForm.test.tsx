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

describe('useRegisterForm の書いたテキストの保存', () => {
  async function renderWithText(text: string, onRegister: (items: RegisterItem[]) => void) {
    const hook = renderHook(() =>
      useRegisterForm(
        true,
        null,
        droppedPaths,
        'datafiles/data.json',
        async () => {},
        noop,
        onRegister
      )
    );
    await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
    await act(async () => {
      await hook.result.current.handleItemChange(0, 'itemCategory', 'clipboard');
    });
    act(() => {
      hook.result.current.updateItem(0, { displayName: '定型文', clipboardText: text });
    });
    return hook;
  }

  it('登録すると、書いた本文をテキストだけの実データとして保存して参照に置き換える', async () => {
    const saveText = vi.fn(async () => ({
      success: true,
      dataFileRef: 'clipboard-data/t1.json',
      preview: '本文',
      formats: ['text'],
      savedAt: 10,
    }));
    (window.electronAPI.clipboardAPI as unknown as Record<string, unknown>).saveText = saveText;
    const onRegister = vi.fn();
    const { result } = await renderWithText('本文', onRegister);

    await act(async () => {
      await result.current.validateAndRegister();
    });

    expect(saveText).toHaveBeenCalledWith('本文');
    const [registered] = onRegister.mock.calls[0][0] as RegisterItem[];
    expect(registered).toMatchObject({
      clipboardDataRef: 'clipboard-data/t1.json',
      clipboardFormats: ['text'],
      clipboardPreview: '本文',
    });
    expect(registered.clipboardText).toBeUndefined();
  });

  it('本文が空なら登録しない', async () => {
    const onRegister = vi.fn();
    const { result } = await renderWithText('  ', onRegister);
    await act(async () => {
      await result.current.validateAndRegister();
    });
    expect(onRegister).not.toHaveBeenCalled();
    expect(result.current.errors[0]?.path).toBe(
      'テキストを書くか、クリップボードを取り込んでください'
    );
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
