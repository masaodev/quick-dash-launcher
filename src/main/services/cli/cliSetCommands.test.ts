import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JsonItem } from '@common/types';

import { CliError } from './cliArgs';
import { runLauncherItemCommand } from './cliLauncherCommands';
import type { LauncherCommandContext, LauncherEntry, LauncherStore } from './cliLauncherCommands';
import { runLauncherSetCommand } from './cliSetCommands';

let entries: LauncherEntry[];
let store: LauncherStore & { append: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };
let ctx: LauncherCommandContext;

function entry(item: JsonItem, file = 'datafiles/data.json'): LauncherEntry {
  return { item, file };
}

beforeEach(() => {
  entries = [
    entry({ id: 'Memo0001', type: 'item', displayName: 'メモ帳', path: 'notepad.exe' }),
    entry({ id: 'Win00001', type: 'window', displayName: 'ターミナル', windowTitle: '*' }),
    entry({ id: 'Dir00001', type: 'dir', path: 'C:\\docs' }),
    entry(
      {
        id: 'Set00001',
        type: 'set',
        displayName: '朝',
        entries: [{ itemId: 'Memo0001' }, { open: { path: 'C:\\a\\議事録.txt' } }],
      },
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
    move: vi.fn(),
    remove: vi.fn(async () => {}),
    markFolder: async (p: string) => p,
    newId: () => 'NewSet01',
  };
  ctx = { store, cwd: 'C:\\work', syncBeforeWrite: vi.fn(async () => {}), changed: vi.fn() };
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

function setEntries(id = 'Set00001'): unknown {
  const found = entries.find((e) => e.item.id === id)?.item;
  return found && 'entries' in found ? found.entries : undefined;
}

describe('launcher item add --type set', () => {
  it('最初の行を --item（表示名）で渡して作る', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--type', 'set', '--name', '夜', '--item', 'メモ帳'],
      ctx
    );
    expect(r).toMatchObject({ id: 'NewSet01', type: 'set', entries: [{ itemId: 'Memo0001' }] });
    expect(store.append).toHaveBeenCalledOnce();
  });

  it('最初の行を --path と --args で渡すと、相対パスを実行したフォルダ基準にする', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--type', 'set', '--name', '夜', '--path', '.\\x.exe', '--args', '-v', '--label', 'X'],
      ctx
    );
    expect(r).toMatchObject({
      entries: [{ open: { path: 'C:\\work\\x.exe', args: '-v' }, label: 'X' }],
    });
  });

  it('行を渡さないと usage、--item と --set entries を両方渡しても usage', async () => {
    expect(
      (await errorOf(runLauncherItemCommand('add', ['--type', 'set', '--name', '夜'], ctx))).code
    ).toBe('usage');
    const both = await errorOf(
      runLauncherItemCommand(
        'add',
        ['--type', 'set', '--name', '夜', '--item', 'メモ帳', '--set', 'entries=[]'],
        ctx
      )
    );
    expect(both.code).toBe('usage');
  });

  it('セット以外に --item を付けると usage', async () => {
    const e = await errorOf(
      runLauncherItemCommand('add', ['--name', 'a', '--path', 'a.exe', '--item', 'メモ帳'], ctx)
    );
    expect(e.code).toBe('usage');
  });
});

describe('セットの行を --set entries で渡すときの確認', () => {
  it('知らないキー・空の行・無い itemId・行にできない種類は invalid', async () => {
    const codeOf = async (json: string) =>
      (await errorOf(runLauncherItemCommand('update', ['朝', '--set', `entries=${json}`], ctx)))
        .code;
    expect(await codeOf('[{"itemID":"Memo0001"}]')).toBe('invalid');
    expect(await codeOf('[{}]')).toBe('invalid');
    expect(await codeOf('[{"itemId":"Gone0001"}]')).toBe('invalid');
    expect(await codeOf('[{"itemId":"Dir00001"}]')).toBe('invalid');
    expect(store.replace).not.toHaveBeenCalled();
  });

  it('セットに --path・--args を渡すと usage（黙って捨てない）', async () => {
    const e = await errorOf(runLauncherItemCommand('update', ['朝', '--path', 'C:/x.exe'], ctx));
    expect(e.code).toBe('usage');
  });
});

