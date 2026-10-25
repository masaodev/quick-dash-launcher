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
import type { LauncherEntry } from './cliLauncherCommands';

let workspaces: Workspace[];
let groups: WorkspaceGroupView[];
let items: WorkspaceItem[];
let archivedGroups: ArchivedWorkspaceGroup[];
let archivedItems: ArchivedWorkspaceItem[];
let ctx: WorkspaceCommandContext;
let nextId: number;
let saved: number;
let linkCandidates: Record<string, string[]>;

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
  linkCandidates = {};
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
    canRef: async (itemId: string) => !unrefable.has(itemId),
    addRef: async (itemId: string, groupId?: string, workspaceId?: string) => {
      const added = {
        ...item(
          `Ref${String(nextId++).padStart(5, '0')}`,
          `参照${itemId}`,
          99,
          groupId,
          workspaceId
        ),
        ref: { itemId, status: 'ok', mainDisplayName: `参照${itemId}` },
      } as WorkspaceItem;
      items.push(added);
      return added;
    },
    updateDisplayName: async (id: string, displayName: string) => {
      items = items.map((i) =>
        i.id === id && i.ref
          ? ({
              ...i,
              displayName: displayName || i.ref.mainDisplayName,
              ref: { ...i.ref, alias: displayName || undefined },
            } as WorkspaceItem)
          : i.id === id
            ? { ...i, displayName }
            : i
      );
    },
    convertToCopy: async (id: string) => {
      items = items.map((i) => (i.id === id ? ({ ...i, ref: undefined } as WorkspaceItem) : i));
      return items.find((i) => i.id === id)!;
    },
    linkToMain: async (id: string, mainItemId: string) => {
      items = items.map((i) =>
        i.id === id
          ? ({
              ...i,
              ref: { itemId: mainItemId, status: 'ok', mainDisplayName: i.displayName },
            } as WorkspaceItem)
          : i
      );
      return items.find((i) => i.id === id)!;
    },
    findLinkCandidates: async (id: string) => linkCandidates[id] ?? [],
    moveToMain: vi.fn(async (id: string, file: string) => {
      items = items.map((i) =>
        i.id === id
          ? ({
              ...i,
              ref: { itemId: 'Moved001', status: 'ok', mainDisplayName: i.displayName },
            } as WorkspaceItem)
          : i
      );
      return {
        item: items.find((i) => i.id === id)!,
        file,
        tabName: file === 'datafiles/data2.json' ? '仕事' : 'メイン',
        reused: false,
      };
    }),
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
    launcher: {
      load: async () => launcherEntries,
      dataFiles: () => ['datafiles/data.json', 'datafiles/data2.json'],
      tabs: async () => [
        { name: 'メイン', files: ['datafiles/data.json'] },
        { name: '仕事', files: ['datafiles/data2.json'] },
      ],
      append: vi.fn(),
      replace: vi.fn(),
      move: vi.fn(),
      remove: vi.fn(),
      markFolder: async (p: string) => p,
      newId: () => 'NewId001',
    },
    // 本体の変換（convertJsonItemToAppItems）の代わり。フォルダ取込は 1 件にならないので undefined
    launcherAppItem: vi.fn(async ({ item: json }: LauncherEntry) => {
      if (json.type === 'dir') return undefined;
      if (json.type === 'clipboard') {
        const { dataFileRef, ...rest } = json;
        return { ...rest, clipboardDataRef: dataFileRef } as AppItem;
      }
      if (json.type === 'item') return { ...json, type: 'url' } as AppItem;
      return json as unknown as AppItem;
    }),
    duplicateClipboardData: vi.fn((ref: string) => ref.replace('.json', '-copy.json')),
  };
});

