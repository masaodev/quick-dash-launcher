import { ipcMain, shell, BrowserWindow } from 'electron';

import { LauncherItem } from '../../common/types';

async function openItem(item: LauncherItem, mainWindow: BrowserWindow | null): Promise<void> {
  try {
    console.log(`アイテムを起動中: ${item.name} (${item.type})`);
    console.log(`パス: ${item.path}`);
    if (item.args) {
      console.log(`引数: ${item.args}`);
    }

    if (item.type === 'url') {
      await shell.openExternal(item.path);
    } else if (item.type === 'file' || item.type === 'folder') {
      await shell.openPath(item.path);
    } else if (item.type === 'app') {
      if (item.args) {
        const { spawn } = await import('child_process');
        spawn(item.path, item.args.split(' '), { detached: true });
      } else {
        await shell.openPath(item.path);
      }
    } else if (item.type === 'customUri') {
      await shell.openExternal(item.path);
    }

    if (mainWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    console.error('アイテムの起動に失敗しました:', error);
    console.error('失敗したアイテム:', {
      name: item.name,
      type: item.type,
      path: item.path,
      args: item.args || 'なし',
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
    console.error('親フォルダの表示に失敗しました:', error);
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
