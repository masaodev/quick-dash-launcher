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

  it('「すべて」のタブは無く、開いたときはセットと同じタブ（先頭）を選んでいる', () => {
    renderPicker([item('a', 'メモ帳', 'メイン'), item('b', '電卓', '仕事')]);
    expect(screen.queryByRole('tab', { name: /^すべて/ })).toBeNull();
    expect(activeTabName()).toMatch(/^メイン/);
    expect(screen.getByText('メモ帳')).toBeTruthy();
    expect(screen.queryByText('電卓')).toBeNull();
  });

  it('allTab のときは「すべて」のタブを出し、開いたときはそれを選んでいる', () => {
    render(
      <SetItemPickerModal
        isOpen
        allTab
        catalog={[item('a', 'メモ帳', 'メイン'), item('b', '電卓', '仕事')]}
        addedKeys={new Set()}
        onClose={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(activeTabName()).toMatch(/^すべて/);
    expect(screen.getByText('電卓')).toBeTruthy();
  });

  it('検索は空白で区切った言葉をすべて含むものに絞る（ランチャーと同じ）', () => {
    renderPicker([
      item('a', 'Git Bash ai-workspace', 'メイン'),
      item('b', 'Git Bash stock_calc', 'メイン'),
      item('c', 'ai-workspace フォルダ', 'メイン'),
    ]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'git  AI-WORK' } });
    expect(screen.getByText('Git Bash ai-workspace')).toBeTruthy();
    expect(screen.queryByText('Git Bash stock_calc')).toBeNull();
    expect(screen.queryByText('ai-workspace フォルダ')).toBeNull();
  });

  it('検索欄で Tab を押すと次のタブ、Shift+Tab で前のタブに切り替わり、フォーカスは検索欄のまま', () => {
    renderPicker([
      item('a', 'メモ帳', 'メイン'),
      item('b', '電卓', '仕事'),
      item('c', 'ペイント', '趣味'),
    ]);
    const search = screen.getByRole('textbox');
    expect(activeTabName()).toMatch(/^メイン/);

    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^仕事/);
    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^趣味/);
    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^メイン/);

    fireEvent.keyDown(search, { key: 'Tab', shiftKey: true });
    expect(activeTabName()).toMatch(/^趣味/);
    expect(document.activeElement).toBe(search);
  });

  it('検索中は、合うアイテムの無いタブを飛ばす', () => {
    renderPicker([
      item('a', 'メモ帳', 'メイン'),
      item('b', 'ペイント', '趣味'),
      item('c', '電卓', '仕事'),
    ]);
    const search = screen.getByRole('textbox');
    fireEvent.change(search, { target: { value: '電卓' } });

    fireEvent.keyDown(search, { key: 'Tab' });
    expect(activeTabName()).toMatch(/^仕事/);
  });
});