let launcherEntries: LauncherEntry[];
/** 参照できない（表に無い）ことにするメインウィンドウのアイテムの id */
let unrefable: Set<string>;
beforeEach(() => {
  unrefable = new Set();
  launcherEntries = [
    {
      item: {
        id: 'Gmail001',
        type: 'item',
        displayName: 'Gmail',
        path: 'https://mail.google.com/',
      },
      file: 'datafiles/data.json',
    },
    {
      item: {
        id: 'SetMorn1',
        type: 'set',
        displayName: '朝',
        entries: [{ itemId: 'Gmail001' }, { open: { path: 'C:\\memo.txt' }, label: 'メモ' }],
        launchMode: 'sequential',
      },
      file: 'datafiles/data2.json',
    },
    {
      item: {
        id: 'Clip0001',
        type: 'clipboard',
        displayName: 'スクショ',
        dataFileRef: 'clipboard-data/Clip0001.json',
        savedAt: 1,
        preview: '',
        formats: ['image'],
      },
      file: 'datafiles/data.json',
    },
    { item: { id: 'Dir00001', type: 'dir', path: 'C:\\tools' }, file: 'datafiles/data.json' },
    {
      item: { id: 'Dup00001', type: 'item', displayName: '重複', path: 'C:\\a' },
      file: 'datafiles/data.json',
    },
    {
      item: { id: 'Dup00002', type: 'item', displayName: '重複', path: 'C:\\b' },
      file: 'datafiles/data2.json',
    },
    {
      item: { id: 'Bad00001', type: 'item', displayName: '壊れた', path: '' },
      file: 'datafiles/data.json',
      invalid: 'path が空です',
    },
  ] as LauncherEntry[];
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

  it('未分類は無いので、--group "" は使えず、グループのあるワークスペースへは --group が要る（A3-157）', async () => {
    expect(
      (await errorOf(runWorkspaceCommand('item', 'update', ['議事録', '--group', ''], ctx))).code
    ).toBe('usage');
    expect(
      (await errorOf(runWorkspaceCommand('item', 'add', ['--name', 'x', '--path', 'C:\\x'], ctx)))
        .code
    ).toBe('usage');
    expect(items.find((i) => i.id === 'It000001')?.groupId).toBe('GrA00001');
  });

  it('グループの無いワークスペースへは --workspace だけで移せる（入れるときに「未分類」グループが作られる）', async () => {
    const moveItemToWorkspace = vi.spyOn(ctx.store, 'moveItemToWorkspace');
    await runWorkspaceCommand('item', 'update', ['設計', '--workspace', '私用'], ctx);
    expect(moveItemToWorkspace).toHaveBeenCalledWith('It000002', 'Ws000002', undefined);
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
  it('廃止した --type window は断り、パスの無い単一アイテムの作り方を案内する', async () => {
    const e = await errorOf(
      runWorkspaceCommand('item', 'add', ['--type', 'window', '--name', 'メモ帳'], ctx)
    );
    expect(e.code).toBe('usage');
    expect(e.message).toContain('--set window=');
  });

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

describe('workspace item add --from（メインウィンドウのアイテムを参照・コピーで足す）', () => {
  it('既定は参照で足す（--name はワークスペースでの表示名）', async () => {
    const addRef = vi.spyOn(ctx.store, 'addRef');
    const addItem = vi.spyOn(ctx.store, 'addItem');
    const r = (await runWorkspaceCommand(
      'item',
      'add',
      ['--from', '朝', '--group', '案件A', '--name', '朝セット'],
      ctx
    )) as Record<string, unknown>;
    expect(addRef).toHaveBeenCalledWith('SetMorn1', 'GrA00001', 'Ws000001');
    expect(addItem).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      displayName: '朝セット',
      ref: { itemId: 'SetMorn1', alias: '朝セット' },
      location: ['仕事', '案件A'],
      from: { id: 'SetMorn1' },
    });
  });

  it('参照できないアイテムはコピーで足し、fellBackToCopy で知らせる（--dry-run も同じ）', async () => {
    unrefable.add('SetMorn1');
    const addRef = vi.spyOn(ctx.store, 'addRef');
    const dry = (await runWorkspaceCommand(
      'item',
      'add',
      ['--from', 'SetMorn1', '--group', '案件A', '--dry-run'],
      ctx
    )) as Record<string, unknown>;
    expect(dry).toMatchObject({ dryRun: true, fellBackToCopy: true });
    expect((dry.item as Record<string, unknown>).type).not.toBe('ref');
    const r = (await runWorkspaceCommand(
      'item',
      'add',
      ['--from', 'SetMorn1', '--group', '案件A'],
      ctx
    )) as Record<string, unknown>;
    expect(addRef).not.toHaveBeenCalled();
    expect(r).toMatchObject({ fellBackToCopy: true, from: { id: 'SetMorn1' } });
  });

  it('--copy で足したときは fellBackToCopy を付けない', async () => {
    const r = (await runWorkspaceCommand(
      'item',
      'add',
      ['--from', 'SetMorn1', '--copy', '--group', '案件A'],
      ctx
    )) as Record<string, unknown>;
    expect(r.fellBackToCopy).toBeUndefined();
  });

  it('参照の --dry-run は足さずに参照の形を返す', async () => {
    const r = (await runWorkspaceCommand(
      'item',
      'add',
      ['--from', 'SetMorn1', '--group', '案件A', '--dry-run'],
      ctx
    )) as { dryRun: boolean; item: Record<string, unknown> };
    expect(r.item).toMatchObject({
      type: 'ref',
      refItemId: 'SetMorn1',
      displayName: '朝',
      id: null,
    });
    expect(items).toHaveLength(2);
  });

  it('--copy は --from と一緒にだけ使える（usage）', async () => {
    const e = await errorOf(
      runWorkspaceCommand('item', 'add', ['--name', 'x', '--path', 'C:\\x', '--copy'], ctx)
    );
    expect(e.code).toBe('usage');
  });

  it('--copy ならセットを行ごと写し、行はメインウィンドウのアイテムを id で指したまま', async () => {
    const addItem = vi.spyOn(ctx.store, 'addItem');
    const r = await runWorkspaceCommand(
      'item',
      'add',
      ['--from', '朝', '--copy', '--group', '案件A', '--position', '0'],
      ctx
    );
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'set',
        displayName: '朝',
        entries: [{ itemId: 'Gmail001' }, { open: { path: 'C:\\memo.txt' }, label: 'メモ' }],
        launchMode: 'sequential',
      }),
      'GrA00001',
      'Ws000001'
    );
    expect(r).toMatchObject({
      location: ['仕事', '案件A'],
      from: { id: 'SetMorn1', displayName: '朝', location: ['仕事'] },
    });
    expect(ctx.syncBeforeWrite).toHaveBeenCalled();
    expect(ctx.changed).toHaveBeenCalled();
  });

  it('--copy で --name で名前を変えて写せ、--dry-run では足さずに写す中身を返す', async () => {
    const r = (await runWorkspaceCommand(
      'item',
      'add',
      ['--from', 'SetMorn1', '--copy', '--name', '朝の準備', '--group', '案件A', '--dry-run'],
      ctx
    )) as { dryRun: boolean; item: Record<string, unknown> };
    expect(r.dryRun).toBe(true);
    expect(r.item).toMatchObject({ type: 'set', displayName: '朝の準備', id: null });
    expect(r.item.entries).toHaveLength(2);
    expect(items).toHaveLength(2);
    expect(ctx.syncBeforeWrite).not.toHaveBeenCalled();
  });

  it('--copy のクリップボードアイテムは実データを複製し、ワークスペース側に自分のファイルを持たせる', async () => {
    const addItem = vi.spyOn(ctx.store, 'addItem');
    await runWorkspaceCommand(
      'item',
      'add',
      ['--from', 'スクショ', '--copy', '--group', '案件A'],
      ctx
    );
    expect(ctx.duplicateClipboardData).toHaveBeenCalledWith('clipboard-data/Clip0001.json');
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'clipboard',
        clipboardDataRef: 'clipboard-data/Clip0001-copy.json',
        formats: ['image'],
      }),
      'GrA00001',
      'Ws000001'
    );
  });

  it('フォルダ取込は conflict、不正なアイテムは invalid、名前が複数なら候補つきで ambiguous', async () => {
    expect(
      (await errorOf(runWorkspaceCommand('item', 'add', ['--from', 'Dir00001'], ctx))).code
    ).toBe('conflict');
    expect(
      (await errorOf(runWorkspaceCommand('item', 'add', ['--from', '壊れた'], ctx))).code
    ).toBe('invalid');
    const e = await errorOf(runWorkspaceCommand('item', 'add', ['--from', '重複'], ctx));
    expect(e.code).toBe('ambiguous');
    expect(e.candidates?.map((c) => c.location)).toEqual([['メイン'], ['仕事']]);
    expect((await errorOf(runWorkspaceCommand('item', 'add', ['--from', '無い'], ctx))).code).toBe(
      'not_found'
    );
  });

  it('中身を決めるオプションとは一緒に使えない（usage）', async () => {
    for (const extra of [
      ['--path', 'C:\\x'],
      ['--memo', 'm'],
      ['--type', 'set'],
      ['--text', 't'],
      ['--set', 'args=x'],
      ['--name', ' '],
    ]) {
      const e = await errorOf(runWorkspaceCommand('item', 'add', ['--from', '朝', ...extra], ctx));
      expect(e.code).toBe('usage');
    }
  });
});

