/**
 * データ変換ユーティリティ
 */

import { DEFAULT_DATA_FILE } from '../types';
import type { DataFileTab, JsonDirOptions, JsonItem, ClipboardFormat } from '../types';
import type { RegisterItem, WindowOperationConfig } from '../types/register.js';
import type { SetEntry, SetLaunchMode } from '../types/launcher.js';
import type { EditingAppItem, EditingWindowItem } from '../types/editingItem.js';
import type { EditableJsonItem } from '../types/editableItem.js';
import {
  isEditingLauncherItem,
  isEditingWindowItem,
  isEditingClipboardItem,
  isEditingSetItem,
} from '../types/editingItem.js';
import {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonWindowItem,
  isJsonClipboardItem,
  isJsonSetItem,
  DIR_OPTIONS_DEFAULTS,
  type DirOptionsForProcessing,
  type JsonWindowItem,
} from '../types/json-data.js';

import { generateId } from './jsonParser.js';
import { normalizeWindowTitleForProcessOnly } from './windowTitle.js';
import { pickWindowPlacement } from './windowPlacement.js';
import { itemWindowSwitchFields, pickItemWindowSwitch } from './itemWindowConversion.js';

/** 展開したアイテムが持つ取込の設定を、編集フォームのフォルダ取込のオプションにする */
function toJsonDirOptions(options: DirOptionsForProcessing | undefined): JsonDirOptions {
  if (!options) {
    return { depth: DIR_OPTIONS_DEFAULTS.depth, types: DIR_OPTIONS_DEFAULTS.types };
  }
  const { depth, types, filter, exclude, prefix, suffix } = options;
  return {
    depth,
    types,
    ...(filter && { filter }),
    ...(exclude && { exclude }),
    ...(prefix && { prefix }),
    ...(suffix && { suffix }),
  };
}

/** 取り込み先のデータファイル（指定が無ければ最初のタブの最初のファイル） */
export function getDefaultTab(sourceFile: string | undefined, tabs: DataFileTab[]): string {
  return sourceFile || (tabs.length > 0 ? tabs[0].files[0] : DEFAULT_DATA_FILE);
}

/** EditingWindowItemまたはJsonWindowItemからWindowOperationConfigを作成する */
function createWindowOperationConfig(
  item: EditingWindowItem | JsonWindowItem
): WindowOperationConfig {
  return {
    displayName: item.displayName,
    windowTitle: item.windowTitle,
    ...pickWindowPlacement(item),
  };
}

/** RegisterItemの共通ベースを作成する */
function createBaseRegisterItem(
  displayName: string,
  targetTab: string,
  targetFile: string | undefined
): Pick<RegisterItem, 'displayName' | 'path' | 'type' | 'targetTab' | 'targetFile'> {
  return { displayName, path: '', type: 'app', targetTab, targetFile };
}

/** ウィンドウ操作用RegisterItemを作成する */
function createWindowRegisterItem(
  displayName: string,
  config: WindowOperationConfig,
  targetTab: string,
  targetFile: string | undefined,
  memo?: string
): RegisterItem {
  return {
    ...createBaseRegisterItem(displayName, targetTab, targetFile),
    itemCategory: 'window',
    windowOperationConfig: config,
    memo,
  };
}

/** セット用RegisterItemを作成する */
function createSetRegisterItem(
  displayName: string,
  entries: SetEntry[],
  launchMode: SetLaunchMode | undefined,
  targetTab: string,
  targetFile: string | undefined,
  memo?: string,
  customIcon?: string
): RegisterItem {
  return {
    ...createBaseRegisterItem(displayName, targetTab, targetFile),
    itemCategory: 'set',
    setEntries: entries.map((entry) => ({ ...entry })),
    setLaunchMode: launchMode,
    customIcon,
    memo,
  };
}

