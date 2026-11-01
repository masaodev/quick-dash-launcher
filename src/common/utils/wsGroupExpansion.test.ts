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

describe('アーカイブしたグループ（A3-227）', () => {
  function archived(id: string, workspaceId: string, extra: Partial<WorkspaceGroup> = {}) {
    return { ...group(id, workspaceId, 0, extra), archivedAt: 100, originalOrder: 0, itemCount: 0 };
  }
  // x は元のワークスペースがある、y は元のワークスペースが無くなった、ysub は一緒にしまったサブグループ
  const archivedGroups = [
    archived('x', 'w1'),
    archived('y', 'gone'),
    archived('ysub', 'gone', { parentGroupId: 'y' }),
  ];
  const candidates = listWsGroupCandidates(workspaces, groups, archivedGroups);
  const ids = (item: JsonWsGroupItem) =>
    resolveWsGroupTargets(item, candidates).map((c) => c.group.id);

  it('今あるグループの後ろに、しまった単位の最上位だけを並べること（元のワークスペースが無くても並べる）', () => {
    expect(candidates.map((c) => c.group.id)).toEqual(['c', 'b', 'a', 'x', 'y']);
    expect(candidates.find((c) => c.group.id === 'x')?.workspace?.id).toBe('w1');
    expect(candidates.find((c) => c.group.id === 'y')?.workspace).toBeUndefined();
  });

  it('scope が all なら、archived の指定で並べるものを選ぶこと（省略時は並べない）', () => {
    expect(ids(wsGroup({}))).toEqual(['c', 'b', 'a']);
    expect(ids(wsGroup({ archived: 'exclude' }))).toEqual(['c', 'b', 'a']);
    expect(ids(wsGroup({ archived: 'include' }))).toEqual(['c', 'b', 'a', 'x', 'y']);
    expect(ids(wsGroup({ archived: 'only' }))).toEqual(['x', 'y']);
  });

  it('selected で選んだアーカイブしたグループは並べ、見つからない id に数えないこと', () => {
    const item = wsGroup({ scope: 'selected', groupIds: ['x', 'a', 'deleted'] });
    expect(ids(item)).toEqual(['a', 'x']);
    expect(findMissingWsGroupIds(item, candidates)).toEqual(['deleted']);
  });

  it('展開したアイテムに archived を付けること（今あるグループには付けない）', () => {
    const item = wsGroup({ scope: 'selected', groupIds: ['x', 'a'] });
    const expanded = expandWsGroupItem(item, candidates, 'data.json', 1);
    expect(expanded.map((e) => [e.groupId, e.archived])).toEqual([
      ['a', undefined],
      ['x', true],
    ]);
  });
});