describe('workspace item move-to-main（コピーをメインウィンドウへ移して参照にする）', () => {
  it('既定のデータファイルへ移し、参照になったアイテムと移した先を返す', async () => {
    const r = (await runWorkspaceCommand('item', 'move-to-main', ['It000001'], ctx)) as Record<
      string,
      unknown
    >;
    expect(ctx.store.moveToMain).toHaveBeenCalledWith('It000001', 'datafiles/data.json');
    expect(r).toMatchObject({
      file: 'datafiles/data.json',
      reused: false,
      item: { id: 'It000001', ref: { itemId: 'Moved001' } },
    });
  });

  it('--tab はそのタブの先頭のデータファイル、--file はそのファイルへ移す', async () => {
    await runWorkspaceCommand('item', 'move-to-main', ['It000001', '--tab', '仕事'], ctx);
    expect(ctx.store.moveToMain).toHaveBeenLastCalledWith('It000001', 'datafiles/data2.json');
    await runWorkspaceCommand('item', 'move-to-main', ['It000002', '--file', 'data2.json'], ctx);
    expect(ctx.store.moveToMain).toHaveBeenLastCalledWith('It000002', 'datafiles/data2.json');
    const both = await errorOf(
      runWorkspaceCommand(
        'item',
        'move-to-main',
        ['It000001', '--file', 'data.json', '--tab', 'メイン'],
        ctx
      )
    );
    expect(both.code).toBe('usage');
  });

  it('--dry-run は移さずに移す先を返し、参照は conflict', async () => {
    const r = (await runWorkspaceCommand(
      'item',
      'move-to-main',
      ['It000001', '--dry-run'],
      ctx
    )) as Record<string, unknown>;
    expect(r).toMatchObject({ dryRun: true, file: 'datafiles/data.json' });
    expect(ctx.store.moveToMain).not.toHaveBeenCalled();

    await runWorkspaceCommand('item', 'move-to-main', ['It000001'], ctx);
    const e = await errorOf(runWorkspaceCommand('item', 'move-to-main', ['It000001'], ctx));
    expect(e.code).toBe('conflict');
  });
});

