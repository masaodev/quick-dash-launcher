import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import {
  LauncherItem,
  AppItem,
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonClipboardItem,
  isJsonSetItem,
  isJsonWsGroupItem,
} from '@common/types';
import type { JsonItem } from '@common/types';
import { isPathlessItem, pickItemWindowSwitch } from '@common/utils/itemWindowConversion';
import { pickRunAsAdmin } from '@common/utils/runAsAdmin';
import {
  expandWsGroupItem,
  listWsGroupCandidates,
  type WsGroupCandidate,
} from '@common/utils/wsGroupExpansion';

import { refineItemType } from '../../utils/folderPathProbe.js';

import { processDirectoryItem, processShortcut } from './directoryScanner.js';

/**
 * WSグループで選べるグループを読む
 * WorkspaceService は WSグループの行があるときだけ読み込む（データファイルの読み込みのたびに起こさない）
 */
async function loadWsGroupCandidates(): Promise<WsGroupCandidate[]> {
  const { WorkspaceService } = await import('../workspace/WorkspaceService.js');
  const service = await WorkspaceService.getInstance();
  return listWsGroupCandidates(await service.loadWorkspaces(), await service.loadGroups());
}

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
    // パスの無い単一アイテムはパスが空なので、対象ウィンドウで見分ける（表示名だけで重複扱いにしない）
    const target = isPathlessItem(item)
      ? `window:${item.window?.processName ?? ''}|${item.window?.title ?? ''}`
      : item.path;
    const uniqueKey = item.args
      ? `${item.displayName}|${target}|${item.args}`
      : `${item.displayName}|${target}`;

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
        // リンク先・引数はショートカットから読み、それ以外の登録内容はデータファイルのものを使う
        addIfUnique({
          ...lnkItem,
          id: jsonItem.id,
          customIcon: jsonItem.customIcon,
          ...pickRunAsAdmin(jsonItem),
          ...pickItemWindowSwitch(jsonItem),
          memo: jsonItem.memo,
          autoImportRuleId: jsonItem.autoImportRuleId,
        });
        return items;
      }
    }

    const item: LauncherItem = {
      displayName: jsonItem.displayName,
      path: jsonItem.path,
      type: await refineItemType(jsonItem.path, detectItemTypeSync(jsonItem.path)),
      args: jsonItem.args,
      customIcon: jsonItem.customIcon,
      ...pickRunAsAdmin(jsonItem),
      ...pickItemWindowSwitch(jsonItem),
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
  } else if (isJsonWsGroupItem(jsonItem)) {
    // グループは重複を除かない（同じグループを 2 回並べる指定は、そのとおり 2 回並べる）
    items.push(
      ...expandWsGroupItem(jsonItem, await loadWsGroupCandidates(), sourceFile, lineNumber)
    );
  } else if (isJsonSetItem(jsonItem)) {
    items.push({
      type: 'set',
      displayName: jsonItem.displayName,
      entries: jsonItem.entries,
      launchMode: jsonItem.launchMode,
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
