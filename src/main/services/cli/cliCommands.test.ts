import { describe, it, expect, vi, afterEach } from 'vitest';

import type { LoadReport } from '../loadReportService';
import { mainI18n } from '../mainI18n';

import { runCliCommand } from './cliCommands';
import type { CliContext } from './cliCommands';
import { CLI_EXIT, CLI_PROTOCOL_VERSION } from './cliProtocol';

function request(argv: string[]) {
  return { protocol: CLI_PROTOCOL_VERSION, argv, cwd: 'C:\\work', cliVersion: '0.1.0' };
}

function report(): LoadReport {
  return {
    reportVersion: 1,
    loadedAt: '2026-10-12T00:00:00.000Z',
    summary: {
      accepted: 3,
      skipped: 1,
      idAssigned: 0,
      groupsFlattened: 0,
      corruptedFiles: [],
      externallyChangedFiles: [],
    },
    files: [
      {
        file: 'datafiles/data.json',
        status: 'ok',
        accepted: 2,
        issues: [],
        externallyChanged: false,
        rewritten: false,
      },
      {
        file: 'datafiles/data2.json',
        status: 'ok',
        accepted: 1,
        issues: [{ index: 1, kind: 'invalid', reason: 'path がありません' }],
        externallyChanged: true,
        rewritten: false,
      },
    ],
    preChangeSnapshot: null,
  } as LoadReport;
}

