/**
 * データ変換ユーティリティ
 *
 * EditingAppItem（編集画面用）からRegisterItem（登録画面用）への変換ロジックを提供します。
 */

import type { LauncherItem, DataFileTab, JsonDirOptions, JsonItem } from '../types';
import type { RegisterItem } from '../types/register.js';
import type { EditingAppItem } from '../types/editingItem.js';
import type { EditableJsonItem } from '../types/editableItem.js';
import {
  isEditingLauncherItem,
  isEditingGroupItem,
  isEditingWindowItem,
} from '../types/editingItem.js';
import {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
  DIR_OPTIONS_DEFAULTS,
} from '../types/json-data.js';

/**
 * expandedOptionsの文字列をJsonDirOptionsに変換する
 *
 * 日本語形式（"深さ:0, タイプ:ファイルとフォルダ, 接頭辞:ソフト："）のみをサポート
 *
 * @param optionsStr - カンマ区切りのオプション文字列
 * @returns JsonDirOptionsオブジェクト
 */
function parseExpandedOptionsToJsonDirOptions(optionsStr: string | undefined): JsonDirOptions {
  const dirOptions: JsonDirOptions = {
    depth: DIR_OPTIONS_DEFAULTS.depth,
    types: DIR_OPTIONS_DEFAULTS.types,
  };

  if (!optionsStr) {
    return dirOptions;
  }

  for (const option of optionsStr.split(',')) {
    const trimmed = option.trim();

    if (trimmed.startsWith('深さ:')) {
      const value = trimmed.substring(3).trim();
      if (value === '無制限') {
        dirOptions.depth = -1;
      } else {
        dirOptions.depth = parseInt(value, 10) || 0;
      }
      continue;
    }

    if (trimmed.startsWith('タイプ:')) {
      const value = trimmed.substring(4).trim();
      if (value === 'ファイルのみ') {
        dirOptions.types = 'file';
      } else if (value === 'フォルダのみ') {
        dirOptions.types = 'folder';
      } else if (value === 'ファイルとフォルダ') {
        dirOptions.types = 'both';
      }
      continue;
    }

    if (trimmed.startsWith('フィルター:')) {
      dirOptions.filter = trimmed.substring(6).trim();
      continue;
    }

    if (trimmed.startsWith('除外:')) {
      dirOptions.exclude = trimmed.substring(3).trim();
      continue;
    }

    if (trimmed.startsWith('接頭辞:')) {
      dirOptions.prefix = trimmed.substring(4).trim();
      continue;
    }

    if (trimmed.startsWith('接尾辞:')) {
      dirOptions.suffix = trimmed.substring(4).trim();
      continue;
    }
  }

  return dirOptions;
}

/**
 * EditingAppItemをRegisterItemに変換する
 *
 * AppItem（LauncherItem/GroupItem/WindowOperationItem）から
 * RegisterModal用のRegisterItem形式に直接変換します。
 * CSV形式の中間変換を経由しません。
 *
 * @param item - 変換元のEditingAppItem
 * @param tabs - 利用可能なデータファイルタブのリスト
 * @returns 変換されたRegisterItem
 */
export function convertEditingAppItemToRegisterItem(
  item: EditingAppItem,
  tabs: DataFileTab[]
): RegisterItem {
  const defaultTab = item.sourceFile || (tabs.length > 0 ? tabs[0].files[0] : 'data.json');

  // GroupItemの場合
  if (isEditingGroupItem(item)) {
    return {
      displayName: item.displayName,
      path: '',
      type: 'app',
      targetTab: defaultTab,
      targetFile: item.sourceFile,
      itemCategory: 'group',
      groupItemNames: [...item.itemNames],
    };
  }

  // WindowItemの場合
  if (isEditingWindowItem(item)) {
    return {
      displayName: item.displayName,
      path: '',
      type: 'app',
      targetTab: defaultTab,
      targetFile: item.sourceFile,
      itemCategory: 'window',
      windowOperationConfig: {
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
      },
    };
  }

  // LauncherItemの場合
  if (isEditingLauncherItem(item)) {
    // フォルダ取込から展開されたアイテムの場合
    if (item.isDirExpanded && item.expandedFrom) {
      const dirOptions = parseExpandedOptionsToJsonDirOptions(item.expandedOptions);

      return {
        displayName: item.expandedFrom,
        path: item.expandedFrom,
        type: 'folder',
        targetTab: defaultTab,
        targetFile: item.sourceFile,
        folderProcessing: 'expand',
        dirOptions,
        itemCategory: 'dir',
      };
    }

    // 通常のLauncherItem
    return {
      displayName: item.displayName,
      path: item.path,
      type: item.type,
      args: item.args || undefined,
      targetTab: defaultTab,
      targetFile: item.sourceFile,
      folderProcessing: item.type === 'folder' ? 'folder' : undefined,
      customIcon: item.customIcon,
      windowConfig: item.windowConfig,
      itemCategory: 'item',
    };
  }

  // フォールバック（通常は到達しないが、型安全性のために必要）
  // isEditingLauncherItemで全てのEditingAppItemをカバーしているため、
  // このコードは実行されないが、TypeScriptの網羅性チェックのために残す
  const _exhaustiveCheck: never = item;
  throw new Error(`Unexpected item type: ${_exhaustiveCheck}`);
}

/**
 * AppItemからEditingAppItemを作成する
 *
 * 既存のLauncherItem/GroupItem/WindowOperationItemに
 * 編集に必要なメタデータを付加してEditingAppItemを作成します。
 *
 * @param item - 元のAppItem（LauncherItem/GroupItem/WindowOperationItem）
 * @returns EditingAppItem
 */
