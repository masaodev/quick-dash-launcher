import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AppItem,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
  Workspace,
  WorkspaceGroupView,
  WorkspaceItem,
  WorkspaceItemUpdate,
} from '@common/types';

import { CliError } from './cliArgs';
import { runWorkspaceCommand } from './cliWorkspaceCommands';
import type { WorkspaceCommandContext, WorkspaceStore } from './cliWorkspaceCommands';

let workspaces: Workspace[];
let groups: WorkspaceGroupView[];
let items: WorkspaceItem[];
let archivedGroups: ArchivedWorkspaceGroup[];
let archivedItems: ArchivedWorkspaceItem[];
let ctx: WorkspaceCommandContext;
let nextId: number;
let saved: number;

function group(id: string, name: string, order: number, extra: Partial<WorkspaceGroupView> = {}) {
  return {
    id,
    displayName: name,
    color: 'primary',
    order,
    createdAt: 0,
    workspaceId: 'Ws000001',
    collapsed: false,
    ...extra,
  } as WorkspaceGroupView;
}

function item(id: string, name: string, order: number, groupId?: string, workspaceId = 'Ws000001') {
  return {
    id,
    type: 'item',
    displayName: name,
    path: `C:\\${name}`,
    launcherType: 'folder',
    icon: 'data:image/png;base64,AAAA',
    workspaceId,
    groupId,
    order,
    addedAt: 0,
  } as WorkspaceItem;
}

