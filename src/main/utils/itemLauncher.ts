/**
 * アイテム起動ユーティリティ
 */

import { spawn } from 'child_process';
import * as path from 'path';

import { shell } from 'electron';
import { Logger } from 'pino';
import { parseArgs } from '@common/utils/argsParser';
import { shouldRunAsAdmin } from '@common/utils/runAsAdmin';

import { ClipboardService } from '../services/clipboardService.js';
import { mainI18n } from '../services/mainI18n.js';

import { noteLaunchedPath } from './folderPathProbe.js';
import { isBareFileName, resolveFromPath } from './pathResolver.js';
import { shellExecuteRunAs, type RunAsRequest } from './shellExecuteRunAs.js';

/**
 * 起動可能なアイテムの最小インターフェース
 */
export interface LaunchableItem {
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'windowSwitch' | 'clipboard';
  path: string;
  args?: string;
  displayName?: string;
  clipboardDataRef?: string;
  /** 常に管理者として実行する（アプリだけ。対象外の種類なら普通に開く） */
  runAsAdmin?: boolean;
}

/**
 * 起動の結果（失敗のときは利用者に見せる理由）
 *
 * cancelled は、管理者として実行するときに UAC で「いいえ」を押した（知らせない・起動の記録に数えない）
 */
export type LaunchResult = { success: true } | { success: false; error: string; cancelled?: true };

/** 失敗の理由（無ければ成功）を LaunchResult にする */
function toResult(error: string | undefined): LaunchResult {
  return error === undefined ? { success: true } : { success: false, error };
}

/**
 * アイテムを起動する
 *
 * 失敗しても投げず、ログに残して { success: false } を返す（知らせるのは呼び出し側）
 */
export async function launchItem(item: LaunchableItem, logger: Logger): Promise<LaunchResult> {
  try {
    switch (item.type) {
      case 'url':
      case 'customUri':
        await shell.openExternal(item.path);
        return { success: true };

      case 'file':
      case 'folder': {
        const error = await openPathOrLog(item.path, logger, {
          path: item.path,
          name: item.displayName,
        });
        // 拡張子の無いパスは、ファイルかどうかを確かめて次の読み込みの種別に反映する（起動は待たせない）
        void noteLaunchedPath(item.path).catch((error) => {
          logger.warn({ error, path: item.path }, '起動したパスの種類を確かめられませんでした');
        });
        return toResult(error);
      }

      case 'app':
        if (shouldRunAsAdmin(item))
          return adminResultToLaunchResult(await launchItemAsAdmin(item, logger));
        return toResult(await launchApp(item, logger));

      case 'clipboard':
        return toResult(await restoreClipboard(item, logger));

      default:
        logger.warn(
          { type: item.type, path: item.path, name: item.displayName },
          '未知のアイテムタイプです'
        );
        return { success: true };
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        item: {
          name: item.displayName,
          type: item.type,
          path: item.path,
          args: item.args || 'なし',
        },
      },
      'アイテムの起動に失敗しました'
    );
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * spawn でプロセスを起動し、起動できたか（spawn か error のどちらかが来るまで）を待つ
 * @returns 失敗の理由（起動できたら undefined）
 */
function spawnDetached(
  command: string,
  args: string[],
  options: { shell?: boolean; cwd?: string },
  logger: Logger,
  logContext: Record<string, unknown>,
  errorMessage: string
): Promise<string | undefined> {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: options.shell,
    cwd: options.cwd,
  });
  child.unref();
  return new Promise((resolve) => {
    child.once('spawn', () => resolve(undefined));
    child.once('error', (error: Error & { code?: string }) => {
      logger.error({ error: error.message, ...logContext }, errorMessage);
      // 「spawn C:\a.exe ENOENT」のままでは伝わらないので、ファイルが無いときは言葉にする
      //（ファイル名だけのものは、引数なしで開くときと同じく PATH に無いと言う）
      if (error.code !== 'ENOENT') return resolve(error.message);
      resolve(
        mainI18n.t(
          isBareFileName(command)
            ? 'launcher.messages.appNotFoundInPath'
            : 'launcher.messages.fileNotFound'
        )
      );
    });
  });
}

