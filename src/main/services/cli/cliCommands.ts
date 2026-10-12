import type { LoadReport } from '../loadReportService.js';

import { CliError, expectPositionals, parseArgs } from './cliArgs.js';
import type { CliErrorCode } from './cliArgs.js';
import { CLI_EXIT, cliResponse } from './cliProtocol.js';
import type { CliRequest, CliResponse } from './cliProtocol.js';
import { LAUNCHER_HELP, runLauncherItemCommand } from './cliLauncherCommands.js';
import type { LauncherStore } from './cliLauncherCommands.js';
import { WORKSPACE_HELP, runWorkspaceCommand } from './cliWorkspaceCommands.js';
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

const HELP = `使い方: qdl <コマンド> [引数]

QuickDashLauncher CLI。起動中の QuickDashLauncher（本体）に依頼します。起動していなければ起動します。

コマンド:
  launcher item list|add|update|remove     メイン画面のアイテム（qdl launcher --help）
  workspace list                           ワークスペースの一覧
  workspace item list|add|update|remove    ワークスペースのアイテム（qdl workspace --help）
  workspace group list|add|update|remove   ワークスペースのグループ
  check                                    直近の読み込み結果（不正・採番・外部変更）を表示する（読み直さない）
  reload                                   設定ファイルを読み直す（メイン画面の F5 と同じ）
  status                                   本体の版・設定フォルダなどを表示する
  help                                     この説明を表示する

出力: 成功したら標準出力に JSON。失敗したら標準出力に {"error": {"code", "message", "candidates"?}}、
標準エラーに説明。code は usage / not_found / ambiguous / invalid / conflict / unavailable / internal。
書き込むコマンドは --dry-run で、書き込まずに結果だけを確かめられます。

終了コード: 0 成功 / 1 失敗 / 2 コマンドの誤り・対象の指定の誤り / 3 本体に接続できない / 4 CLI と本体の版の不一致
`;

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
      `  - ${c.id}  ${c.displayName}${c.location.length ? `  （${c.location.join(' / ')}）` : ''}`
    );
  }
  if (error.code === 'usage') lines.push('qdl help で使い方を確認できます');
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
  if (isHelp(command)) return cliResponse(CLI_EXIT.ok, HELP);

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
      if (wantsHelp || noun === undefined) throw helpAsResult(LAUNCHER_HELP);
      if (noun !== 'item')
        throw new CliError('usage', `不明なコマンドです: launcher ${noun}（launcher item のみ）`);
      return runLauncherItemCommand(verb, args, {
        store: ctx.launcher,
        cwd: req.cwd,
        syncBeforeWrite: ctx.syncBeforeWrite,
        changed: (message) => ctx.changed('launcher', message),
      });
    }

    case 'workspace': {
      const [noun, verb, ...args] = rest;
      if (wantsHelp || noun === undefined) throw helpAsResult(WORKSPACE_HELP);
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
      throw new CliError('usage', `不明なコマンドです: ${command}`);
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
