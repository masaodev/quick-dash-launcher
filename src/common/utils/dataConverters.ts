/**
 * データ変換ユーティリティ
 */

import { DEFAULT_DATA_FILE } from '../types';
import type {
  LauncherItem,
  DataFileTab,
  JsonDirOptions,
  JsonItem,
  ClipboardFormat,
} from '../types';
import type { RegisterItem, WindowOperationConfig } from '../types/register.js';
import type { EditingAppItem, EditingWindowItem } from '../types/editingItem.js';
import type { EditableJsonItem } from '../types/editableItem.js';
import {
  isEditingLauncherItem,
  isEditingGroupItem,
  isEditingWindowItem,
  isEditingClipboardItem,
} from '../types/editingItem.js';
import {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
  isJsonClipboardItem,
  DIR_OPTIONS_DEFAULTS,
  type JsonWindowItem,
} from '../types/json-data.js';

/** 深さ値のマッピング */
const DEPTH_MAP: Record<string, number> = { 無制限: -1 };

/** タイプ値のマッピング */
const TYPES_MAP: Record<string, 'file' | 'folder' | 'both'> = {
  ファイルのみ: 'file',
  フォルダのみ: 'folder',
  ファイルとフォルダ: 'both',
};

/** オプションキーと処理のマッピング */
const OPTION_PARSERS: {
  prefix: string;
  handler: (value: string, options: JsonDirOptions) => void;
}[] = [
  {
    prefix: '深さ:',
    handler: (value, options) => {
      options.depth = DEPTH_MAP[value] ?? (parseInt(value, 10) || 0);
    },
  },
  {
    prefix: 'タイプ:',
    handler: (value, options) => {
      if (TYPES_MAP[value]) options.types = TYPES_MAP[value];
    },
  },
  {
    prefix: 'フィルター:',
    handler: (value, options) => {
      options.filter = value;
    },
  },
  {
    prefix: '除外:',
    handler: (value, options) => {
      options.exclude = value;
    },
  },
  {
    prefix: '接頭辞:',
    handler: (value, options) => {
      options.prefix = value;
    },
  },
  {
    prefix: '接尾辞:',
    handler: (value, options) => {
      options.suffix = value;
    },
  },
];

/**
 * expandedOptionsの文字列をJsonDirOptionsに変換する
 */
function parseExpandedOptionsToJsonDirOptions(optionsStr: string | undefined): JsonDirOptions {
  const dirOptions: JsonDirOptions = {
    depth: DIR_OPTIONS_DEFAULTS.depth,
    types: DIR_OPTIONS_DEFAULTS.types,
  };

  if (!optionsStr) return dirOptions;

  for (const option of optionsStr.split(',')) {
    const trimmed = option.trim();
    for (const parser of OPTION_PARSERS) {
      if (trimmed.startsWith(parser.prefix)) {
        parser.handler(trimmed.substring(parser.prefix.length).trim(), dirOptions);
        break;
      }
    }
  }

  return dirOptions;
}

/** デフォルトのタブを取得する */
function getDefaultTab(sourceFile: string | undefined, tabs: DataFileTab[]): string {
  return sourceFile || (tabs.length > 0 ? tabs[0].files[0] : DEFAULT_DATA_FILE);
}

/** EditingWindowItemまたはJsonWindowItemからWindowOperationConfigを作成する */
function createWindowOperationConfig(
  item: EditingWindowItem | JsonWindowItem
): WindowOperationConfig {
  return {
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
}

/** RegisterItemの共通ベースを作成する */
function createBaseRegisterItem(
  displayName: string,
  targetTab: string,
  targetFile: string | undefined
): Pick<RegisterItem, 'displayName' | 'path' | 'type' | 'targetTab' | 'targetFile'> {
  return { displayName, path: '', type: 'app', targetTab, targetFile };
}

/** グループ用RegisterItemを作成する */
function createGroupRegisterItem(
  displayName: string,
  itemNames: string[],
  targetTab: string,
  targetFile: string | undefined,
  memo?: string
): RegisterItem {
  return {
    ...createBaseRegisterItem(displayName, targetTab, targetFile),
    itemCategory: 'group',
    groupItemNames: [...itemNames],
    memo,
  };
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

  if (isEditingGroupItem(item)) {
    return createGroupRegisterItem(
      item.displayName,
      item.itemNames,
      defaultTab,
      item.sourceFile,
      item.memo
    );
  }

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

  if (isEditingLauncherItem(item)) {
    if (item.isDirExpanded && item.expandedFrom) {
      return {
        displayName: item.expandedFrom,
        path: item.expandedFrom,
        type: 'folder',
        targetTab: defaultTab,
        targetFile: item.sourceFile,
        folderProcessing: 'expand',
        dirOptions: parseExpandedOptionsToJsonDirOptions(item.expandedOptions),
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
      windowConfig: item.windowConfig,
      itemCategory: 'item',
      memo: item.memo,
    };
  }

  const _exhaustiveCheck: never = item;
  throw new Error(`Unexpected item type: ${_exhaustiveCheck}`);
}

/**
 * AppItemからEditingAppItemを作成する
 */
export function createEditingAppItem(
  item: LauncherItem & { sourceFile?: string; lineNumber?: number }
): EditingAppItem {
  return {
    ...item,
    sourceFile: item.sourceFile || DEFAULT_DATA_FILE,
    lineNumber: item.lineNumber || 1,
  } as EditingAppItem;
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
    };
  }

  if (isJsonGroupItem(jsonItem)) {
    return createGroupRegisterItem(
      jsonItem.displayName,
      jsonItem.itemNames,
      defaultTab,
      sourceFile,
      jsonItem.memo
    );
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
      windowConfig: jsonItem.windowConfig,
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
 */
export function convertRegisterItemToJsonItem(
  registerItem: RegisterItem,
  existingId?: string
): JsonItem {
  const id = existingId || `temp-${Date.now()}`;
  const memo = registerItem.memo;
  const now = Date.now();

  if (registerItem.itemCategory === 'dir') {
    return {
      id,
      type: 'dir',
      path: registerItem.path,
      options: registerItem.dirOptions,
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

  if (registerItem.itemCategory === 'group') {
    return {
      id,
      type: 'group',
      displayName: registerItem.displayName,
      itemNames: registerItem.groupItemNames || [],
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

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
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

  if (registerItem.itemCategory === 'clipboard') {
    return {
      id,
      type: 'clipboard',
      displayName: registerItem.displayName,
      dataFileRef: registerItem.clipboardDataRef || '',
      savedAt: registerItem.clipboardSavedAt || now,
      formats: registerItem.clipboardFormats || [],
      preview: registerItem.clipboardPreview,
      customIcon: registerItem.customIcon,
      ...(memo && { memo }),
      updatedAt: now,
    };
  }

  return {
    id,
    type: 'item',
    displayName: registerItem.displayName,
    path: registerItem.path,
    args: registerItem.args,
    customIcon: registerItem.customIcon,
    windowConfig: registerItem.windowConfig,
    ...(memo && { memo }),
    updatedAt: now,
  };
}
