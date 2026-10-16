/**
 * アイテム起動ユーティリティ
 */

import { spawn } from 'child_process';
import * as path from 'path';

import { shell } from 'electron';
import { Logger } from 'pino';
import { parseArgs } from '@common/utils/argsParser';

import { ClipboardService } from '../services/clipboardService.js';
import { mainI18n } from '../services/mainI18n.js';

import { noteLaunchedPath } from './folderPathProbe.js';
import { isBareFileName, resolveFromPath } from './pathResolver.js';

/**
 * 起動可能なアイテムの最小インターフェース
 */
export interface LaunchableItem {
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard';
  path: string;
  args?: string;
  displayName?: string;
  clipboardDataRef?: string;
}

/** 起動の結果（失敗のときは利用者に見せる理由） */
export type LaunchResult = { success: true } | { success: false; error: string };

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
    child.once('error', (error) => {
      logger.error({ error: error.message, ...logContext }, errorMessage);
      resolve(error.message);
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

  // 引数ありの場合はspawnを使用（コマンドインジェクション防止）
  const args = parseArgs(item.args);
  const needsShell = /\.(cmd|bat)$/i.test(item.path);
  return spawnDetached(
    item.path,
    args,
    { shell: needsShell, cwd: getWorkingDirectory(item.path) },
    logger,
    { ...logContext, args: item.args },
    'アイテムの起動に失敗しました (spawn)'
  );
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
