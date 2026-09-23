import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import {
  LauncherItem,
  AppItem,
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
  isJsonClipboardItem,
  isJsonLayoutItem,
} from '@common/types';
import type { JsonItem } from '@common/types';

import { processDirectoryItem, processShortcut } from '../../ipc/directoryScanner.js';
import { resolveLayoutEntryIcons } from '../../utils/layoutIconResolver.js';

/**
 * JsonItemをAppItem（複数の場合あり）に変換
 */
export async function convertJsonItemToAppItems(
  jsonItem: JsonItem,
  sourceFile: string,
  itemIndex: number,
  seenPaths: Set<string>,
  tabIndex: number
): Promise<AppItem[]> {
  const items: AppItem[] = [];
  const lineNumber = itemIndex + 1;

  /**
   * 重複チェックを行い、重複でなければアイテムを追加する
   */
  function addIfUnique(item: LauncherItem): boolean {
    const uniqueKey = item.args
      ? `${item.displayName}|${item.path}|${item.args}`
      : `${item.displayName}|${item.path}`;

    if (seenPaths.has(uniqueKey)) {
      dataLogger.debug(
        { tabIndex, sourceFile, itemName: item.displayName, uniqueKey },
        'タブ内で重複するアイテムをスキップ'
      );
      return false;
    }

    seenPaths.add(uniqueKey);
    items.push(item);
    return true;
  }

  if (isJsonLauncherItem(jsonItem)) {
    // .lnkファイルの場合は特別処理
    if (jsonItem.path.toLowerCase().endsWith('.lnk') && FileUtils.exists(jsonItem.path)) {
      const lnkItem = processShortcut(jsonItem.path, sourceFile, lineNumber, jsonItem.displayName);
      if (lnkItem) {
        addIfUnique(lnkItem);
        return items;
      }
    }

    const item: LauncherItem = {
      displayName: jsonItem.displayName,
      path: jsonItem.path,
      type: detectItemTypeSync(jsonItem.path),
      args: jsonItem.args,
      customIcon: jsonItem.customIcon,
      windowConfig: jsonItem.windowConfig,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isDirExpanded: false,
      isEdited: false,
      memo: jsonItem.memo,
      autoImportRuleId: jsonItem.autoImportRuleId,
    };
    addIfUnique(item);
  } else if (isJsonDirItem(jsonItem)) {
    const scannedItems = await processDirectoryItem(
      jsonItem.path,
      jsonItem.options,
      sourceFile,
      lineNumber,
      jsonItem.id
    );

    for (const scannedItem of scannedItems) {
      addIfUnique(scannedItem);
    }
  } else if (isJsonGroupItem(jsonItem)) {
    items.push({
      displayName: jsonItem.displayName,
      type: 'group',
      itemNames: jsonItem.itemNames,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isEdited: false,
      memo: jsonItem.memo,
    });
  } else if (isJsonWindowItem(jsonItem)) {
    items.push({
      type: 'window',
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
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isEdited: false,
      memo: jsonItem.memo,
    });
  } else if (isJsonClipboardItem(jsonItem)) {
    items.push({
      type: 'clipboard',
      displayName: jsonItem.displayName,
      clipboardDataRef: jsonItem.dataFileRef,
      savedAt: jsonItem.savedAt,
      preview: jsonItem.preview,
      formats: jsonItem.formats,
      customIcon: jsonItem.customIcon,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isEdited: false,
      memo: jsonItem.memo,
    });
  } else if (isJsonLayoutItem(jsonItem)) {
    // executablePathからアイコンを復元（既存キャッシュ機構を利用）
    const icons = await resolveLayoutEntryIcons(jsonItem.entries);
    const entriesWithIcons = jsonItem.entries.map((entry) => {
      const icon = entry.executablePath ? icons.get(entry.executablePath) : undefined;
      return icon ? { ...entry, icon } : entry;
    });
    items.push({
      type: 'layout',
      displayName: jsonItem.displayName,
      entries: entriesWithIcons,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isEdited: false,
      memo: jsonItem.memo,
      customIcon: jsonItem.customIcon,
    });
  }

  return items;
}
