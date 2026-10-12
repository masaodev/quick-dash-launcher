/**
 * CLI（qdl.exe）と本体のやり取りの取り決め
 *
 * qdl.exe は引数をそのまま送って結果を表示するだけの中継役で、解釈は本体が行う。
 * 1 回の接続で 1 往復し、依頼も応答も JSON 1 行（末尾に改行）。
 * 形を変えたら CLI_PROTOCOL_VERSION を上げ、cli/src/main.rs の PROTOCOL_VERSION も合わせる。
 */

import { mainI18n } from '../mainI18n.js';

export const CLI_PROTOCOL_VERSION = 1;

/** 依頼 1 件の上限。設定の変更系の依頼はこれより十分小さい */
export const CLI_MAX_REQUEST_BYTES = 1024 * 1024;

export const CLI_EXIT = {
  ok: 0,
  /** コマンドは解釈できたが失敗した */
  failure: 1,
  /** コマンド・引数の誤り */
  usage: 2,
  /** 本体に届かない（qdl.exe 側で使う） */
  notAvailable: 3,
  /** やり取りの版が合わない・形が壊れている */
  protocol: 4,
} as const;

export interface CliRequest {
  protocol: number;
  argv: string[];
  /** qdl を実行したフォルダ（相対パスの解決に使う） */
  cwd: string;
  cliVersion?: string;
}

export interface CliResponse {
  protocol: number;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * パイプ名。userData のフォルダ名（quick-dash-launcher／dev-quick-dash-launcher など）とユーザー名から作り、
 * 開発用インスタンスや同じ PC の別ユーザーの QDL と混ざらないようにする。
 * qdl.exe も同じ規則で組み立てる（cli/src/main.rs の pipe_name）。
 */
export function getCliPipeName(userDataDirName: string, userName: string): string {
  return `\\\\.\\pipe\\${userDataDirName}-cli-${userName}`;
}

export function cliResponse(exitCode: number, stdout = '', stderr = ''): CliResponse {
  return { protocol: CLI_PROTOCOL_VERSION, exitCode, stdout, stderr };
}

/**
 * 受け取った 1 行を依頼として読む。読めなければ、そのまま返せるエラー応答を返す
 */
export function parseCliRequest(line: string): CliRequest | CliResponse {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return cliResponse(CLI_EXIT.protocol, '', mainI18n.t('cli.errors.badJson') + '\n');
  }
  if (typeof value !== 'object' || value === null) {
    return cliResponse(CLI_EXIT.protocol, '', mainI18n.t('cli.errors.badShape') + '\n');
  }
  const req = value as Partial<CliRequest>;
  if (req.protocol !== CLI_PROTOCOL_VERSION) {
    return cliResponse(
      CLI_EXIT.protocol,
      '',
      mainI18n.t('cli.errors.versionMismatch', {
        cli: String(req.protocol),
        app: CLI_PROTOCOL_VERSION,
      }) + '\n'
    );
  }
  if (!Array.isArray(req.argv) || !req.argv.every((a) => typeof a === 'string')) {
    return cliResponse(CLI_EXIT.protocol, '', mainI18n.t('cli.errors.badArgv') + '\n');
  }
  return {
    protocol: req.protocol,
    argv: req.argv,
    cwd: typeof req.cwd === 'string' ? req.cwd : '',
    cliVersion: typeof req.cliVersion === 'string' ? req.cliVersion : undefined,
  };
}

export function isCliResponse(value: CliRequest | CliResponse): value is CliResponse {
  return 'exitCode' in value;
}
