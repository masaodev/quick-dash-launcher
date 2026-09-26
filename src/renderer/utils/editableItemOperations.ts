/**
 * 管理画面「アイテム管理」の一覧（EditableJsonItem 配列）に対する純粋な操作
 *
 * 状態を持たないため、コンポーネントやフックから切り離してテストできる。
 * アイテムの同一性は item.id で判定する（行番号は表示用で、操作のたびに振り直す）。
 */
import {
  isJsonLauncherItem,
  type DuplicateHandlingOption,
  type JsonItem,
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

/** EditableJsonItem の一意キー（選択状態・変更差分の管理に使う）＝ item.id */
export function getItemKey(item: EditableJsonItem): string {
  return item.item.id;
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
export function toEditableItem(jsonItem: JsonItem, sourceFile: string): EditableJsonItem {
  const validation = validateEditableItem(jsonItem);
  return {
    item: jsonItem,
    displayText: safeDisplayText(jsonItem),
    meta: {
      sourceFile,
      lineNumber: 0,
      isValid: validation.isValid,
      validationError: validation.error,
    },
  };
}

/**
 * JsonItem の内容を差し替え、表示テキストと検証結果を作り直す
 *
 * セル編集・詳細編集の結果は必ずここを通す（古い displayText が検索や重複判定に残らないように）。
 */
export function refreshEditableItem(
  item: EditableJsonItem,
  jsonItem: JsonItem,
  sourceFile: string = item.meta.sourceFile
): EditableJsonItem {
  const validation = validateEditableItem(jsonItem);
  return {
    item: jsonItem,
    displayText: safeDisplayText(jsonItem),
    meta: {
      ...item.meta,
      sourceFile,
      isValid: validation.isValid,
      validationError: validation.error,
    },
  };
}

function safeDisplayText(jsonItem: JsonItem): string {
  try {
    return jsonItemToDisplayText(jsonItem);
  } catch {
    return JSON.stringify(jsonItem);
  }
}

/** 先頭に追加する空の新規アイテム（id はこの時点で本採番する） */
export function createBlankItem(sourceFile: string): EditableJsonItem {
  return toEditableItem(
    {
      id: generateId(),
      type: 'item',
      displayName: '',
      path: '',
      updatedAt: Date.now(),
    },
    sourceFile
  );
}

/** 指定 id のアイテムを除き、行番号を振り直す */
export function removeItems(items: EditableJsonItem[], ids: Iterable<string>): EditableJsonItem[] {
  const idSet = new Set(ids);
  return reorderItemNumbers(items.filter((item) => !idSet.has(item.item.id)));
}

/** 指定 id のアイテムを差し替える（表示テキスト・検証は作り直し済みのものを渡す） */
export function replaceItem(
  items: EditableJsonItem[],
  updated: EditableJsonItem
): EditableJsonItem[] {
  return items.map((item) => (item.item.id === updated.item.id ? updated : item));
}

/**
 * 指定したアイテムを新しい ID で複製し、対象のうち最後のアイテムの直後に挿入する
 *
 * @returns 対象が一覧に無ければ null
 */
export function duplicateItems(
  items: EditableJsonItem[],
  ids: Iterable<string>
): EditableJsonItem[] | null {
  const idSet = new Set(ids);
  const targets = items.filter((item) => idSet.has(item.item.id));
  if (targets.length === 0) return null;

  const lastTarget = targets[targets.length - 1];
  const insertAfterIndex = items.findIndex((item) => item.item.id === lastTarget.item.id);

  const duplicated = targets.map((item) =>
    refreshEditableItem(item, { ...item.item, id: generateId(), updatedAt: Date.now() })
  );

  return reorderItemNumbers([
    ...items.slice(0, insertAfterIndex + 1),
    ...duplicated,
    ...items.slice(insertAfterIndex + 1),
  ]);
}

/** 重複判定のキー: 種類と表示テキストが同じものを重複とみなす */
function duplicateKey(item: EditableJsonItem): string {
  return `${item.item.type}:${item.displayText}`;
}

/**
 * 指定データファイル内の重複アイテムの id（ファイル順で 2 件目以降）を返す
 */
export function findDuplicateIds(items: EditableJsonItem[], sourceFile: string): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of items) {
    if (item.meta.sourceFile !== sourceFile) continue;
    const key = duplicateKey(item);
    if (seen.has(key)) {
      duplicates.push(item.item.id);
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

/** 指定データファイル内の重複を除く（他のファイルは触らない） */
export function dedupeFileItems(
  items: EditableJsonItem[],
  sourceFile: string
): { items: EditableJsonItem[]; removed: number } {
  const duplicateIds = findDuplicateIds(items, sourceFile);
  if (duplicateIds.length === 0) return { items, removed: 0 };
  return { items: removeItems(items, duplicateIds), removed: duplicateIds.length };
}

/** キー順に依存しない JSON 文字列（内容の比較用） */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** 内容が同じか（updatedAt と行番号は無視。置き場のファイルは比較に含める） */
export function isSameContent(a: EditableJsonItem, b: EditableJsonItem): boolean {
  if (a.meta.sourceFile !== b.meta.sourceFile) return false;
  const { updatedAt: _a, ...itemA } = a.item;
  const { updatedAt: _b, ...itemB } = b.item;
  return stableStringify(itemA) === stableStringify(itemB);
}

export interface ItemsDiff {
  /** 内容が変わった、または新しく追加された id */
  changedIds: Set<string>;
  /** 削除された id */
  deletedIds: Set<string>;
  hasChanges: boolean;
}

/** ディスクの内容（base）と作業中の一覧（working）の差分 */
export function diffItems(base: EditableJsonItem[], working: EditableJsonItem[]): ItemsDiff {
  const baseById = new Map(base.map((item) => [item.item.id, item]));
  const workingIds = new Set(working.map((item) => item.item.id));
  const changedIds = new Set<string>();
  const deletedIds = new Set<string>();

  for (const item of working) {
    const original = baseById.get(item.item.id);
    if (!original || !isSameContent(original, item)) {
      changedIds.add(item.item.id);
    }
  }
  for (const item of base) {
    if (!workingIds.has(item.item.id)) {
      deletedIds.add(item.item.id);
    }
  }

  return { changedIds, deletedIds, hasChanges: changedIds.size > 0 || deletedIds.size > 0 };
}

export interface RebaseConflict {
  id: string;
  displayName: string;
  /** 自分の変更を捨てた理由 */
  reason: 'changed-externally' | 'deleted-externally';
}

export interface RebaseResult {
  items: EditableJsonItem[];
  /** 新しいディスク内容の上に再適用できた自分の変更（追加・編集・削除）の件数 */
  applied: number;
  /** 再適用できず、ディスク側を採用した変更 */
  conflicts: RebaseConflict[];
}

function itemDisplayName(item: EditableJsonItem): string {
  const jsonItem = item.item as { displayName?: string; path?: string };
  return jsonItem.displayName || jsonItem.path || item.item.id;
}

/**
 * ディスクが外部で変わったとき、自分の未保存の変更を新しい内容の上に載せ直す
 *
 * - 自分が触っていないアイテムはディスク側を採用する
 * - 自分が変更したアイテムは、ディスク側が読み込み時から変わっていなければ自分の版を採用する
 * - 双方が変えていた場合と、外部で削除されていた場合はディスク側を採用し、conflicts に載せる
 * - 自分が追加したアイテムは、そのファイルの先頭に置く
 */
export function rebaseWorkingItems(
  oldBase: EditableJsonItem[],
  working: EditableJsonItem[],
  newBase: EditableJsonItem[]
): RebaseResult {
  const oldBaseById = new Map(oldBase.map((item) => [item.item.id, item]));
  const workingById = new Map(working.map((item) => [item.item.id, item]));
  const newBaseById = new Map(newBase.map((item) => [item.item.id, item]));

  const result: EditableJsonItem[] = [];
  const conflicts: RebaseConflict[] = [];
  let applied = 0;

  for (const external of newBase) {
    const id = external.item.id;
    const original = oldBaseById.get(id);
    const mine = workingById.get(id);

    // 外部で追加されたアイテム
    if (!original) {
      result.push(external);
      continue;
    }

    // 自分が削除したアイテム
    if (!mine) {
      if (isSameContent(original, external)) {
        applied++;
      } else {
        conflicts.push({
          id,
          displayName: itemDisplayName(external),
          reason: 'changed-externally',
        });
        result.push(external);
      }
      continue;
    }

    // 自分が触っていない
    if (isSameContent(mine, original)) {
      result.push(external);
      continue;
    }

    // 自分が変更した。外部が変えていなければ自分の版、変えていれば外部の版
    if (isSameContent(original, external) || isSameContent(mine, external)) {
      result.push(mine);
      applied++;
    } else {
      conflicts.push({ id, displayName: itemDisplayName(mine), reason: 'changed-externally' });
      result.push(external);
    }
  }

  // 自分が追加したアイテム（読み込み時にもディスクにも無い）
  const added: EditableJsonItem[] = [];
  for (const mine of working) {
    const id = mine.item.id;
    if (!oldBaseById.has(id) && !newBaseById.has(id)) {
      added.push(mine);
      applied++;
    } else if (oldBaseById.has(id) && !newBaseById.has(id)) {
      // 外部で削除された。自分が変更していたら知らせる
      if (!isSameContent(mine, oldBaseById.get(id)!)) {
        conflicts.push({ id, displayName: itemDisplayName(mine), reason: 'deleted-externally' });
      }
    }
  }

  return { items: reorderItemNumbers([...added, ...result]), applied, conflicts };
}

/**
 * 保存用のアイテム列を作る: 変更したアイテムに updatedAt を付け、行番号を振り直す
 */
export function buildItemsForSave(
  workingItems: EditableJsonItem[],
  changedIds: Set<string>
): EditableJsonItem[] {
  const now = Date.now();
  return reorderItemNumbers(
    workingItems.map((item) =>
      changedIds.has(item.item.id) ? { ...item, item: { ...item.item, updatedAt: now } } : item
    )
  );
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