export function createEditingAppItem(
  item: LauncherItem & { sourceFile?: string; lineNumber?: number }
): EditingAppItem {
  return {
    ...item,
    sourceFile: item.sourceFile || 'data.json',
    lineNumber: item.lineNumber || 1,
  } as EditingAppItem;
}

/**
 * EditableJsonItemをRegisterItemに変換する
 *
 * アイテム管理画面で使用されるEditableJsonItemを
 * RegisterModal用のRegisterItem形式に変換します。
 *
 * @param editableItem - 変換元のEditableJsonItem
 * @param tabs - 利用可能なデータファイルタブのリスト
 * @returns 変換されたRegisterItem
 */
export function convertEditableJsonItemToRegisterItem(
  editableItem: EditableJsonItem,
  tabs: DataFileTab[]
): RegisterItem {
  const jsonItem = editableItem.item;
  const sourceFile = editableItem.meta.sourceFile;
  const defaultTab = sourceFile || (tabs.length > 0 ? tabs[0].files[0] : 'data.json');

  // フォルダ取込アイテム
  if (isJsonDirItem(jsonItem)) {
    return {
      displayName: jsonItem.path,
      path: jsonItem.path,
      type: 'folder',
      targetTab: defaultTab,
      targetFile: sourceFile,
      folderProcessing: 'expand',
      dirOptions: jsonItem.options || {
        depth: DIR_OPTIONS_DEFAULTS.depth,
        types: DIR_OPTIONS_DEFAULTS.types,
      },
      itemCategory: 'dir',
    };
  }

  // グループアイテム
  if (isJsonGroupItem(jsonItem)) {
    return {
      displayName: jsonItem.displayName,
      path: '',
      type: 'app',
      targetTab: defaultTab,
      targetFile: sourceFile,
      itemCategory: 'group',
      groupItemNames: [...jsonItem.itemNames],
    };
  }

  // ウィンドウ操作アイテム
  if (isJsonWindowItem(jsonItem)) {
    return {
      displayName: jsonItem.displayName,
      path: '',
      type: 'app',
      targetTab: defaultTab,
      targetFile: sourceFile,
      itemCategory: 'window',
      windowOperationConfig: {
        displayName: jsonItem.displayName,
        windowTitle: jsonItem.windowTitle,
        processName: jsonItem.processName,
        x: jsonItem.x,
        y: jsonItem.y,
        width: jsonItem.width,
        height: jsonItem.height,
        moveToActiveMonitorCenter: jsonItem.moveToActiveMonitorCenter,
        virtualDesktopNumber: jsonItem.virtualDesktopNumber,
        activateWindow: jsonItem.activateWindow,
        pinToAllDesktops: jsonItem.pinToAllDesktops,
      },
    };
  }

  // 通常のLauncherItem
  if (isJsonLauncherItem(jsonItem)) {
    return {
      displayName: jsonItem.displayName,
      path: jsonItem.path,
      type: 'app', // 型検出は後でRegisterModal側で行われる
      args: jsonItem.args || undefined,
      targetTab: defaultTab,
      targetFile: sourceFile,
      folderProcessing: undefined,
      customIcon: jsonItem.customIcon,
      windowConfig: jsonItem.windowConfig,
      itemCategory: 'item',
    };
  }

  // フォールバック
  return {
    displayName: '',
    path: '',
    type: 'file',
    targetTab: defaultTab,
    targetFile: sourceFile,
    itemCategory: 'item',
  };
}

/**
 * RegisterItemをJsonItemに変換する
 *
 * RegisterModal用のRegisterItem形式をJSON保存用のJsonItem形式に変換します。
 * itemCategoryに基づいて適切なJsonItem型（JsonLauncherItem/JsonDirItem/JsonGroupItem/JsonWindowItem）を生成します。
 *
 * @param registerItem - 変換元のRegisterItem
 * @param existingId - 既存のID（編集時に使用、未指定時は新規生成）
 * @returns 変換されたJsonItem
 */
export function convertRegisterItemToJsonItem(
  registerItem: RegisterItem,
  existingId?: string
): JsonItem {
  const id = existingId || `temp-${Date.now()}`;

  // フォルダ取込アイテム
  if (registerItem.itemCategory === 'dir') {
    return {
      id,
      type: 'dir',
      path: registerItem.path,
      options: registerItem.dirOptions,
    };
  }

  // グループアイテム
  if (registerItem.itemCategory === 'group') {
    return {
      id,
      type: 'group',
      displayName: registerItem.displayName,
      itemNames: registerItem.groupItemNames || [],
    };
  }

  // ウィンドウ操作アイテム
  if (registerItem.itemCategory === 'window') {
    const config = registerItem.windowOperationConfig;
    return {
      id,
      type: 'window',
      displayName: config?.displayName || registerItem.displayName,
      windowTitle: config?.windowTitle || '',
      processName: config?.processName,
      x: config?.x,
      y: config?.y,
      width: config?.width,
      height: config?.height,
      moveToActiveMonitorCenter: config?.moveToActiveMonitorCenter,
      virtualDesktopNumber: config?.virtualDesktopNumber,
      activateWindow: config?.activateWindow,
      pinToAllDesktops: config?.pinToAllDesktops,
    };
  }

  // 通常のLauncherItem
  return {
    id,
    type: 'item',
    displayName: registerItem.displayName,
    path: registerItem.path,
    args: registerItem.args,
    customIcon: registerItem.customIcon,
    windowConfig: registerItem.windowConfig,
  };
}
