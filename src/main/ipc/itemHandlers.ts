import { exec } from 'child_process';

import { ipcMain, shell, BrowserWindow } from 'electron';
import { itemLogger } from '@common/logger';

import { LauncherItem, GroupItem, AppItem } from '../../common/types';

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
      // ショートカットファイル（.lnk）の場合、pathがショートカットファイル自身のパスになる
      // .lnkファイルの場合は引数があってもshell.openPathを使用
      if (item.path.endsWith('.lnk')) {
        await shell.openPath(item.path);
      } else if (item.args) {
        // Windowsでは start コマンドを使って完全に独立したプロセスとして起動
        if (process.platform === 'win32') {
          // startコマンドを使って新しいウィンドウで実行
          const command = `start "" "${item.path}" ${item.args}`;
          exec(command, { windowsHide: false }, (error) => {
            if (error) {
              itemLogger.error('アイテムの起動に失敗しました (start command)', {
                error: error.message,
              });
            }
          });
        } else {
          // Unix系OSの場合は従来通りspawnを使用
          const { spawn } = await import('child_process');
          const child = spawn(item.path, item.args.split(' '), {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        }
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
    itemLogger.info('親フォルダーを開く', {
      name: item.name,
      type: item.type,
      path: item.path,
      originalPath: item.originalPath || 'なし',
    });

    if (item.type === 'file' || item.type === 'folder' || item.type === 'app') {
      await shell.showItemInFolder(item.path);
    }

    if (mainWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    itemLogger.error('親フォルダの表示に失敗しました', {
      error: error instanceof Error ? error.message : String(error),
      item: {
        name: item.name,
        type: item.type,
        path: item.path,
      },
    });
  }
}

/**
 * グループ内のアイテムを順次実行する
 * アイテム名から実際のLauncherItemを検索し、500ms間隔で順次起動する
 *
 * @param group - 実行するグループアイテム
 * @param allItems - すべてのアイテムリスト（参照解決用）
 * @param mainWindow - メインウィンドウ（非表示処理用）
 */
async function executeGroup(
  group: GroupItem,
  allItems: AppItem[],
  mainWindow: BrowserWindow | null
): Promise<void> {
  itemLogger.info('グループを実行中', {
    groupName: group.name,
    itemCount: group.itemNames.length,
    itemNames: group.itemNames,
  });

  // アイテム名からLauncherItemを検索するマップを作成
  const itemMap = new Map<string, LauncherItem>();
  for (const item of allItems) {
    if (item.type !== 'group') {
      itemMap.set(item.name, item);
    }
  }

  let successCount = 0;
  let errorCount = 0;

  // グループ内のアイテムを順次実行
  for (let i = 0; i < group.itemNames.length; i++) {
    const itemName = group.itemNames[i];
    const item = itemMap.get(itemName);

    if (!item) {
      itemLogger.warn('グループ内のアイテムが見つかりません', {
        groupName: group.name,
        itemName: itemName,
      });
      errorCount++;
      continue;
    }

    try {
      // 個別アイテムを実行（ウィンドウは非表示にしない）
      await openItem(item, null);
      successCount++;
      itemLogger.info('グループアイテムを実行しました', {
        groupName: group.name,
        itemName: itemName,
        index: i + 1,
        total: group.itemNames.length,
      });
    } catch (error) {
      itemLogger.error('グループアイテムの実行に失敗しました', {
        groupName: group.name,
        itemName: itemName,
        error: error instanceof Error ? error.message : String(error),
      });
      errorCount++;
    }

    // 最後のアイテム以外は500ms待機
    if (i < group.itemNames.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  itemLogger.info('グループ実行完了', {
    groupName: group.name,
    total: group.itemNames.length,
    success: successCount,
    error: errorCount,
  });

  // すべてのアイテム実行後にウィンドウを非表示
  if (mainWindow) {
    mainWindow.hide();
  }
}

export function setupItemHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('open-item', async (_event, item: LauncherItem) => {
    await openItem(item, getMainWindow());
  });

  ipcMain.handle('open-parent-folder', async (_event, item: LauncherItem) => {
    await openParentFolder(item, getMainWindow());
  });

  ipcMain.handle('execute-group', async (_event, group: GroupItem, allItems: AppItem[]) => {
    await executeGroup(group, allItems, getMainWindow());
  });
}
