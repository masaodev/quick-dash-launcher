import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { renderHook } from '@testing-library/react';
import type { AppItem, LauncherItem, SearchMode } from '@common/types';

import { useKeyboardShortcuts, type UseKeyboardShortcutsParams } from './useKeyboardShortcuts';

const showToastWindow = vi.fn();
const openParentFolder = vi.fn();

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
    reloadData: vi.fn(async () => undefined),
    desktopCount: 0,
    activeDesktopTab: 0,
    setActiveDesktopTab: vi.fn(),
  };
  const { result } = renderHook(() => useKeyboardShortcuts(params));
  return { params, handleKeyDown: result.current.handleKeyDown };
}

function keyEvent(key: string, init: { shiftKey?: boolean } = {}): React.KeyboardEvent {
  return {
    key,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

beforeEach(() => {
  showToastWindow.mockReset();
  openParentFolder.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { showToastWindow, openParentFolder },
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
});
