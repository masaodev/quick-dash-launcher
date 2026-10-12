import type { LoadReport } from '../loadReportService.js';

import { CLI_EXIT, cliResponse } from './cliProtocol.js';
import type { CliRequest, CliResponse } from './cliProtocol.js';

/**
 * CLI のコマンドの解釈と実行
 *
 * qdl.exe は中継役なので、コマンド・引数・ヘルプ・出力の形はすべてここで決める。
 * 成功時は標準出力に JSON（AI が読む前提）、失敗時は標準エラーに人向けの文を出す。
 */

export interface CliContext {
  appVersion: string;
  pid: number;
  configFolder: string;
  /** F5 と同じ再読込を行い、そのときの読み込みレポートを返す */
  reload: () => Promise<LoadReport | null>;
}

const HELP = `使い方: qdl <コマンド>

QuickDashLauncher（起動中の本体）に依頼します。起動していなければ起動します。

コマンド:
  status    本体の版・設定フォルダなどを JSON で表示する
  reload    設定ファイルを読み直す（メイン画面の F5 と同じ）。読み込み結果を JSON で表示する
  help      この説明を表示する

終了コード: 0 成功 / 1 失敗 / 2 コマンドの誤り / 3 本体に接続できない / 4 CLI と本体の版の不一致
`;

const COMMANDS = ['status', 'reload'];

function unknownCommand(command: string): CliResponse {
  return cliResponse(
    CLI_EXIT.usage,
    '',
    `不明なコマンドです: ${command}\nqdl help で使えるコマンドを確認できます\n`
  );
}

function json(value: unknown): CliResponse {
  return cliResponse(CLI_EXIT.ok, JSON.stringify(value, null, 2) + '\n');
}

export async function runCliCommand(req: CliRequest, ctx: CliContext): Promise<CliResponse> {
  const [command, ...rest] = req.argv;

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    return cliResponse(CLI_EXIT.ok, HELP);
  }

  if (!COMMANDS.includes(command)) {
    return unknownCommand(command);
  }

  if (rest.length > 0) {
    return cliResponse(
      CLI_EXIT.usage,
      '',
      `${command} は引数を取りません: ${rest.join(' ')}\nqdl help で使い方を確認できます\n`
    );
  }

  switch (command) {
    case 'status':
      return json({
        app: 'QuickDashLauncher',
        version: ctx.appVersion,
        cliVersion: req.cliVersion ?? null,
        pid: ctx.pid,
        configFolder: ctx.configFolder,
      });

    case 'reload': {
      const report = await ctx.reload();
      return json({
        reloaded: true,
        loadedAt: report?.loadedAt ?? null,
        summary: report?.summary ?? null,
        // 問題のあったファイルだけ詳しく返す（全件の詳細は last-load-report.json）
        filesWithIssues:
          report?.files.filter(
            (f) => f.status !== 'ok' || f.issues.length > 0 || f.externallyChanged || f.rewritten
          ) ?? [],
        preChangeSnapshot: report?.preChangeSnapshot ?? null,
      });
    }

    default:
      return unknownCommand(command);
  }
}
