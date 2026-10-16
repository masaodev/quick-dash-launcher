import { DESKTOP_TAB } from '@common/constants';
import { createTitleMatcher } from '@common/utils/windowTitle';
import type { RegisterItem, WindowConfig, WindowInfo, WindowOperationConfig } from '@common/types';
import { pickWindowPlacement } from '@common/utils/windowPlacement';

/**
 * ウィンドウリストを仮想デスクトップタブでフィルタリング
 *
 * @param windows ウィンドウリスト
 * @param activeDesktopTab アクティブなデスクトップタブID（0=すべて, -2=全デスクトップに表示, 1以上=デスクトップ番号）
 * @returns フィルタリングされたウィンドウリスト
 */
export function filterWindowsByDesktopTab(
  windows: WindowInfo[],
  activeDesktopTab: number
): WindowInfo[] {
  if (activeDesktopTab === DESKTOP_TAB.ALL) {
    return windows;
  }
  if (activeDesktopTab === DESKTOP_TAB.PINNED) {
    return windows.filter((w) => w.isPinned === true);
  }
  return windows.filter((w) => w.desktopNumber === activeDesktopTab);
}

/**
 * ウィンドウ一覧からタイトル/プロセス名でマッチするウィンドウを検索
 * メインプロセス側の findWindowByTitle と同じタイトルの照合（createTitleMatcher）を使う
 */
export function findMatchingWindow(
  windows: WindowInfo[],
  title?: string,
  processName?: string
): WindowInfo | null {
  const titleMatches = title?.trim() ? createTitleMatcher(title) : null;
  return (
    windows.find((win) => {
      if (titleMatches && !titleMatches(win.title)) return false;

      if (processName?.trim()) {
        if (!win.processName) return false;
        if (!win.processName.toLowerCase().includes(processName.toLowerCase())) return false;
      }

      return true;
    }) || null
  );
}

/**
 * RegisterItem のウィンドウ設定からタイトル/プロセス名を抽出する
 */
function extractWindowSearchParams(item: RegisterItem): {
  title?: string;
  processName?: string;
} {
  if (item.itemCategory === 'window') {
    return {
      title: item.windowOperationConfig?.windowTitle,
      processName: item.windowOperationConfig?.processName,
    };
  }
  return {
    title: item.window?.title,
    processName: item.window?.processName,
  };
}

/**
 * RegisterItem のウィンドウ設定を使って、実行中のウィンドウを検索する
 *
 * RegisterModal と WorkspaceItemEditModal の両方で使用される共通ロジック。
 * タイトル/プロセス名を抽出 → 全ウィンドウ取得 → マッチング検索 を行う。
 */
export async function fetchMatchingWindow(item: RegisterItem): Promise<WindowInfo | null> {
  const { title, processName } = extractWindowSearchParams(item);
  if (!title && !processName) return null;

  try {
    const allWindows = await window.electronAPI.getAllWindowsAllDesktops();
    return findMatchingWindow(allWindows, title, processName);
  } catch {
    return null;
  }
}

/**
 * WindowOperationConfig を WindowConfig に変換する
 *
 * WindowConfigEditor は WindowConfig を扱うため、
 * ウィンドウ操作アイテム編集時にこの変換が必要。
 */
export function toWindowConfig(config: WindowOperationConfig): WindowConfig {
  return {
    title: config.windowTitle,
    ...pickWindowPlacement(config),
  };
}

/**
 * WindowConfig を WindowOperationConfig に変換する
 *
 * WindowConfigEditor からの変更を WindowOperationConfig として保存する際に使用。
 */
export function toWindowOperationConfig(
  displayName: string,
  config: WindowConfig
): WindowOperationConfig {
  return {
    displayName,
    windowTitle: config.title || '',
    ...pickWindowPlacement(config),
  };
}
