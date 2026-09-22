import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../../config/pathManager.js', () => {
  const pm = {
    getConfigFolder: () => tempRoot.dir,
    getWorkspaceUiStateFilePath: () => path.join(tempRoot.dir, 'workspace-ui-state.json'),
  };
  return { PathManager: pm, default: pm };
});

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { resetDataFileTrackerForTesting } from '../dataFileTracker';

import { WorkspaceFileStore } from './WorkspaceFileStore';
import { WorkspaceItemManager } from './WorkspaceItemManager';
import { WorkspaceUiStateStore } from './WorkspaceUiStateStore';

describe('WorkspaceItemManager', () => {
  let store: WorkspaceFileStore;
  let manager: WorkspaceItemManager;

  beforeEach(async () => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-ws-items-'));
    resetDataFileTrackerForTesting();
    store = new WorkspaceFileStore(
      {
        main: path.join(tempRoot.dir, 'workspace.json'),
        archive: path.join(tempRoot.dir, 'workspace-archive.json'),
        legacyDetached: path.join(tempRoot.dir, 'workspace-detached.json'),
      },
      new WorkspaceUiStateStore(path.join(tempRoot.dir, 'workspace-ui-state.json')),
      { createPreMigrationSnapshot: async () => {} }
    );
    await store.reload();
    manager = new WorkspaceItemManager(store);
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  const readItems = () =>
    JSON.parse(fs.readFileSync(path.join(tempRoot.dir, 'workspace.json'), 'utf8')).items;

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
