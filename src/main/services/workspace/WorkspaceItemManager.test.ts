import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../../config/pathManager.js', () => {
  const pm = {
    getConfigFolder: () => tempRoot.dir,
    getWorkspaceUiStateFilePath: () => `${tempRoot.dir}/workspace-ui-state.json`,
  };
  return { PathManager: pm, default: pm };
});

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import type { WorkspaceFileStore } from './WorkspaceFileStore';
import { WorkspaceItemManager } from './WorkspaceItemManager';
import { createTestWorkspaceStore, type TestWorkspaceStore } from './testStore';

describe('WorkspaceItemManager', () => {
  let test: TestWorkspaceStore;
  let store: WorkspaceFileStore;
  let manager: WorkspaceItemManager;

  beforeEach(async () => {
    test = await createTestWorkspaceStore('qdl-ws-items-');
    tempRoot.dir = test.dir;
    store = test.store;
    manager = new WorkspaceItemManager(store);
  });

  afterEach(() => {
    test.cleanup();
  });

  const readItems = () => test.readMain().items as Record<string, unknown>[];

  it('addItem はメイン画面のアイテムをファイル形式で保存し、launcherType を持つこと', () => {
    const added = manager.addItem({
      displayName: 'GitHub',
      path: 'https://github.com/',
      type: 'url',
      memo: 'm',
    });
    expect(added).toMatchObject({ type: 'item', launcherType: 'url', memo: 'm', order: 0 });
    expect(added.workspaceId).toBe(store.resolveDefaultWorkspaceId());
    expect(readItems()[0]).toEqual({
      id: added.id,
      type: 'item',
      displayName: 'GitHub',
      path: 'https://github.com/',
      memo: 'm',
      workspaceId: added.workspaceId,
      order: 0,
      addedAt: added.addedAt,
    });
  });

  it('updateItem は path が変わらない編集でショートカットのリンク先（originalPath）を保つこと', () => {
    const added = manager.addItem({
      displayName: 'Docs',
      path: 'C:\\Users\\me\\Docs.lnk',
      type: 'folder',
      originalPath: 'C:\\Users\\me\\Documents',
    });

    manager.updateItem(added.id, {
      type: 'item',
      displayName: 'Docs（改名）',
      path: 'C:\\Users\\me\\Docs.lnk',
    });
    expect(readItems()[0]).toMatchObject({
      displayName: 'Docs（改名）',
      originalPath: 'C:\\Users\\me\\Documents',
    });

    // path を変えたら引き継がない
    manager.updateItem(added.id, { type: 'item', displayName: 'Other', path: 'C:\\other.exe' });
    expect(readItems()[0]).not.toHaveProperty('originalPath');
  });

  it('updateItem で種別を変えると古い種別のフィールドが残らないこと', () => {
    const added = manager.addItem({ displayName: 'a', path: 'C:\\a.exe', type: 'app', args: '-x' });
    manager.updateItem(added.id, {
      type: 'window',
      displayName: 'a',
      windowTitle: '*a',
      x: 1,
    });
    const item = readItems()[0];
    expect(item).toMatchObject({ type: 'window', windowTitle: '*a', x: 1 });
    expect(item).not.toHaveProperty('path');
    expect(item).not.toHaveProperty('args');
    expect(manager.loadItems()[0]).not.toHaveProperty('launcherType');
  });

  it('タイトル空・プロセス名だけのウィンドウ操作は "*" に正規化して書くこと（読み込みで invalid にしない）', () => {
    const added = manager.addItem({
      type: 'window',
      displayName: 'メモ帳',
      windowTitle: '',
      processName: 'notepad.exe',
    });
    expect(added).toMatchObject({ type: 'window', windowTitle: '*', processName: 'notepad.exe' });
    expect(readItems()[0].windowTitle).toBe('*');
  });

  it('検証を通らない本体（displayName 空）は書かずに throw すること', () => {
    manager.addItem({ displayName: 'a', path: 'C:\\a.exe', type: 'app' });
    expect(() =>
      manager.updateItem(manager.loadItems()[0].id, {
        type: 'item',
        displayName: '',
        path: 'C:\\a.exe',
      })
    ).toThrow('displayName');
    expect(readItems()[0].displayName).toBe('a');
  });
});
