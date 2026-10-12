import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JsonItem } from '@common/types';

import { CliError } from './cliArgs';
import { runLauncherItemCommand } from './cliLauncherCommands';
import type { LauncherCommandContext, LauncherEntry, LauncherStore } from './cliLauncherCommands';

let entries: LauncherEntry[];
let store: LauncherStore & { append: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };
let ctx: LauncherCommandContext;

function entry(item: JsonItem, file = 'datafiles/data.json'): LauncherEntry {
  return { item, file };
}

beforeEach(() => {
  entries = [
    entry({
      id: 'Memo0001',
      type: 'item',
      displayName: 'メモ帳',
      path: 'notepad.exe',
      memo: '既存',
    }),
    entry({ id: 'Dup00001', type: 'item', displayName: '議事録', path: 'C:\\a\\議事録' }),
    entry(
      { id: 'Dup00002', type: 'item', displayName: '議事録', path: 'C:\\b\\議事録' },
      'datafiles/data2.json'
    ),
  ];
  store = {
    load: vi.fn(async () => entries),
    dataFiles: () => ['datafiles/data.json', 'datafiles/data2.json'],
    tabs: async () => [
      { name: 'メイン', files: ['datafiles/data.json'] },
      { name: '仕事', files: ['datafiles/data2.json'] },
    ],
    append: vi.fn((file: string, item: JsonItem) => entries.push(entry(item, file))),
    replace: vi.fn((item: JsonItem) => {
      const i = entries.findIndex((e) => e.item.id === item.id);
      entries[i] = { ...entries[i], item };
    }),
    remove: vi.fn(async (id: string) => {
      entries = entries.filter((e) => e.item.id !== id);
    }),
    markFolder: async (p: string) => p,
    newId: () => 'NewId001',
  };
  ctx = { store, cwd: 'C:\\work\\案件A', syncBeforeWrite: vi.fn(async () => {}), changed: vi.fn() };
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

describe('launcher item add', () => {
  it('相対パスを実行したフォルダ基準にし、タブのファイルへ追加して id を返す', async () => {
    const result = (await runLauncherItemCommand(
      'add',
      ['--name', '資料', '--path', '.\\資料', '--tab', '仕事', '--memo', 'm'],
      ctx
    )) as Record<string, unknown>;
    expect(result).toMatchObject({
      id: 'NewId001',
      type: 'item',
      kind: 'folder',
      displayName: '資料',
      path: 'C:\\work\\案件A\\資料',
      memo: 'm',
      file: 'datafiles/data2.json',
      tab: '仕事',
    });
    expect(store.append).toHaveBeenCalledWith(
      'datafiles/data2.json',
      expect.objectContaining({ id: 'NewId001' })
    );
    expect(ctx.syncBeforeWrite).toHaveBeenCalled();
    expect(ctx.changed).toHaveBeenCalledWith('CLI: メイン画面に「資料」を追加しました');
  });

  it('PATH から探すコマンド・URL・%VAR% のパスはそのまま', async () => {
    for (const p of ['code', 'https://example.com/a', '%USERPROFILE%\\Desktop']) {
      const r = (await runLauncherItemCommand(
        'add',
        ['--name', 'x', '--path', p, '--dry-run'],
        ctx
      )) as {
        item: { path: string };
      };
      expect(r.item.path).toBe(p);
    }
  });

  it('--dry-run は読み直しも書き込みもしない', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--name', 'x', '--path', 'C:\\x', '--dry-run'],
      ctx
    );
    expect(r).toMatchObject({ dryRun: true });
    expect(store.append).not.toHaveBeenCalled();
    expect(ctx.syncBeforeWrite).not.toHaveBeenCalled();
    expect(ctx.changed).not.toHaveBeenCalled();
  });

  it('グループアイテムは --set の JSON で itemNames を渡す', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--type', 'group', '--name', '朝', '--set', 'itemNames=["メモ帳","議事録"]'],
      ctx
    );
    expect(r).toMatchObject({ type: 'group', itemNames: ['メモ帳', '議事録'] });
  });

  it('その種類に無い項目を --set すると、黙って落とさずに invalid', async () => {
    const e = await errorOf(
      runLauncherItemCommand(
        'add',
        ['--name', 'x', '--path', 'C:\\x', '--set', 'windowTitle=a'],
        ctx
      )
    );
    expect(e.code).toBe('invalid');
    expect(e.message).toContain('windowTitle');
    expect(store.append).not.toHaveBeenCalled();
  });

  it('必須の欠け・知らないファイル・知らない種類は断る', async () => {
    expect((await errorOf(runLauncherItemCommand('add', ['--path', 'C:\\x'], ctx))).code).toBe(
      'usage'
    );
    expect(
      (
        await errorOf(
          runLauncherItemCommand(
            'add',
            ['--name', 'x', '--path', 'C:\\x', '--file', 'data9.json'],
            ctx
          )
        )
      ).code
    ).toBe('not_found');
    expect(
      (await errorOf(runLauncherItemCommand('add', ['--type', 'clipboard', '--name', 'x'], ctx)))
        .code
    ).toBe('usage');
  });
});