/** クリップボード用RegisterItemを作成する */
function createClipboardRegisterItem(
  displayName: string,
  targetTab: string,
  targetFile: string | undefined,
  clipboard: {
    dataRef?: string;
    formats?: ClipboardFormat[];
    savedAt?: number;
    preview?: string;
    customIcon?: string;
  },
  memo?: string
): RegisterItem {
  return {
    ...createBaseRegisterItem(displayName, targetTab, targetFile),
    type: 'clipboard',
    itemCategory: 'clipboard',
    clipboardDataRef: clipboard.dataRef,
    clipboardFormats: clipboard.formats,
    clipboardSavedAt: clipboard.savedAt,
    clipboardPreview: clipboard.preview,
    customIcon: clipboard.customIcon,
    memo,
  };
}

/**
 * EditingAppItemをRegisterItemに変換する
 */
export function convertEditingAppItemToRegisterItem(
  item: EditingAppItem,
  tabs: DataFileTab[]
): RegisterItem {
  const defaultTab = getDefaultTab(item.sourceFile, tabs);

  if (isEditingWindowItem(item)) {
    return createWindowRegisterItem(
      item.displayName,
      createWindowOperationConfig(item),
      defaultTab,
      item.sourceFile,
      item.memo
    );
  }

  if (isEditingClipboardItem(item)) {
    return createClipboardRegisterItem(
      item.displayName,
      defaultTab,
      item.sourceFile,
      {
        dataRef: item.clipboardDataRef,
        formats: item.formats,
        savedAt: item.savedAt,
        preview: item.preview,
        customIcon: item.customIcon,
      },
      item.memo
    );
  }

  if (isEditingSetItem(item)) {
    return createSetRegisterItem(
      item.displayName,
      item.entries,
      item.launchMode,
      defaultTab,
      item.sourceFile,
      item.memo,
      item.customIcon
    );
  }

  if (isEditingLauncherItem(item)) {
    if (item.isDirExpanded && item.expandedFrom) {
      return {
        displayName: item.expandedFrom,
        path: item.expandedFrom,
        type: 'folder',
        targetTab: defaultTab,
        targetFile: item.sourceFile,
        folderProcessing: 'expand',
        dirOptions: toJsonDirOptions(item.expandedOptions),
        itemCategory: 'dir',
      };
    }

    return {
      displayName: item.displayName,
      path: item.path,
      type: item.type,
      args: item.args || undefined,
      targetTab: defaultTab,
      targetFile: item.sourceFile,
      folderProcessing: item.type === 'folder' ? 'folder' : undefined,
      customIcon: item.customIcon,
      ...pickItemWindowSwitch(item),
      itemCategory: 'item',
      memo: item.memo,
    };
  }

  const _exhaustiveCheck: never = item;
  throw new Error(`Unexpected item type: ${_exhaustiveCheck}`);
}

/**
 * EditableJsonItemをRegisterItemに変換する
 */
export function convertEditableJsonItemToRegisterItem(
  editableItem: EditableJsonItem,
  tabs: DataFileTab[]
): RegisterItem {
  const jsonItem = editableItem.item;
  const sourceFile = editableItem.meta.sourceFile;
  const defaultTab = getDefaultTab(sourceFile, tabs);

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
      // メモを渡さないと、詳細編集で更新したときに元のメモが消える
      memo: jsonItem.memo,
    };
  }

  if (isJsonWindowItem(jsonItem)) {
    return createWindowRegisterItem(
      jsonItem.displayName,
      createWindowOperationConfig(jsonItem),
      defaultTab,
      sourceFile,
      jsonItem.memo
    );
  }

  if (isJsonSetItem(jsonItem)) {
    return createSetRegisterItem(
      jsonItem.displayName,
      jsonItem.entries,
      jsonItem.launchMode,
      defaultTab,
      sourceFile,
      jsonItem.memo,
      jsonItem.customIcon
    );
  }

  if (isJsonLauncherItem(jsonItem)) {
    return {
      displayName: jsonItem.displayName,
      path: jsonItem.path,
      type: 'app' as const,
      args: jsonItem.args || undefined,
      targetTab: defaultTab,
      targetFile: sourceFile,
      folderProcessing: undefined,
      customIcon: jsonItem.customIcon,
      ...pickItemWindowSwitch(jsonItem),
      itemCategory: 'item' as const,
      memo: jsonItem.memo,
    };
  }

  if (isJsonClipboardItem(jsonItem)) {
    return createClipboardRegisterItem(
      jsonItem.displayName,
      defaultTab,
      sourceFile,
      {
        dataRef: jsonItem.dataFileRef,
        formats: jsonItem.formats,
        savedAt: jsonItem.savedAt,
        preview: jsonItem.preview,
        customIcon: jsonItem.customIcon,
      },
      jsonItem.memo
    );
  }

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
 * 登録フロー（メインプロセス）と編集フロー（レンダラー）の両方から使う唯一の変換関数。
 * かつてmain側に別実装が存在しID採番やdirオプションの扱いが食い違っていたため、
 * 変換仕様の変更は必ずこの関数に対して行うこと。
 *
 * @param registerItem - 変換元のRegisterItem
 * @param existingId - 既存アイテムの編集時にIDを引き継ぐ場合に指定
 */
