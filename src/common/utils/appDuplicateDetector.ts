/**
 * アプリインポート重複検出ユーティリティ
 * インストール済みアプリのインポート時に既存アイテムとの重複を検出する
 */

import type { ScannedAppItem } from '../types/appImport';
import type { EditableJsonItem } from '../types/editableItem';
import type { DuplicateCheckResult } from '../types/bookmark';

/**
 * パスを正規化する（小文字化、`/`→`\`変換、末尾`\`除去）
 */
export function normalizeAppPath(filePath: string): string {
  let normalized = filePath.trim().toLowerCase();
  normalized = normalized.replace(/\//g, '\\');
  if (normalized.endsWith('\\')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * アプリと既存アイテムの重複をチェックする
 * shortcutPathとtargetPath（originalPath）の両方で既存アイテムと比較
 */
export function checkAppDuplicates(
  apps: ScannedAppItem[],
  existingItems: EditableJsonItem[]
): DuplicateCheckResult {
  const existingPathMap = buildAppPathToIdMap(existingItems);

  const duplicateExistingIds: string[] = [];
  const duplicateAppIds: string[] = [];

  for (const app of apps) {
    const normalizedShortcut = normalizeAppPath(app.shortcutPath);
    const normalizedTarget = normalizeAppPath(app.targetPath);

    // shortcutPath（path）またはtargetPath（originalPath）で重複を検出
    const existingId =
      existingPathMap.get(normalizedShortcut) ?? existingPathMap.get(normalizedTarget);

    if (existingId) {
      duplicateExistingIds.push(existingId);
      duplicateAppIds.push(app.id);
    }
  }

  return {
    duplicateCount: duplicateAppIds.length,
    newCount: apps.length - duplicateAppIds.length,
    duplicateExistingIds,
    duplicateBookmarkIds: duplicateAppIds,
  };
}

/**
 * 重複するアプリをフィルタリングして新規のみを返す
 */
export function filterNonDuplicateApps(
  apps: ScannedAppItem[],
  duplicateAppIds: string[]
): ScannedAppItem[] {
  const duplicateSet = new Set(duplicateAppIds);
  return apps.filter((app) => !duplicateSet.has(app.id));
}

/**
 * 既存アイテムからパス->IDのマッピングを作成する
 * path（shortcutPath）とoriginalPath（targetPath）の両方をマップに格納
 */
export function buildAppPathToIdMap(existingItems: EditableJsonItem[]): Map<string, string> {
  const pathMap = new Map<string, string>();

  for (const { item } of existingItems) {
    if (item.type === 'item' && item.path) {
      pathMap.set(normalizeAppPath(item.path), item.id);
      if ('originalPath' in item && item.originalPath) {
        pathMap.set(normalizeAppPath(item.originalPath as string), item.id);
      }
    }
  }

  return pathMap;
}
