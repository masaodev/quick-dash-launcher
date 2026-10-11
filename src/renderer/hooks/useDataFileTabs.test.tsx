import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    error: toastError,
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { useDataFileTabs } from './useDataFileTabs';

const createDataFile = vi.fn();

beforeEach(() => {
  toastError.mockClear();
  createDataFile.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      getSettings: async () => ({
        showDataFileTabs: true,
        defaultFileTab: 'datafiles/data.json',
        dataFileLabels: {},
        dataFileTabs: [
          { name: 'メイン', files: ['datafiles/data.json'] },
          { name: '仕事', files: ['datafiles/work.json', '../outside.json'] },
        ],
      }),
      createDataFile,
      onWindowHidden: () => () => undefined,
      onSettingsChanged: () => () => undefined,
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('useDataFileTabs のデータファイルの作成', () => {
  it('作れなかったファイルだけをトーストで知らせ、既にあるファイルは知らせない', async () => {
    createDataFile.mockImplementation(async (fileName: string) => {
      if (fileName === '../outside.json') {
        return { success: false, error: 'データファイル名が正しくありません' };
      }
      if (fileName === 'datafiles/data.json') {
        return { success: false, error: 'ファイルは既に存在します', alreadyExists: true };
      }
      return { success: true };
    });

    renderHook(() => useDataFileTabs());

    await waitFor(() => expect(createDataFile).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    const message = toastError.mock.calls[0][0] as string;
    expect(message).toContain('../outside.json（データファイル名が正しくありません）');
    expect(message).not.toContain('data.json');
    expect(message).not.toContain('work.json');
  });

  it('すべて作成済みか作成できたときは知らせない', async () => {
    createDataFile.mockResolvedValue({
      success: false,
      error: 'ファイルは既に存在します',
      alreadyExists: true,
    });
    renderHook(() => useDataFileTabs());
    await waitFor(() => expect(createDataFile).toHaveBeenCalledTimes(3));
    await new Promise((r) => setTimeout(r, 0));
    expect(toastError).not.toHaveBeenCalled();
  });
});
