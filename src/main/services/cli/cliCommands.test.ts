import { describe, it, expect, vi } from 'vitest';

import type { LoadReport } from '../loadReportService';

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
    expect(body.summary.skipped).toBe(1);
    expect(body.filesWithIssues.map((f: { file: string }) => f.file)).toEqual([
      'datafiles/data2.json',
    ]);
  });

  it('不明なコマンドは usage の終了コードで、標準エラーに案内を出す', async () => {
    const res = await runCliCommand(request(['add']), context());
    expect(res.exitCode).toBe(CLI_EXIT.usage);
    expect(res.stdout).toBe('');
    expect(res.stderr).toContain('不明なコマンドです: add');
  });

  it('不明なコマンドに引数が付いていても、不明なコマンドとして案内する', async () => {
    const res = await runCliCommand(request(['add', 'foo']), context());
    expect(res.exitCode).toBe(CLI_EXIT.usage);
    expect(res.stderr).toContain('不明なコマンドです: add');
  });

  it('引数を取らないコマンドに引数があれば usage で断る', async () => {
    const ctx = context();
    const res = await runCliCommand(request(['reload', 'now']), ctx);
    expect(res.exitCode).toBe(CLI_EXIT.usage);
    expect(ctx.reload).not.toHaveBeenCalled();
  });
});
