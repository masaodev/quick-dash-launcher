import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { act, renderHook } from '@testing-library/react';
import type { AppItem, LauncherItem, SearchMode, WindowInfo } from '@common/types';

import { useKeyboardShortcuts, type UseKeyboardShortcutsParams } from './useKeyboardShortcuts';
import { useWindowOperations } from './useWindowOperations';
import { useWindowMultiSelect } from './useWindowMultiSelect';

const showToastWindow = vi.fn();
const openParentFolder = vi.fn();
const closeWindow = vi.fn();
const isWindowPinned = vi.fn();
const pinWindow = vi.fn();
const unPinWindow = vi.fn();
const setEscapeHandledByPage = vi.fn();

function launcherItem(type: LauncherItem['type'], path: string): LauncherItem {
  return { displayName: `${type} のアイテム`, path, type } as LauncherItem;
}

function notepad(hwnd: number): WindowInfo {
  return { hwnd, title: `${hwnd} - メモ帳`, processName: 'Notepad.exe' } as WindowInfo;
}

type Params = Omit<UseKeyboardShortcutsParams, 'windowOps' | 'windowSelection'> & {
  removeWindowFromList: (hwnd: WindowInfo['hwnd']) => void;
  refreshWindowsKeepingSelection: () => Promise<void>;
};

