/**
 * ブックマーク自動取込のアイテムを、前回の取込と今回のブックマークの差分だけ書き換える
 *
 * ルールで入れたアイテムを URL で突き合わせ、
 * - 今回もある URL は残す（id・memo・customIcon・args・ウィンドウ切替の設定を保つ）。表示名が変わったときだけ書き換える
 * - 今回ない URL は消す
 * - 前回ない URL は末尾に足す
 * 同じ URL が複数あるときは、出現順で 1 対 1 に対応づける
 */

import type { JsonItem, JsonLauncherItem } from '../types';

/** 今回取り込むブックマーク（表示名はルールの接頭辞・フォルダ名を付けたもの） */
export interface BookmarkSyncEntry {
  url: string;
  displayName: string;
}

export interface BookmarkSyncCounts {
  added: number;
  updated: number;
  deleted: number;
}

export interface BookmarkSyncResult {
  items: JsonItem[];
  counts: BookmarkSyncCounts;
}

function isRuleItem(item: JsonItem, ruleId: string): item is JsonLauncherItem {
  return item.type === 'item' && item.autoImportRuleId === ruleId;
}

/**
 * ルールのアイテムを今回のブックマークに合わせる（items は書き換えず、新しい配列を返す）
 */
export function syncBookmarkRuleItems(
  items: JsonItem[],
  ruleId: string,
  entries: BookmarkSyncEntry[],
  now: number,
  newId: () => string
): BookmarkSyncResult {
  // URL ごとに、前回のアイテムをファイルの順に並べる
  const previousByUrl = new Map<string, JsonLauncherItem[]>();
  for (const item of items) {
    if (!isRuleItem(item, ruleId)) continue;
    previousByUrl.set(item.path, [...(previousByUrl.get(item.path) ?? []), item]);
  }

  const replacements = new Map<JsonLauncherItem, JsonLauncherItem>();
  const addedItems: JsonLauncherItem[] = [];
  let updated = 0;

  for (const entry of entries) {
    const previous = previousByUrl.get(entry.url)?.shift();
    if (!previous) {
      addedItems.push({
        id: newId(),
        type: 'item',
        displayName: entry.displayName,
        path: entry.url,
        autoImportRuleId: ruleId,
        updatedAt: now,
      });
      continue;
    }
    if (previous.displayName === entry.displayName) {
      replacements.set(previous, previous);
    } else {
      replacements.set(previous, { ...previous, displayName: entry.displayName, updatedAt: now });
      updated++;
    }
  }

  let deleted = 0;
  const kept: JsonItem[] = [];
  for (const item of items) {
    if (!isRuleItem(item, ruleId)) {
      kept.push(item);
      continue;
    }
    const replacement = replacements.get(item);
    if (replacement) {
      kept.push(replacement);
    } else {
      deleted++;
    }
  }

  return {
    items: [...kept, ...addedItems],
    counts: { added: addedItems.length, updated, deleted },
  };
}