export function convertRegisterItemToJsonItem(
  registerItem: RegisterItem,
  existingId?: string
): JsonItem {
  const id = existingId ?? generateId();
  const memo = registerItem.memo;
  const now = Date.now();

  if (registerItem.itemCategory === 'dir') {
    // 既定値(depth:0, types:'both')や空オプションは保存しない
    const options: JsonDirOptions = {};
    const dirOptions = registerItem.dirOptions;
    if (dirOptions) {
      if (dirOptions.depth !== undefined && dirOptions.depth !== DIR_OPTIONS_DEFAULTS.depth) {
        options.depth = dirOptions.depth;
      }
      if (dirOptions.types && dirOptions.types !== DIR_OPTIONS_DEFAULTS.types) {
        options.types = dirOptions.types;
      }
      if (dirOptions.filter) options.filter = dirOptions.filter;
      if (dirOptions.exclude) options.exclude = dirOptions.exclude;
      if (dirOptions.prefix) options.prefix = dirOptions.prefix;
      if (dirOptions.suffix) options.suffix = dirOptions.suffix;
    }

    return {
      id,
      type: 'dir',
      path: registerItem.path,
      options: Object.keys(options).length > 0 ? options : undefined,
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

  if (registerItem.itemCategory === 'window') {
    const config = registerItem.windowOperationConfig;
    if (!config) {
      throw new Error('windowOperationConfig is required for window items');
    }
    return {
      id,
      type: 'window',
      displayName: config.displayName || registerItem.displayName,
      windowTitle:
        normalizeWindowTitleForProcessOnly(config.windowTitle, config.processName) ??
        config.windowTitle,
      ...pickWindowPlacement(config),
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

  if (registerItem.itemCategory === 'clipboard') {
    if (!registerItem.clipboardDataRef) {
      throw new Error('clipboardDataRef is required for clipboard items');
    }
    return {
      id,
      type: 'clipboard',
      displayName: registerItem.displayName,
      dataFileRef: registerItem.clipboardDataRef,
      savedAt: registerItem.clipboardSavedAt || now,
      formats: registerItem.clipboardFormats || [],
      preview: registerItem.clipboardPreview,
      ...(registerItem.customIcon && { customIcon: registerItem.customIcon }),
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

  if (registerItem.itemCategory === 'set') {
    return {
      id,
      type: 'set' as const,
      displayName: registerItem.displayName,
      entries: (registerItem.setEntries || []).map((entry) => ({ ...entry })),
      ...(registerItem.setLaunchMode && { launchMode: registerItem.setLaunchMode }),
      ...(registerItem.customIcon && { customIcon: registerItem.customIcon }),
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

  return {
    id,
    type: 'item',
    displayName: registerItem.displayName,
    path: registerItem.path,
    ...(registerItem.args && { args: registerItem.args }),
    ...(registerItem.customIcon && { customIcon: registerItem.customIcon }),
    ...itemWindowSwitchFields(registerItem),
    ...(memo && { memo }),
    updatedAt: now,
  };
}
