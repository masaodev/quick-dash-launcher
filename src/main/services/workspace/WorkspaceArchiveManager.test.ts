import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileUtils } from '@common/utils/fileUtils';

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

import { WorkspaceArchiveManager } from './WorkspaceArchiveManager';
import type { WorkspaceFileStore } from './WorkspaceFileStore';
import { WorkspaceGroupManager } from './WorkspaceGroupManager';
import { WorkspaceItemManager } from './WorkspaceItemManager';
import { createTestWorkspaceStore, type TestWorkspaceStore } from './testStore';

describe('WorkspaceArchiveManager', () => {
  let test: TestWorkspaceStore;
  let store: WorkspaceFileStore;
  let manager: WorkspaceArchiveManager;
  let groups: WorkspaceGroupManager;
  let items: WorkspaceItemManager;

  beforeEach(async () => {
    test = await createTestWorkspaceStore('qdl-ws-archive-');
    tempRoot.dir = test.dir;
    store = test.store;
    manager = new WorkspaceArchiveManager(store);
    groups = new WorkspaceGroupManager(store);
    items = new WorkspaceItemManager(store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    test.cleanup();
  });

  const addItem = (name: string, groupId?: string) =>
    items.addItem({ displayName: name, path: `C:\\${name}.exe`, type: 'app' }, groupId);
  const addWorkspace = (name: string) => {
    const list = store.get('workspaces');
    const ws = { id: store.newId(), displayName: name, order: list.length, createdAt: 1 };
    store.set('workspaces', [...list, ws]);
    return ws;
  };

  /** 親（アイテム 1）＋子（アイテム 1）＋無関係のグループ（アイテム 1）を作る */
  function seedTree() {
    const parent = groups.createGroup('親');
    const child = groups.createGroup('子', undefined, parent.id);
    const other = groups.createGroup('別');
    const inParent = addItem('p', parent.id);
    const inChild = addItem('c', child.id);
    const inOther = addItem('o', other.id);
    return { parent, child, other, inParent, inChild, inOther };
  }

  describe('archiveGroup', () => {
    it('子孫ごとアーカイブへ移し、メタ（archivedAt / originalOrder / itemCount / archivedGroupId）を付けること', () => {
      const { parent, child, other, inParent, inChild } = seedTree();
      const spy = vi.spyOn(FileUtils, 'safeWriteTextFile');

      manager.archiveGroup(parent.id, groups.loadGroups(), items.loadItems());

      // main と archive に 1 回ずつ
      expect(spy).toHaveBeenCalledTimes(2);
      expect(groups.loadGroups().map((g) => g.id)).toEqual([other.id]);
      expect(items.loadItems()).toHaveLength(1);

      const archived = manager.loadArchivedGroups();
      const main = archived.find((g) => g.id === parent.id)!;
      const sub = archived.find((g) => g.id === child.id)!;
      // メインは子孫込みの件数、サブは直下の件数
      expect(main).toMatchObject({ originalOrder: parent.order, itemCount: 2 });
      expect(sub).toMatchObject({ parentGroupId: parent.id, itemCount: 1 });
      expect(typeof main.archivedAt).toBe('number');

      const archivedItems = manager.getAllArchivedItems();
      expect(archivedItems.map((i) => [i.id, i.archivedGroupId]).sort()).toEqual(
        [
          [inParent.id, parent.id],
          [inChild.id, child.id],
        ].sort()
      );
      expect(test.readArchive().items).toHaveLength(2);
    });

    it('存在しないグループは throw して何も書かないこと', () => {
      seedTree();
      const spy = vi.spyOn(FileUtils, 'safeWriteTextFile');
      expect(() =>
        manager.archiveGroup('missing1', groups.loadGroups(), items.loadItems())
      ).toThrow('Group not found');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('restoreGroup', () => {
    it('子孫ごと復元し、メタを外して末尾 order・親が現存すれば維持すること', () => {
      const { parent, child, other } = seedTree();
      manager.archiveGroup(child.id, groups.loadGroups(), items.loadItems());
      const extra = addItem('x', other.id);

      const { restoredGroup, restoredItems } = manager.restoreGroup(
        child.id,
        groups.loadGroups(),
        items.loadItems()
      );

      expect(restoredGroup).toMatchObject({ id: child.id, parentGroupId: parent.id });
      expect(restoredGroup).not.toHaveProperty('archivedAt');
      expect(restoredGroup).not.toHaveProperty('itemCount');
      expect(restoredGroup.order).toBe(Math.max(...[parent, other].map((g) => g.order)) + 1);
      expect(restoredItems).toHaveLength(1);
      expect(restoredItems[0]).not.toHaveProperty('archivedGroupId');
      expect(restoredItems[0].order).toBe(extra.order + 1);
      expect(restoredItems[0].groupId).toBe(child.id);
      expect(manager.loadArchivedGroups()).toEqual([]);
      expect(manager.getAllArchivedItems()).toEqual([]);
      expect(groups.loadGroups()).toHaveLength(3);
    });

    it('同名グループがあれば "(復元)" を付け、親が無くなっていればトップレベルにすること', () => {
      const { parent, child } = seedTree();
      manager.archiveGroup(child.id, groups.loadGroups(), items.loadItems());
      groups.deleteGroup(parent.id, false, items.loadItems());
      groups.createGroup('子');

      const { restoredGroup } = manager.restoreGroup(
        child.id,
        groups.loadGroups(),
        items.loadItems()
      );
      expect(restoredGroup.displayName).toBe('子 (復元)');
      expect(restoredGroup).not.toHaveProperty('parentGroupId');
    });

    it('元のワークスペースが無ければ既定ワークスペースに、指定があればそこへ復元すること', () => {
      const ws2 = addWorkspace('WS2');
      const g = groups.createGroup('g', undefined, undefined, ws2.id);
      const item = addItem('i', g.id);
      manager.archiveGroup(g.id, groups.loadGroups(), items.loadItems());
      store.set(
        'workspaces',
        store.get('workspaces').filter((w) => w.id !== ws2.id)
      );

      const { restoredGroup, restoredItems } = manager.restoreGroup(
        g.id,
        groups.loadGroups(),
        items.loadItems()
      );
      const defaultWs = store.resolveDefaultWorkspaceId();
      expect(restoredGroup.workspaceId).toBe(defaultWs);
      expect(restoredItems[0]).toMatchObject({ id: item.id, workspaceId: defaultWs });

      // 指定ワークスペースへ（同名でも改名しない・トップレベル）
      manager.archiveGroup(g.id, groups.loadGroups(), items.loadItems());
      const ws3 = addWorkspace('WS3');
      groups.createGroup('g');
      const moved = manager.restoreGroup(g.id, groups.loadGroups(), items.loadItems(), {
        targetWorkspaceId: ws3.id,
      });
      expect(moved.restoredGroup).toMatchObject({ displayName: 'g', workspaceId: ws3.id });
      expect(moved.restoredItems[0].workspaceId).toBe(ws3.id);
    });

    it('存在しないグループは throw すること', () => {
      expect(() => manager.restoreGroup('missing1', [], [])).toThrow('Archived group not found');
    });
  });

  describe('deleteArchivedGroup', () => {
    it('子孫グループとそのアイテムも消し、存在しなければ何もしないこと', () => {
      const { parent, other } = seedTree();
      manager.archiveGroup(parent.id, groups.loadGroups(), items.loadItems());
      manager.archiveGroup(other.id, groups.loadGroups(), items.loadItems());

      manager.deleteArchivedGroup(parent.id);
      expect(manager.loadArchivedGroups().map((g) => g.id)).toEqual([other.id]);
      expect(manager.getAllArchivedItems().map((i) => i.archivedGroupId)).toEqual([other.id]);

      const spy = vi.spyOn(FileUtils, 'safeWriteTextFile');
      manager.deleteArchivedGroup('missing1');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('restoreItemToWorkspace', () => {
    it('メタと groupId を外して指定ワークスペースの末尾に戻し、アーカイブから消すこと', () => {
      const { parent, inParent, inChild } = seedTree();
      manager.archiveGroup(parent.id, groups.loadGroups(), items.loadItems());
      const ws2 = addWorkspace('WS2');
      const last = addItem('last');

      manager.restoreItemToWorkspace(inChild.id, ws2.id, items.loadItems());

      const restored = items.loadItems().find((i) => i.id === inChild.id)!;
      expect(restored).toMatchObject({ workspaceId: ws2.id, order: last.order + 1 });
      expect(restored).not.toHaveProperty('groupId');
      expect(restored).not.toHaveProperty('archivedAt');
      expect(manager.getAllArchivedItems().map((i) => i.id)).toEqual([inParent.id]);

      expect(() => manager.restoreItemToWorkspace('missing1', ws2.id, items.loadItems())).toThrow(
        'Archived item not found'
      );
    });
  });
});
