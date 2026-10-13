import type { LoadReport } from '../loadReportService.js';
import { mainI18n } from '../mainI18n.js';

import { CliError, expectPositionals, parseArgs } from './cliArgs.js';
import type { CliErrorCode } from './cliArgs.js';
import { CLI_EXIT, cliResponse } from './cliProtocol.js';
import type { CliRequest, CliResponse } from './cliProtocol.js';
import { runLauncherItemCommand } from './cliLauncherCommands.js';
import type { LauncherStore } from './cliLauncherCommands.js';
import { runWorkspaceCommand } from './cliWorkspaceCommands.js';
import type { WorkspaceStore } from './cliWorkspaceCommands.js';

/**
 * CLI のコマンドの解釈と実行
 *
 * qdl.exe は中継役なので、コマンド・引数・ヘルプ・出力の形はすべてここで決める。
 * コマンドは「画面 → もの → 操作」（例: qdl workspace item add）。
 * 成功したら標準出力に結果の JSON。失敗したら標準出力に {"error": {code, message, candidates?}}、
 * 標準エラーに人向けの文を出す（AI は標準出力だけ読めば次の一手が分かる）。
 */

export interface CliContext {
  appVersion: string;
  pid: number;
  configFolder: string;
  /** F5 と同じ再読込を行い、そのときの読み込みレポートを返す */
  reload: () => Promise<LoadReport | null>;
  /** 直近の読み込みレポート（読み直さない） */
  lastReport: () => LoadReport | null;
  /** 書き込みの前に読み直す（外部変更の検知。ワークスペースは読み直さないと書き込みを断られる） */
  syncBeforeWrite: () => Promise<void>;
  launcher: LauncherStore;
  workspace: WorkspaceStore;
  markFolder: (path: string) => Promise<string>;
  /** 書き込んだ後: 画面に知らせ、トーストを出す */
  changed: (target: 'launcher' | 'workspace', message: string) => void;
  beforeGroupRemoved: (groupId: string) => Promise<void>;
}

const EXIT_BY_CODE: Record<CliErrorCode, number> = {
  usage: CLI_EXIT.usage,
  not_found: CLI_EXIT.usage,
  ambiguous: CLI_EXIT.usage,
  invalid: CLI_EXIT.failure,
  conflict: CLI_EXIT.failure,
  unavailable: CLI_EXIT.failure,
  internal: CLI_EXIT.failure,
};

function json(value: unknown): CliResponse {
  return cliResponse(CLI_EXIT.ok, JSON.stringify(value, null, 2) + '\n');
}

export function errorResponse(error: CliError): CliResponse {
  const body = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.candidates ? { candidates: error.candidates } : {}),
    },
  };
  const lines = [`qdl: ${error.message}`];
  for (const c of error.candidates ?? []) {
    lines.push(
      `  - ${c.id}  ${c.displayName}` +
        (c.location.length
          ? mainI18n.t('cli.candidateLocation', { location: c.location.join(' / ') })
          : '')
    );
  }
  if (error.code === 'usage') lines.push(mainI18n.t('cli.help.seeHelp'));
  return cliResponse(
    EXIT_BY_CODE[error.code],
    JSON.stringify(body, null, 2) + '\n',
    lines.join('\n') + '\n'
  );
}

function isHelp(word: string | undefined): boolean {
  return word === undefined || word === 'help' || word === '--help' || word === '-h';
}

function noArgs(args: readonly string[]): void {
  expectPositionals(parseArgs(args, {}), []);
}

export async function runCliCommand(req: CliRequest, ctx: CliContext): Promise<CliResponse> {
  const [command, ...rest] = req.argv;
  if (isHelp(command)) return cliResponse(CLI_EXIT.ok, mainI18n.t('cli.help.main'));

  try {
    return json(await dispatch(command, rest, req, ctx));
  } catch (error) {
    if (error instanceof HelpResult) return cliResponse(CLI_EXIT.ok, error.text);
    if (error instanceof CliError) return errorResponse(error);
    return errorResponse(new CliError('internal', (error as Error)?.message ?? String(error)));
  }
}

async function dispatch(
  command: string,
  rest: string[],
  req: CliRequest,
  ctx: CliContext
): Promise<unknown> {
  // 「qdl launcher --help」「qdl workspace item --help」はそれぞれの説明
  const wantsHelp = rest.some((a) => a === '--help' || a === '-h');

  switch (command) {
    case 'status':
      noArgs(rest);
      return {
        app: 'QuickDashLauncher',
        version: ctx.appVersion,
        cliVersion: req.cliVersion ?? null,
        pid: ctx.pid,
        configFolder: ctx.configFolder,
      };

    case 'reload':
      noArgs(rest);
      return reloadResult(await ctx.reload());

    case 'check': {
      noArgs(rest);
      // 読み直さずに、直近の読み込み（起動時・F5・reload・CLI の書き込み前）の結果を返す
      const { reloaded: _reloaded, ...result } = reloadResult(ctx.lastReport());
      void _reloaded;
      return result;
    }

    case 'launcher': {
      const [noun, verb, ...args] = rest;
      if (wantsHelp || noun === undefined) throw helpAsResult(mainI18n.t('cli.help.launcher'));
      if (noun !== 'item')
        throw new CliError('usage', mainI18n.t('cli.errors.unknownLauncherNoun', { noun }));
      return runLauncherItemCommand(verb, args, {
        store: ctx.launcher,
        cwd: req.cwd,
        syncBeforeWrite: ctx.syncBeforeWrite,
        changed: (message) => ctx.changed('launcher', message),
      });
    }

    case 'workspace': {
      const [noun, verb, ...args] = rest;
      if (wantsHelp || noun === undefined) throw helpAsResult(mainI18n.t('cli.help.workspace'));
      return runWorkspaceCommand(noun, verb, args, {
        store: ctx.workspace,
        cwd: req.cwd,
        markFolder: ctx.markFolder,
        syncBeforeWrite: ctx.syncBeforeWrite,
        changed: (message) => ctx.changed('workspace', message),
        beforeGroupRemoved: ctx.beforeGroupRemoved,
      });
    }

    default:
      throw new CliError('usage', mainI18n.t('cli.errors.unknownCommand', { command }));
  }
}

function reloadResult(report: LoadReport | null): Record<string, unknown> {
  return {
    reloaded: true,
    loadedAt: report?.loadedAt ?? null,
    summary: report?.summary ?? null,
    // 問題のあったファイルだけ詳しく返す
    filesWithIssues:
      report?.files.filter(
        (f) => f.status !== 'ok' || f.issues.length > 0 || f.externallyChanged || f.rewritten
      ) ?? [],
    preChangeSnapshot: report?.preChangeSnapshot ?? null,
  };
}

/** 各コマンドの --help は JSON ではなく説明文を返すので、例外で抜けて呼び出し元で返す */
class HelpResult extends Error {
  constructor(readonly text: string) {
    super('help');
  }
}

function helpAsResult(text: string): HelpResult {
  return new HelpResult(text);
}
