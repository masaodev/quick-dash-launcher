import { ipcMain, shell, BrowserWindow } from 'electron';
import { itemLogger } from '@common/logger';

import { LauncherItem } from '../../common/types';

async function openItem(item: LauncherItem, mainWindow: BrowserWindow | null): Promise<void> {
  try {
    itemLogger.info('アイテムを起動中', { 
      name: item.name, 
      type: item.type,
      path: item.path,
      args: item.args || 'なし',
      originalPath: item.originalPath || 'なし'
    });

    if (item.type === 'url') {
      await shell.openExternal(item.path);
    } else if (item.type === 'file' || item.type === 'folder') {
      await shell.openPath(item.path);
    } else if (item.type === 'app') {
      // .lnkファイルで元のパスが存在する場合は、それを使用
      const launchPath = item.originalPath && item.originalPath.endsWith('.lnk') ? item.originalPath : item.path;
      
      // .lnkファイルの場合は引数があってもshell.openPathを使用
      if (launchPath.endsWith('.lnk')) {
        await shell.openPath(launchPath);
      } else if (item.args) {
        const { spawn } = await import('child_process');
        spawn(launchPath, item.args.split(' '), { detached: true });
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
        originalPath: item.originalPath || 'なし'
      }
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
  ipcMain.handle('open-item', async (_event, item: LauncherItem) => {
    await openItem(item, getMainWindow());
  });

  ipcMain.handle('open-parent-folder', async (_event, item: LauncherItem) => {
    await openParentFolder(item, getMainWindow());
  });
}
