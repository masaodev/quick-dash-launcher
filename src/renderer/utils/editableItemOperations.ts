/**
 * 管理画面「アイテム管理」の一覧（EditableJsonItem 配列）に対する純粋な操作
 *
 * 状態を持たないため、コンポーネントやフックから切り離してテストできる。
 */
import {
  isJsonLauncherItem,
  type DuplicateHandlingOption,
  type ScannedAppItem,
  type SimpleBookmarkItem,
} from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { validateEditableItem } from '@common/types/editableItem';
import { jsonItemToDisplayText } from '@common/utils/displayTextConverter';
import { generateId } from '@common/utils/jsonParser';
import {
  checkDuplicates,
  filterNonDuplicateBookmarks,
  buildUrlToIdMap,
  normalizeUrl,
} from '@common/utils/duplicateDetector';
import {
  checkAppDuplicates,
  filterNonDuplicateApps,
  buildAppPathToIdMap,
  normalizeAppPath,
} from '@common/utils/appDuplicateDetector';

/** 自動取込フィルタ: 全て / 自動取込のみ / 手動登録のみ / 特定ルール ID */
export type AutoImportFilter = 'all' | 'auto-import-only' | 'manual-only' | string;

/** EditableJsonItem の一意キー（選択状態・編集中の差分の管理に使う） */
export function getItemKey(item: EditableJsonItem): string {
  return `${item.meta.sourceFile}_${item.meta.lineNumber}`;
}

/** 同じファイル・同じ行のアイテムか */
function isSameRow(a: EditableJsonItem, b: EditableJsonItem): boolean {
  return a.meta.sourceFile === b.meta.sourceFile && a.meta.lineNumber === b.meta.lineNumber;
}

/** ファイルごとに行番号を 0 から振り直す */
export function reorderItemNumbers(items: EditableJsonItem[]): EditableJsonItem[] {
  const fileCounters = new Map<string, number>();

  return items.map((item) => {
    const counter = fileCounters.get(item.meta.sourceFile) ?? 0;
    fileCounters.set(item.meta.sourceFile, counter + 1);
    return {
      ...item,
      meta: { ...item.meta, lineNumber: counter },
    };
  });
}

/** JsonItem から、指定データファイルに置く EditableJsonItem を作る */
export function toEditableItem(
  jsonItem: EditableJsonItem['item'],
  sourceFile: string
): EditableJsonItem {
  const validation = validateEditableItem(jsonItem);
  return {
    item: jsonItem,
    displayText: jsonItemToDisplayText(jsonItem),
    meta: {
      sourceFile,
      lineNumber: 0,
      isValid: validation.isValid,
      validationError: validation.error,
    },
  };
}

/** 先頭に追加する空の新規アイテム */
export function createBlankItem(sourceFile: string): EditableJsonItem {
  return {
    item: {
      id: `temp-${Date.now()}`,
      type: 'item',
      displayName: '',
      path: '',
      updatedAt: Date.now(),
    },
    displayText: ',',
    meta: {
      sourceFile,
      lineNumber: 0,
      isValid: false,
      validationError: 'displayNameが空です',
    },
  };
}

/** 指定したアイテムを除き、行番号を振り直す */
export function removeItems(
  items: EditableJsonItem[],
  itemsToDelete: EditableJsonItem[]
): EditableJsonItem[] {
  return reorderItemNumbers(
    items.filter((item) => !itemsToDelete.some((target) => isSameRow(item, target)))
  );
}

/**
 * 指定したアイテムを新しい ID で複製し、対象のうち最後の行の直後に挿入する
 *
 * @returns 挿入位置が見つからなければ null
 */
