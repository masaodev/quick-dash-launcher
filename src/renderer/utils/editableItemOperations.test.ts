import { describe, it, expect } from 'vitest';
import type { JsonItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import {
  buildItemsForSave,
  duplicateItems,
  filterEditableItems,
  getItemKey,
  importBookmarks,
  removeItems,
  reorderItemNumbers,
  sortAndDedupeFileItems,
  toEditableItem,
} from './editableItemOperations';

const FILE = 'datafiles/data.json';
const OTHER = 'datafiles/data2.json';

let idSeq = 0;
function launcher(
  displayName: string,
  itemPath: string,
  extra: Partial<Extract<JsonItem, { type: 'item' }>> = {}
): JsonItem {
  idSeq++;
  return {
    id: `id${String(idSeq).padStart(6, '0')}`,
    type: 'item',
    displayName,
    path: itemPath,
    ...extra,
  };
}

/** 行番号を振った一覧を作る */
function rows(...entries: Array<[JsonItem, string?]>): EditableJsonItem[] {
  return reorderItemNumbers(entries.map(([item, file]) => toEditableItem(item, file ?? FILE)));
}

const names = (items: EditableJsonItem[]) =>
  items.map((i) => ('displayName' in i.item ? i.item.displayName : i.item.type));

describe('editableItemOperations', () => {
  it('reorderItemNumbers はファイルごとに 0 から振り直すこと', () => {
    const items = rows(
      [launcher('a', 'C:\\a.exe')],
      [launcher('b', 'C:\\b.exe'), OTHER],
      [launcher('c', 'C:\\c.exe')]
    );
    expect(items.map((i) => [i.meta.sourceFile, i.meta.lineNumber])).toEqual([
      [FILE, 0],
      [OTHER, 0],
      [FILE, 1],
    ]);
  });

  it('removeItems は指定行を除いて行番号を振り直すこと', () => {
    const items = rows(
      [launcher('a', 'C:\\a')],
      [launcher('b', 'C:\\b')],
      [launcher('c', 'C:\\c')]
    );
    const result = removeItems(items, [items[1]]);
    expect(names(result)).toEqual(['a', 'c']);
    expect(result.map((i) => i.meta.lineNumber)).toEqual([0, 1]);
  });

  it('duplicateItems は対象の最後の行の直後に新しい ID で複製すること', () => {
    const items = rows(
      [launcher('a', 'C:\\a')],
      [launcher('b', 'C:\\b')],
      [launcher('c', 'C:\\c')]
    );
    const result = duplicateItems(items, [items[1], items[0]])!;
    expect(names(result)).toEqual(['a', 'b', 'a', 'b', 'c']);
    expect(result[2].item.id).not.toBe(items[0].item.id);
    expect(result.map((i) => i.meta.lineNumber)).toEqual([0, 1, 2, 3, 4]);
  });

  it('duplicateItems は挿入位置が見つからなければ null を返すこと', () => {
    const items = rows([launcher('a', 'C:\\a')]);
    const [stray] = rows([launcher('x', 'C:\\x'), OTHER]);
    expect(duplicateItems(items, [stray])).toBeNull();
  });

  it('sortAndDedupeFileItems は対象ファイルだけを種類・パス順に並べ、重複を除くこと', () => {
    const items = rows(
      [launcher('z', 'C:\\z.exe')],
      [launcher('other', 'C:\\0.exe'), OTHER],
      [{ id: 'grp00001', type: 'group', displayName: 'G', itemNames: [] }],
      [launcher('a', 'C:\\a.exe')],
      [launcher('a', 'C:\\a.exe')]
    );
    const result = sortAndDedupeFileItems(items, FILE);
    // 他ファイルのアイテムは先頭にそのまま、対象ファイルは group → item（パス順）、重複は 1 件に
    expect(names(result)).toEqual(['other', 'G', 'a', 'z']);
  });

  it('buildItemsForSave は整列・重複削除の指定に従うこと', () => {
    const items = rows(
      [launcher('b', 'C:\\b')],
      [launcher('a', 'C:\\a')],
      [launcher('a', 'C:\\a')]
    );

    const kept = buildItemsForSave(items, new Map(), { sortAndDedupe: false, sourceFile: FILE });
    expect(names(kept)).toEqual(['b', 'a', 'a']);

    const sorted = buildItemsForSave(items, new Map(), { sortAndDedupe: true, sourceFile: FILE });
    expect(names(sorted)).toEqual(['a', 'b']);
  });

  it('buildItemsForSave は編集差分を反映し、更新日時を付け直すこと', () => {
    const items = rows([launcher('a', 'C:\\a', { updatedAt: 1 })]);
    const edited = { ...items[0], item: { ...items[0].item, displayName: 'renamed' } };
    const result = buildItemsForSave(items, new Map([[getItemKey(items[0]), edited]]), {
      sortAndDedupe: false,
      sourceFile: FILE,
    });
    expect(names(result)).toEqual(['renamed']);
    expect(result[0].item.updatedAt).toBeGreaterThan(1);
  });

  describe('filterEditableItems', () => {
    const items = rows(
      [launcher('GitHub', 'https://github.com', { autoImportRuleId: 'rule1' })],
      [launcher('GitLab', 'https://gitlab.com')],
      [launcher('Google', 'https://google.com', { autoImportRuleId: 'rule2' })],
      [launcher('GitHub', 'https://github.com'), OTHER]
    );
    const filter = (autoImportFilter: string, searchQuery: string) =>
      names(filterEditableItems(items, { sourceFile: FILE, autoImportFilter, searchQuery }));

    it('対象ファイルと検索語（空白区切りの AND）で絞り込むこと', () => {
      expect(filter('all', '')).toEqual(['GitHub', 'GitLab', 'Google']);
      expect(filter('all', 'git hub')).toEqual(['GitHub']);
    });

    it('取込元フィルタと検索語を併用できること', () => {
      expect(filter('auto-import-only', '')).toEqual(['GitHub', 'Google']);
      expect(filter('auto-import-only', 'google')).toEqual(['Google']);
      expect(filter('manual-only', '')).toEqual(['GitLab']);
      expect(filter('manual-only', 'google')).toEqual([]);
      expect(filter('rule1', '')).toEqual(['GitHub']);
      expect(filter('rule1', 'google')).toEqual([]);
    });
  });

  it('importBookmarks は重複をスキップ／上書き（既存 ID を引き継ぐ）できること', () => {
    const existing = launcher('GitHub', 'https://github.com');
    const items = rows([existing]);
    const bookmarks = [
      { id: 'b1', displayName: 'GitHub 新', url: 'https://github.com', checked: true },
      { id: 'b2', displayName: 'MDN', url: 'https://developer.mozilla.org', checked: true },
    ];

    const skipped = importBookmarks(items, bookmarks, 'skip', FILE);
    expect(names(skipped)).toEqual(['MDN', 'GitHub']);

    const overwritten = importBookmarks(items, bookmarks, 'overwrite', FILE);
    expect(names(overwritten)).toEqual(['GitHub 新', 'MDN']);
    expect(overwritten[0].item.id).toBe(existing.id);
  });
});
