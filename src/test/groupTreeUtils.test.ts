import { describe, it, expect } from 'vitest';
import type { WorkspaceGroup } from '@common/types';
import {
  getGroupDepth,
  canCreateSubgroup,
  getChildGroups,
  getDescendantGroupIds,
  buildGroupTree,
  flattenGroupTree,
  MAX_GROUP_DEPTH,
} from '@common/utils/groupTreeUtils';

function makeGroup(overrides: Partial<WorkspaceGroup> & { id: string }): WorkspaceGroup {
  return {
    displayName: overrides.id,
    color: 'var(--color-primary)',
    order: 0,
    collapsed: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('groupTreeUtils', () => {
  const topGroup = makeGroup({ id: 'top', order: 0 });
  const subGroup = makeGroup({ id: 'sub', parentGroupId: 'top', order: 0 });
  const subSubGroup = makeGroup({ id: 'subsub', parentGroupId: 'sub', order: 0 });
  const topGroup2 = makeGroup({ id: 'top2', order: 1 });
  const subGroup2 = makeGroup({ id: 'sub2', parentGroupId: 'top', order: 1 });
  const allGroups = [topGroup, subGroup, subSubGroup, topGroup2, subGroup2];

  describe('getGroupDepth', () => {
    it('トップレベルグループの深さは0', () => {
      expect(getGroupDepth('top', allGroups)).toBe(0);
    });

    it('サブグループの深さは1', () => {
      expect(getGroupDepth('sub', allGroups)).toBe(1);
    });

    it('サブサブグループの深さは2', () => {
      expect(getGroupDepth('subsub', allGroups)).toBe(2);
    });

    it('存在しないグループの深さは0', () => {
      expect(getGroupDepth('nonexistent', allGroups)).toBe(0);
    });
  });

  describe('canCreateSubgroup', () => {
    it('トップレベルグループにはサブグループ作成可能', () => {
      expect(canCreateSubgroup('top', allGroups)).toBe(true);
    });

    it('サブグループにはサブサブグループ作成可能（depth < MAX_GROUP_DEPTH）', () => {
      expect(canCreateSubgroup('sub', allGroups)).toBe(true);
    });

    it('サブサブグループにはさらにサブグループ作成不可（MAX_GROUP_DEPTH到達）', () => {
      expect(canCreateSubgroup('subsub', allGroups)).toBe(false);
    });
  });

  describe('getChildGroups', () => {
    it('トップレベルの子を取得', () => {
      const children = getChildGroups('top', allGroups);
      expect(children.map((c) => c.id)).toEqual(['sub', 'sub2']);
    });

    it('トップレベルグループ（親なし）を取得', () => {
      const topLevelGroups = getChildGroups(undefined, allGroups);
      expect(topLevelGroups.map((c) => c.id)).toEqual(['top', 'top2']);
    });

    it('子がないグループは空配列', () => {
      expect(getChildGroups('subsub', allGroups)).toEqual([]);
    });
  });

  describe('getDescendantGroupIds', () => {
    it('全子孫IDを取得', () => {
      const ids = getDescendantGroupIds('top', allGroups);
      expect(ids.sort()).toEqual(['sub', 'sub2', 'subsub'].sort());
    });

    it('リーフグループの子孫は空', () => {
      expect(getDescendantGroupIds('subsub', allGroups)).toEqual([]);
    });

    it('トップレベル2の子孫は空', () => {
      expect(getDescendantGroupIds('top2', allGroups)).toEqual([]);
    });
  });

  describe('buildGroupTree', () => {
    it('正しいツリー構造を構築', () => {
      const tree = buildGroupTree(allGroups);
      expect(tree.length).toBe(2); // top, top2

      const topNode = tree.find((n) => n.group.id === 'top')!;
      expect(topNode.depth).toBe(0);
      expect(topNode.children.length).toBe(2); // sub, sub2

      const subNode = topNode.children.find((n) => n.group.id === 'sub')!;
      expect(subNode.depth).toBe(1);
      expect(subNode.children.length).toBe(1); // subsub

      const subSubNode = subNode.children[0];
      expect(subSubNode.group.id).toBe('subsub');
      expect(subSubNode.depth).toBe(2);
      expect(subSubNode.children.length).toBe(0);
    });

    it('空配列からは空ツリー', () => {
      expect(buildGroupTree([])).toEqual([]);
    });
  });

  describe('flattenGroupTree', () => {
    it('ツリーを深さ優先で平坦化', () => {
      const tree = buildGroupTree(allGroups);
      const flat = flattenGroupTree(tree);
      const ids = flat.map((n) => n.group.id);
      // top -> sub -> subsub -> sub2 -> top2
      expect(ids).toEqual(['top', 'sub', 'subsub', 'sub2', 'top2']);
    });
  });

  describe('MAX_GROUP_DEPTH', () => {
    it('最大深さは2', () => {
      expect(MAX_GROUP_DEPTH).toBe(2);
    });
  });
});
