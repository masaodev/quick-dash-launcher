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
    test = await createTestWorkspaceStore('qdl-ws-items-', (dir) => {
      tempRoot.dir = dir;
    });
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

  it('createItem は入力した中身からアイテムを作り、指定したグループの末尾に足すこと', () => {
    const first = manager.addItem({ displayName: '先', path: 'notepad.exe', type: 'app' });
    const created = manager.createItem(
      { type: 'set', displayName: '朝のセット', entries: [{ itemId: first.id }] },
      'g1'
    );
    expect(created).toMatchObject({
      type: 'set',
      displayName: '朝のセット',
      groupId: 'g1',
      order: first.order + 1,
    });
    expect(readItems().map((item) => item.displayName)).toEqual(['先', '朝のセット']);
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
      type: 'clipboard',
      displayName: 'a',
      dataFileRef: 'clipboard-data/a.json',
      savedAt: 1,
      formats: ['text'],
    });
    const item = readItems()[0];
    expect(item).toMatchObject({ type: 'clipboard', dataFileRef: 'clipboard-data/a.json' });
    expect(item).not.toHaveProperty('path');
    expect(item).not.toHaveProperty('args');
    expect(manager.loadItems()[0]).not.toHaveProperty('launcherType');
  });

  it('廃止したウィンドウ操作の本体（古い CLI など）は、パスの無い単一アイテムにして書くこと', () => {
    const added = manager.addItem({ displayName: 'a', path: 'C:\\a.exe', type: 'app' });
    manager.updateItem(added.id, {
      type: 'window',
      displayName: 'メモ帳',
      windowTitle: '',
      processName: 'notepad.exe',
    } as never);
    expect(readItems()[0]).toMatchObject({
      type: 'item',
      displayName: 'メモ帳',
      path: '',
      window: { processName: 'notepad.exe' },
    });
    expect(readItems()[0]).not.toHaveProperty('windowTitle');
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

  describe('参照アイテム', () => {
    it('addRef は指す id と最後に見た表示名だけをファイルに書くこと', () => {
      const added = manager.addRef('Main0001', 'Visual Studio Code', 'g1');
      expect(added).toMatchObject({
        type: 'ref',
        refItemId: 'Main0001',
        displayName: 'Visual Studio Code',
        ref: { itemId: 'Main0001', lastKnownName: 'Visual Studio Code', status: 'missing' },
        groupId: 'g1',
      });
      expect(readItems()[0]).toEqual({
        id: added.id,
        type: 'ref',
        refItemId: 'Main0001',
        lastKnownName: 'Visual Studio Code',
        workspaceId: added.workspaceId,
        groupId: 'g1',
        order: 0,
        addedAt: added.addedAt,
      });
    });

    it('updateDisplayName は参照ならワークスペースでの表示名を書き、空なら消すこと', () => {
      const added = manager.addRef('Main0001', 'Visual Studio Code');
      manager.updateDisplayName(added.id, 'VSC');
      expect(readItems()[0]).toMatchObject({
        displayName: 'VSC',
        lastKnownName: 'Visual Studio Code',
      });
      manager.updateDisplayName(added.id, '  ');
      expect(readItems()[0].displayName).toBeUndefined();
      expect(manager.loadItems()[0].displayName).toBe('Visual Studio Code');
    });

    it('updateItem は参照の中身を直さないこと（メインウィンドウの編集画面で直す）', () => {
      const added = manager.addRef('Main0001', 'x');
      expect(() =>
        manager.updateItem(added.id, { type: 'item', displayName: 'y', path: 'notepad.exe' })
      ).toThrow('Reference item');
    });

    it('replaceWithRef・replaceWithContent は id・並び順・所属・追加日時を保って置き換えること', () => {
      const copy = manager.addItem(
        { displayName: 'メモ帳', path: 'notepad.exe', type: 'app' },
        'g1'
      );
      const linked = manager.replaceWithRef(copy.id, 'Main0001', 'Notepad', 'メモ帳');
      expect(linked).toMatchObject({
        id: copy.id,
        type: 'ref',
        groupId: 'g1',
        order: copy.order,
        addedAt: copy.addedAt,
        ref: { itemId: 'Main0001', alias: 'メモ帳' },
      });
      const back = manager.replaceWithContent(copy.id, {
        type: 'item',
        displayName: 'メモ帳',
        path: 'notepad.exe',
      });
      expect(back).toMatchObject({ id: copy.id, type: 'item', groupId: 'g1', order: copy.order });
      expect(readItems()[0]).not.toHaveProperty('refItemId');
    });

    it('duplicateItem は参照を参照のまま複製すること', () => {
      const added = manager.addRef('Main0001', 'x');
      manager.updateDisplayName(added.id, '別名');
      const dup = manager.duplicateItem(added.id);
      expect(readItems()[1]).toMatchObject({
        id: dup.id,
        type: 'ref',
        refItemId: 'Main0001',
        displayName: '別名',
      });
    });

    it('duplicateItem はクリップボードアイテムの実データを写し、元と同じファイルを指さないこと', () => {
      const added = manager.addItem({ displayName: 'a', path: 'C:\\a.exe', type: 'app' });
      manager.updateItem(added.id, {
        type: 'clipboard',
        displayName: 'メモ',
        dataFileRef: 'clipboard-data/a.json',
        savedAt: 1,
        formats: ['text'],
      });
      const copied: string[] = [];
      const dup = manager.duplicateItem(added.id, undefined, undefined, (ref) => {
        copied.push(ref);
        return 'clipboard-data/b.json';
      });
      expect(copied).toEqual(['clipboard-data/a.json']);
      expect(readItems().find((i) => i.id === dup.id)).toMatchObject({
        type: 'clipboard',
        dataFileRef: 'clipboard-data/b.json',
      });
      expect(readItems().find((i) => i.id === added.id)).toMatchObject({
        dataFileRef: 'clipboard-data/a.json',
      });
    });

    it('updateRefs で指す先を付け替えられること', () => {
      manager.addRef('Old00001', 'x');
      const changed = manager.updateRefs((item) => {
        item.ref.itemId = 'New00001';
        item.refItemId = 'New00001';
        return true;
      });
      expect(changed).toBe(true);
      expect(readItems()[0].refItemId).toBe('New00001');
      expect(manager.updateRefs(() => false, 'archive')).toBe(false);
    });
  });
});
