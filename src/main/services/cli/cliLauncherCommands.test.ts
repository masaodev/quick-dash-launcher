import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JsonItem } from '@common/types';

import { CliError } from './cliArgs';
import { runLauncherItemCommand } from './cliLauncherCommands';
import type { LauncherCommandContext, LauncherEntry, LauncherStore } from './cliLauncherCommands';

let entries: LauncherEntry[];
let store: LauncherStore & {
  append: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  move: ReturnType<typeof vi.fn>;
};
let ctx: LauncherCommandContext;
let saved: number;

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
    move: vi.fn((item: JsonItem, _from: string, to: string) => {
      const i = entries.findIndex((e) => e.item.id === item.id);
      entries[i] = { item, file: to };
    }),
    remove: vi.fn(async (id: string) => {
      entries = entries.filter((e) => e.item.id !== id);
    }),
    markFolder: async (p: string) => p,
    newId: () => 'NewId001',
  };
  saved = 0;
  ctx = {
    store,
    cwd: 'C:\\work\\案件A',
    syncBeforeWrite: vi.fn(async () => {}),
    changed: vi.fn(),
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
    expect(ctx.changed).toHaveBeenCalledWith('CLI: メインウィンドウに「資料」を追加しました');
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

  it('セットは --set の JSON で entries を渡す', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--type', 'set', '--name', '朝', '--set', 'entries=[{"itemId":"Memo0001"}]'],
      ctx
    );
    expect(r).toMatchObject({ type: 'set', entries: [{ itemId: 'Memo0001' }] });
  });

  it('ウィンドウ切り替えはセットの行と同じキーで渡せる', async () => {
    const r = await runLauncherItemCommand(
      'add',
      [
        '--name',
        'メモ',
        '--path',
        'notepad.exe',
        '--set',
        'window={"processName":"notepad.exe"}',
        '--set',
        'placement={"x":0,"y":0}',
      ],
      ctx
    );
    expect(r).toMatchObject({
      window: { processName: 'notepad.exe' },
      placement: { x: 0, y: 0 },
    });
  });

  it('古い windowConfig= も受け付け、新しいキーに直して書く', async () => {
    await runLauncherItemCommand(
      'update',
      ['Memo0001', '--set', 'windowConfig={"title":"*","processName":"notepad.exe","x":10}'],
      ctx
    );
    const saved = entries.find((e) => e.item.id === 'Memo0001')!.item;
    expect(saved).not.toHaveProperty('windowConfig');
    expect(saved).toMatchObject({
      window: { processName: 'notepad.exe' },
      placement: { x: 10 },
      activateWindow: true,
    });
  });

  it('--set window=… で対象ウィンドウを渡せば --path なしで足せる（パスの無い単一アイテム）', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--name', 'MS To Do', '--set', 'window={"processName":"ApplicationFrameHost.exe"}'],
      ctx
    );
    expect(r).toMatchObject({
      kind: 'windowSwitch',
      path: '',
      window: { processName: 'ApplicationFrameHost.exe' },
    });
    // --path も対象ウィンドウも無ければ、どちらかを求める
    const none = await errorOf(runLauncherItemCommand('add', ['--name', 'x'], ctx));
    expect(none.code).toBe('usage');
    expect(none.message).toBe('--path か --set window=… を指定してください');
    // 中身の無い window では足せない
    const empty = await errorOf(
      runLauncherItemCommand('add', ['--name', 'x', '--set', 'window={}'], ctx)
    );
    expect(empty.code).toBe('invalid');
    expect(empty.message).toContain('--path か --set window=… を指定してください');
  });

  it('--set runAsAdmin=true で「常に管理者として実行」を付けられる（アプリだけ。セットは持たない）', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--name', '管理ツール', '--path', 'C:\\Tools\\admin.exe', '--set', 'runAsAdmin=true'],
      ctx
    );
    expect(r).toMatchObject({ runAsAdmin: true });

    const url = await errorOf(
      runLauncherItemCommand(
        'add',
        ['--name', 'サイト', '--path', 'https://example.com/', '--set', 'runAsAdmin=true'],
        ctx
      )
    );
    expect(url.code).toBe('invalid');
    expect(url.message).toContain('runAsAdmin はアプリ');

    const set = await errorOf(
      runLauncherItemCommand(
        'add',
        [
          '--type',
          'set',
          '--name',
          '朝',
          '--set',
          'entries=[{"itemId":"Memo0001"}]',
          '--set',
          'runAsAdmin=true',
        ],
        ctx
      )
    );
    expect(set.code).toBe('invalid');
    expect(set.message).toContain('runAsAdmin');
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

  it('廃止した --type window は断り、パスの無い単一アイテムの作り方を案内する', async () => {
    const window = await errorOf(
      runLauncherItemCommand(
        'add',
        ['--type', 'window', '--name', 'w', '--set', 'windowTitle=*メモ帳*'],
        ctx
      )
    );
    expect(window.code).toBe('usage');
    expect(window.message).toContain('--type window');
    expect(window.message).toContain('--set window=');
    expect(store.append).not.toHaveBeenCalled();
  });

  it('その種類に要る項目が無ければ、どう渡すかを日本語で案内する', async () => {
    const set = await errorOf(runLauncherItemCommand('add', ['--type', 'set', '--name', 'g'], ctx));
    expect(set.message).toContain('--item');
    const path = await errorOf(
      runLauncherItemCommand('update', ['Memo0001', '--unset', 'path'], ctx)
    );
    expect(path.message).toContain('キー path がありません（--path で渡してください）');
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

describe('launcher item update で別のタブへ移す', () => {
  it('--tab で id を保ったまま移し、移した先と元を返す', async () => {
    const r = (await runLauncherItemCommand('update', ['メモ帳', '--tab', '仕事'], ctx)) as Record<
      string,
      unknown
    >;
    expect(r).toMatchObject({
      before: { id: 'Memo0001', tab: 'メイン' },
      item: { id: 'Memo0001', file: 'datafiles/data2.json', tab: '仕事' },
      moved: { from: 'datafiles/data.json', to: 'datafiles/data2.json' },
    });
    expect(store.move).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Memo0001' }),
      'datafiles/data.json',
      'datafiles/data2.json'
    );
    expect(store.replace).not.toHaveBeenCalled();
    expect(ctx.changed).toHaveBeenCalledTimes(1);
  });

  it('本文の変更と同時にでき、--file でも指定できる', async () => {
    const r = (await runLauncherItemCommand(
      'update',
      ['Memo0001', '--file', 'data2.json', '--memo', '新'],
      ctx
    )) as { item: Record<string, unknown> };
    expect(r.item).toMatchObject({ memo: '新', file: 'datafiles/data2.json' });
    expect(store.move).toHaveBeenCalledWith(
      expect.objectContaining({ memo: '新' }),
      'datafiles/data.json',
      'datafiles/data2.json'
    );
  });

  it('今と同じタブなら書き込まず unchanged を返す（タブの 2 つ目のファイルにあっても）', async () => {
    store.tabs = async () => [
      { name: 'メイン', files: ['datafiles/data.json', 'datafiles/data2.json'] },
    ];
    const r = await runLauncherItemCommand('update', ['Dup00002', '--tab', 'メイン'], ctx);
    expect(r).toMatchObject({
      unchanged: true,
      item: { id: 'Dup00002', file: 'datafiles/data2.json' },
    });
    expect(store.move).not.toHaveBeenCalled();
    expect(store.replace).not.toHaveBeenCalled();
    expect(ctx.changed).not.toHaveBeenCalled();
  });

  it('--dry-run では移さない', async () => {
    const r = await runLauncherItemCommand('update', ['メモ帳', '--tab', '仕事', '--dry-run'], ctx);
    expect(r).toMatchObject({ dryRun: true, moved: { to: 'datafiles/data2.json' } });
    expect(store.move).not.toHaveBeenCalled();
  });

  it('自動取込のアイテムは conflict、無いタブは not_found、--file と --tab の両方は usage', async () => {
    entries.push(
      entry({
        id: 'Auto0001',
        type: 'item',
        displayName: 'ブックマーク',
        path: 'https://example.com/',
        autoImportRuleId: 'Rule0001',
      })
    );
    expect(
      (await errorOf(runLauncherItemCommand('update', ['Auto0001', '--tab', '仕事'], ctx))).code
    ).toBe('conflict');
    expect(
      (await errorOf(runLauncherItemCommand('update', ['メモ帳', '--tab', '無い'], ctx))).code
    ).toBe('not_found');
    expect(
      (
        await errorOf(
          runLauncherItemCommand('update', ['メモ帳', '--tab', '仕事', '--file', 'data2'], ctx)
        )
      ).code
    ).toBe('usage');
    expect(store.move).not.toHaveBeenCalled();
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

describe('launcher のクリップボードアイテム（テキスト）', () => {
  beforeEach(() => {
    entries.push(
      entry({
        id: 'Clip0001',
        type: 'clipboard',
        displayName: '定型文',
        dataFileRef: 'clipboard-data/Old00001.json',
        savedAt: 0,
        preview: '古い',
        formats: ['text'],
      }),
      entry({
        id: 'Clip0002',
        type: 'clipboard',
        displayName: '画像つき',
        dataFileRef: 'clipboard-data/Img00001.json',
        savedAt: 0,
        formats: ['text', 'image'],
      })
    );
  });

  it('--type clipboard --text で足し、検証の後に実データを保存する', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--type', 'clipboard', '--name', 'あいさつ', '--text', 'お世話になっております。'],
      ctx
    );
    expect(r).toMatchObject({
      id: 'NewId001',
      type: 'clipboard',
      displayName: 'あいさつ',
      dataFileRef: 'clipboard-data/Saved001.json',
      formats: ['text'],
      preview: 'お世話になっております。',
    });
    expect(ctx.clipboard.save).toHaveBeenCalledWith('お世話になっております。');
  });

  it('--dry-run・本文なし・--path 付きでは実データを保存しない', async () => {
    const r = await runLauncherItemCommand(
      'add',
      ['--type', 'clipboard', '--name', 'x', '--text', 'y', '--dry-run'],
      ctx
    );
    expect(r).toMatchObject({ dryRun: true, item: { dataFileRef: null, preview: 'y' } });
    expect(
      (await errorOf(runLauncherItemCommand('add', ['--type', 'clipboard', '--name', 'x'], ctx)))
        .code
    ).toBe('usage');
    expect(
      (
        await errorOf(
          runLauncherItemCommand(
            'add',
            ['--type', 'clipboard', '--name', 'x', '--text', 'y', '--path', 'a'],
            ctx
          )
        )
      ).code
    ).toBe('usage');
    expect(ctx.clipboard.save).not.toHaveBeenCalled();
  });

  it('テキストだけのものは本文を書き換え、実データの参照を差し替える', async () => {
    const r = (await runLauncherItemCommand('update', ['定型文', '--text', '新しい本文'], ctx)) as {
      before: Record<string, unknown>;
      item: Record<string, unknown>;
    };
    expect(r.before).toMatchObject({ dataFileRef: 'clipboard-data/Old00001.json' });
    expect(r.item).toMatchObject({
      id: 'Clip0001',
      dataFileRef: 'clipboard-data/Saved001.json',
      preview: '新しい本文',
    });
    expect(store.replace).toHaveBeenCalled();
  });

  it('テキスト以外を含むものは本文を書き換えず conflict、名前は変えられる', async () => {
    expect(
      (await errorOf(runLauncherItemCommand('update', ['画像つき', '--text', 'x'], ctx))).code
    ).toBe('conflict');
    expect(ctx.clipboard.save).not.toHaveBeenCalled();
    const r = (await runLauncherItemCommand('update', ['画像つき', '--name', '画像'], ctx)) as {
      item: Record<string, unknown>;
    };
    expect(r.item).toMatchObject({ displayName: '画像', formats: ['text', 'image'] });
  });

  it('--text はクリップボード以外には usage、参照の項目は --set で変えられない', async () => {
    expect(
      (await errorOf(runLauncherItemCommand('update', ['メモ帳', '--text', 'x'], ctx))).code
    ).toBe('usage');
    expect(
      (
        await errorOf(
          runLauncherItemCommand(
            'update',
            ['定型文', '--set', 'dataFileRef=clipboard-data/x.json'],
            ctx
          )
        )
      ).code
    ).toBe('usage');
  });

  it('list --with-text はテキストだけのものに本文を付ける', async () => {
    const r = (await runLauncherItemCommand('list', ['--with-text'], ctx)) as Record<
      string,
      unknown
    >[];
    expect(r.find((v) => v.id === 'Clip0001')?.text).toBe('本文:clipboard-data/Old00001.json');
    expect(r.find((v) => v.id === 'Clip0002')).not.toHaveProperty('text');
    expect(r.find((v) => v.id === 'Memo0001')).not.toHaveProperty('text');
  });
});
