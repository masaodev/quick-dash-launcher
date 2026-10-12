import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { renderHook } from '@testing-library/react';
import type { AppItem, LauncherItem, SearchMode, WindowInfo } from '@common/types';

import { useKeyboardShortcuts, type UseKeyboardShortcutsParams } from './useKeyboardShortcuts';

const showToastWindow = vi.fn();
const openParentFolder = vi.fn();
const closeWindow = vi.fn();

function launcherItem(type: LauncherItem['type'], path: string): LauncherItem {
  return { displayName: `${type} のアイテム`, path, type } as LauncherItem;
}

function setup(
  items: AppItem[],
  searchMode: SearchMode = 'normal'
): {
  params: UseKeyboardShortcutsParams;
  handleKeyDown: (e: React.KeyboardEvent) => Promise<void>;
} {
  const params: UseKeyboardShortcutsParams = {
    showDataFileTabs: false,
    activeTab: 'datafiles/data.json',
    dataFileTabs: [],
    mainItems: items,
    filteredItems: items,
    searchQuery: '',
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),
    setActiveTab: vi.fn(),
    navigateToPrevious: vi.fn(() => null),
    navigateToNext: vi.fn(() => null),
    setSearchQuery: vi.fn(),
    handleExecuteItem: vi.fn(async () => undefined),
    handleEditItem: vi.fn(),
    searchMode,
    windowList: [],
    toggleSearchMode: vi.fn(async () => undefined),
    refreshWindows: vi.fn(async () => undefined),
    refreshWindowsKeepingSelection: vi.fn(async () => undefined),
    removeWindowFromList: vi.fn(),
    reloadData: vi.fn(async () => undefined),
    desktopCount: 0,
    activeDesktopTab: 0,
    setActiveDesktopTab: vi.fn(),
  };
  const { result } = renderHook(() => useKeyboardShortcuts(params));
  return { params, handleKeyDown: result.current.handleKeyDown };
}

function keyEvent(
  key: string,
  init: { shiftKey?: boolean; ctrlKey?: boolean } = {}
): React.KeyboardEvent {
  return {
    key,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

beforeEach(() => {
  showToastWindow.mockReset();
  openParentFolder.mockReset();
  closeWindow.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { showToastWindow, openParentFolder, closeWindow },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

describe('useKeyboardShortcuts', () => {
  it('通常モードの F2 で選択中のアイテムの編集画面を開く', async () => {
    const item = launcherItem('file', 'C:\\Windows\\win.ini');
    const { params, handleKeyDown } = setup([item]);

    await handleKeyDown(keyEvent('F2'));

    expect(params.handleEditItem).toHaveBeenCalledWith(item);
  });

  it('ウィンドウ検索モードの F2 では何もしない', async () => {
    const { params, handleKeyDown } = setup(
      [launcherItem('file', 'C:\\Windows\\win.ini')],
      'window'
    );

    await handleKeyDown(keyEvent('F2'));

    expect(params.handleEditItem).not.toHaveBeenCalled();
  });

  it.each([
    ['url', 'https://github.com/'],
    ['customUri', 'ms-settings:'],
  ] as const)(
    '%s の Shift+Enter は親フォルダーが無いことをトーストで知らせる',
    async (type, path) => {
      const { params, handleKeyDown } = setup([launcherItem(type, path)]);

      await handleKeyDown(keyEvent('Enter', { shiftKey: true }));

      expect(openParentFolder).not.toHaveBeenCalled();
      expect(params.handleExecuteItem).not.toHaveBeenCalled();
      expect(showToastWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          itemType: type,
          message: 'このアイテムには親フォルダーがありません',
        })
      );
    }
  );

  it('ファイルの Shift+Enter は親フォルダーを開く', async () => {
    const item = launcherItem('file', 'C:\\Windows\\win.ini');
    const { handleKeyDown } = setup([item]);

    await handleKeyDown(keyEvent('Enter', { shiftKey: true }));

    expect(openParentFolder).toHaveBeenCalledWith(item);
    expect(showToastWindow).not.toHaveBeenCalled();
  });

  it('ウィンドウ検索モードの Ctrl+D で閉じたウィンドウは、再取得を待たずに一覧から外す', async () => {
    const win = { hwnd: 100, title: '無題 - メモ帳', processName: 'Notepad.exe' } as WindowInfo;
    closeWindow.mockResolvedValue({ success: true });
    const { params, handleKeyDown } = setup([win], 'window');

    await handleKeyDown(keyEvent('d', { ctrlKey: true }));

    expect(closeWindow).toHaveBeenCalledWith(100);
    expect(params.removeWindowFromList).toHaveBeenCalledWith(100);
    expect(params.refreshWindowsKeepingSelection).toHaveBeenCalled();
    expect(params.refreshWindows).not.toHaveBeenCalled();
  });

  it('一覧が更新される前に続けて押した Ctrl+D は、閉じている途中のウィンドウを飛ばして次を閉じる', async () => {
    const first = { hwnd: 100, title: '1 - メモ帳', processName: 'Notepad.exe' } as WindowInfo;
    const second = { hwnd: 200, title: '2 - メモ帳', processName: 'Notepad.exe' } as WindowInfo;
    let finishFirst: (value: { success: boolean }) => void = () => undefined;
    closeWindow
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValue({ success: true });
    const { handleKeyDown } = setup([first, second], 'window');

    // 1 回目の処理が終わる前（同じ描画のまま）に 2 回目を押す
    const pressing = handleKeyDown(keyEvent('d', { ctrlKey: true }));
    await handleKeyDown(keyEvent('d', { ctrlKey: true }));
    finishFirst({ success: true });
    await pressing;

    expect(closeWindow.mock.calls).toEqual([[100], [200]]);
  });

  it('ウィンドウを閉じるのに失敗したときは一覧から外さない', async () => {
    const win = { hwnd: 100, title: '無題 - メモ帳', processName: 'Notepad.exe' } as WindowInfo;
    closeWindow.mockResolvedValue({ success: false, error: 'x' });
    const { params, handleKeyDown } = setup([win], 'window');

    await handleKeyDown(keyEvent('d', { ctrlKey: true }));

    expect(params.removeWindowFromList).not.toHaveBeenCalled();
  });
});