beforeEach(() => {
  nextId = 1;
  saved = 0;
  workspaces = [
    { id: 'Ws000001', displayName: '仕事', order: 0, createdAt: 0 },
    { id: 'Ws000002', displayName: '私用', order: 1, createdAt: 0 },
  ];
  groups = [
    group('GrA00001', '案件A', 0),
    group('GrSub001', '資料', 1, { parentGroupId: 'GrA00001' }),
    group('GrEmpty1', '空', 2),
  ];
  items = [item('It000001', '議事録', 0, 'GrA00001'), item('It000002', '設計', 2, 'GrA00001')];
  archivedGroups = [
    { ...group('ArG00001', '旧案件', 0), archivedAt: 0, originalOrder: 0, itemCount: 1 },
    {
      ...group('ArSub001', '旧資料', 1, { parentGroupId: 'ArG00001' }),
      archivedAt: 0,
      originalOrder: 1,
      itemCount: 1,
    },
    {
      ...group('ArG00002', '迷子', 2, { workspaceId: 'WsGone01' }),
      archivedAt: 0,
      originalOrder: 2,
      itemCount: 0,
    },
  ] as ArchivedWorkspaceGroup[];
  archivedItems = [
    { ...item('ArIt0001', '古い', 0, 'ArG00001'), archivedAt: 0, archivedGroupId: 'ArG00001' },
    { ...item('ArIt0002', '古い資料', 0, 'ArSub001'), archivedAt: 0, archivedGroupId: 'ArSub001' },
  ] as ArchivedWorkspaceItem[];

  const store: WorkspaceStore = {
    loadWorkspaces: async () => [...workspaces].sort((a, b) => a.order - b.order),
    createWorkspace: async (name: string) => {
      const created = { id: 'WsNew001', displayName: name, order: workspaces.length, createdAt: 0 };
      workspaces.push(created);
      return created;
    },
    renameWorkspace: async (id: string, name: string) => {
      workspaces = workspaces.map((w) => (w.id === id ? { ...w, displayName: name } : w));
    },
    deleteWorkspace: vi.fn(async (id: string) => {
      workspaces = workspaces.filter((w) => w.id !== id);
    }),
    reorderWorkspaces: async (ids: string[]) => {
      workspaces = workspaces.map((w) => ({ ...w, order: ids.indexOf(w.id) }));
    },
    loadGroups: async () => groups,
    loadItems: async () => items,
    addItem: async (app: AppItem, groupId?: string, workspaceId?: string) => {
      const a = app as AppItem & { displayName: string; path: string; type: string };
      const added = {
        ...item(`New${String(nextId++).padStart(5, '0')}`, a.displayName, 99, groupId, workspaceId),
        path: a.path,
        launcherType: a.type,
      } as WorkspaceItem;
      items.push(added);
      return added;
    },
    updateItem: async (id: string, update: WorkspaceItemUpdate) => {
      items = items.map((i) => (i.id === id ? ({ ...i, ...update } as WorkspaceItem) : i));
    },
    removeItem: async (id: string) => {
      items = items.filter((i) => i.id !== id);
    },
    moveItemToGroup: async (id: string, groupId?: string) => {
      items = items.map((i) => (i.id === id ? { ...i, groupId } : i));
    },
    moveItemToWorkspace: async (id: string, workspaceId: string) => {
      items = items.map((i) => (i.id === id ? { ...i, workspaceId, groupId: undefined } : i));
    },
    reorderMixed: async (_parent, entries) => {
      entries.forEach((e, index) => {
        if (e.kind === 'item')
          items = items.map((i) => (i.id === e.id ? { ...i, order: index } : i));
        else groups = groups.map((g) => (g.id === e.id ? { ...g, order: index } : g));
      });
    },
    createGroup: async (name, color, parentGroupId, workspaceId) => {
      const created = group('GrNew001', name, 9, {
        color: color ?? 'primary',
        parentGroupId,
        workspaceId: workspaceId ?? 'Ws000001',
      });
      groups.push(created);
      return created;
    },
    updateGroup: async (id, updates) => {
      groups = groups.map((g) => (g.id === id ? { ...g, ...updates } : g));
    },
    deleteGroup: async (id) => {
      groups = groups.filter((g) => g.id !== id);
    },
    archiveGroup: vi.fn(async (id: string) => {
      groups = groups.filter((g) => g.id !== id && g.parentGroupId !== id);
    }),
    loadArchivedGroups: async () => archivedGroups,
    loadArchivedItems: async () => archivedItems,
    moveGroupToWorkspace: vi.fn(async (id: string, workspaceId: string) => {
      const found = archivedGroups.find((g) => g.id === id)!;
      archivedGroups = archivedGroups.filter((g) => g.id !== id);
      groups.push(group(found.id, found.displayName, 9, { workspaceId }));
    }),
  };
  ctx = {
    store,
    cwd: 'C:\\work',
    markFolder: async (p) => p,
    syncBeforeWrite: vi.fn(async () => {}),
    changed: vi.fn(),
    beforeGroupRemoved: vi.fn(async () => {}),
    clipboard: {
      save: vi.fn((text: string) => ({
        dataFileRef: `clipboard-data/Saved${String(++saved).padStart(3, '0')}.json`,
        savedAt: 1,
        preview: text.slice(0, 100),
        formats: ['text' as const],
      })),
      read: vi.fn((ref: string) => `本文:${ref}`),
    },
  };
});

async function errorOf(promise: Promise<unknown>): Promise<CliError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error('例外が出なかった');
}

