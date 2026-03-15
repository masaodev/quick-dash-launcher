/**
 * レイアウト関連のユーティリティ関数
 */

import type { LayoutItem, LayoutWindowEntry, WindowInfo } from '../types';
import type { RegisterItem } from '../types/register';

/**
 * WindowInfo を既存の LayoutWindowEntry にマージする
 * ウィンドウ選択モーダルからエントリを更新する際に使用
 */
export function mergeWindowInfoIntoLayoutEntry(
  existing: LayoutWindowEntry,
  windowInfo: WindowInfo
): LayoutWindowEntry {
  return {
    ...existing,
    windowTitle: windowInfo.title,
    processName: windowInfo.processName,
    executablePath: windowInfo.executablePath || existing.executablePath,
    x: windowInfo.x,
    y: windowInfo.y,
    width: windowInfo.width,
    height: windowInfo.height,
    virtualDesktopNumber: windowInfo.desktopNumber || existing.virtualDesktopNumber,
    icon: windowInfo.icon || existing.icon,
  };
}

/**
 * RegisterItem からレイアウト実行用の LayoutItem を構築する
 */
export function buildLayoutItemFromRegisterItem(item: RegisterItem): LayoutItem {
  return {
    type: 'layout',
    displayName: item.displayName,
    entries: item.layoutEntries || [],
    memo: item.memo,
  };
}
