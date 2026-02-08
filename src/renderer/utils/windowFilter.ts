import { DESKTOP_TAB } from '@common/constants';
import type { RegisterItem, WindowConfig, WindowInfo, WindowOperationConfig } from '@common/types';

/**
 * ウィンドウリストを仮想デスクトップタブでフィルタリング
 *
 * @param windows ウィンドウリスト
 * @param activeDesktopTab アクティブなデスクトップタブID（0=すべて, -2=ピン止め, 1以上=デスクトップ番号）
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
 * ワイルドカードパターンを正規表現に変換
 * メインプロセス側の windowMatcher.ts と同じロジック
 */
function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`, 'i');
}

/**
 * ウィンドウ一覧からタイトル/プロセス名でマッチするウィンドウを検索
 * メインプロセス側の findWindowByTitle と同等のマッチングロジック
 */
export function findMatchingWindow(
  windows: WindowInfo[],
  title?: string,
  processName?: string
): WindowInfo | null {
  return (
    windows.find((win) => {
      let titleMatches = true;
      if (title && title.trim() !== '') {
        const hasWildcard = title.includes('*') || title.includes('?');
        if (hasWildcard) {
          titleMatches = wildcardToRegex(title).test(win.title);
        } else {
          titleMatches = win.title.toLowerCase() === title.toLowerCase();
        }
      }

      let processMatches = true;
      if (processName && processName.trim() !== '') {
        if (win.processName) {
          processMatches = win.processName.toLowerCase().includes(processName.toLowerCase());
        } else {
          processMatches = false;
        }
      }

      return titleMatches && processMatches;
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
    title: item.windowConfig?.title,
    processName: item.windowConfig?.processName,
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
    processName: config.processName,
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    moveToActiveMonitorCenter: config.moveToActiveMonitorCenter,
    virtualDesktopNumber: config.virtualDesktopNumber,
    activateWindow: config.activateWindow,
    pinToAllDesktops: config.pinToAllDesktops,
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
    processName: config.processName,
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    moveToActiveMonitorCenter: config.moveToActiveMonitorCenter,
    virtualDesktopNumber: config.virtualDesktopNumber,
    activateWindow: config.activateWindow,
    pinToAllDesktops: config.pinToAllDesktops,
  };
}