describe('workspace item', () => {
  it('グループに追加して位置を指定すると、サブグループも含めた並びのその位置に入る', async () => {
    const r = (await runWorkspaceCommand(
      'item',
      'add',
      ['--name', 'メモ', '--path', '.\\メモ', '--group', '案件A', '--position', '1'],
      ctx
    )) as Record<string, unknown>;
    expect(r).toMatchObject({
      displayName: 'メモ',
      path: 'C:\\work\\メモ',
      kind: 'folder',
      location: ['仕事', '案件A'],
    });
    expect(r).not.toHaveProperty('icon');
    expect(r).not.toHaveProperty('launcherType');
    // 並び: 議事録(0) → メモ(1) → 資料(サブグループ) → 設計
    const order = (id: string) =>
      items.find((i) => i.id === id)?.order ?? groups.find((g) => g.id === id)?.order;
    expect([order('It000001'), order(String(r.id)), order('GrSub001'), order('It000002')]).toEqual([
      0, 1, 2, 3,
    ]);
    expect(ctx.changed).toHaveBeenCalledWith('CLI: ワークスペースに「メモ」を追加しました');
  });

  it('--group "" で未分類へ、--workspace だけなら移った先の未分類へ移す', async () => {
    await runWorkspaceCommand('item', 'update', ['議事録', '--group', ''], ctx);
    expect(items.find((i) => i.id === 'It000001')?.groupId).toBeUndefined();
    const r = (await runWorkspaceCommand(
      'item',
      'update',
      ['設計', '--workspace', '私用'],
      ctx
    )) as {
      item: Record<string, unknown>;
    };
    expect(r.item.location).toEqual(['私用']);
  });

  it('本文の変更は今の内容に当て、変える前の内容も返す', async () => {
    const r = (await runWorkspaceCommand(
      'item',
      'update',
      ['It000001', '--memo', '毎週'],
      ctx
    )) as {
      before: Record<string, unknown>;
      item: Record<string, unknown>;
    };
    expect(r.before.memo).toBeUndefined();
    expect(r.item).toMatchObject({
      displayName: '議事録',
      memo: '毎週',
      location: ['仕事', '案件A'],
    });
  });

  it('知らないグループは not_found、変える項目が無ければ usage', async () => {
    expect(
      (
        await errorOf(
          runWorkspaceCommand(
            'item',
            'add',
            ['--name', 'x', '--path', 'C:\\x', '--group', '無い'],
            ctx
          )
        )
      ).code
    ).toBe('not_found');
    expect((await errorOf(runWorkspaceCommand('item', 'update', ['議事録'], ctx))).code).toBe(
      'usage'
    );
  });

  it('list は場所付きの平らな配列で、グループで絞れる', async () => {
    const r = (await runWorkspaceCommand('item', 'list', ['--group', '案件A'], ctx)) as Array<
      Record<string, unknown>
    >;
    expect(r.map((i) => i.displayName)).toEqual(['議事録', '設計']);
  });
});

describe('workspace group', () => {
  it('親を指定して追加でき、不正な色は invalid', async () => {
    const r = await runWorkspaceCommand(
      'group',
      'add',
      ['--name', '会議', '--parent', '案件A'],
      ctx
    );
    expect(r).toMatchObject({ displayName: '会議', location: ['仕事', '案件A', '会議'] });
    expect(
      (await errorOf(runWorkspaceCommand('group', 'add', ['--name', 'x', '--color', 'red'], ctx)))
        .code
    ).toBe('invalid');
  });

  it('空でないグループは消さずに conflict、空のグループは切り離しウィンドウを閉じてから消す', async () => {
    expect((await errorOf(runWorkspaceCommand('group', 'remove', ['案件A'], ctx))).code).toBe(
      'conflict'
    );
    await runWorkspaceCommand('group', 'remove', ['空'], ctx);
    expect(ctx.beforeGroupRemoved).toHaveBeenCalledWith('GrEmpty1');
    expect(groups.map((g) => g.id)).not.toContain('GrEmpty1');
  });

  it('--parent "" で最上位へ移す', async () => {
    const r = (await runWorkspaceCommand('group', 'update', ['資料', '--parent', ''], ctx)) as {
      group: Record<string, unknown>;
    };
    expect(r.group.parentGroupId).toBeNull();
  });
});

describe('workspace list', () => {
  it('ワークスペースごとの件数を返す', async () => {
    expect(await runWorkspaceCommand('list', undefined, [], ctx)).toEqual([
      { id: 'Ws000001', displayName: '仕事', order: 0, groupCount: 3, itemCount: 2 },
      { id: 'Ws000002', displayName: '私用', order: 1, groupCount: 0, itemCount: 0 },
    ]);
  });
});

