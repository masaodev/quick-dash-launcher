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

import type { TFunction } from 'i18next';

import type {
  AppItem,
  ClipboardItem,
  LauncherItem,
  SetItem,
  ToastItemType,
  WindowItem,
  WorkspaceItem,
  WorkspaceItemUpdate,
} from '../types';
import { isClipboardItem, isSetItem, isWindowInfo, isWindowItem } from '../types/guards';
import type { RegisterItem, WindowOperationConfig } from '../types/register';

import { windowInfoToWindowItem } from './windowInfoConverter';
import { pickWindowPlacement } from './windowPlacement.js';
import {
  pickItemWindowSwitch,
  switchToWindowConfig,
  windowConfigToSwitchFields,
} from './itemWindowConversion.js';

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
    ...pickItemWindowSwitch(item),
    memo: item.memo,
  });
}

function windowBody(item: WindowItem): WorkspaceItemUpdate {
  return compact({
    type: 'window',
    displayName: item.displayName,
    windowTitle: item.windowTitle,
    ...pickWindowPlacement(item),
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

function setBody(item: SetItem): WorkspaceItemUpdate {
  return compact({
    type: 'set',
    displayName: item.displayName,
    entries: item.entries.map((entry) => ({ ...entry })),
    launchMode: item.launchMode,
    customIcon: item.customIcon,
    memo: item.memo,
  });
}

/**
 * メイン画面のアイテムをワークスペースアイテムの本体に変換する（id・並び順・所属は呼び出し側が付ける）
 *
 * WindowInfo（ウィンドウ検索結果）はタイトルとプロセス名だけのウィンドウ操作アイテムにする。
 * 位置も記録したいときは呼び出し側で windowInfoToWindowItem(info, { includePosition: true }) を通す
 */
export function appItemToWorkspaceItemBody(item: AppItem): WorkspaceItemUpdate {
  if (isWindowInfo(item)) {
    return windowBody(windowInfoToWindowItem(item));
  }
  if (isWindowItem(item)) return windowBody(item);
  if (isClipboardItem(item)) return clipboardBody(item);
  if (isSetItem(item)) return setBody(item);
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
        ...pickWindowPlacement(item),
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
    case 'set':
      return {
        displayName: item.displayName,
        path: '',
        type: 'app',
        targetTab: '',
        itemCategory: 'set',
        setEntries: item.entries.map((entry) => ({ ...entry })),
        setLaunchMode: item.launchMode,
        customIcon: item.customIcon,
        memo: item.memo,
      };
    case 'item':
      return {
        displayName: item.displayName,
        path: item.path,
        type: item.launcherType,
        args: item.args,
        icon: item.icon,
        targetTab: '',
        customIcon: item.customIcon,
        windowConfig: switchToWindowConfig(item),
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
        ...pickWindowPlacement(config ?? {}),
        processName: config?.processName || undefined,
        memo,
      });
    }
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
    case 'set':
      return compact({
        type: 'set',
        displayName: registerItem.displayName,
        entries: (registerItem.setEntries ?? []).map((entry) => ({ ...entry })),
        launchMode: registerItem.setLaunchMode,
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
        ...windowConfigToSwitchFields(registerItem.windowConfig),
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
export function describeWorkspaceItem(item: WorkspaceItem, t: TFunction): string {
  switch (item.type) {
    case 'item':
      return item.path;
    case 'window':
      return item.processName
        ? t('workspace.describe.windowWithProcess', {
            title: item.windowTitle,
            process: item.processName,
          })
        : t('workspace.describe.window', { title: item.windowTitle });
    case 'clipboard':
      return item.preview
        ? t('workspace.describe.clipboardWithPreview', { preview: item.preview })
        : t('workspace.describe.clipboard');
    case 'set':
      return t('workspace.describe.set', { count: item.entries.length });
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
