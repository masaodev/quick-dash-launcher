import { describe, it, expect, vi } from 'vitest';
import type { DataFileTab, EditingAppItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import { useModalInitializer } from './useModalInitializer';

const tabs: DataFileTab[] = [{ files: ['data.json'], name: 'メイン' }];

function editable(item: EditableJsonItem['item']): EditableJsonItem {
  return {
    item,
    displayText: '',
    meta: { sourceFile: 'data.json', lineNumber: 0, isValid: true },
  } as EditableJsonItem;
}

describe('useModalInitializer の initializeFromEditingItem', () => {
  it('アイテム管理からセットを開くと、カスタムアイコンのプレビューを読む', async () => {
    const onLoadCustomIcon = vi.fn(async () => undefined);
    const { initializeFromEditingItem } = useModalInitializer();

    const [item] = await initializeFromEditingItem(
      editable({
        id: 's1',
        type: 'set',
        displayName: 'S1',
        entries: [],
        customIcon: 'set.png',
      } as EditableJsonItem['item']),
      tabs,
      onLoadCustomIcon
    );

    expect(item.customIcon).toBe('set.png');
    expect(onLoadCustomIcon).toHaveBeenCalledWith(0, 'set.png');
  });

  it('メイン画面からクリップボード・セットを開いても、カスタムアイコンのプレビューを読む', async () => {
    const onLoadCustomIcon = vi.fn(async () => undefined);
    const { initializeFromEditingItem } = useModalInitializer();

    await initializeFromEditingItem(
      {
        type: 'clipboard',
        displayName: 'C1',
        clipboardDataRef: 'x.json',
        savedAt: 0,
        formats: [],
        customIcon: 'clip.png',
        sourceFile: 'data.json',
      } as EditingAppItem,
      tabs,
      onLoadCustomIcon
    );
    await initializeFromEditingItem(
      {
        type: 'set',
        displayName: 'S1',
        entries: [],
        customIcon: 'set.png',
        sourceFile: 'data.json',
      } as EditingAppItem,
      tabs,
      onLoadCustomIcon
    );

    expect(onLoadCustomIcon.mock.calls).toEqual([
      [0, 'clip.png'],
      [0, 'set.png'],
    ]);
  });

  it('カスタムアイコンが無ければ読まない', async () => {
    const onLoadCustomIcon = vi.fn(async () => undefined);
    const { initializeFromEditingItem } = useModalInitializer();

    await initializeFromEditingItem(
      editable({
        id: 's1',
        type: 'set',
        displayName: 'S1',
        entries: [],
      } as EditableJsonItem['item']),
      tabs,
      onLoadCustomIcon
    );

    expect(onLoadCustomIcon).not.toHaveBeenCalled();
  });
});
