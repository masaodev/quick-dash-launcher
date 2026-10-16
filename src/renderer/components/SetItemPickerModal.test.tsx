import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { SetCatalogItem } from '../utils/setEditing';

import SetItemPickerModal from './SetItemPickerModal';

function item(key: string, displayName: string, groupName: string): SetCatalogItem {
  return { key, id: key, displayName, kind: 'app', groupName, sameGroup: groupName === 'メイン' };
}

function renderPicker(catalog: SetCatalogItem[]) {
  render(
    <SetItemPickerModal
      isOpen
      catalog={catalog}
      addedKeys={new Set()}
      onClose={vi.fn()}
      onAdd={vi.fn()}
    />
  );
}

function activeTabName(): string {
  return screen.getByRole('tab', { selected: true }).textContent ?? '';
}

describe('SetItemPickerModal', () => {
  it('開いたときに検索欄にフォーカスがある（モーダル本体に取られない）', () => {
    renderPicker([item('a', 'メモ帳', 'メイン')]);
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('検索欄で Tab を押すと次のタブ、Shift+Tab で前のタブに切り替わり、フォーカスは検索欄のまま', () => {
    renderPicker([item('a', 'メモ帳', 'メイン'), item('b', '電卓', '仕事')]);
    const search = screen.getByRole('textbox');
    expect(activeTabName()).toMatch(/^すべて/);

    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^メイン/);
    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^仕事/);
    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^すべて/);

    fireEvent.keyDown(search, { key: 'Tab', shiftKey: true });
    expect(activeTabName()).toMatch(/^仕事/);
    expect(document.activeElement).toBe(search);
  });

  it('検索中は、合うアイテムの無いタブを飛ばす', () => {
    renderPicker([item('a', 'メモ帳', 'メイン'), item('b', '電卓', '仕事')]);
    const search = screen.getByRole('textbox');
    fireEvent.change(search, { target: { value: '電卓' } });

    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^仕事/);
  });
});
