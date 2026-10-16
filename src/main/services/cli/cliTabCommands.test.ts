import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { DataFileTab } from '@common/types';
import { setTabManagerTranslator } from '@common/utils/tabManager';
import type { TabStructure } from '@common/utils/tabManager';

import { CliError } from './cliArgs';
import { runLauncherTabCommand } from './cliTabCommands';
import type { TabCommandContext, TabStore } from './cliTabCommands';

let tabs: DataFileTab[];
let labels: Record<string, string>;
let counts: Map<string, number>;
let calls: string[];
let store: TabStore;
let ctx: TabCommandContext;

beforeAll(() => {
  // 失敗の理由はキーのまま返す（文言ではなく code を確かめる）
  setTabManagerTranslator((key) => key);
});

beforeEach(() => {
  tabs = [
    { name: 'メイン', files: ['datafiles/data.json', 'datafiles/data4.json'] },
    { name: 'Window', files: ['datafiles/data3.json'] },
    { name: '仕事', files: ['datafiles/data2.json'] },
  ];
  labels = {
    'datafiles/data.json': 'メイン用',
    'datafiles/data4.json': 'ブックマーク',
    'datafiles/data3.json': 'Window用',
    'datafiles/data2.json': '仕事用',
  };
  counts = new Map([
    ['datafiles/data.json', 5],
    ['datafiles/data3.json', 2],
  ]);
  calls = [];
  store = {
    load: async () => ({
      tabs,
      labels,
      defaultFileTab: 'datafiles/data.json',
      showDataFileTabs: true,
    }),
    filesOnDisk: () => [
      'datafiles/data.json',
      'datafiles/data2.json',
      'datafiles/data3.json',
      'datafiles/data4.json',
      'datafiles/data5.json',
    ],
    countItems: async () => counts,
    createFile: vi.fn((file: string) => {
      calls.push(`create ${file}`);
    }),
    deleteFile: vi.fn(async (file: string) => {
      calls.push(`delete ${file}`);
      return [];
    }),
    save: vi.fn(async (structure: TabStructure) => {
      calls.push('save');
      tabs = structure.tabs;
      labels = structure.labels;
    }),
  };
  ctx = { store, syncBeforeWrite: vi.fn(async () => {}), changed: vi.fn() };
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

describe('launcher tab list', () => {
  it('タブごとのファイルと件数、既定のタブ、どのタブにも無いファイルを返す', async () => {
    const r = (await runLauncherTabCommand('list', [], ctx)) as {
      tabs: Record<string, unknown>[];
      unassignedFiles: Record<string, unknown>[];
    };
    expect(r.tabs[0]).toMatchObject({
      index: 0,
      name: 'メイン',
      itemCount: 5,
      default: true,
      files: [
        { file: 'datafiles/data.json', label: 'メイン用', itemCount: 5 },
        { file: 'datafiles/data4.json', label: 'ブックマーク', itemCount: 0 },
      ],
    });
    expect(r.tabs[1]).toMatchObject({ name: 'Window', default: false });
    expect(r.unassignedFiles).toEqual([
      { file: 'datafiles/data5.json', label: 'datafiles/data5.json', itemCount: 0 },
    ]);
  });
});

describe('launcher tab add / update', () => {
  it('新しいデータファイルを作ってから設定を保存し、位置を指定できる', async () => {
    const r = await runLauncherTabCommand(
      'add',
      ['--name', '株', '--label', '株の銘柄', '--position', '1'],
      ctx
    );
    expect(r).toMatchObject({
      tab: {
        index: 1,
        name: '株',
        files: [{ file: 'datafiles/data6.json', label: '株の銘柄', itemCount: 0 }],
      },
    });
    expect(calls).toEqual(['create datafiles/data6.json', 'save']);
    expect(tabs.map((t) => t.name)).toEqual(['メイン', '株', 'Window', '仕事']);
    expect(ctx.changed).toHaveBeenCalledTimes(1);
  });

  it('--dry-run では作らず保存しない。名前が無ければ usage', async () => {
    const r = await runLauncherTabCommand('add', ['--name', '株', '--dry-run'], ctx);
    expect(r).toMatchObject({ dryRun: true, tab: { name: '株' } });
    expect(calls).toEqual([]);
    expect((await errorOf(runLauncherTabCommand('add', [], ctx))).code).toBe('usage');
  });

  it('タブ表示がオフなら tabsHidden を付ける', async () => {
    store.load = async () => ({
      tabs,
      labels,
      defaultFileTab: 'datafiles/data.json',
      showDataFileTabs: false,
    });
    const r = await runLauncherTabCommand('add', ['--name', '株', '--dry-run'], ctx);
    expect(r).toMatchObject({ tabsHidden: true });
  });

  it('番号でも名前でも指定でき、改名と並べ替えを返す', async () => {
    const r = (await runLauncherTabCommand(
      'update',
      ['2', '--name', '業務', '--position', '0'],
      ctx
    )) as { before: Record<string, unknown>; tab: Record<string, unknown> };
    expect(r.before).toMatchObject({ index: 2, name: '仕事' });
    expect(r.tab).toMatchObject({ index: 0, name: '業務' });
    expect(tabs.map((t) => t.name)).toEqual(['業務', 'メイン', 'Window']);
    expect(calls).toEqual(['save']);
  });

  it('無いタブは not_found、変えるものが無ければ usage', async () => {
    expect(
      (await errorOf(runLauncherTabCommand('update', ['無い', '--name', 'x'], ctx))).code
    ).toBe('not_found');
    expect((await errorOf(runLauncherTabCommand('update', ['仕事'], ctx))).code).toBe('usage');
  });
});

describe('launcher tab remove', () => {
  it('消えるファイルが空なら、設定を保存してからファイルを消す', async () => {
    const r = await runLauncherTabCommand('remove', ['仕事'], ctx);
    expect(r).toMatchObject({ removed: { name: '仕事' }, deletedFiles: ['datafiles/data2.json'] });
    expect(calls).toEqual(['save', 'delete datafiles/data2.json']);
  });

  it('アイテムが入ったファイルが消えるときは conflict で何もしない', async () => {
    const e = await errorOf(runLauncherTabCommand('remove', ['Window'], ctx));
    expect(e.code).toBe('conflict');
    expect(e.message).toContain('datafiles/data3.json');
    expect(calls).toEqual([]);
  });

  it('メインのデータファイルを持つタブは conflict', async () => {
    expect((await errorOf(runLauncherTabCommand('remove', ['メイン'], ctx))).code).toBe('conflict');
  });
});

describe('launcher tab file', () => {
  it('新しいファイルを名前つきで作ってタブに入れる', async () => {
    const r = await runLauncherTabCommand('file', ['add', '仕事', '--label', '議事録'], ctx);
    expect(r).toMatchObject({
      file: { file: 'datafiles/data6.json', label: '議事録', created: true },
      tab: {
        name: '仕事',
        files: [{ file: 'datafiles/data2.json' }, { file: 'datafiles/data6.json' }],
      },
    });
    expect(calls).toEqual(['create datafiles/data6.json', 'save']);
  });

  it('--existing でタブに無いファイルを入れる。無いファイルは not_found', async () => {
    const r = await runLauncherTabCommand(
      'file',
      ['add', '仕事', '--existing', 'data5.json', '--label', '旧データ'],
      ctx
    );
    expect(r).toMatchObject({
      file: { file: 'datafiles/data5.json', label: '旧データ', created: false },
    });
    expect(calls).toEqual(['save']);
    expect(
      (await errorOf(runLauncherTabCommand('file', ['add', '仕事', '--existing', 'data9'], ctx)))
        .code
    ).toBe('not_found');
  });

  it('名前を変え、どのタブにも無いファイルは not_found', async () => {
    const r = await runLauncherTabCommand('file', ['update', 'data3.json', '--label', '窓'], ctx);
    expect(r).toMatchObject({ before: { label: 'Window用' }, file: { label: '窓' } });
    expect(
      (await errorOf(runLauncherTabCommand('file', ['update', 'data5', '--label', 'x'], ctx))).code
    ).toBe('not_found');
  });

  it('空のファイルは外して消し、アイテムのあるファイル・メインのファイルは conflict', async () => {
    const r = await runLauncherTabCommand('file', ['remove', 'メイン', 'ブックマーク'], ctx);
    expect(r).toMatchObject({ removed: { file: 'datafiles/data4.json' }, deleted: true });
    expect(calls).toEqual(['save', 'delete datafiles/data4.json']);
    expect(
      (await errorOf(runLauncherTabCommand('file', ['remove', 'Window', 'data3'], ctx))).code
    ).toBe('conflict');
    expect(
      (await errorOf(runLauncherTabCommand('file', ['remove', 'メイン', 'data.json'], ctx))).code
    ).toBe('conflict');
  });

  it('ほかのタブでも使っているファイルは外すだけで消さない', async () => {
    tabs[2] = { name: '仕事', files: ['datafiles/data2.json', 'datafiles/data3.json'] };
    const r = await runLauncherTabCommand('file', ['remove', '仕事', 'data3'], ctx);
    expect(r).toMatchObject({ deleted: false });
    expect(calls).toEqual(['save']);
  });
});
