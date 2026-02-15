/**
 * アイテム起動ユーティリティ
 */

import { spawn } from 'child_process';

import { shell } from 'electron';
import { Logger } from 'pino';
import { parseArgs } from '@common/utils/argsParser';

import { ClipboardService } from '../services/clipboardService.js';

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

/**
 * アイテムを起動する
 */
export async function launchItem(item: LaunchableItem, logger: Logger): Promise<void> {
  try {
    switch (item.type) {
      case 'url':
      case 'customUri':
        await shell.openExternal(item.path);
        break;

      case 'file':
      case 'folder':
        await shell.openPath(item.path);
        break;

      case 'app':
        await launchApp(item, logger);
        break;

      case 'clipboard':
        await restoreClipboard(item, logger);
        break;

      default:
        logger.warn(
          { type: item.type, path: item.path, name: item.displayName },
          '未知のアイテムタイプです'
        );
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
  }
}

/** spawn でプロセスを起動し、エラーハンドリングを設定する */
function spawnDetached(
  command: string,
  args: string[],
  options: { shell?: boolean },
  logger: Logger,
  logContext: Record<string, unknown>,
  errorMessage: string
): void {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: options.shell,
  });
  child.unref();
  child.on('error', (error) => {
    logger.error({ error: error.message, ...logContext }, errorMessage);
  });
}

async function launchApp(item: LaunchableItem, logger: Logger): Promise<void> {
  const logContext = { path: item.path, name: item.displayName };

  // 登録アプリ（shell:AppsFolder\パス）の場合はexplorer.exe経由で起動
  if (item.path.startsWith('shell:AppsFolder\\')) {
    spawnDetached(
      'explorer.exe',
      [item.path],
      {},
      logger,
      logContext,
      '登録アプリの起動に失敗しました'
    );
    return;
  }

  // ショートカットファイルまたは引数なしの場合
  if (item.path.endsWith('.lnk') || !item.args) {
    await shell.openPath(item.path);
    return;
  }

  // 引数ありの場合はspawnを使用（コマンドインジェクション防止）
  const args = parseArgs(item.args);
  const needsShell = /\.(cmd|bat)$/i.test(item.path);
  spawnDetached(
    item.path,
    args,
    { shell: needsShell },
    logger,
    { ...logContext, args: item.args },
    'アイテムの起動に失敗しました (spawn)'
  );
}

async function restoreClipboard(item: LaunchableItem, logger: Logger): Promise<void> {
  if (!item.clipboardDataRef) {
    logger.warn({ name: item.displayName }, 'クリップボードデータ参照がありません');
    return;
  }

  const clipboardService = ClipboardService.getInstance();
  const result = await clipboardService.restoreClipboard(item.clipboardDataRef);
  if (!result.success) {
    logger.error(
      { error: result.error, dataRef: item.clipboardDataRef, name: item.displayName },
      'クリップボードの復元に失敗しました'
    );
  }
}