function context(overrides: Partial<CliContext> = {}): CliContext {
  return {
    appVersion: '0.8.0',
    pid: 1234,
    configFolder: 'C:\\config',
    reload: vi.fn().mockResolvedValue(report()),
    lastReport: vi.fn(() => report()),
    syncBeforeWrite: vi.fn(async () => {}),
    clipboard: { save: vi.fn(), read: vi.fn(() => null) },
    tabs: {
      load: vi.fn(),
      filesOnDisk: () => [],
      countItems: vi.fn(),
      createFile: vi.fn(),
      deleteFile: vi.fn(),
      save: vi.fn(),
    },
    launcher: {
      load: vi.fn(async () => {
        throw new Error('ディスクが読めない');
      }),
      dataFiles: () => [],
      tabs: async () => [],
      move: vi.fn(),
      append: vi.fn(),
      replace: vi.fn(),
      remove: vi.fn(),
      markFolder: async (p: string) => p,
      newId: () => 'NewId001',
    },
    workspace: {} as CliContext['workspace'],
    settings: {} as CliContext['settings'],
    markFolder: async (p) => p,
    changed: vi.fn(),
    beforeGroupRemoved: vi.fn(),
    launcherAppItem: vi.fn(async () => undefined),
    duplicateClipboardData: vi.fn(() => null),
    openLauncherEntry: vi.fn(async () => ({ type: 'url' })),
    show: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('runCliCommand', () => {
  it('引数なし・help はヘルプを出して成功する', async () => {
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      const res = await runCliCommand(request(argv), context());
      expect(res.exitCode).toBe(CLI_EXIT.ok);
      expect(res.stdout).toContain('使い方: qdl');
    }
  });

  it('launcher・workspace の --help はそれぞれの説明を出す', async () => {
    const launcher = await runCliCommand(request(['launcher', '--help']), context());
    expect(launcher.stdout).toContain('qdl launcher item');
    const workspace = await runCliCommand(request(['workspace', 'item', '--help']), context());
    expect(workspace.stdout).toContain('qdl workspace item add');
  });

  it('オプションの値としての -h・--help は説明の求めとみなさない（何も足さずに成功を返さない）', async () => {
    const res = await runCliCommand(
      request([
        'launcher',
        'item',
        'add',
        '--name',
        't',
        '--path',
        'tool.exe',
        '--args',
        '-h',
        '--dry-run',
      ]),
      context()
    );
    // 説明ではなく、コマンドを実行した結果（ここではストアの無い文脈なのでエラー）の JSON が返る
    expect(res.stdout).not.toContain('qdl launcher item');
    expect(() => JSON.parse(res.stdout)).not.toThrow();
  });

  it('フラグの後ろの --help は説明の求め', async () => {
    const res = await runCliCommand(
      request(['launcher', 'item', 'add', '--dry-run', '--help']),
      context()
    );
    expect(res.exitCode).toBe(CLI_EXIT.ok);
    expect(res.stdout).toContain('qdl launcher item');
  });

  it('status は版と設定フォルダを JSON で返す', async () => {
    const res = await runCliCommand(request(['status']), context());
    expect(res.exitCode).toBe(CLI_EXIT.ok);
    expect(JSON.parse(res.stdout)).toEqual({
      app: 'QuickDashLauncher',
      version: '0.8.0',
      cliVersion: '0.1.0',
      pid: 1234,
      configFolder: 'C:\\config',
    });
  });

  it('reload は再読込して、問題のあったファイルだけ詳しく返す', async () => {
    const ctx = context();
    const res = await runCliCommand(request(['reload']), ctx);
    expect(ctx.reload).toHaveBeenCalledOnce();
    const body = JSON.parse(res.stdout);
    expect(body.reloaded).toBe(true);
    expect(body.filesWithIssues.map((f: { file: string }) => f.file)).toEqual([
      'datafiles/data2.json',
    ]);
  });

  it('check は読み直さずに直近の結果を返す', async () => {
    const ctx = context();
    const body = JSON.parse((await runCliCommand(request(['check']), ctx)).stdout);
    expect(ctx.reload).not.toHaveBeenCalled();
    expect(body.summary.skipped).toBe(1);
  });

  it('不明なコマンドは、標準出力に error の JSON、標準エラーに案内、終了コード 2', async () => {
    const res = await runCliCommand(request(['add', 'foo']), context());
    expect(res.exitCode).toBe(CLI_EXIT.usage);
    expect(JSON.parse(res.stdout)).toEqual({
      error: { code: 'usage', message: '不明なコマンドです: add' },
    });
    expect(res.stderr).toContain('qdl: 不明なコマンドです: add');
    expect(res.stderr).toContain('qdl help');
  });

  it('引数を取らないコマンドに引数があれば usage', async () => {
    const ctx = context();
    const res = await runCliCommand(request(['reload', 'now']), ctx);
    expect(res.exitCode).toBe(CLI_EXIT.usage);
    expect(ctx.reload).not.toHaveBeenCalled();
  });

  it('想定外の例外は internal で、終了コード 1', async () => {
    const res = await runCliCommand(request(['launcher', 'item', 'list']), context());
    expect(res.exitCode).toBe(CLI_EXIT.failure);
    expect(JSON.parse(res.stdout).error).toEqual({
      code: 'internal',
      message: 'ディスクが読めない',
    });
  });

  it('候補のある失敗は、標準エラーにも候補を並べる', async () => {
    const ctx = context({
      launcher: {
        ...context().launcher,
        load: async () => [
          {
            item: { id: 'Aaaaaaa1', type: 'item', displayName: 'x', path: 'C:\\a' },
            file: 'datafiles/data.json',
          },
          {
            item: { id: 'Bbbbbbb2', type: 'item', displayName: 'x', path: 'C:\\b' },
            file: 'datafiles/data.json',
          },
        ],
      },
    });
    const res = await runCliCommand(request(['launcher', 'item', 'remove', 'x']), ctx);
    expect(res.exitCode).toBe(CLI_EXIT.usage);
    expect(JSON.parse(res.stdout).error.code).toBe('ambiguous');
    expect(res.stderr).toContain('Aaaaaaa1');
  });
});

describe('runCliCommand（open・show）', () => {
  const launcherWith = (...names: string[]) => ({
    ...context().launcher,
    load: async () =>
      names.map((name, i) => ({
        item: { id: `Item000${i}`, type: 'item' as const, displayName: name, path: `C:\${i}` },
        file: 'datafiles/data.json',
      })),
  });

  it('open は表示名か id で 1 件に絞って開き、開いたアイテムを返す', async () => {
    const openLauncherEntry = vi.fn(async () => ({ type: 'app' }));
    const ctx = context({ launcher: launcherWith('メモ帳', '電卓'), openLauncherEntry });
    const res = await runCliCommand(request(['open', '電卓']), ctx);
    expect(res.exitCode).toBe(CLI_EXIT.ok);
    expect(JSON.parse(res.stdout)).toEqual({
      opened: { id: 'Item0001', name: '電卓', type: 'app' },
    });
    expect(openLauncherEntry).toHaveBeenCalledWith(
      expect.objectContaining({ item: expect.objectContaining({ id: 'Item0001' }) })
    );

    const byId = await runCliCommand(request(['open', 'Item0000']), ctx);
    expect(JSON.parse(byId.stdout).opened.name).toBe('メモ帳');
  });

  it('--ascii を付けると、JSON の日本語を \\uXXXX で書く（エラーの JSON も。stderr の文はそのまま）', async () => {
    const openLauncherEntry = vi.fn(async () => ({ type: 'app' }));
    const ctx = context({ launcher: launcherWith('メモ帳'), openLauncherEntry });
    const ok = await runCliCommand(request(['--ascii', 'open', 'メモ帳']), ctx);
    expect([...ok.stdout].every((c) => c.charCodeAt(0) < 0x7f)).toBe(true);
    expect(JSON.parse(ok.stdout).opened.name).toBe('メモ帳');

    const ng = await runCliCommand(request(['open', '無いもの', '--ascii']), ctx);
    expect(ng.stdout).not.toContain('無いもの');
    expect(JSON.parse(ng.stdout).error.code).toBe('not_found');
    expect(ng.stderr).toContain('無いもの');
  });

  it('open は見つからない・複数当たる・引数が無いときに開かずエラーを返す', async () => {
    const openLauncherEntry = vi.fn(async () => ({ type: 'app' }));
    const ctx = context({ launcher: launcherWith('x', 'x'), openLauncherEntry });
    const ambiguous = await runCliCommand(request(['open', 'x']), ctx);
    expect(JSON.parse(ambiguous.stdout).error.code).toBe('ambiguous');
    const notFound = await runCliCommand(request(['open', 'nope']), ctx);
    expect(JSON.parse(notFound.stdout).error.code).toBe('not_found');
    const missing = await runCliCommand(request(['open']), ctx);
    expect(missing.exitCode).toBe(CLI_EXIT.usage);
    expect(openLauncherEntry).not.toHaveBeenCalled();
  });

  it('show は既定でメインウィンドウ、workspace でワークスペースを出す。ほかは usage', async () => {
    const show = vi.fn(async () => {});
    const ctx = context({ show });
    expect(JSON.parse((await runCliCommand(request(['show']), ctx)).stdout)).toEqual({
      shown: 'main',
    });
    expect(JSON.parse((await runCliCommand(request(['show', 'workspace']), ctx)).stdout)).toEqual({
      shown: 'workspace',
    });
    const bad = await runCliCommand(request(['show', 'admin']), ctx);
    expect(bad.exitCode).toBe(CLI_EXIT.usage);
    expect(show.mock.calls).toEqual([['main'], ['workspace']]);
  });
});

describe('runCliCommand（表示言語）', () => {
  afterEach(async () => {
    await mainI18n.changeLanguage('ja');
  });

  it('アプリが英語なら、ヘルプとエラーの文言も英語になり、code は変わらない', async () => {
    await mainI18n.changeLanguage('en');
    const help = await runCliCommand(request(['help']), context());
    expect(help.stdout).toContain('Usage: qdl <command>');

    const res = await runCliCommand(request(['nope']), context());
    expect(res.exitCode).toBe(CLI_EXIT.usage);
    expect(JSON.parse(res.stdout).error).toMatchObject({
      code: 'usage',
      message: 'Unknown command: nope',
    });
    expect(res.stderr).toContain('Run qdl help to see how to use it');
  });
});
