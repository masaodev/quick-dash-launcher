import { describe, expect, it } from 'vitest';

import type { JsonWsGroupItem } from '../types/json-data';
import type { Workspace, WorkspaceGroup } from '../types/workspace';
import { isLauncherItem, isWsGroupItem } from '../types/guards';

import {
  expandWsGroupItem,
  findMissingWsGroupIds,
  listWsGroupCandidates,
  resolveWsGroupTargets,
} from './wsGroupExpansion';

function workspace(id: string, order: number): Workspace {
  return { id, displayName: `WS-${id}`, order, createdAt: 0 };
}

function group(
  id: string,
  workspaceId: string,
  order: number,
  extra: Partial<WorkspaceGroup> = {}
): WorkspaceGroup {
  return {
    id,
    displayName: `G-${id}`,
    color: 'primary',
    order,
    createdAt: 0,
    workspaceId,
    ...extra,
  };
}

// ワークスペース 2 つ（w2 が先）。w1 にはサブグループもある
const workspaces = [workspace('w1', 1), workspace('w2', 0)];
const groups = [
  group('a', 'w1', 1),
  group('b', 'w1', 0),
  group('sub', 'w1', 0, { parentGroupId: 'b' }),
  group('c', 'w2', 0),
  group('orphan', 'gone', 0),
];

function wsGroup(extra: Partial<JsonWsGroupItem>): JsonWsGroupItem {
  return { id: 'wsgrp001', type: 'wsgroup', scope: 'all', ...extra };
}

describe('listWsGroupCandidates', () => {
  it('ワークスペースの順 → グループの順に並べ、サブグループとワークスペースの無いグループを除くこと', () => {
    const ids = listWsGroupCandidates(workspaces, groups).map((c) => c.group.id);
    expect(ids).toEqual(['c', 'b', 'a']);
  });
});

describe('resolveWsGroupTargets・findMissingWsGroupIds', () => {
  const candidates = listWsGroupCandidates(workspaces, groups);

  it('scope が all ならすべてのグループを返すこと', () => {
    expect(resolveWsGroupTargets(wsGroup({}), candidates).map((c) => c.group.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('selected なら選んだグループを、選んだ順でなくワークスペースの順で返すこと', () => {
    const item = wsGroup({ scope: 'selected', groupIds: ['a', 'c'] });
    expect(resolveWsGroupTargets(item, candidates).map((c) => c.group.id)).toEqual(['c', 'a']);
  });

  it('消えたグループ・サブグループの id は並べず、見つからない id として返すこと', () => {
    const item = wsGroup({ scope: 'selected', groupIds: ['a', 'deleted', 'sub'] });
    expect(resolveWsGroupTargets(item, candidates).map((c) => c.group.id)).toEqual(['a']);
    expect(findMissingWsGroupIds(item, candidates)).toEqual(['deleted', 'sub']);
  });

  it('scope が all なら見つからない id は無いこと', () => {
    expect(findMissingWsGroupIds(wsGroup({ groupIds: ['deleted'] }), candidates)).toEqual([]);
  });
});

describe('expandWsGroupItem', () => {
  const candidates = listWsGroupCandidates(workspaces, groups);

  it('グループ 1 つを 1 件にし、表示名に前後の文字を付けること', () => {
    const item = wsGroup({
      scope: 'selected',
      groupIds: ['b'],
      options: { prefix: '[', suffix: ']' },
    });
    expect(expandWsGroupItem(item, candidates, 'data.json', 3)).toEqual([
      {
        type: 'wsgroup',
        displayName: '[G-b]',
        groupId: 'b',
        color: 'primary',
        sourceFile: 'data.json',
        lineNumber: 3,
        expandedFromId: 'wsgrp001',
      },
    ]);
  });

  it('展開したアイテムは WSグループとして判定され、単一アイテムとは扱わないこと', () => {
    const [expanded] = expandWsGroupItem(wsGroup({}), candidates, 'data.json', 1);
    expect(isWsGroupItem(expanded)).toBe(true);
    expect(isLauncherItem(expanded)).toBe(false);
  });
});