/** App と同じく、ウィンドウ操作・複数選択・キー操作のフックを組み合わせて使う */
function setup(
  items: AppItem[],
  searchMode: SearchMode = 'normal',
  selectedIndex = 0,
  canPinWindow = true
) {
  const params: Params = {
    showDataFileTabs: false,
    activeTab: 'datafiles/data.json',
    dataFileTabs: [],
    mainItems: items,
    filteredItems: items,
    searchQuery: '',
    selectedIndex,
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
    canPinWindow,
    activeDesktopTab: 0,
    setActiveDesktopTab: vi.fn(),
  };
  const { result } = renderHook(() => {
    const windowOps = useWindowOperations(params);
    const windowSelection = useWindowMultiSelect({
      searchMode: params.searchMode,
      filteredItems: params.filteredItems,
      selectedIndex: params.selectedIndex,
    });
    const { handleKeyDown } = useKeyboardShortcuts({ ...params, windowOps, windowSelection });
    return { handleKeyDown, windowSelection };
  });
  return {
    params,
    /** 最新の描画の handleKeyDown で押す（state の変化を反映させる） */
    press: (e: React.KeyboardEvent) => act(() => result.current.handleKeyDown(e)),
    /** 同じ描画のまま押す（処理が詰まっていて、一覧が更新される前に押されたキー） */
    handleKeyDown: result.current.handleKeyDown,
    selection: () => result.current.windowSelection,
  };
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
  isWindowPinned.mockReset();
  pinWindow.mockReset();
  unPinWindow.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      showToastWindow,
      openParentFolder,
      closeWindow,
      isWindowPinned,
      pinWindow,
      unPinWindow,
      setEscapeHandledByPage,
    },
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
    closeWindow.mockResolvedValue({ success: true });
    const { params, press } = setup([notepad(100)], 'window');

    await press(keyEvent('d', { ctrlKey: true }));

    expect(closeWindow).toHaveBeenCalledWith(100);
    expect(params.removeWindowFromList).toHaveBeenCalledWith(100);
    expect(params.refreshWindowsKeepingSelection).toHaveBeenCalled();
    expect(params.refreshWindows).not.toHaveBeenCalled();
  });

  it('一覧が更新される前に続けて押した Ctrl+D は、閉じている途中のウィンドウを飛ばして次を閉じる', async () => {
    let finishFirst: (value: { success: boolean }) => void = () => undefined;
    closeWindow
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValue({ success: true });
    const { handleKeyDown } = setup([notepad(100), notepad(200)], 'window');

    // 1 回目の処理が終わる前（同じ描画のまま）に 2 回目を押す
    const pressing = handleKeyDown(keyEvent('d', { ctrlKey: true }));
    await handleKeyDown(keyEvent('d', { ctrlKey: true }));
    finishFirst({ success: true });
    await pressing;

    expect(closeWindow.mock.calls).toEqual([[100], [200]]);
  });

  it('ウィンドウを閉じるのに失敗したときは一覧から外さない', async () => {
    closeWindow.mockResolvedValue({ success: false, error: 'x' });
    const { params, press } = setup([notepad(100)], 'window');

    await press(keyEvent('d', { ctrlKey: true }));

    expect(params.removeWindowFromList).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+A で表示中をすべて選び、Ctrl+D は確認の帯を出して Enter で全部閉じる', async () => {
    closeWindow.mockResolvedValue({ success: true });
    const wins = [notepad(100), notepad(200), notepad(300)];
    const { press, selection } = setup(wins, 'window');

    await press(keyEvent('A', { ctrlKey: true, shiftKey: true }));
    expect(selection().markedWindows).toEqual(wins);

    await press(keyEvent('d', { ctrlKey: true }));
    expect(closeWindow).not.toHaveBeenCalled();
    expect(selection().pendingClose).toEqual(wins);

    await press(keyEvent('Enter'));
    expect(closeWindow.mock.calls).toEqual([[100], [200], [300]]);
    expect(selection().pendingClose).toBeNull();
    // トーストは 1 回だけ
    expect(showToastWindow).toHaveBeenCalledTimes(1);
    expect(showToastWindow).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: '3 個のウィンドウ', itemType: 'windowClose' })
    );
  });

  it('Esc は確認の帯をやめ、もう一度で選択を外す', async () => {
    const { press, selection } = setup([notepad(100), notepad(200)], 'window');

    await press(keyEvent('A', { ctrlKey: true, shiftKey: true }));
    await press(keyEvent('d', { ctrlKey: true }));
    await press(keyEvent('Escape'));
    expect(selection().pendingClose).toBeNull();
    expect(selection().markedWindows).toHaveLength(2);

    await press(keyEvent('Escape'));
    expect(selection().markedWindows).toHaveLength(0);
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it('Shift+↓ でカーソルの行と次の行を選ぶ', async () => {
    const wins = [notepad(100), notepad(200), notepad(300)];
    const { params, press, selection } = setup(wins, 'window');

    await press(keyEvent('ArrowDown', { shiftKey: true }));

    expect(params.setSelectedIndex).toHaveBeenCalledWith(1);
    expect(selection().markedWindows).toEqual([wins[0], wins[1]]);
  });

  it('選んでいるときの Ctrl+P は、1 つでも固定していなければ全部固定する', async () => {
    isWindowPinned.mockImplementation(async (hwnd: number) => hwnd === 100);
    pinWindow.mockResolvedValue({ success: true });
    const { press } = setup([notepad(100), notepad(200)], 'window');

    await press(keyEvent('A', { ctrlKey: true, shiftKey: true }));
    await press(keyEvent('p', { ctrlKey: true }));

    expect(pinWindow.mock.calls).toEqual([[100], [200]]);
    expect(unPinWindow).not.toHaveBeenCalled();
  });

  it('仮想デスクトップ非対応の環境の Ctrl+P は固定せず、対応していないことをトーストで知らせる', async () => {
    const { press } = setup([notepad(100)], 'window', 0, false);

    await press(keyEvent('p', { ctrlKey: true }));

    expect(isWindowPinned).not.toHaveBeenCalled();
    expect(pinWindow).not.toHaveBeenCalled();
    expect(showToastWindow).toHaveBeenCalledWith({
      type: 'warning',
      message: 'この環境は仮想デスクトップに対応していません。',
    });
  });

  it('一部のウィンドウだけ固定に失敗したときは、成功の文言に失敗した数を添える', async () => {
    isWindowPinned.mockResolvedValue(false);
    pinWindow.mockImplementation(async (hwnd: number) =>
      hwnd === 300 ? { success: false, error: 'アクセスが拒否されました' } : { success: true }
    );
    const { press } = setup([notepad(100), notepad(200), notepad(300)], 'window');

    await press(keyEvent('A', { ctrlKey: true, shiftKey: true }));
    await press(keyEvent('p', { ctrlKey: true }));

    expect(showToastWindow).toHaveBeenCalledWith({
      displayName: '2 個のウィンドウ',
      itemType: 'windowPin',
      message: 'ウィンドウを全デスクトップに固定しました（1 個は固定に失敗しました）',
    });
  });
});