describe('launcher set row list', () => {
  it('行番号と名前を付けて返し、見つからないアイテムの行に missing を付ける', async () => {
    (entries[3].item as { entries: unknown[] }).entries.push({
      itemId: 'Gone0001',
      label: '消した',
    });
    const r = await runLauncherSetCommand('row', 'list', ['朝'], ctx);
    expect(r).toMatchObject({
      set: { id: 'Set00001', displayName: '朝', file: 'datafiles/data2.json', tab: '仕事' },
      entries: [
        { index: 0, name: 'メモ帳', itemId: 'Memo0001' },
        { index: 1, name: '議事録.txt' },
        { index: 2, name: '消した', missing: true },
      ],
    });
  });

  it('セットでないアイテムの名前は not_found', async () => {
    expect((await errorOf(runLauncherSetCommand('row', 'list', ['メモ帳'], ctx))).code).toBe(
      'not_found'
    );
  });
});

describe('launcher set row add', () => {
  it('末尾に足し、トーストで知らせる', async () => {
    await runLauncherSetCommand('row', 'add', ['朝', '--item', 'Win00001'], ctx);
    expect(setEntries()).toEqual([
      { itemId: 'Memo0001' },
      { open: { path: 'C:\\a\\議事録.txt' } },
      { itemId: 'Win00001' },
    ]);
    expect(ctx.changed).toHaveBeenCalledWith(expect.stringContaining('ターミナル'));
  });

  it('--position で差し込む。範囲外は usage', async () => {
    await runLauncherSetCommand(
      'row',
      'add',
      ['朝', '--path', 'https://example.com/', '--position', '0'],
      ctx
    );
    expect(setEntries()).toMatchObject([{ open: { path: 'https://example.com/' } }, {}, {}]);
    const e = await errorOf(
      runLauncherSetCommand('row', 'add', ['朝', '--item', 'メモ帳', '--position', '9'], ctx)
    );
    expect(e.code).toBe('usage');
  });

  it('フォルダ取込（dir）やセットは行にできない', async () => {
    expect(
      (await errorOf(runLauncherSetCommand('row', 'add', ['朝', '--item', 'Dir00001'], ctx))).code
    ).toBe('invalid');
    expect(
      (await errorOf(runLauncherSetCommand('row', 'add', ['朝', '--item', 'Set00001'], ctx))).code
    ).toBe('invalid');
    // 表示名では行にできる種類だけを探す
    expect(
      (await errorOf(runLauncherSetCommand('row', 'add', ['朝', '--item', '朝'], ctx))).code
    ).toBe('not_found');
  });

  it('同じ名前のセットがあっても、行にできるアイテムを選ぶ', async () => {
    entries.push(
      entry({
        id: 'Set00002',
        type: 'set',
        displayName: 'メモ帳',
        entries: [{ itemId: 'Win00001' }],
      })
    );
    await runLauncherSetCommand('row', 'add', ['朝', '--item', 'メモ帳'], ctx);
    expect(setEntries()).toContainEqual({ itemId: 'Memo0001' });
  });

  it('--dry-run では書き込まない', async () => {
    const r = await runLauncherSetCommand(
      'row',
      'add',
      ['朝', '--item', 'メモ帳', '--dry-run'],
      ctx
    );
    expect(r).toMatchObject({ dryRun: true });
    expect(store.replace).not.toHaveBeenCalled();
    expect(ctx.syncBeforeWrite).not.toHaveBeenCalled();
  });
});

describe('launcher set row remove', () => {
  it('行番号で消す', async () => {
    await runLauncherSetCommand('row', 'remove', ['朝', '1'], ctx);
    expect(setEntries()).toEqual([{ itemId: 'Memo0001' }]);
    expect(ctx.changed).toHaveBeenCalledWith(expect.stringContaining('議事録.txt'));
  });

  it('範囲外の行番号は usage、最後の 1 行は conflict', async () => {
    expect((await errorOf(runLauncherSetCommand('row', 'remove', ['朝', '5'], ctx))).code).toBe(
      'usage'
    );
    await runLauncherSetCommand('row', 'remove', ['朝', '0'], ctx);
    expect((await errorOf(runLauncherSetCommand('row', 'remove', ['朝', '0'], ctx))).code).toBe(
      'conflict'
    );
  });
});

describe('launcher set の語の誤り', () => {
  it('row 以外・操作なしは usage', async () => {
    expect((await errorOf(runLauncherSetCommand('row', 'list', [], ctx))).code).toBe('usage');
    expect((await errorOf(runLauncherSetCommand('row', undefined, [], ctx))).code).toBe('usage');
  });
});
