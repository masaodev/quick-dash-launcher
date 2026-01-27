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
import { isLauncherItem, isWindowOperationItem } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { WorkspaceService } from '../services/workspace/index.js';
import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';
import { SettingsService } from '../services/settingsService.js';

import { notifyWorkspaceChanged } from './workspaceHandlers.js';

async function openItem(
  item: LauncherItem,
  _mainWindow: BrowserWindow | null,
  _shouldHideWindow: boolean
): Promise<void> {
  try {
    itemLogger.info(
      {
        name: item.displayName,
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
      item.displayName,
      itemLogger
    );

    if (activationResult.activated) {
      // ウィンドウアクティブ化成功、通常起動をスキップ
      return;
    }
    // アクティブ化失敗または未設定の場合は下記の通常起動処理へフォールバック

    // 通常の起動処理：共通のlaunchItem関数を使用
    await launchItem(
      {
        type: item.type,
        path: item.path,
        args: item.args,
        displayName: item.displayName,
      },
      itemLogger
    );
  } catch (error) {
    itemLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        item: {
          name: item.displayName,
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
  _mainWindow: BrowserWindow | null,
  _shouldHideWindow: boolean
): Promise<void> {
  try {
    itemLogger.info(
      {
        name: item.displayName,
        type: item.type,
        path: item.path,
        originalPath: item.originalPath || 'なし',
      },
      '親フォルダーを開く'
    );

    if (item.type === 'file' || item.type === 'folder' || item.type === 'app') {
      await shell.showItemInFolder(item.path);
    }
  } catch (error) {
    itemLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        item: { name: item.displayName, type: item.type, path: item.path },
      },
      '親フォルダの表示に失敗しました'
    );
  }
}

/**
 * グループ内の1つのアイテムを実行する
 *
 * @param groupName - グループ名（ログ出力用）
 * @param itemName - 実行するアイテム名
 * @param item - 実行するアイテム（LauncherItemまたはWindowOperationItem）
 * @returns 実行結果（成功/失敗とアイテム名）
 */
async function executeGroupItem(
  groupName: string,
  itemName: string,
  item: LauncherItem | WindowOperationItem | undefined
): Promise<{ success: boolean; itemName: string }> {
  if (!item) {
    itemLogger.warn({ groupName, itemName }, 'グループ内のアイテムが見つかりません');
    return { success: false, itemName };
  }

  try {
    // アイテムの種類に応じて実行
    if (isWindowOperationItem(item)) {
      // ウィンドウ操作アイテムの場合
      const windowConfig: WindowConfig = {
        title: item.windowTitle,
        processName: item.processName,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
        virtualDesktopNumber: item.virtualDesktopNumber,
        activateWindow: item.activateWindow,
        pinToAllDesktops: item.pinToAllDesktops,
      };

      const result = await tryActivateWindow(windowConfig, item.windowTitle, itemLogger);

      if (!result.windowFound) {
        itemLogger.warn(
          { groupName, itemName, windowTitle: item.windowTitle },
          'グループ内のウィンドウ操作アイテム: ウィンドウが見つかりませんでした'
        );
      }
    } else {
      // 通常のLauncherItemの場合
      await openItem(item, null, false);
    }

    itemLogger.info({ groupName, itemName }, 'グループアイテムを実行しました');
    return { success: true, itemName };
  } catch (error) {
    itemLogger.error(
      {
        groupName,
        itemName,
        error: error instanceof Error ? error.message : String(error),
      },
      'グループアイテムの実行に失敗しました'
    );
    return { success: false, itemName };
  }
}

/**
 * グループ内のアイテムを実行する（並列または順次）
 * アイテム名から実際のLauncherItemを検索し、設定に応じて並列または順次起動する
 *
 * @param group - 実行するグループアイテム
 * @param allItems - すべてのアイテムリスト（参照解決用）
 * @param mainWindow - メインウィンドウ（非表示処理用）
 * @param shouldHideWindow - ウィンドウを非表示にするかどうか
 */
async function executeGroup(
  group: GroupItem,
  allItems: AppItem[],
  _mainWindow: BrowserWindow | null,
  _shouldHideWindow: boolean
): Promise<void> {
  itemLogger.info(
    { groupName: group.displayName, itemCount: group.itemNames.length, itemNames: group.itemNames },
    'グループを実行中'
  );

  // 設定を取得
  const settingsService = await SettingsService.getInstance();
  const parallelLaunch = await settingsService.get('parallelGroupLaunch');

  // アイテム名からLauncherItemまたはWindowOperationItemを検索するマップを作成
  const itemMap = new Map<string, LauncherItem | WindowOperationItem>();
  for (const item of allItems) {
    if (isLauncherItem(item)) {
      itemMap.set(item.displayName, item);
    } else if (isWindowOperationItem(item)) {
      itemMap.set(item.displayName, item);
    }
  }

  let successCount = 0;
  let errorCount = 0;

  // 並列起動モード
  if (parallelLaunch) {
    itemLogger.info({ groupName: group.displayName }, '並列起動モードでグループを実行');

    const promises = group.itemNames.map((itemName) =>
      executeGroupItem(group.displayName, itemName, itemMap.get(itemName))
    );

    const results = await Promise.all(promises);
    successCount = results.filter((r) => r.success).length;
    errorCount = results.filter((r) => !r.success).length;
  } else {
    // 順次起動モード
    itemLogger.info({ groupName: group.displayName }, '順次起動モードでグループを実行');

    for (let i = 0; i < group.itemNames.length; i++) {
      const itemName = group.itemNames[i];
      const result = await executeGroupItem(group.displayName, itemName, itemMap.get(itemName));

      if (result.success) {
        successCount++;
        itemLogger.info(
          { groupName: group.displayName, itemName, index: i + 1, total: group.itemNames.length },
          'グループアイテムを実行しました（順次）'
        );
      } else {
        errorCount++;
      }

      // 最後のアイテム以外は待機
      if (i < group.itemNames.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, GROUP_LAUNCH_DELAY_MS));
      }
    }
  }

  itemLogger.info(
    {
      groupName: group.displayName,
      total: group.itemNames.length,
      success: successCount,
      error: errorCount,
      mode: parallelLaunch ? '並列' : '順次',
    },
    'グループ実行完了'
  );
}

