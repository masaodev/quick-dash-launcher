import { describe, it, expect, vi } from 'vitest';
import type { WorkspaceItem } from '@common/types';

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { stripRuntimeIcons, setStoredItems, purgeStoredItemIcons } = await import('./itemSanitizer');

const ICON = 'data:image/png;base64,AAAA';

/** テスト用のワークスペースアイテムを作る */
function item(partial: Partial<WorkspaceItem>): WorkspaceItem {
  return {
    id: 'id',
    displayName: 'name',
    originalName: 'name',
    path: 'C:\\app.exe',
    type: 'app',
    order: 0,
    addedAt: 0,
    ...partial,
  };
}

/** テスト用のインメモリストア */
function createStore(items: WorkspaceItem[]) {
  const state = { items };
  return {
    get: (_key: 'items') => state.items,
    set: (_key: 'items', value: WorkspaceItem[]) => {
      state.items = value;
    },
    state,
  };
}

describe('stripRuntimeIcons', () => {
  it('トップレベルのiconを除去する', () => {
    const result = stripRuntimeIcons([item({ icon: ICON })]);

    expect(result[0]).not.toHaveProperty('icon');
    expect(result[0].displayName).toBe('name');
  });

  it('layoutEntriesのiconを除去し、他のフィールドは保持する', () => {
    const result = stripRuntimeIcons([
      item({
        type: 'layout',
        layoutEntries: [
          { windowTitle: 'w1', launchApp: true, icon: ICON },
          { windowTitle: 'w2', launchApp: false, executablePath: 'C:\\a.exe' },
        ],
      }),
    ]);

    expect(result[0].layoutEntries).toEqual([
      { windowTitle: 'w1', launchApp: true },
      { windowTitle: 'w2', launchApp: false, executablePath: 'C:\\a.exe' },
    ]);
  });

  it('customIconは保存対象なので除去しない', () => {
    const result = stripRuntimeIcons([item({ icon: ICON, customIcon: 'custom.png' })]);

    expect(result[0].customIcon).toBe('custom.png');
  });

  it('除去対象がない場合は元の配列をそのまま返す', () => {
    const items = [item({}), item({ id: 'id2' })];

    expect(stripRuntimeIcons(items)).toBe(items);
  });
});

describe('setStoredItems', () => {
  it('アイコンを除去してから保存する', () => {
    const store = createStore([]);

    setStoredItems(store, [item({ icon: ICON })]);

    expect(store.state.items[0]).not.toHaveProperty('icon');
  });
});

describe('purgeStoredItemIcons', () => {
  it('保存済みのアイコンを除去して書き戻す', () => {
    const store = createStore([item({ icon: ICON }), item({ id: 'id2' })]);

    purgeStoredItemIcons(store, 'workspace');

    expect(store.state.items[0]).not.toHaveProperty('icon');
    expect(store.state.items).toHaveLength(2);
  });

  it('除去対象がない場合は書き込まない', () => {
    const store = createStore([item({})]);
    const before = store.state.items;

    purgeStoredItemIcons(store, 'workspace');

    expect(store.state.items).toBe(before);
  });
});