/**
 * shell.openPath で開き、開けなかったらログに残す
 * shell.openPath は失敗しても例外を投げず、エラーメッセージを返すため
 * @returns 失敗の理由（開けたら undefined）
 */
async function openPathOrLog(
  target: string,
  logger: Logger,
  logContext: Record<string, unknown>
): Promise<string | undefined> {
  const error = await shell.openPath(target);
  if (error) {
    logger.error({ ...logContext, error }, 'アイテムの起動に失敗しました');
    return error;
  }
  return undefined;
}

/** @returns 失敗の理由（起動できたら undefined） */
async function launchApp(item: LaunchableItem, logger: Logger): Promise<string | undefined> {
  const logContext = { path: item.path, name: item.displayName };

  // 登録アプリ（shell:AppsFolder\パス）の場合はexplorer.exe経由で起動
  if (item.path.startsWith('shell:AppsFolder\\')) {
    return spawnDetached(
      'explorer.exe',
      [item.path],
      {},
      logger,
      logContext,
      '登録アプリの起動に失敗しました'
    );
  }

  // ショートカットファイルまたは引数なしの場合
  if (/\.lnk$/i.test(item.path) || !item.args) {
    // shell.openPath はフルパスでないと開けないので、ファイル名だけ（calc.exe など）は PATH から探す
    const target = isBareFileName(item.path) ? await resolveFromPath(item.path) : item.path;
    if (!target) {
      logger.error(logContext, 'PATH にアプリが見つからないため起動できません');
      return mainI18n.t('launcher.messages.appNotFoundInPath');
    }
    return openPathOrLog(target, logger, logContext);
  }

  const cwd = getWorkingDirectory(item.path);
  // .bat・.cmd は cmd.exe 経由でしか動かない。パスだけを引用符で囲み、引数欄の文字は書いたとおりに
  // 後ろへ付けた 1 本のコマンドにして渡す（コマンドプロンプトに打つのと同じ。管理者として実行・
  // エクスプローラーで開いたときも、Windows は同じ形で cmd.exe に渡す）
  if (/\.(cmd|bat)$/i.test(item.path)) {
    return spawnDetached(
      buildCmdCommandLine(item.path, item.args),
      [],
      { shell: true, cwd },
      logger,
      { ...logContext, args: item.args },
      'アイテムの起動に失敗しました (spawn)'
    );
  }
  // それ以外は引数を分けて spawn に渡す（シェルを通さないので、記号がコマンドとして動かない）
  return spawnDetached(
    item.path,
    parseArgs(item.args),
    { shell: false, cwd },
    logger,
    { ...logContext, args: item.args },
    'アイテムの起動に失敗しました (spawn)'
  );
}

/**
 * .bat・.cmd を cmd.exe に渡すコマンドを組み立てる
 *
 * パスだけを `"` で囲み、引数は書いたとおりに付ける。`&` `^` `=` などはコマンドプロンプトと同じく
 * cmd.exe が読むので、1 つの引数として渡したいときは引数欄で `"` で囲む
 */
export function buildCmdCommandLine(batPath: string, args: string): string {
  const trimmed = args.trim();
  return trimmed ? `"${batPath}" ${trimmed}` : `"${batPath}"`;
}

/**
 * 引数ありで起動するときの作業フォルダ（実行ファイルのあるフォルダ）
 *
 * 引数なし（shell.openPath）で開いたときと同じく、実行ファイルのフォルダで起動する。
 * 作業フォルダの設定ファイルを読むツールのため。PATH 上のコマンド名など絶対パスでないときは指定しない
 */
export function getWorkingDirectory(executablePath: string): string | undefined {
  return path.win32.isAbsolute(executablePath) ? path.win32.dirname(executablePath) : undefined;
}