export function setupItemHandlers(
  getMainWindow: () => BrowserWindow | null,
  getWindowPinMode: () => WindowPinMode
) {
  ipcMain.handle(IPC_CHANNELS.OPEN_ITEM, async (_event, item: LauncherItem) => {
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
        {
          error: error instanceof Error ? error.message : String(error),
          itemName: item.displayName,
        },
        '実行履歴の記録に失敗しました'
      );
    }
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_PARENT_FOLDER, async (_event, item: LauncherItem) => {
    const shouldHide = getWindowPinMode() === 'normal';
    await openParentFolder(item, getMainWindow(), shouldHide);
  });

  ipcMain.handle(
    IPC_CHANNELS.EXECUTE_GROUP,
    async (_event, group: GroupItem, allItems: AppItem[]) => {
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
          {
            error: error instanceof Error ? error.message : String(error),
            groupName: group.displayName,
          },
          'グループ実行履歴の記録に失敗しました'
        );
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.EXECUTE_WINDOW_OPERATION,
    async (_event, item: WindowOperationItem) => {
      itemLogger.info(
        {
          windowTitle: item.windowTitle,
          processName: item.processName,
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
        processName: item.processName,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
        virtualDesktopNumber: item.virtualDesktopNumber,
        activateWindow: item.activateWindow,
        pinToAllDesktops: item.pinToAllDesktops,
      };

      const result = await tryActivateWindow(windowConfig, item.windowTitle, itemLogger);

      if (!result.windowFound) {
        itemLogger.warn({ windowTitle: item.windowTitle }, 'ウィンドウが見つかりませんでした');
      }

      // 実行履歴に記録
      try {
        const workspaceService = await WorkspaceService.getInstance();
        await workspaceService.addExecutionHistory(item);
        notifyWorkspaceChanged();
      } catch (error) {
        itemLogger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            itemName: item.displayName,
          },
          '実行履歴の記録に失敗しました'
        );
      }
    }
  );
}