export function duplicateItems(
  items: EditableJsonItem[],
  itemsToDuplicate: EditableJsonItem[]
): EditableJsonItem[] | null {
  // 行番号順に並べ、最後のアイテムの次を挿入位置にする
  const sorted = [...itemsToDuplicate].sort((a, b) => a.meta.lineNumber - b.meta.lineNumber);
  const lastItem = sorted[sorted.length - 1];
  const insertAfterIndex = items.findIndex((item) => isSameRow(item, lastItem));
  if (insertAfterIndex === -1) return null;

  const duplicated = sorted.map((item) => ({
    ...item,
    item: { ...item.item, id: generateId(), updatedAt: Date.now() },
    // 行番号は reorderItemNumbers で振り直す
    meta: { ...item.meta, lineNumber: -1 },
  }));

  return reorderItemNumbers([
    ...items.slice(0, insertAfterIndex + 1),
    ...duplicated,
    ...items.slice(insertAfterIndex + 1),
  ]);
}

/** 整列用: 種類の並び順 */
const TYPE_ORDER: Record<string, number> = {
  dir: 0,
  group: 1,
  window: 2,
  item: 3,
  clipboard: 4,
};

/** 整列用: パスと引数（フォルダはオプション）を並べた文字列 */
function getPathAndArgs(item: EditableJsonItem): string {
  const jsonItem = item.item;
  switch (jsonItem.type) {
    case 'item': {
      const argsPart = jsonItem.args || '';
      return argsPart ? `${jsonItem.path || ''} ${argsPart}` : jsonItem.path || '';
    }
    case 'dir': {
      const options = jsonItem.options
        ? Object.entries(jsonItem.options)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')
        : '';
      return options ? `${jsonItem.path || ''} ${options}` : jsonItem.path || '';
    }
    case 'group':
    case 'window':
      return jsonItem.displayName || '';
    default:
      return '';
  }
}

/**
 * 指定データファイルのアイテムだけを整列し、重複（種類と表示テキストが同じもの）を除く
 *
 * 他のデータファイルのアイテムは並びを変えずに前に置く。
 */
