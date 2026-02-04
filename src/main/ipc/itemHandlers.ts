import { ipcMain, BrowserWindow, shell } from 'electron';
import { itemLogger } from '@common/logger';
import {
  LauncherItem,
  GroupItem,
  WindowItem,
  AppItem,
  WindowPinMode,
  WindowConfig,
} from '@common/types';
import { GROUP_LAUNCH_DELAY_MS } from '@common/constants';
import { isLauncherItem, isWindowItem } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { WorkspaceService } from '../services/workspace/index.js';
import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';
import { SettingsService } from '../services/settingsService.js';

import { notifyWorkspaceChanged } from './workspaceHandlers.js';

/**
 * WindowItemからWindowConfigを生成する
 */
function createWindowConfig(item: WindowItem): WindowConfig {
  return {
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
}

/**
 * 実行履歴を記録する
 */
async function recordExecutionHistory(
  item: LauncherItem | GroupItem | WindowItem,
  itemIdentifier: string
): Promise<void> {
  try {
    const workspaceService = await WorkspaceService.getInstance();
    await workspaceService.addExecutionHistory(item);
    notifyWorkspaceChanged();
  } catch (error) {
    itemLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        itemName: itemIdentifier,
      },
      '実行履歴の記録に失敗しました'
    );
  }
}

async function openItem(item: LauncherItem): Promise<void> {
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
  const activationResult = await tryActivateWindow(item.windowConfig, item.displayName, itemLogger);

  if (activationResult.activated) {
    return;
  }

  // 通常の起動処理
  await launchItem(
    {
      type: item.type,
      path: item.path,
      args: item.args,
      displayName: item.displayName,
    },
    itemLogger
  );
}

async function openParentFolder(item: LauncherItem): Promise<void> {
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
}

/**
 * グループ内の1つのアイテムを実行する
 */
async function executeGroupItem(
  groupName: string,
  itemName: string,
  item: LauncherItem | WindowItem | undefined
): Promise<{ success: boolean; itemName: string }> {
  if (!item) {
    itemLogger.warn({ groupName, itemName }, 'グループ内のアイテムが見つかりません');
    return { success: false, itemName };
  }

  try {
    if (isWindowItem(item)) {
      const windowConfig = createWindowConfig(item);
      const result = await tryActivateWindow(windowConfig, item.windowTitle, itemLogger);

      if (!result.windowFound) {
        itemLogger.warn(
          { groupName, itemName, windowTitle: item.windowTitle },
          'グループ内のウィンドウ操作アイテム: ウィンドウが見つかりませんでした'
        );
      }
    } else {
      await openItem(item);
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
 */
async function executeGroup(group: GroupItem, allItems: AppItem[]): Promise<void> {
  itemLogger.info(
    { groupName: group.displayName, itemCount: group.itemNames.length, itemNames: group.itemNames },
    'グループを実行中'
  );

  const settingsService = await SettingsService.getInstance();
  const parallelLaunch = await settingsService.get('parallelGroupLaunch');

  // アイテム名からLauncherItemまたはWindowItemを検索するマップを作成
  const itemMap = new Map<string, LauncherItem | WindowItem>();
  for (const item of allItems) {
    if (isLauncherItem(item) || isWindowItem(item)) {
      itemMap.set(item.displayName, item);
    }
  }

  let successCount = 0;
  let errorCount = 0;

  if (parallelLaunch) {
    itemLogger.info({ groupName: group.displayName }, '並列起動モードでグループを実行');

    const promises = group.itemNames.map((itemName) =>
      executeGroupItem(group.displayName, itemName, itemMap.get(itemName))
    );

    const results = await Promise.all(promises);
    successCount = results.filter((r) => r.success).length;
    errorCount = results.filter((r) => !r.success).length;
  } else {
    itemLogger.info({ groupName: group.displayName }, '順次起動モードでグループを実行');

    for (let i = 0; i < group.itemNames.length; i++) {
      const itemName = group.itemNames[i];
      const result = await executeGroupItem(group.displayName, itemName, itemMap.get(itemName));

      if (result.success) {
        successCount++;
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
  _getMainWindow: () => BrowserWindow | null,
  _getWindowPinMode: () => WindowPinMode
): void {
  ipcMain.handle(IPC_CHANNELS.OPEN_ITEM, async (_event, item: LauncherItem) => {
    await openItem(item);
    await recordExecutionHistory(item, item.displayName);
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_PARENT_FOLDER, async (_event, item: LauncherItem) => {
    await openParentFolder(item);
  });

  ipcMain.handle(
    IPC_CHANNELS.EXECUTE_GROUP,
    async (_event, group: GroupItem, allItems: AppItem[]) => {
      await executeGroup(group, allItems);
      await recordExecutionHistory(group, group.displayName);
    }
  );

  ipcMain.handle(IPC_CHANNELS.EXECUTE_WINDOW_OPERATION, async (_event, item: WindowItem) => {
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

    const windowConfig = createWindowConfig(item);
    const result = await tryActivateWindow(windowConfig, item.windowTitle, itemLogger);

    if (!result.windowFound) {
      itemLogger.warn({ windowTitle: item.windowTitle }, 'ウィンドウが見つかりませんでした');
    }

    await recordExecutionHistory(item, item.displayName);
  });
}