describe('workspace add / update / remove', () => {
  it('追加して位置を指定すると、その位置に入る', async () => {
    const r = await runWorkspaceCommand('add', '--name', ['株', '--position', '0'], ctx);
    expect(r).toMatchObject({ id: 'WsNew001', displayName: '株', order: 0 });
    const list = (await runWorkspaceCommand('list', undefined, [], ctx)) as { id: string }[];
    expect(list.map((w) => w.id)).toEqual(['WsNew001', 'Ws000001', 'Ws000002']);
    expect(ctx.changed).toHaveBeenCalledTimes(1);
  });

  it('--dry-run では追加しない', async () => {
    const r = await runWorkspaceCommand('add', '--name', ['株', '--dry-run'], ctx);
    expect(r).toEqual({ dryRun: true, workspace: { id: null, displayName: '株' } });
    expect(workspaces).toHaveLength(2);
    expect(ctx.syncBeforeWrite).not.toHaveBeenCalled();
  });

  it('改名と並べ替えができ、変える前の内容も返す', async () => {
    const r = (await runWorkspaceCommand(
      'update',
      '私用',
      ['--name', '生活', '--position', '0'],
      ctx
    )) as { before: Record<string, unknown>; workspace: Record<string, unknown> };
    expect(r.before).toMatchObject({ id: 'Ws000002', displayName: '私用', order: 1 });
    expect(r.workspace).toMatchObject({ id: 'Ws000002', displayName: '生活', order: 0 });
  });

  it('変えるものが無ければ usage、空の名前も usage', async () => {
    expect((await errorOf(runWorkspaceCommand('update', '私用', [], ctx))).code).toBe('usage');
    expect((await errorOf(runWorkspaceCommand('update', '私用', ['--name', ' '], ctx))).code).toBe(
      'usage'
    );
  });

  it('中身のあるワークスペースは消さずに conflict、空のものは消す', async () => {
    expect((await errorOf(runWorkspaceCommand('remove', '仕事', [], ctx))).code).toBe('conflict');
    await runWorkspaceCommand('remove', '私用', [], ctx);
    expect(workspaces.map((w) => w.id)).toEqual(['Ws000001']);
  });

  it('最後の 1 つは空でも conflict', async () => {
    workspaces = [{ id: 'Ws000002', displayName: '私用', order: 0, createdAt: 0 }];
    expect((await errorOf(runWorkspaceCommand('remove', '私用', [], ctx))).code).toBe('conflict');
    expect(ctx.store.deleteWorkspace).not.toHaveBeenCalled();
  });
});

