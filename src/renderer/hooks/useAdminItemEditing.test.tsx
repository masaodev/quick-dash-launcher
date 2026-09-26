import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { JsonItem, RegisterItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import {
  refreshEditableItem,
  reorderItemNumbers,
  toEditableItem,
} from '../utils/editableItemOperations';

import { useAdminItemEditing } from './useAdminItemEditing';

const FILE = 'datafiles/data.json';
const OTHER = 'datafiles/data2.json';

let idSeq = 0;
function launcher(displayName: string, itemPath: string, extra: Partial<JsonItem> = {}): JsonItem {
  idSeq++;
  return {
    id: `id${String(idSeq).padStart(6, '0')}`,
    type: 'item',
    displayName,
    path: itemPath,
    ...extra,
  } as JsonItem;
}

function rows(...entries: Array<[JsonItem, string?]>): EditableJsonItem[] {
  return reorderItemNumbers(entries.map(([item, file]) => toEditableItem(item, file ?? FILE)));
}

const names = (items: EditableJsonItem[]) =>
  items.map((i) => ('displayName' in i.item ? i.item.displayName : i.item.type));

const withName = (item: EditableJsonItem, displayName: string): EditableJsonItem => ({
  ...item,
  item: { ...item.item, displayName } as JsonItem,
});

type SaveFn = (items: EditableJsonItem[]) => Promise<boolean>;

function setup(initial: EditableJsonItem[], onSave = vi.fn<SaveFn>(async () => true)) {
  const hook = renderHook(({ items }) => useAdminItemEditing(items, onSave), {
    initialProps: { items: initial },
  });
  return { ...hook, onSave };
}

describe('useAdminItemEditing', () => {
  it('セル編集は id で結び付き、行を追加・削除しても別のアイテムに移らないこと', () => {
    const base = rows([launcher('a', 'C:\\a')], [launcher('b', 'C:\\b')], [launcher('c', 'C:\\c')]);
    const { result } = setup(base);

    act(() => result.current.recordEdit(withName(base[2], 'C')));
    act(() => result.current.addBlankItem(FILE));
    act(() => result.current.deleteItems([base[0]]));

    expect(names(result.current.workingItems)).toEqual(['', 'b', 'C']);
    expect(result.current.workingItems[2].item.id).toBe(base[2].item.id);
    expect(result.current.changedIds.has(base[2].item.id)).toBe(true);
    expect(result.current.deletedCount).toBe(1);
  });

  it('セル編集で表示テキストと検証結果が作り直されること', () => {
    const base = rows([launcher('a', 'C:\\a')]);
    const { result } = setup(base);

    act(() => result.current.recordEdit(withName(base[0], '')));
    const edited = result.current.workingItems[0];
    expect(edited.meta.isValid).toBe(false);
    expect(edited.displayText).not.toBe(base[0].displayText);
    expect(result.current.invalidCount).toBe(1);
  });

  it('編集して元に戻すと未保存扱いにならないこと', () => {
    const base = rows([launcher('a', 'C:\\a')]);
    const { result } = setup(base);

    act(() => result.current.recordEdit(withName(base[0], 'x')));
    expect(result.current.hasUnsavedChanges).toBe(true);
    act(() => result.current.recordEdit(withName(result.current.workingItems[0], 'a')));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('discardChanges は編集だけでなく追加・削除も元に戻すこと', () => {
    const base = rows([launcher('a', 'C:\\a')], [launcher('b', 'C:\\b')]);
    const { result } = setup(base);

    act(() => result.current.addBlankItem(FILE));
    act(() => result.current.deleteItems([base[1]]));
    act(() => result.current.recordEdit(withName(base[0], 'A')));
    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => result.current.discardChanges());
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(names(result.current.workingItems)).toEqual(['a', 'b']);
  });

  it('saveChanges は保存に成功したときだけ確定し、失敗したら未保存のまま残すこと', async () => {
    const base = rows([launcher('a', 'C:\\a', { updatedAt: 1 })]);
    const onSave = vi.fn<SaveFn>(async () => false);
    const { result } = setup(base, onSave);

    act(() => result.current.recordEdit(withName(base[0], 'A')));
    let saved = true;
    await act(async () => {
      saved = await result.current.saveChanges();
    });
    expect(saved).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(result.current.hasUnsavedChanges).toBe(true);

    onSave.mockResolvedValueOnce(true);
    await act(async () => {
      saved = await result.current.saveChanges();
    });
    expect(saved).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(false);
    // 変更したアイテムには updatedAt が付く
    const savedItems = onSave.mock.calls[1][0];
    expect(savedItems[0].item.updatedAt).toBeGreaterThan(1);
  });

  it('変更が無いときは saveChanges が onSave を呼ばないこと', async () => {
    const base = rows([launcher('a', 'C:\\a')]);
    const { result, onSave } = setup(base);
    let saved = true;
    await act(async () => {
      saved = await result.current.saveChanges();
    });
    expect(saved).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('ディスクの内容が変わっても未保存の変更は新しい内容の上に残ること', () => {
    const base = rows([launcher('a', 'C:\\a')], [launcher('b', 'C:\\b')]);
    const { result, rerender } = setup(base);

    act(() => result.current.recordEdit(withName(base[0], 'A')));
    act(() => result.current.deleteItems([base[1]]));

    // 外部で c が追加された
    const newBase = reorderItemNumbers([...base, toEditableItem(launcher('c', 'C:\\c'), FILE)]);
    rerender({ items: newBase });

    expect(names(result.current.workingItems)).toEqual(['A', 'c']);
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.rebaseNotice).toEqual({ applied: 2, conflicts: [] });

    act(() => result.current.clearRebaseNotice());
    expect(result.current.rebaseNotice).toBeNull();
  });

  it('未保存の変更が無ければディスクの内容をそのまま採用すること', () => {
    const base = rows([launcher('a', 'C:\\a')]);
    const { result, rerender } = setup(base);
    const newBase = rows([launcher('z', 'C:\\z')]);
    rerender({ items: newBase });
    expect(result.current.workingItems).toBe(newBase);
    expect(result.current.rebaseNotice).toBeNull();
  });

  it('applyRegisterUpdate はメモだけの変更も記録し、自動取込の紐づけと保存先の変更を反映すること', () => {
    const base = rows([launcher('a', 'C:\\a', { autoImportRuleId: 'rule1' } as Partial<JsonItem>)]);
    const { result } = setup(base);

    const registerItem: RegisterItem = {
      displayName: 'a',
      path: 'C:\\a',
      type: 'app',
      targetTab: FILE,
      targetFile: FILE,
      itemCategory: 'item',
      memo: 'メモ',
    };
    let movedTo: string | null = 'x';
    act(() => {
      movedTo = result.current.applyRegisterUpdate(base[0], [registerItem]);
    });
    expect(movedTo).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(true);
    const updated = result.current.workingItems[0].item as JsonItem & {
      memo?: string;
      autoImportRuleId?: string;
    };
    expect(updated.memo).toBe('メモ');
    expect(updated.autoImportRuleId).toBe('rule1');
    expect(updated.id).toBe(base[0].item.id);

    act(() => {
      movedTo = result.current.applyRegisterUpdate(result.current.workingItems[0], [
        { ...registerItem, targetFile: OTHER },
      ]);
    });
    expect(movedTo).toBe(OTHER);
    expect(result.current.workingItems[0].meta.sourceFile).toBe(OTHER);
  });

  it('countDuplicates / dedupeFile は対象ファイルの重複だけを扱うこと', () => {
    const base = rows(
      [launcher('a', 'C:\\a')],
      [launcher('a', 'C:\\a')],
      [launcher('a', 'C:\\a'), OTHER]
    );
    const { result } = setup(base);
    expect(result.current.countDuplicates(FILE)).toBe(1);
    let removed = 0;
    act(() => {
      removed = result.current.dedupeFile(FILE);
    });
    expect(removed).toBe(1);
    expect(result.current.workingItems.map((i) => i.meta.sourceFile)).toEqual([FILE, OTHER]);
    expect(result.current.deletedCount).toBe(1);
  });

  it('選択は id で保持し、削除や絞り込みで消えたアイテムの選択は外れること', () => {
    const base = rows([launcher('a', 'C:\\a')], [launcher('b', 'C:\\b')]);
    const { result } = setup(base);

    act(() => result.current.selectAll(base, true));
    expect(result.current.selectedItems.size).toBe(2);

    act(() => result.current.addBlankItem(FILE));
    // 先頭に行が入って行番号がずれても、選択は元のアイテムを指したまま
    expect([...result.current.selectedItems]).toEqual([base[0].item.id, base[1].item.id]);

    act(() => result.current.retainVisibleSelection([base[1]]));
    expect([...result.current.selectedItems]).toEqual([base[1].item.id]);

    act(() => result.current.deleteItems([base[1]]));
    expect(result.current.selectedItems.size).toBe(0);
  });

  it('duplicateItems は新しい id で直後に複製し、未保存扱いになること', () => {
    const base = rows([launcher('a', 'C:\\a')]);
    const { result } = setup(base);
    act(() => result.current.duplicateItems([base[0]]));
    expect(names(result.current.workingItems)).toEqual(['a', 'a']);
    expect(result.current.workingItems[1].item.id).not.toBe(base[0].item.id);
    expect(result.current.changedIds.has(result.current.workingItems[1].item.id)).toBe(true);
  });

  it('外部の変更と競合した自分の編集は捨てられ、通知に載ること', () => {
    const base = rows([launcher('a', 'C:\\a')]);
    const { result, rerender } = setup(base);
    act(() => result.current.recordEdit(withName(base[0], 'mine')));

    const newBase = [
      refreshEditableItem(base[0], { ...base[0].item, displayName: 'theirs' } as JsonItem),
    ];
    rerender({ items: newBase });

    expect(names(result.current.workingItems)).toEqual(['theirs']);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.rebaseNotice?.conflicts).toEqual([
      { id: base[0].item.id, displayName: 'mine', reason: 'changed-externally' },
    ]);
  });
});