describe('launcher item update / remove', () => {
  it('指定した項目だけ変え、変える前の内容も返す', async () => {
    const r = (await runLauncherItemCommand('update', ['メモ帳', '--name', 'メモ'], ctx)) as {
      before: Record<string, unknown>;
      item: Record<string, unknown>;
    };
    expect(r.before).toMatchObject({ displayName: 'メモ帳' });
    expect(r.item).toMatchObject({
      id: 'Memo0001',
      displayName: 'メモ',
      path: 'notepad.exe',
      memo: '既存',
    });
    expect(store.replace).toHaveBeenCalled();
  });

  it('--unset で任意の項目を外せる。必須の項目を外すと invalid', async () => {
    const r = (await runLauncherItemCommand('update', ['Memo0001', '--unset', 'memo'], ctx)) as {
      item: Record<string, unknown>;
    };
    expect(r.item.memo).toBeUndefined();
    expect(
      (await errorOf(runLauncherItemCommand('update', ['Memo0001', '--unset', 'path'], ctx))).code
    ).toBe('invalid');
  });

  it('表示名が複数に当たったら何も変えず、候補（id と場所）を返す', async () => {
    const e = await errorOf(runLauncherItemCommand('update', ['議事録', '--memo', 'x'], ctx));
    expect(e.code).toBe('ambiguous');
    expect(e.candidates).toEqual([
      { id: 'Dup00001', displayName: '議事録', location: ['メイン'] },
      { id: 'Dup00002', displayName: '議事録', location: ['仕事'] },
    ]);
    expect(store.replace).not.toHaveBeenCalled();
  });

  it('変える項目が無ければ usage、見つからなければ not_found', async () => {
    expect((await errorOf(runLauncherItemCommand('update', ['メモ帳'], ctx))).code).toBe('usage');
    expect((await errorOf(runLauncherItemCommand('remove', ['無い'], ctx))).code).toBe('not_found');
  });

  it('remove は消した内容を返す', async () => {
    const r = await runLauncherItemCommand('remove', ['Dup00002'], ctx);
    expect(r).toMatchObject({ removed: { id: 'Dup00002', tab: '仕事' } });
    expect(entries.map((e) => e.item.id)).toEqual(['Memo0001', 'Dup00001']);
  });
});

describe('launcher item list', () => {
  it('タブと語で絞り、種類（kind）と場所を付けて平らに返す', async () => {
    const r = (await runLauncherItemCommand(
      'list',
      ['--tab', 'メイン', '--grep', 'メモ'],
      ctx
    )) as Array<Record<string, unknown>>;
    expect(r).toEqual([
      expect.objectContaining({
        id: 'Memo0001',
        kind: 'app',
        file: 'datafiles/data.json',
        tab: 'メイン',
      }),
    ]);
  });
});
