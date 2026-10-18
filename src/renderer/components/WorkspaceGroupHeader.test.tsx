import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { WorkspaceGroupView } from '@common/types';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';

const group: WorkspaceGroupView = {
  id: 'grp00001',
  displayName: '仕事の資料',
  color: 'primary',
  order: 0,
  createdAt: 0,
  workspaceId: 'wsp00001',
  collapsed: false,
};

function renderHeader(props: { isWindowHandle?: boolean; isEditing?: boolean } = {}) {
  const onToggle = vi.fn();
  const { container } = render(
    <WorkspaceGroupHeader
      group={group}
      itemCount={3}
      isEditing={props.isEditing ?? false}
      isWindowHandle={props.isWindowHandle}
      depth={0}
      draggedElement={null}
      canNest={false}
      onToggle={onToggle}
      onUpdate={vi.fn()}
      onEndEdit={vi.fn()}
      onGroupDragStart={vi.fn()}
      onGroupDragOverForReorder={vi.fn()}
      onGroupDropForReorder={vi.fn()}
      onContextMenu={vi.fn()}
    />
  );
  const header = container.querySelector('.workspace-group-header') as HTMLElement;
  return { header, onToggle };
}

describe('WorkspaceGroupHeader（切り離しウィンドウの一番上の見出し）', () => {
  const startWindowMove = vi.fn();

  beforeEach(() => {
    startWindowMove.mockClear();
    window.electronAPI = { startWindowMove } as unknown as typeof window.electronAPI;
    // jsdom には pointer capture が無い
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  it('押したまま 4px 以上動かすと、ウィンドウの移動を 1 回だけ始める', () => {
    const { header } = renderHeader({ isWindowHandle: true });
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, screenX: 100, screenY: 100 });
    fireEvent.pointerMove(header, { pointerId: 1, screenX: 102, screenY: 101 });
    expect(startWindowMove).not.toHaveBeenCalled();
    fireEvent.pointerMove(header, { pointerId: 1, screenX: 105, screenY: 100 });
    fireEvent.pointerMove(header, { pointerId: 1, screenX: 120, screenY: 100 });
    expect(startWindowMove).toHaveBeenCalledTimes(1);
  });

  it('動かさずに離せば、クリックで開閉する', () => {
    const { header, onToggle } = renderHeader({ isWindowHandle: true });
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, screenX: 100, screenY: 100 });
    fireEvent.pointerUp(header, { pointerId: 1, screenX: 100, screenY: 100 });
    fireEvent.click(header);
    expect(onToggle).toHaveBeenCalledWith(group.id);
    expect(startWindowMove).not.toHaveBeenCalled();
  });

  it('並べ替えのドラッグをしない（掴むのはウィンドウの移動に使う）', () => {
    const { header } = renderHeader({ isWindowHandle: true });
    expect(header.getAttribute('draggable')).toBe('false');
    expect(header.classList.contains('workspace-group-header-handle')).toBe(true);
  });

  it('右ボタン・名前の編集中は移動を始めない', () => {
    const { header } = renderHeader({ isWindowHandle: true });
    fireEvent.pointerDown(header, { button: 2, pointerId: 1, screenX: 100, screenY: 100 });
    fireEvent.pointerMove(header, { pointerId: 1, screenX: 150, screenY: 100 });
    expect(startWindowMove).not.toHaveBeenCalled();

    const editing = renderHeader({ isWindowHandle: true, isEditing: true });
    fireEvent.pointerDown(editing.header, { button: 0, pointerId: 1, screenX: 100, screenY: 100 });
    fireEvent.pointerMove(editing.header, { pointerId: 1, screenX: 150, screenY: 100 });
    expect(startWindowMove).not.toHaveBeenCalled();
  });

  it('ほかの見出しは今までどおり並べ替えのドラッグができ、押して動かしても移動しない', () => {
    const { header } = renderHeader();
    expect(header.getAttribute('draggable')).toBe('true');
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, screenX: 100, screenY: 100 });
    fireEvent.pointerMove(header, { pointerId: 1, screenX: 150, screenY: 100 });
    expect(startWindowMove).not.toHaveBeenCalled();
  });
});
