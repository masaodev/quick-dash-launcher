import { describe, it, expect } from 'vitest';
import type { JsonItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import {
  buildItemsForSave,
  createBlankItem,
  dedupeFileItems,
  diffItems,
  duplicateItems,
  filterEditableItems,
  findDuplicateIds,
  getItemKey,
  importBookmarks,
  isSameContent,
  rebaseWorkingItems,
  refreshEditableItem,
  removeItems,
  reorderItemNumbers,
  replaceItem,
  stableStringify,
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

/** 名前を変えた版（表示テキスト・検証も作り直す） */
const renamed = (item: EditableJsonItem, displayName: string) =>
  refreshEditableItem(item, { ...item.item, displayName } as JsonItem);

describe('editableItemOperations', () => {
  it('getItemKey はアイテムの id であること（行番号に依存しない）', () => {
    const items = rows([launcher('a', 'C:\\a')]);
    const moved = reorderItemNumbers([createBlankItem(FILE), ...items]);
    expect(getItemKey(moved[1])).toBe(items[0].item.id);
    expect(moved[1].meta.lineNumber).toBe(1);
  });

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

  it('createBlankItem は本採番した id と検証エラーを持つこと', () => {
    const blank = createBlankItem(FILE);
    expect(blank.item.id).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(blank.meta.isValid).toBe(false);
    expect(createBlankItem(FILE).item.id).not.toBe(blank.item.id);
  });

  it('refreshEditableItem は表示テキストと検証結果を作り直すこと', () => {
    const [item] = rows([launcher('a', 'C:\\a')]);
    const refreshed = refreshEditableItem(item, { ...item.item, displayName: '' } as JsonItem);
    expect(refreshed.meta.isValid).toBe(false);
    expect(refreshed.displayText).not.toBe(item.displayText);

    const moved = refreshEditableItem(item, item.item, OTHER);
    expect(moved.meta.sourceFile).toBe(OTHER);
  });

  it('removeItems は指定 id を除いて行番号を振り直すこと', () => {
    const items = rows(
      [launcher('a', 'C:\\a')],
      [launcher('b', 'C:\\b')],
      [launcher('c', 'C:\\c')]
    );
    const result = removeItems(items, [items[1].item.id]);
    expect(names(result)).toEqual(['a', 'c']);
    expect(result.map((i) => i.meta.lineNumber)).toEqual([0, 1]);
  });

  it('replaceItem は同じ id のアイテムだけを差し替えること', () => {
    const items = rows([launcher('a', 'C:\\a')], [launcher('b', 'C:\\b')]);
    const result = replaceItem(items, renamed(items[1], 'B'));
    expect(names(result)).toEqual(['a', 'B']);
    expect(result[0]).toBe(items[0]);
  });

  it('duplicateItems は対象の最後のアイテムの直後に新しい ID で複製すること', () => {
    const items = rows(
      [launcher('a', 'C:\\a')],
      [launcher('b', 'C:\\b')],
      [launcher('c', 'C:\\c')]
    );
    const result = duplicateItems(items, [items[1].item.id, items[0].item.id])!;
    expect(names(result)).toEqual(['a', 'b', 'a', 'b', 'c']);
    expect(result[2].item.id).not.toBe(items[0].item.id);
    expect(result.map((i) => i.meta.lineNumber)).toEqual([0, 1, 2, 3, 4]);
  });

  it('duplicateItems は対象が無ければ null を返すこと', () => {
    const items = rows([launcher('a', 'C:\\a')]);
    expect(duplicateItems(items, ['nope'])).toBeNull();
  });

  it('findDuplicateIds / dedupeFileItems は対象ファイル内の 2 件目以降だけを除くこと', () => {
    const items = rows(
      [launcher('a', 'C:\\a.exe')],
      [launcher('a', 'C:\\a.exe'), OTHER],
      [launcher('a', 'C:\\a.exe')],
      [launcher('a', 'C:\\b.exe')],
      [launcher('a', 'C:\\a.exe')]
    );
    expect(findDuplicateIds(items, FILE)).toEqual([items[2].item.id, items[4].item.id]);
    const { items: deduped, removed } = dedupeFileItems(items, FILE);
    expect(removed).toBe(2);
    // 他ファイルは触らない。順序は保つ
    expect(deduped.map((i) => [i.meta.sourceFile, (i.item as { path?: string }).path])).toEqual([
      [FILE, 'C:\\a.exe'],
      [OTHER, 'C:\\a.exe'],
      [FILE, 'C:\\b.exe'],
    ]);
    expect(dedupeFileItems(deduped, FILE).removed).toBe(0);
  });

  it('stableStringify はキー順と undefined の有無に依存しないこと', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(
      stableStringify({ a: [2, { c: 2, d: 1 }], b: 1, z: undefined })
    );
  });

  it('isSameContent は updatedAt と行番号を無視し、置き場のファイルは比較すること', () => {
    const [a] = rows([launcher('a', 'C:\\a', { updatedAt: 1 })]);
    const later = { ...a, item: { ...a.item, updatedAt: 2 }, meta: { ...a.meta, lineNumber: 9 } };
    expect(isSameContent(a, later)).toBe(true);
    expect(isSameContent(a, refreshEditableItem(a, a.item, OTHER))).toBe(false);
    expect(isSameContent(a, renamed(a, 'x'))).toBe(false);
  });

  it('diffItems は変更・追加・削除を id で検出すること', () => {
    const base = rows([launcher('a', 'C:\\a')], [launcher('b', 'C:\\b')], [launcher('c', 'C:\\c')]);
    const working = reorderItemNumbers([createBlankItem(FILE), renamed(base[0], 'A'), base[2]]);
    const diff = diffItems(base, working);
    expect(diff.hasChanges).toBe(true);
    expect([...diff.changedIds]).toEqual([working[0].item.id, base[0].item.id]);
    expect([...diff.deletedIds]).toEqual([base[1].item.id]);
    expect(diffItems(base, base).hasChanges).toBe(false);
    // 行番号だけ違っても変更ではない
    expect(diffItems(base, reorderItemNumbers([base[2], base[1], base[0]])).hasChanges).toBe(false);
  });

  it('buildItemsForSave は変更した id にだけ updatedAt を付け、行番号を振り直すこと', () => {
    const items = rows(
      [launcher('a', 'C:\\a', { updatedAt: 1 })],
      [launcher('b', 'C:\\b', { updatedAt: 1 })]
    );
    const result = buildItemsForSave([items[1], items[0]], new Set([items[0].item.id]));
    expect(names(result)).toEqual(['b', 'a']);
    expect(result[0].item.updatedAt).toBe(1);
    expect(result[1].item.updatedAt).toBeGreaterThan(1);
    expect(result.map((i) => i.meta.lineNumber)).toEqual([0, 1]);
  });

  describe('rebaseWorkingItems', () => {
    const base = () =>
      rows([launcher('a', 'C:\\a')], [launcher('b', 'C:\\b')], [launcher('c', 'C:\\c')]);

    it('自分の編集・追加・削除を、外部が触っていないアイテムの上に載せ直すこと', () => {
      const oldBase = base();
      const added = createBlankItem(FILE);
      const working = reorderItemNumbers([added, renamed(oldBase[0], 'A'), oldBase[2]]); // b は削除
      // 外部で d を追加した
      const newBase = reorderItemNumbers([
        ...oldBase,
        toEditableItem(launcher('d', 'C:\\d'), FILE),
      ]);

      const result = rebaseWorkingItems(oldBase, working, newBase);
      expect(names(result.items)).toEqual(['', 'A', 'c', 'd']);
      expect(result.applied).toBe(3);
      expect(result.conflicts).toEqual([]);
      expect(result.items.map((i) => i.meta.lineNumber)).toEqual([0, 1, 2, 3]);
    });

    it('外部も変えたアイテムは外部を採用し、conflicts に載せること', () => {
      const oldBase = base();
      const working = replaceItem(oldBase, renamed(oldBase[0], 'mine'));
      const newBase = replaceItem(oldBase, renamed(oldBase[0], 'theirs'));

      const result = rebaseWorkingItems(oldBase, working, newBase);
      expect(names(result.items)).toEqual(['theirs', 'b', 'c']);
      expect(result.applied).toBe(0);
      expect(result.conflicts).toEqual([
        { id: oldBase[0].item.id, displayName: 'mine', reason: 'changed-externally' },
      ]);
    });

    it('外部で削除されたアイテムへの自分の編集は捨て、外部で変わったアイテムの自分の削除も取り消すこと', () => {
      const oldBase = base();
      // 自分: a を編集、b を削除
      const working = replaceItem(oldBase, renamed(oldBase[0], 'A')).filter(
        (i) => i.item.id !== oldBase[1].item.id
      );
      // 外部: a を削除、b を編集
      const newBase = replaceItem(oldBase, renamed(oldBase[1], 'B')).filter(
        (i) => i.item.id !== oldBase[0].item.id
      );

      const result = rebaseWorkingItems(oldBase, working, newBase);
      expect(names(result.items)).toEqual(['B', 'c']);
      expect(result.conflicts.map((c) => [c.displayName, c.reason])).toEqual([
        ['B', 'changed-externally'],
        ['A', 'deleted-externally'],
      ]);
    });

    it('双方が同じ内容に変えていれば競合にしないこと', () => {
      const oldBase = base();
      const working = replaceItem(oldBase, renamed(oldBase[0], 'same'));
      const newBase = replaceItem(oldBase, renamed(oldBase[0], 'same'));
      const result = rebaseWorkingItems(oldBase, working, newBase);
      expect(result.conflicts).toEqual([]);
      expect(diffItems(newBase, result.items).hasChanges).toBe(false);
    });
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