describe('workspace group archive / archive list / archive restore', () => {
  it('archive は子孫まで数え、切り離しウィンドウを閉じてからしまう', async () => {
    const r = await runWorkspaceCommand('group', 'archive', ['案件A'], ctx);
    expect(r).toMatchObject({ archived: { id: 'GrA00001', itemCount: 2, subgroupCount: 1 } });
    expect(ctx.beforeGroupRemoved).toHaveBeenCalledWith('GrA00001');
    expect(ctx.store.archiveGroup).toHaveBeenCalledWith('GrA00001');
  });

  it('archive の --dry-run はしまわない', async () => {
    const r = await runWorkspaceCommand('group', 'archive', ['案件A', '--dry-run'], ctx);
    expect(r).toMatchObject({ dryRun: true, archived: { id: 'GrA00001' } });
    expect(ctx.store.archiveGroup).not.toHaveBeenCalled();
    expect(ctx.beforeGroupRemoved).not.toHaveBeenCalled();
  });

  it('list は最上位のグループだけを、サブグループ名と子孫までの件数つきで返す', async () => {
    const r = (await runWorkspaceCommand('archive', 'list', [], ctx)) as Record<string, unknown>[];
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      id: 'ArG00001',
      workspace: '仕事',
      itemCount: 2,
      subgroups: ['旧資料'],
    });
    expect(r[1]).toMatchObject({ id: 'ArG00002', workspace: null });
  });

  it('restore は省略時に元のワークスペースへ、元が無ければ既定のワークスペースへ戻す', async () => {
    await runWorkspaceCommand('archive', 'restore', ['旧案件'], ctx);
    expect(ctx.store.moveGroupToWorkspace).toHaveBeenCalledWith('ArG00001', 'Ws000001');
    const r = await runWorkspaceCommand('archive', 'restore', ['迷子'], ctx);
    expect(ctx.store.moveGroupToWorkspace).toHaveBeenCalledWith('ArG00002', 'Ws000001');
    expect(r).toMatchObject({ restored: { id: 'ArG00002', location: ['仕事', '迷子'] } });
  });

  it('restore は --workspace で復元先を選べ、--dry-run では戻さない', async () => {
    const r = await runWorkspaceCommand(
      'archive',
      'restore',
      ['旧案件', '--workspace', '私用', '--dry-run'],
      ctx
    );
    expect(r).toMatchObject({ dryRun: true, workspace: '私用', restoring: { id: 'ArG00001' } });
    expect(ctx.store.moveGroupToWorkspace).not.toHaveBeenCalled();
    await runWorkspaceCommand('archive', 'restore', ['旧案件', '--workspace', '私用'], ctx);
    expect(ctx.store.moveGroupToWorkspace).toHaveBeenCalledWith('ArG00001', 'Ws000002');
  });

  it('一緒にしまったサブグループだけは指定できず not_found、操作が無ければ usage', async () => {
    expect((await errorOf(runWorkspaceCommand('archive', 'restore', ['旧資料'], ctx))).code).toBe(
      'not_found'
    );
    expect((await errorOf(runWorkspaceCommand('archive', undefined, [], ctx))).code).toBe('usage');
  });
});

describe('workspace のクリップボードアイテム（テキスト）', () => {
  it('--type clipboard --text でグループに足す', async () => {
    const addItem = vi.spyOn(ctx.store, 'addItem');
    const r = await runWorkspaceCommand(
      'item',
      'add',
      ['--type', 'clipboard', '--name', 'あいさつ', '--text', 'こんにちは', '--group', '案件A'],
      ctx
    );
    expect(r).toMatchObject({ displayName: 'あいさつ', location: ['仕事', '案件A'] });
    // 画面からの追加と同じ形（ClipboardItem）で本体に渡す
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'clipboard',
        displayName: 'あいさつ',
        clipboardDataRef: 'clipboard-data/Saved001.json',
        formats: ['text'],
        preview: 'こんにちは',
      }),
      'GrA00001',
      'Ws000001'
    );
  });

  it('テキストだけのものは本文を書き換え、テキスト以外を含むものは conflict', async () => {
    items.push(
      {
        ...item('ClipW001', '定型', 5),
        type: 'clipboard',
        dataFileRef: 'clipboard-data/Old00001.json',
        savedAt: 0,
        formats: ['text'],
      } as unknown as WorkspaceItem,
      {
        ...item('ClipW002', '画像', 6),
        type: 'clipboard',
        dataFileRef: 'clipboard-data/Img00001.json',
        savedAt: 0,
        formats: ['image'],
      } as unknown as WorkspaceItem
    );
    await runWorkspaceCommand('item', 'update', ['定型', '--text', '新しい'], ctx);
    expect(items.find((i) => i.id === 'ClipW001')).toMatchObject({
      dataFileRef: 'clipboard-data/Saved001.json',
      preview: '新しい',
    });
    expect(
      (await errorOf(runWorkspaceCommand('item', 'update', ['画像', '--text', 'x'], ctx))).code
    ).toBe('conflict');
    const listed = (await runWorkspaceCommand('item', 'list', ['--with-text'], ctx)) as Record<
      string,
      unknown
    >[];
    expect(listed.find((v) => v.id === 'ClipW001')?.text).toBe('本文:clipboard-data/Saved001.json');
    expect(listed.find((v) => v.id === 'ClipW002')).not.toHaveProperty('text');
  });
});