describe('workspace item update / convert（参照アイテム）', () => {
  beforeEach(async () => {
    await runWorkspaceCommand('item', 'add', ['--from', '朝', '--group', '案件A'], ctx);
  });

  const refId = () => items.find((i) => i.ref)!.id;

  it('参照は --name（ワークスペースでの表示名）と置き場所だけ変えられ、中身は conflict', async () => {
    const r = (await runWorkspaceCommand('item', 'update', [refId(), '--name', '朝'], ctx)) as {
      item: Record<string, unknown>;
    };
    expect(r.item).toMatchObject({ displayName: '朝' });
    for (const extra of [
      ['--path', 'C:\\x'],
      ['--memo', 'm'],
      ['--set', 'args=x'],
    ]) {
      const e = await errorOf(runWorkspaceCommand('item', 'update', [refId(), ...extra], ctx));
      expect(e.code).toBe('conflict');
    }
  });

  it('convert --to copy で参照をコピーにし、コピーには conflict', async () => {
    const id = refId();
    await runWorkspaceCommand('item', 'convert', [id, '--to', 'copy'], ctx);
    expect(items.find((i) => i.id === id)?.ref).toBeUndefined();
    const e = await errorOf(runWorkspaceCommand('item', 'convert', [id, '--to', 'copy'], ctx));
    expect(e.code).toBe('conflict');
  });

  it('convert --to ref は --from か、パスが同じ候補 1 件で参照にする', async () => {
    const linkToMain = vi.spyOn(ctx.store, 'linkToMain');
    await runWorkspaceCommand('item', 'convert', ['It000001', '--to', 'ref', '--from', '朝'], ctx);
    expect(linkToMain).toHaveBeenCalledWith('It000001', 'SetMorn1');

    expect(
      (await errorOf(runWorkspaceCommand('item', 'convert', ['It000002', '--to', 'ref'], ctx))).code
    ).toBe('not_found');
    linkCandidates = { It000002: ['Gmail001'] };
    await runWorkspaceCommand('item', 'convert', ['It000002', '--to', 'ref'], ctx);
    expect(linkToMain).toHaveBeenCalledWith('It000002', 'Gmail001');
    linkCandidates = { It000002: ['Gmail001', 'SetMorn1'] };
    expect(
      (await errorOf(runWorkspaceCommand('item', 'convert', ['It000002', '--to', 'ref'], ctx))).code
    ).toBe('ambiguous');
    expect(
      (await errorOf(runWorkspaceCommand('item', 'convert', ['It000002', '--to', 'x'], ctx))).code
    ).toBe('usage');
  });
});
