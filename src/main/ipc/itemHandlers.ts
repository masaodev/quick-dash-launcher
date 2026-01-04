import { ipcMain, BrowserWindow, shell } from 'electron';
import { itemLogger } from '@common/logger';
import {
  LauncherItem,
  GroupItem,
  WindowOperationItem,
  AppItem,
  WindowPinMode,
  WindowConfig,
} from '@common/types';
import { GROUP_LAUNCH_DELAY_MS } from '@common/constants';
import { isLauncherItem } from '@common/utils/typeGuards';

import { WorkspaceService } from '../services/workspaceService.js';
import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';

import { notifyWorkspaceChanged } from './workspaceHandlers.js';

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
        windowConfig: item.windowConfig ? JSON.stringify(item.windowConfig) : 'なし',
      },
      'アイテムを起動中'
    );

    // ウィンドウ設定が存在する場合、先にウィンドウ検索を試行
    const activationResult = await tryActivateWindow(
      item.windowConfig,
      item.windowTitle,
      item.name,
      itemLogger
    );

    if (activationResult.activated) {
      // ウィンドウアクティブ化成功、通常起動をスキップ
      if (mainWindow && shouldHideWindow) {
        mainWindow.hide();
      }
      return;
    }
    // アクティブ化失敗または未設定の場合は下記の通常起動処理へフォールバック

    // 通常の起動処理：共通のlaunchItem関数を使用
    await launchItem(
      {
        type: item.type,
        path: item.path,
        args: item.args,
        name: item.name,
      },
      itemLogger
    );

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
      'アイテムの起動処理でエラーが発生しました'
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
    if (isLauncherItem(item)) {
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

    // 実行履歴に記録
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.addExecutionHistory(item);
      // ワークスペースウィンドウに変更を通知
      notifyWorkspaceChanged();
    } catch (error) {
      // 履歴記録失敗はエラーログのみ（アイテム起動自体は成功）
      itemLogger.error(
        { error: error instanceof Error ? error.message : String(error), itemName: item.name },
        '実行履歴の記録に失敗しました'
      );
    }
  });

  ipcMain.handle('open-parent-folder', async (_event, item: LauncherItem) => {
    const shouldHide = getWindowPinMode() === 'normal';
    await openParentFolder(item, getMainWindow(), shouldHide);
  });

  ipcMain.handle('execute-group', async (_event, group: GroupItem, allItems: AppItem[]) => {
    const shouldHide = getWindowPinMode() === 'normal';
    await executeGroup(group, allItems, getMainWindow(), shouldHide);

    // 実行履歴に記録
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.addExecutionHistory(group);
      // ワークスペースウィンドウに変更を通知
      notifyWorkspaceChanged();
    } catch (error) {
      // 履歴記録失敗はエラーログのみ（グループ起動自体は成功）
      itemLogger.error(
        { error: error instanceof Error ? error.message : String(error), groupName: group.name },
        'グループ実行履歴の記録に失敗しました'
      );
    }
  });

  ipcMain.handle('execute-window-operation', async (_event, item: WindowOperationItem) => {
    itemLogger.info(
      {
        windowTitle: item.windowTitle,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        virtualDesktopNumber: item.virtualDesktopNumber,
        activateWindow: item.activateWindow,
      },
      'ウィンドウ操作アイテムを実行中'
    );

    const windowConfig: WindowConfig = {
      title: item.windowTitle,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      virtualDesktopNumber: item.virtualDesktopNumber,
      activateWindow: item.activateWindow,
    };

    const result = await tryActivateWindow(windowConfig, undefined, item.windowTitle, itemLogger);

    if (!result.windowFound) {
      itemLogger.warn({ windowTitle: item.windowTitle }, 'ウィンドウが見つかりませんでした');
    }

    const shouldHide = getWindowPinMode() === 'normal';
    if (result.activated && shouldHide) {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
    }

    // 実行履歴に記録
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.addExecutionHistory(item);
      notifyWorkspaceChanged();
    } catch (error) {
      itemLogger.error(
        { error: error instanceof Error ? error.message : String(error), itemName: item.name },
        '実行履歴の記録に失敗しました'
      );
    }
  });
}
