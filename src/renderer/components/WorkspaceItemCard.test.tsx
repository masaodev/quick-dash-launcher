import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceItem } from '@common/types';

import WorkspaceItemCard from './WorkspaceItemCard';

function card(displayName: string): WorkspaceItem {
  return {
    id: 'Ws000001',
    type: 'item',
    displayName,
    path: 'https://example.com/',
    launcherType: 'url',
    workspaceId: 'Wspace01',
    groupId: 'Group001',
    order: 0,
    addedAt: 0,
  } as WorkspaceItem;
}

function renderCard(item: WorkspaceItem, isEditing: boolean, onUpdateDisplayName = vi.fn()) {
  const props = {
    item,
    isEditing,
    onLaunch: vi.fn(),
    onRemove: vi.fn(),
    onUpdateDisplayName,
    onStartEdit: vi.fn(),
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
  };
  const view = render(<WorkspaceItemCard {...props} />);
  return {
    ...view,
    rerenderWith: (next: WorkspaceItem, editing: boolean) =>
      view.rerender(<WorkspaceItemCard {...props} item={next} isEditing={editing} />),
  };
}

describe('WorkspaceItemCard の名前の変更（A3-258）', () => {
  it('表示している間に名前が変わったら、編集は今の名前から始まる', () => {
    const { rerenderWith } = renderCard(card('旧'), false);
    rerenderWith(card('新'), false);
    rerenderWith(card('新'), true);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('新');
  });

  it('変えずに確定しても、古い名前には戻さない', () => {
    const onUpdate = vi.fn();
    const { rerenderWith } = renderCard(card('旧'), false, onUpdate);
    rerenderWith(card('新'), false);
    rerenderWith(card('新'), true);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onUpdate).not.toHaveBeenCalledWith('Ws000001', '旧');
  });

  it('編集中に名前が変わっても、打っている途中の文字は消さない', () => {
    const { rerenderWith } = renderCard(card('元'), true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '打ちかけ' } });
    rerenderWith(card('外で変わった'), true);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('打ちかけ');
  });
});
