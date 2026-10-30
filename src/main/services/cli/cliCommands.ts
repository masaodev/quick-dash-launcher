import type { LoadReport } from '../loadReportService.js';
import { mainI18n } from '../mainI18n.js';

import {
  CliError,
  escapeNonAscii,
  expectPositionals,
  parseArgs,
  takeAsciiFlag,
  wantsHelp,
} from './cliArgs.js';
import type { CliErrorCode } from './cliArgs.js';
import { CLI_EXIT, cliResponse } from './cliProtocol.js';
import type { CliRequest, CliResponse } from './cliProtocol.js';
import { findLauncherEntry, itemName, runLauncherItemCommand } from './cliLauncherCommands.js';
import type { LauncherEntry, LauncherStore } from './cliLauncherCommands.js';
import { runLauncherSetCommand } from './cliSetCommands.js';
import { runLauncherTabCommand } from './cliTabCommands.js';
import type { TabStore } from './cliTabCommands.js';
import { runSettingsCommand } from './cliSettingsCommands.js';
import type { SettingsStore } from './cliSettingsCommands.js';
import { runWorkspaceCommand } from './cliWorkspaceCommands.js';
import type { WorkspaceCommandContext, WorkspaceStore } from './cliWorkspaceCommands.js';
import type { ClipboardTextStore } from './cliShared.js';

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
  /** メイン画面のタブとデータファイルの構成 */
  tabs: TabStore;
  workspace: WorkspaceStore;
  /** settings.json の設定 */
  settings: SettingsStore;
  markFolder: (path: string) => Promise<string>;
  /** 書き込んだ後: 画面に知らせ、トーストを出す */
  changed: (target: 'launcher' | 'workspace' | 'settings', message: string) => void;
  beforeGroupRemoved: (groupId: string) => Promise<void>;
  /** クリップボードアイテムの実データ（テキストだけ）の読み書き */
  clipboard: ClipboardTextStore;
  /** ワークスペースの item add --from（メイン画面のアイテムを写す） */
  launcherAppItem: WorkspaceCommandContext['launcherAppItem'];
  duplicateClipboardData: WorkspaceCommandContext['duplicateClipboardData'];
  /** open: メインウィンドウのアイテムを、画面で Enter を押したのと同じように開く。開いたアイテムの種類を返す */
  openLauncherEntry: (entry: LauncherEntry) => Promise<{ type: string }>;
  /** show: メインウィンドウかワークスペースを出す */
  show: (target: 'main' | 'workspace') => Promise<void>;
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

/** 出力する JSON の文字列にする（`--ascii` なら ASCII 以外を `\uXXXX` で書く） */
function jsonText(value: unknown, ascii: boolean): string {
  const text = JSON.stringify(value, null, 2) + '\n';
  return ascii ? escapeNonAscii(text) : text;
}

function json(value: unknown, ascii: boolean): CliResponse {
  return cliResponse(CLI_EXIT.ok, jsonText(value, ascii));
}

function errorResponse(error: CliError, ascii: boolean): CliResponse {
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
  return cliResponse(EXIT_BY_CODE[error.code], jsonText(body, ascii), lines.join('\n') + '\n');
}

function isHelp(word: string | undefined): boolean {
  return word === undefined || word === 'help' || word === '--help' || word === '-h';
}

function noArgs(args: readonly string[]): void {
  expectPositionals(parseArgs(args, {}), []);
}

export async function runCliCommand(req: CliRequest, ctx: CliContext): Promise<CliResponse> {
  // --ascii: Windows PowerShell 5.1 はパイプの文字を既定で Shift_JIS として読むので、
  // JSON の日本語を \uXXXX で書いて化けないようにする（説明の文は人が読むのでそのまま）
  const { ascii, argv } = takeAsciiFlag(req.argv);
  const [command, ...rest] = argv;
  if (isHelp(command)) return cliResponse(CLI_EXIT.ok, mainI18n.t('cli.help.main'));

  try {
    return json(await dispatch(command, rest, req, ctx), ascii);
  } catch (error) {
    if (error instanceof HelpResult) return cliResponse(CLI_EXIT.ok, error.text);
    if (error instanceof CliError) return errorResponse(error, ascii);
    return errorResponse(
      new CliError('internal', (error as Error)?.message ?? String(error)),
      ascii
    );
  }
}

async function dispatch(
  command: string,
  rest: string[],
  req: CliRequest,
  ctx: CliContext
): Promise<unknown> {
  // 「qdl launcher --help」「qdl workspace item --help」はそれぞれの説明
  const helpRequested = wantsHelp(rest);

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
      if (helpRequested || noun === undefined) throw helpAsResult(mainI18n.t('cli.help.launcher'));
      const launcherCtx = {
        store: ctx.launcher,
        cwd: req.cwd,
        syncBeforeWrite: ctx.syncBeforeWrite,
        changed: (message: string) => ctx.changed('launcher', message),
        clipboard: ctx.clipboard,
      };
      if (noun === 'set') {
        const [setVerb, ...setArgs] = args;
        return runLauncherSetCommand(verb, setVerb, setArgs, launcherCtx);
      }
      if (noun === 'tab') {
        return runLauncherTabCommand(verb, args, {
          store: ctx.tabs,
          syncBeforeWrite: ctx.syncBeforeWrite,
          changed: (message: string) => ctx.changed('launcher', message),
        });
      }
      if (noun !== 'item')
        throw new CliError('usage', mainI18n.t('cli.errors.unknownLauncherNoun', { noun }));
      return runLauncherItemCommand(verb, args, launcherCtx);
    }

    case 'workspace': {
      const [noun, verb, ...args] = rest;
      if (helpRequested || noun === undefined) throw helpAsResult(mainI18n.t('cli.help.workspace'));
      return runWorkspaceCommand(noun, verb, args, {
        store: ctx.workspace,
        cwd: req.cwd,
        markFolder: ctx.markFolder,
        syncBeforeWrite: ctx.syncBeforeWrite,
        changed: (message) => ctx.changed('workspace', message),
        beforeGroupRemoved: ctx.beforeGroupRemoved,
        clipboard: ctx.clipboard,
        launcher: ctx.launcher,
        launcherAppItem: ctx.launcherAppItem,
        duplicateClipboardData: ctx.duplicateClipboardData,
      });
    }

    case 'open': {
      if (helpRequested) throw helpAsResult(mainI18n.t('cli.help.main'));
      const parsed = parseArgs(rest, {});
      const [key] = expectPositionals(parsed, [mainI18n.t('cli.args.idOrName')]);
      const entry = await findLauncherEntry(key, ctx.launcher);
      const opened = await ctx.openLauncherEntry(entry);
      return {
        opened: { id: entry.item.id, name: itemName(entry.item), type: opened.type },
      };
    }

    case 'show': {
      if (helpRequested) throw helpAsResult(mainI18n.t('cli.help.main'));
      const parsed = parseArgs(rest, {});
      const target = parsed.positionals[0] ?? 'main';
      if (parsed.positionals.length > 1 || (target !== 'main' && target !== 'workspace')) {
        throw new CliError('usage', mainI18n.t('cli.errors.unknownShowTarget', { target }));
      }
      await ctx.show(target);
      return { shown: target };
    }

    case 'settings': {
      const [verb, ...args] = rest;
      if (helpRequested || verb === undefined) throw helpAsResult(mainI18n.t('cli.help.settings'));
      return runSettingsCommand(verb, args, {
        store: ctx.settings,
        changed: (message) => ctx.changed('settings', message),
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
