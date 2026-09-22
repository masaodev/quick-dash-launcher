/**
 * ワークスペースアイテムの変換ユーティリティ
 *
 * - AppItem（メイン画面のアイテム）→ ワークスペースアイテムの本体（追加時）
 * - WorkspaceItem ⇄ RegisterItem（編集モーダル）
 * - 表示用の文字列（ツールチップ・テキストコピー・トースト）
 *
 * ファイル形式（json-workspace.ts）はデータファイルと同じ語彙なので、変換はフィールド名の
 * 詰め替えではなく「メタ情報の付け外し」が中心になる。
 */

import type {
  AppItem,
  ClipboardItem,
  GroupItem,
  LauncherItem,
  LayoutItem,
  ToastItemType,
  WindowItem,
  WorkspaceItem,
  WorkspaceItemUpdate,
} from '../types';
import {
  isClipboardItem,
  isGroupItem,
  isLayoutItem,
  isWindowInfo,
  isWindowItem,
} from '../types/guards';
import type { RegisterItem, WindowOperationConfig } from '../types/register';

import { stripIconFromLayoutEntries } from './dataConverters';

/** undefined の値を持つキーを落とす（ファイルに `"args": undefined` のような穴を残さないため） */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ============================================================
// AppItem → ワークスペースアイテム本体（追加時）
// ============================================================

function launcherBody(item: LauncherItem): WorkspaceItemUpdate {
  return compact({
    type: 'item',
    displayName: item.displayName,
    path: item.path,
    args: item.args,
    originalPath: item.originalPath,
    customIcon: item.customIcon,
    windowConfig: item.windowConfig,
    memo: item.memo,
  });
}

function windowBody(item: WindowItem): WorkspaceItemUpdate {
  return compact({
    type: 'window',
    displayName: item.displayName,
    windowTitle: item.windowTitle,
    processName: item.processName,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
    virtualDesktopNumber: item.virtualDesktopNumber,
    activateWindow: item.activateWindow,
    pinToAllDesktops: item.pinToAllDesktops,
    memo: item.memo,
  });
}

function groupBody(item: GroupItem): WorkspaceItemUpdate {
  return compact({
    type: 'group',
    displayName: item.displayName,
    itemNames: [...item.itemNames],
    memo: item.memo,
  });
}

function clipboardBody(item: ClipboardItem): WorkspaceItemUpdate {
  return compact({
    type: 'clipboard',
    displayName: item.displayName,
    dataFileRef: item.clipboardDataRef,
    savedAt: item.savedAt,
    preview: item.preview,
    formats: [...item.formats],
    customIcon: item.customIcon,
    memo: item.memo,
  });
}

function layoutBody(item: LayoutItem): WorkspaceItemUpdate {
  return compact({
    type: 'layout',
    displayName: item.displayName,
    entries: stripIconFromLayoutEntries(item.entries),
    customIcon: item.customIcon,
    memo: item.memo,
  });
}

/**
 * メイン画面のアイテムをワークスペースアイテムの本体に変換する（id・並び順・所属は呼び出し側が付ける）
 *
 * @throws WindowInfo（ウィンドウ検索結果）はワークスペースに入れられない
 */
export function appItemToWorkspaceItemBody(item: AppItem): WorkspaceItemUpdate {
  if (isWindowInfo(item)) {
    throw new Error('WindowInfo is not supported in workspace');
  }
  if (isWindowItem(item)) return windowBody(item);
  if (isGroupItem(item)) return groupBody(item);
  if (isClipboardItem(item)) return clipboardBody(item);
  if (isLayoutItem(item)) return layoutBody(item);
  return launcherBody(item);
}

// ============================================================
// WorkspaceItem ⇄ RegisterItem（編集モーダル）
// ============================================================

/**
 * WorkspaceItem を RegisterItem に変換（編集モーダル用）
 */
