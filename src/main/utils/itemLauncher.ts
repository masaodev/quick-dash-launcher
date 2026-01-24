/**
 * アイテム起動ユーティリティ
 *
 * LauncherItem、WorkspaceItemなどのアイテムタイプに基づいた起動処理を提供します。
 */

import { spawn } from 'child_process';

import { shell } from 'electron';
import { Logger } from 'pino';
import { parseArgs } from '@common/utils/argsParser';

/**
 * 起動可能なアイテムの最小インターフェース
 */
export interface LaunchableItem {
  /** アイテムタイプ */
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  /** パス（URL、ファイルパス、アプリケーションパスなど） */
  path: string;
  /** コマンドライン引数（オプション） */
  args?: string;
  /** アイテム名（ログ出力用） */
  name?: string;
}

/**
 * アイテムを起動する
 *
 * @param item 起動するアイテム
 * @param logger ロガーインスタンス
 *
 * @description
 * アイテムタイプに応じて適切な起動方法を選択します：
 * - url: shell.openExternal（外部URLをブラウザで開く）
 * - file/folder: shell.openPath（ファイル/フォルダを関連アプリで開く）
 * - app: 引数がある場合はspawn、.lnkの場合やその他はshell.openPath
 * - customUri: shell.openExternal（obsidian://, vscode://などのカスタムURIスキーマ）
 *
 * @throws エラーは投げず、ログに記録します
 */
export async function launchItem(item: LaunchableItem, logger: Logger): Promise<void> {
  try {
    if (item.type === 'url') {
      // URLを外部ブラウザで開く
      await shell.openExternal(item.path);
    } else if (item.type === 'file' || item.type === 'folder') {
      // ファイル・フォルダを関連アプリで開く
      await shell.openPath(item.path);
    } else if (item.type === 'app') {
      // アプリケーションを起動
      if (item.path.endsWith('.lnk')) {
        // ショートカットファイル（.lnk）の場合はshell.openPathを使用
        await shell.openPath(item.path);
      } else if (item.args) {
        // 引数がある場合はspawnを使用してコマンドインジェクションを防止
        const args = parseArgs(item.args);
        // .cmd/.bat ファイルはシェル経由で実行する必要がある
        const needsShell = /\.(cmd|bat)$/i.test(item.path);
        const child = spawn(item.path, args, {
          detached: true,
          stdio: 'ignore',
          shell: needsShell,
        });
        child.unref();

        // エラーハンドリング
        child.on('error', (error) => {
          logger.error(
            {
              error: error.message,
              path: item.path,
              args: item.args,
              name: item.displayName,
            },
            'アイテムの起動に失敗しました (spawn)'
          );
        });
      } else {
        // 引数がない場合はshell.openPathを使用
        await shell.openPath(item.path);
      }
    } else if (item.type === 'customUri') {
      // カスタムURIスキーマ（obsidian://, vscode://など）を開く
      await shell.openExternal(item.path);
    } else {
      // 未知のアイテムタイプ
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