export function sortAndDedupeFileItems(
  items: EditableJsonItem[],
  sourceFile: string
): EditableJsonItem[] {
  const currentFileItems = items.filter((item) => item.meta.sourceFile === sourceFile);
  const otherFileItems = items.filter((item) => item.meta.sourceFile !== sourceFile);

  const sorted = [...currentFileItems].sort((a, b) => {
    const typeA = TYPE_ORDER[a.item.type] ?? 99;
    const typeB = TYPE_ORDER[b.item.type] ?? 99;
    if (typeA !== typeB) return typeA - typeB;

    const pathAndArgsA = getPathAndArgs(a).toLowerCase();
    const pathAndArgsB = getPathAndArgs(b).toLowerCase();
    if (pathAndArgsA !== pathAndArgsB) return pathAndArgsA.localeCompare(pathAndArgsB);

    const nameA = a.item.type === 'item' ? (a.item.displayName || '').toLowerCase() : '';
    const nameB = b.item.type === 'item' ? (b.item.displayName || '').toLowerCase() : '';
    return nameA.localeCompare(nameB);
  });

  const seen = new Set<string>();
  const deduplicated = sorted.filter((item) => {
    const key = `${item.item.type}:${item.displayText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...otherFileItems, ...deduplicated];
}

/**
 * 保存用のアイテム列を作る: 編集中の差分を反映し、必要なら整列・重複削除して行番号を振り直す
 */
export function buildItemsForSave(
  workingItems: EditableJsonItem[],
  editedItems: Map<string, EditableJsonItem>,
  options: { sortAndDedupe: boolean; sourceFile: string }
): EditableJsonItem[] {
  let updated = workingItems.map((item) => {
    const edited = editedItems.get(getItemKey(item));
    return edited ? { ...edited, item: { ...edited.item, updatedAt: Date.now() } } : item;
  });

  if (options.sortAndDedupe) {
    updated = sortAndDedupeFileItems(updated, options.sourceFile);
  }
  return reorderItemNumbers(updated);
}

/** 自動取込フィルタと検索語（空白区切りの AND）で、指定データファイルのアイテムを絞り込む */
export function filterEditableItems(
  items: EditableJsonItem[],
  criteria: { sourceFile: string; autoImportFilter: AutoImportFilter; searchQuery: string }
): EditableJsonItem[] {
  const keywords = criteria.searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  return items.filter((item) => {
    if (item.meta.sourceFile !== criteria.sourceFile) return false;

    if (criteria.autoImportFilter !== 'all') {
      const ruleId = isJsonLauncherItem(item.item) ? item.item.autoImportRuleId : undefined;
      if (criteria.autoImportFilter === 'auto-import-only') {
        if (!ruleId) return false;
      } else if (criteria.autoImportFilter === 'manual-only') {
        if (ruleId) return false;
      } else if (ruleId !== criteria.autoImportFilter) {
        // 特定ルールIDでフィルタ
        return false;
      }
    }

    const itemText = item.displayText.toLowerCase();
    return keywords.every((keyword) => itemText.includes(keyword));
  });
}

/**
 * 取り込んだアイテムを先頭に加える
 *
 * 上書き指定のときは重複していた既存アイテムを取り除く（取り込み側が既存の ID を引き継ぐ）。
 */
function mergeImported(
  items: EditableJsonItem[],
  newItems: EditableJsonItem[],
  duplicateHandling: DuplicateHandlingOption,
  duplicateExistingIds: string[]
): EditableJsonItem[] {
  const idsToRemove = new Set(duplicateHandling === 'overwrite' ? duplicateExistingIds : []);
  const remaining = items.filter((item) => !idsToRemove.has(item.item.id));
  return reorderItemNumbers([...newItems, ...remaining]);
}

/** ブックマークを指定データファイルへ取り込んだ結果のアイテム列 */
export function importBookmarks(
  items: EditableJsonItem[],
  bookmarks: SimpleBookmarkItem[],
  duplicateHandling: DuplicateHandlingOption,
  sourceFile: string
): EditableJsonItem[] {
  const currentFileItems = items.filter((item) => item.meta.sourceFile === sourceFile);
  const duplicateResult = checkDuplicates(bookmarks, currentFileItems);

  const bookmarksToImport =
    duplicateHandling === 'skip'
      ? filterNonDuplicateBookmarks(bookmarks, duplicateResult.duplicateBookmarkIds)
      : bookmarks;
  const urlToIdMap = duplicateHandling === 'overwrite' ? buildUrlToIdMap(currentFileItems) : null;

  const newItems = bookmarksToImport.map((bookmark) =>
    toEditableItem(
      {
        id: urlToIdMap?.get(normalizeUrl(bookmark.url)) ?? generateId(),
        type: 'item',
        displayName: bookmark.displayName,
        path: bookmark.url,
        updatedAt: Date.now(),
      },
      sourceFile
    )
  );

  return mergeImported(items, newItems, duplicateHandling, duplicateResult.duplicateExistingIds);
}

/** インストール済みアプリを指定データファイルへ取り込んだ結果のアイテム列 */
export function importApps(
  items: EditableJsonItem[],
  apps: ScannedAppItem[],
  duplicateHandling: DuplicateHandlingOption,
  sourceFile: string
): EditableJsonItem[] {
  const currentFileItems = items.filter((item) => item.meta.sourceFile === sourceFile);
  const duplicateResult = checkAppDuplicates(apps, currentFileItems);

  const appsToImport =
    duplicateHandling === 'skip'
      ? filterNonDuplicateApps(apps, duplicateResult.duplicateBookmarkIds)
      : apps;
  const pathToIdMap =
    duplicateHandling === 'overwrite' ? buildAppPathToIdMap(currentFileItems) : null;

  const newItems = appsToImport.map((app) => {
    // originalPath（ショートカットのリンク先）は JsonLauncherItem の型にはないが、
    // 既存アイテムとの重複判定（appDuplicateDetector）で使うため付けたまま渡す
    const jsonItem = {
      id:
        pathToIdMap?.get(normalizeAppPath(app.shortcutPath)) ??
        pathToIdMap?.get(normalizeAppPath(app.targetPath)) ??
        generateId(),
      type: 'item' as const,
      displayName: app.displayName,
      path: app.shortcutPath,
      originalPath: app.targetPath,
      args: app.args,
      updatedAt: Date.now(),
    };
    return toEditableItem(jsonItem, sourceFile);
  });

  return mergeImported(items, newItems, duplicateHandling, duplicateResult.duplicateExistingIds);
}