export function workspaceItemToRegisterItem(item: WorkspaceItem): RegisterItem {
  switch (item.type) {
    case 'window': {
      const windowOperationConfig: WindowOperationConfig = {
        displayName: item.displayName,
        windowTitle: item.windowTitle,
        processName: item.processName,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
        virtualDesktopNumber: item.virtualDesktopNumber,
        activateWindow: item.activateWindow,
        pinToAllDesktops: item.pinToAllDesktops,
      };
      return {
        displayName: item.displayName,
        path: '',
        type: 'app',
        targetTab: '',
        itemCategory: 'window',
        windowOperationConfig,
        memo: item.memo,
      };
    }
    case 'group':
      return {
        displayName: item.displayName,
        path: '',
        type: 'app',
        targetTab: '',
        itemCategory: 'group',
        groupItemNames: [...item.itemNames],
        memo: item.memo,
      };
    case 'clipboard':
      return {
        displayName: item.displayName,
        path: '',
        type: 'clipboard',
        targetTab: '',
        itemCategory: 'clipboard',
        clipboardDataRef: item.dataFileRef,
        clipboardFormats: item.formats,
        clipboardSavedAt: item.savedAt,
        clipboardPreview: item.preview,
        customIcon: item.customIcon,
        memo: item.memo,
      };
    case 'layout':
      return {
        displayName: item.displayName,
        path: '',
        type: 'app',
        targetTab: '',
        itemCategory: 'layout',
        layoutEntries: [...item.entries],
        customIcon: item.customIcon,
        memo: item.memo,
      };
    case 'item':
      return {
        displayName: item.displayName,
        path: item.path,
        type: item.launcherType,
        args: item.args,
        targetTab: '',
        customIcon: item.customIcon,
        windowConfig: item.windowConfig,
        itemCategory: 'item',
        memo: item.memo,
      };
  }
}

/**
 * RegisterItem をアイテム更新（置き換え）に変換する
 *
 * その種別が持つフィールドだけを返すので、別種別への変更でも古いフィールドは残らない。
 */
export function registerItemToWorkspaceItemUpdate(registerItem: RegisterItem): WorkspaceItemUpdate {
  const memo = registerItem.memo || undefined;

  switch (registerItem.itemCategory) {
    case 'window': {
      const config = registerItem.windowOperationConfig;
      return compact({
        type: 'window',
        displayName: config?.displayName || registerItem.displayName,
        windowTitle: config?.windowTitle ?? '',
        processName: config?.processName || undefined,
        x: config?.x,
        y: config?.y,
        width: config?.width,
        height: config?.height,
        moveToActiveMonitorCenter: config?.moveToActiveMonitorCenter,
        virtualDesktopNumber: config?.virtualDesktopNumber,
        activateWindow: config?.activateWindow,
        pinToAllDesktops: config?.pinToAllDesktops,
        memo,
      });
    }
    case 'group':
      return compact({
        type: 'group',
        displayName: registerItem.displayName,
        itemNames: [...(registerItem.groupItemNames ?? [])],
        memo,
      });
    case 'clipboard':
      return compact({
        type: 'clipboard',
        displayName: registerItem.displayName,
        dataFileRef: registerItem.clipboardDataRef ?? '',
        savedAt: registerItem.clipboardSavedAt ?? Date.now(),
        preview: registerItem.clipboardPreview,
        formats: [...(registerItem.clipboardFormats ?? [])],
        customIcon: registerItem.customIcon,
        memo,
      });
    case 'layout':
      return compact({
        type: 'layout',
        displayName: registerItem.displayName,
        entries: stripIconFromLayoutEntries(registerItem.layoutEntries ?? []),
        customIcon: registerItem.customIcon,
        memo,
      });
    default:
      return compact({
        type: 'item',
        displayName: registerItem.displayName,
        path: registerItem.path,
        args: registerItem.args || undefined,
        customIcon: registerItem.customIcon,
        windowConfig: registerItem.windowConfig,
        memo,
      });
  }
}

// ============================================================
// 表示用
// ============================================================

/**
 * アイテムの「中身」を 1 行で表す（ツールチップ・テキストコピー用）
 *
 * 旧形式ではこれを path に保存していたが、2.0 では表示時にここで組み立てる。
 */
export function describeWorkspaceItem(item: WorkspaceItem): string {
  switch (item.type) {
    case 'item':
      return item.path;
    case 'window':
      return item.processName
        ? `ウィンドウ操作: ${item.windowTitle}（${item.processName}）`
        : `ウィンドウ操作: ${item.windowTitle}`;
    case 'group':
      return `グループ: ${item.itemNames.length}件`;
    case 'clipboard':
      return item.preview ? `クリップボード: ${item.preview}` : 'クリップボード';
    case 'layout':
      return `レイアウト: ${item.entries.length}件`;
  }
}

/** 起動トーストに渡す種別（通常アイテムは path から判定した種別） */
export function toToastItemType(item: WorkspaceItem): ToastItemType {
  switch (item.type) {
    case 'item':
      return item.launcherType;
    case 'window':
      return 'windowOperation';
    default:
      return item.type;
  }
}