/** UAC の確認で「いいえ」を押したときのエラーコード（ERROR_CANCELLED） */
export const ERROR_CANCELLED = 1223;
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_PATH_NOT_FOUND = 3;

/** 管理者として起動した結果（cancelled は UAC で「いいえ」を押した。知らせない） */
export type AdminLaunchResult =
  { status: 'launched' } | { status: 'cancelled' } | { status: 'failed'; error: string };

/**
 * 管理者として起動するときに渡すものを組み立てる（引数・作業フォルダは普通に開くときと同じ）
 *
 * ショートカット（.lnk）は、引数・作業フォルダをショートカット自身が持つので渡さない
 * （アイテムの引数はショートカットから読んだものなので、渡すと二重になる）
 */
export function buildRunAsRequest(item: Pick<LaunchableItem, 'path' | 'args'>): RunAsRequest {
  if (/\.lnk$/i.test(item.path)) return { file: item.path };
  const parameters = item.args?.trim();
  const directory = getWorkingDirectory(item.path);
  return {
    file: item.path,
    ...(parameters && { parameters }),
    ...(directory && { directory }),
  };
}

/** 管理者として起動した結果を、普通に開いたときの結果の形にする */
function adminResultToLaunchResult(result: AdminLaunchResult): LaunchResult {
  if (result.status === 'launched') return { success: true };
  if (result.status === 'cancelled') return { success: false, error: '', cancelled: true };
  return { success: false, error: result.error };
}

/** ShellExecuteExW のエラーコードを、利用者に見せる理由にする */
function describeRunAsError(code: number): string {
  if (code === ERROR_FILE_NOT_FOUND || code === ERROR_PATH_NOT_FOUND) {
    return mainI18n.t('launcher.messages.fileNotFound');
  }
  return mainI18n.t('launcher.messages.windowsError', { code });
}

/**
 * アイテムを管理者として起動する（UAC の確認が出る）
 *
 * 失敗しても投げず、ログに残して結果を返す（知らせるのは呼び出し側）
 *
 * @param execute ShellExecuteExW を呼ぶ関数（テストで差し替える）
 */
export async function launchItemAsAdmin(
  item: Pick<LaunchableItem, 'path' | 'args' | 'displayName'>,
  logger: Logger,
  execute: (request: RunAsRequest) => Promise<number> = shellExecuteRunAs
): Promise<AdminLaunchResult> {
  const request = buildRunAsRequest(item);
  const logContext = { name: item.displayName, ...request };
  try {
    const code = await execute(request);
    if (code === 0) {
      logger.info(logContext, '管理者として起動しました');
      return { status: 'launched' };
    }
    if (code === ERROR_CANCELLED) {
      logger.info(logContext, '管理者としての起動を UAC で取りやめました');
      return { status: 'cancelled' };
    }
    logger.error({ ...logContext, code }, '管理者として起動できませんでした');
    return { status: 'failed', error: describeRunAsError(code) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ ...logContext, error: message }, '管理者として起動できませんでした');
    return { status: 'failed', error: message };
  }
}

/** @returns 失敗の理由（復元できたら undefined） */
async function restoreClipboard(item: LaunchableItem, logger: Logger): Promise<string | undefined> {
  if (!item.clipboardDataRef) {
    logger.warn({ name: item.displayName }, 'クリップボードデータ参照がありません');
    return mainI18n.t('launcher.messages.clipboardDataMissing');
  }

  const clipboardService = ClipboardService.getInstance();
  const result = await clipboardService.restoreClipboard(item.clipboardDataRef);
  if (!result.success) {
    logger.error(
      { error: result.error, dataRef: item.clipboardDataRef, name: item.displayName },
      'クリップボードの復元に失敗しました'
    );
    return result.error ?? mainI18n.t('launcher.messages.clipboardDataMissing');
  }
  return undefined;
}
