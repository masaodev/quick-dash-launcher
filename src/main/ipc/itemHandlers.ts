import { spawn } from 'child_process';

import { ipcMain, shell, BrowserWindow } from 'electron';
import { itemLogger } from '@common/logger';
import { LauncherItem, GroupItem, AppItem, WindowPinMode } from '@common/types';
import { GROUP_LAUNCH_DELAY_MS } from '@common/constants';
import { parseArgs } from '@common/utils/argsParser';

async function openItem(
  item: LauncherItem,
  mainWindow: BrowserWindow | null,
  shouldHideWindow: boolean
): Promise<void> {
  try {
    itemLogger.info(
      {
        name: item.name,
        type: item.type,
        path: item.path,
        args: item.args || 'なし',
        originalPath: item.originalPath || 'なし',
      },
      'アイテムを起動中'
    );

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
        // 引数を配列として処理（ダブルクォートを考慮してパース）
        const args = parseArgs(item.args);

        // spawnを使用してコマンドインジェクションを防止
        // 直接実行することで、startコマンドの複雑な挙動を回避
        const child = spawn(item.path, args, {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        child.on('error', (error) => {
          itemLogger.error(
            { error: error.message, path: item.path, args: item.args },
            'アイテムの起動に失敗しました (spawn)'
          );
        });
      } else {
        await shell.openPath(item.path);
      }
    } else if (item.type === 'customUri') {
      await shell.openExternal(item.path);
    }

    if (mainWindow && shouldHideWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    itemLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        item: {
          name: item.name,
          type: item.type,
          path: item.path,
          args: item.args || 'なし',
          originalPath: item.originalPath || 'なし',
        },
      },
      'アイテムの起動に失敗しました'
    );
  }
}

async function openParentFolder(
  item: LauncherItem,
  mainWindow: BrowserWindow | null,
  shouldHideWindow: boolean
): Promise<void> {
  try {
    itemLogger.info(
      {
        name: item.name,
        type: item.type,
        path: item.path,
        originalPath: item.originalPath || 'なし',
      },
      '親フォルダーを開く'
    );

    if (item.type === 'file' || item.type === 'folder' || item.type === 'app') {
      await shell.showItemInFolder(item.path);
    }

    if (mainWindow && shouldHideWindow) {
      mainWindow.hide();
    }
  } catch (error) {
    itemLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        item: { name: item.name, type: item.type, path: item.path },
      },
      '親フォルダの表示に失敗しました'
    );
  }
}

/**
 * グループ内のアイテムを順次実行する
 * アイテム名から実際のLauncherItemを検索し、500ms間隔で順次起動する
 *
 * @param group - 実行するグループアイテム
 * @param allItems - すべてのアイテムリスト（参照解決用）
 * @param mainWindow - メインウィンドウ（非表示処理用）
 * @param shouldHideWindow - ウィンドウを非表示にするかどうか
 */
async function executeGroup(
  group: GroupItem,
  allItems: AppItem[],
  mainWindow: BrowserWindow | null,
  shouldHideWindow: boolean
): Promise<void> {
  itemLogger.info(
    { groupName: group.name, itemCount: group.itemNames.length, itemNames: group.itemNames },
    'グループを実行中'
  );

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
      itemLogger.warn({ groupName: group.name, itemName }, 'グループ内のアイテムが見つかりません');
      errorCount++;
      continue;
    }

    try {
      // 個別アイテムを実行（ウィンドウは非表示にしない）
      await openItem(item, null, false);
      successCount++;
      itemLogger.info(
        { groupName: group.name, itemName, index: i + 1, total: group.itemNames.length },
        'グループアイテムを実行しました'
      );
    } catch (error) {
      itemLogger.error(
        {
          groupName: group.name,
          itemName,
          error: error instanceof Error ? error.message : String(error),
        },
        'グループアイテムの実行に失敗しました'
      );
      errorCount++;
    }

    // 最後のアイテム以外は待機
    if (i < group.itemNames.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, GROUP_LAUNCH_DELAY_MS));
    }
  }

  itemLogger.info(
    {
      groupName: group.name,
      total: group.itemNames.length,
      success: successCount,
      error: errorCount,
    },
    'グループ実行完了'
  );

  // すべてのアイテム実行後にウィンドウを非表示
  if (mainWindow && shouldHideWindow) {
    mainWindow.hide();
  }
}

export function setupItemHandlers(
  getMainWindow: () => BrowserWindow | null,
  getWindowPinMode: () => WindowPinMode
) {
  ipcMain.handle('open-item', async (_event, item: LauncherItem) => {
    const shouldHide = getWindowPinMode() === 'normal';
    await openItem(item, getMainWindow(), shouldHide);
  });

  ipcMain.handle('open-parent-folder', async (_event, item: LauncherItem) => {
    const shouldHide = getWindowPinMode() === 'normal';
    await openParentFolder(item, getMainWindow(), shouldHide);
  });

  ipcMain.handle('execute-group', async (_event, group: GroupItem, allItems: AppItem[]) => {
    const shouldHide = getWindowPinMode() === 'normal';
    await executeGroup(group, allItems, getMainWindow(), shouldHide);
  });
}
