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
    markFolder: async (p) => p,
    changed: vi.fn(),
    beforeGroupRemoved: vi.fn(),
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
