import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDefaultGroupColor } from '@common/groupColors';
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

import type { WorkspaceFileStore } from './WorkspaceFileStore';
import { WorkspaceGroupManager } from './WorkspaceGroupManager';
import { WorkspaceItemManager } from './WorkspaceItemManager';
import { applyOrders } from './orderUtils';
import { createTestWorkspaceStore, type TestWorkspaceStore } from './testStore';

describe('WorkspaceGroupManager', () => {
  let test: TestWorkspaceStore;
  let store: WorkspaceFileStore;
  let manager: WorkspaceGroupManager;
  let items: WorkspaceItemManager;

  beforeEach(async () => {
    test = await createTestWorkspaceStore('qdl-ws-groups-');
    tempRoot.dir = test.dir;
    store = test.store;
    manager = new WorkspaceGroupManager(store);
    items = new WorkspaceItemManager(store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    test.cleanup();
  });

  const readGroups = () => test.readMain().groups as Record<string, unknown>[];
  const addItem = (name: string, groupId?: string) =>
    items.addItem({ displayName: name, path: `C:\\${name}.exe`, type: 'app' }, groupId);

  describe('createGroup', () => {
    it('order は同じ親の中で末尾になり、workspaceId 省略時は既定ワークスペースになること', () => {
      const a = manager.createGroup('A');
      const b = manager.createGroup('B');
      expect([a.order, b.order]).toEqual([0, 1]);
      expect(a.workspaceId).toBe(store.resolveDefaultWorkspaceId());
      expect(a).not.toHaveProperty('parentGroupId');
      expect(a.color).toBe(getDefaultGroupColor(0));
      expect(readGroups()).toHaveLength(2);
    });

    it('サブグループは親の workspaceId を継承し、深さに応じた既定色になること', () => {
      const ws = store.get('workspaces');
      const parent = manager.createGroup('親', 'danger', undefined, ws[0].id);
      const child = manager.createGroup('子', undefined, parent.id);
      expect(child.parentGroupId).toBe(parent.id);
      expect(child.workspaceId).toBe(parent.workspaceId);
      expect(child.color).toBe(getDefaultGroupColor(1));
      expect(child.order).toBe(0);
    });

    it('不正な色は既定色に落とし、有効な色はそのまま使うこと', () => {
      expect(manager.createGroup('a', 'not-a-color').color).toBe(getDefaultGroupColor(0));
      expect(manager.createGroup('b', '#123456').color).toBe('#123456');
      expect(manager.createGroup('c', 'teal').color).toBe('teal');
    });

    it('親が無い・深さ超過なら throw して書かないこと', () => {
      expect(() => manager.createGroup('x', undefined, 'missing1')).toThrow(
        'Parent group not found'
      );
      const g0 = manager.createGroup('0');
      const g1 = manager.createGroup('1', undefined, g0.id);
      const g2 = manager.createGroup('2', undefined, g1.id);
      expect(() => manager.createGroup('3', undefined, g2.id)).toThrow(
        'Maximum subgroup depth exceeded'
      );
      expect(readGroups()).toHaveLength(3);
    });
  });

  describe('updateGroup', () => {
    it('displayName / color だけを更新し、id・order・createdAt・workspaceId は変えないこと', () => {
      const g = manager.createGroup('前');
      manager.updateGroup(g.id, { displayName: '後', color: 'pink' });
      const saved = manager.getGroupById(g.id)!;
      expect(saved).toEqual({ ...g, displayName: '後', color: 'pink' });
    });

    it('不正な色・存在しない id は throw すること', () => {
      const g = manager.createGroup('a');
      expect(() => manager.updateGroup(g.id, { color: 'nope' })).toThrow('Invalid group color');
      expect(() => manager.updateGroup('missing1', { displayName: 'x' })).toThrow(
        'Group not found'
      );
      expect(manager.getGroupById(g.id)!.color).toBe(g.color);
    });

    it('parentGroupId の変更は moveGroupToParent と同じ検証を通ること', () => {
      const parent = manager.createGroup('親');
      const child = manager.createGroup('子', undefined, parent.id);
      expect(() => manager.updateGroup(parent.id, { parentGroupId: child.id })).toThrow(
        'Cannot move a group into its own descendant'
      );
      manager.updateGroup(child.id, { parentGroupId: undefined });
      expect(manager.getGroupById(child.id)).not.toHaveProperty('parentGroupId');
    });
  });

  describe('deleteGroup', () => {
    it('子孫グループも消し、deleteItems=false なら配下のアイテムは未分類に残ること', () => {
      const parent = manager.createGroup('親');
      const child = manager.createGroup('子', undefined, parent.id);
      const other = manager.createGroup('別');
      const inChild = addItem('c', child.id);
      const inOther = addItem('o', other.id);

      const spy = vi.spyOn(FileUtils, 'safeWriteTextFile');
      const remaining = manager.deleteGroup(parent.id, false, items.loadItems());

      expect(spy).toHaveBeenCalledTimes(1);
      expect(readGroups().map((g) => g.id)).toEqual([other.id]);
      expect(remaining.find((i) => i.id === inChild.id)).not.toHaveProperty('groupId');
      expect(remaining.find((i) => i.id === inOther.id)?.groupId).toBe(other.id);
      expect(test.readMain().items).toHaveLength(2);
    });

    it('deleteItems=true なら子孫配下のアイテムも消えること', () => {
      const parent = manager.createGroup('親');
      const child = manager.createGroup('子', undefined, parent.id);
      addItem('c', child.id);
      const free = addItem('free');

      const remaining = manager.deleteGroup(parent.id, true, items.loadItems());
      expect(remaining.map((i) => i.id)).toEqual([free.id]);
      expect(test.readMain().items).toHaveLength(1);
    });

    it('存在しないグループは何も書かずにそのまま返すこと', () => {
      const free = addItem('free');
      const spy = vi.spyOn(FileUtils, 'safeWriteTextFile');
      const before = items.loadItems();
      expect(manager.deleteGroup('missing1', true, before)).toBe(before);
      expect(spy).not.toHaveBeenCalled();
      expect(items.loadItems().map((i) => i.id)).toEqual([free.id]);
    });
  });

  describe('moveGroupToParent', () => {
    it('undefined でトップレベルへ移り、新しい親の中で末尾 order になること', () => {
      const top1 = manager.createGroup('top1');
      const top2 = manager.createGroup('top2');
      const child = manager.createGroup('child', undefined, top1.id);

      manager.moveGroupToParent(child.id, undefined);
      const moved = manager.getGroupById(child.id)!;
      expect(moved).not.toHaveProperty('parentGroupId');
      expect(moved.order).toBe(top2.order + 1);

      manager.moveGroupToParent(child.id, top2.id);
      expect(manager.getGroupById(child.id)).toMatchObject({ parentGroupId: top2.id, order: 0 });
    });

    it('自分の子孫への移動・深さ超過・存在しない親は throw すること', () => {
      const g0 = manager.createGroup('0');
      const g1 = manager.createGroup('1', undefined, g0.id);
      const g2 = manager.createGroup('2', undefined, g1.id);
      const other = manager.createGroup('other');

      expect(() => manager.moveGroupToParent(g0.id, g2.id)).toThrow('own descendant');
      // other の下に g0（深さ 2 の部分木）を入れると深さ 3 になる
      expect(() => manager.moveGroupToParent(g0.id, other.id)).toThrow('maximum depth');
      expect(() => manager.moveGroupToParent(g2.id, 'missing1')).toThrow('Parent group not found');
      expect(manager.getGroupById(g0.id)).not.toHaveProperty('parentGroupId');
    });

    it('同じ親への移動は何もしないこと', () => {
      const top = manager.createGroup('top');
      const spy = vi.spyOn(FileUtils, 'safeWriteTextFile');
      manager.moveGroupToParent(top.id, undefined);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('reorderGroups', () => {
    it('指定順に order を振り、未指定のグループは保持し、不明な id は無視すること', () => {
      const a = manager.createGroup('a');
      const b = manager.createGroup('b');
      const c = manager.createGroup('c');

      manager.reorderGroups([c.id, 'missing1', a.id]);
      const byId = new Map(manager.loadGroups().map((g) => [g.id, g.order]));
      expect(byId.get(c.id)).toBe(0);
      expect(byId.get(a.id)).toBe(1);
      expect(byId.get(b.id)).toBe(b.order);
      expect(readGroups()).toHaveLength(3);
    });
  });

  describe('applyOrders（混在並べ替え）', () => {
    it('該当する要素だけ order を書き換え、更新件数を返すこと', () => {
      const list = [
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
        { id: 'c', order: 2 },
      ];
      const updated = applyOrders(
        list,
        new Map([
          ['a', 5],
          ['c', 2],
          ['zz', 9],
        ])
      );
      expect(updated).toBe(1);
      expect(list.map((e) => e.order)).toEqual([5, 1, 2]);
    });

    it('アイテムとグループを 1 回の書き込みで並べ替えられること', () => {
      const g = manager.createGroup('g');
      const i = addItem('i');
      const spy = vi.spyOn(FileUtils, 'safeWriteTextFile');

      store.update((main) => {
        applyOrders(main.items, new Map([[i.id, 1]]));
        applyOrders(main.groups, new Map([[g.id, 0]]));
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(manager.getGroupById(g.id)!.order).toBe(0);
      expect(items.loadItems()[0].order).toBe(1);
    });
  });
});
