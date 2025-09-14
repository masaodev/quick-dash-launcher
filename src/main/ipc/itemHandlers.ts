import { ipcMain, shell, BrowserWindow } from 'electron';
import { itemLogger } from '@common/logger';
import { exec } from 'child_process';

import { LauncherItem } from '../../common/types';

async function openItem(item: LauncherItem, mainWindow: BrowserWindow | null): Promise<void> {
  try {
    itemLogger.info('アイテムを起動中', {
      name: item.name,
      type: item.type,
      path: item.path,
      args: item.args || 'なし',
      originalPath: item.originalPath || 'なし',
    });

    if (item.type === 'url') {
      await shell.openExternal(item.path);
    } else if (item.type === 'file' || item.type === 'folder') {
      await shell.openPath(item.path);
    } else if (item.type === 'app') {
      // .lnkファイルで元のパスが存在する場合は、それを使用
      const launchPath =
        item.originalPath && item.originalPath.endsWith('.lnk') ? item.originalPath : item.path;

      // .lnkファイルの場合は引数があってもshell.openPathを使用
      if (launchPath.endsWith('.lnk')) {
        await shell.openPath(launchPath);
      } else if (item.args) {
        // Windowsでは start コマンドを使って完全に独立したプロセスとして起動
        if (process.platform === 'win32') {
          // startコマンドを使って新しいウィンドウで実行
          const command = `start "" "${launchPath}" ${item.args}`;
          exec(command, { windowsHide: false }, (error) => {
            if (error) {
              itemLogger.error('アイテムの起動に失敗しました (start command)', { error: error.message });
            }
          });
        } else {
          // Unix系OSの場合は従来通りspawnを使用
          const { spawn } = await import('child_process');
          const child = spawn(launchPath, item.args.split(' '), {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
        }
      } else {
        await shell.openPath(launchPath);
      }
    } else if (item.type === 'customUri') {
      await shell.openExternal(item.path);
    }

    if (mainWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    itemLogger.error('アイテムの起動に失敗しました', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      item: {
        name: item.name,
        type: item.type,
        path: item.path,
        args: item.args || 'なし',
        originalPath: item.originalPath || 'なし',
      },
    });
  }
}

async function openParentFolder(
  item: LauncherItem,
  mainWindow: BrowserWindow | null
): Promise<void> {
  try {
    if (item.type === 'file' || item.type === 'folder') {
      await shell.showItemInFolder(item.path);
    }

    if (mainWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    itemLogger.error('親フォルダの表示に失敗しました', { error });
  }
}

export function setupItemHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('open-item', async (_event, item: LauncherItem, searchQuery?: string) => {
    // 検索クエリが提供された場合は履歴に追加
    if (searchQuery && searchQuery.trim()) {
      const { ipcMain: ipc } = await import('electron');
      // 検索履歴エントリーを追加
      ipc.emit('internal-add-history', searchQuery.trim());
    }

    await openItem(item, getMainWindow());
  });

  ipcMain.handle('open-parent-folder', async (_event, item: LauncherItem) => {
    await openParentFolder(item, getMainWindow());
  });

  // 内部的な履歴追加イベント
  ipcMain.on('internal-add-history', async (query: string) => {
    try {
      // 検索履歴エントリーを追加するIPCハンドラーを呼び出す
      const { ipcMain: ipc } = await import('electron');
      ipc.emit('add-search-history-entry-internal', query);
    } catch (error) {
      itemLogger.error('検索履歴の追加に失敗しました', { error, query });
    }
  });
}
