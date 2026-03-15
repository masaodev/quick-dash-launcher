import { ipcMain, shell } from 'electron';
import { itemLogger } from '@common/logger';
import { LauncherItem, GroupItem, WindowItem, AppItem, WindowConfig } from '@common/types';
import type { LayoutItem, LayoutWindowEntry } from '@common/types';
import { GROUP_LAUNCH_DELAY_MS } from '@common/constants';
import { isLauncherItem, isWindowItem } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';
import { SettingsService } from '../services/settingsService.js';
import { findWindowByTitle } from '../utils/windowMatcher.js';

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
    { name: item.displayName, type: item.type, path: item.path },
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

  const mode = parallelLaunch ? '並列' : '順次';
  itemLogger.info({ groupName: group.displayName }, `${mode}起動モードでグループを実行`);

  let results: { success: boolean; itemName: string }[];

  if (parallelLaunch) {
    results = await Promise.all(
      group.itemNames.map((itemName) =>
        executeGroupItem(group.displayName, itemName, itemMap.get(itemName))
      )
    );
  } else {
    results = [];
    for (let i = 0; i < group.itemNames.length; i++) {
      const itemName = group.itemNames[i];
      results.push(await executeGroupItem(group.displayName, itemName, itemMap.get(itemName)));

      if (i < group.itemNames.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, GROUP_LAUNCH_DELAY_MS));
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  itemLogger.info(
    {
      groupName: group.displayName,
      total: group.itemNames.length,
      success: successCount,
      error: results.length - successCount,
      mode,
    },
    'グループ実行完了'
  );
}

/** レイアウトのウィンドウ出現待機の設定 */
const LAYOUT_WAIT_CONFIG = {
  /** 最大待機時間（ミリ秒） */
  MAX_WAIT_MS: 10000,
  /** ポーリング間隔（ミリ秒） */
  POLL_INTERVAL_MS: 500,
};

/**
 * ウィンドウが出現するまで待機する
 */
async function waitForWindow(windowTitle: string, processName?: string): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < LAYOUT_WAIT_CONFIG.MAX_WAIT_MS) {
    const found = findWindowByTitle(windowTitle, processName);
    if (found) return true;
    await new Promise((resolve) => setTimeout(resolve, LAYOUT_WAIT_CONFIG.POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * レイアウトの各エントリを実行する
 */
async function executeLayoutEntry(entry: LayoutWindowEntry): Promise<void> {
  const windowConfig: WindowConfig = {
    title: entry.windowTitle,
    processName: entry.processName,
    x: entry.x,
    y: entry.y,
    width: entry.width,
    height: entry.height,
    virtualDesktopNumber: entry.virtualDesktopNumber,
  };

  if (entry.launchApp && entry.executablePath) {
    // まず既存ウィンドウを検索
    const existingWindow = findWindowByTitle(entry.windowTitle, entry.processName);
    if (!existingWindow) {
      // アプリ起動
      await launchItem(
        {
          type: 'app',
          path: entry.executablePath,
          args: entry.args,
          displayName: entry.windowTitle,
        },
        itemLogger
      );

      // ウィンドウ出現待機
      const appeared = await waitForWindow(entry.windowTitle, entry.processName);
      if (!appeared) {
        itemLogger.warn(
          { windowTitle: entry.windowTitle },
          'レイアウト: アプリ起動後のウィンドウ出現待機がタイムアウトしました'
        );
        return;
      }
    }
  }

  // ウィンドウの位置・サイズ設定
  const result = await tryActivateWindow(windowConfig, entry.windowTitle, itemLogger);
  if (!result.windowFound) {
    itemLogger.warn(
      { windowTitle: entry.windowTitle },
      'レイアウト: ウィンドウが見つかりませんでした'
    );
  }
}

/**
 * レイアウトを実行する（全エントリを順次処理）
 */
async function executeLayout(item: LayoutItem): Promise<void> {
  itemLogger.info(
    { displayName: item.displayName, entryCount: item.entries.length },
    'レイアウトを実行中'
  );

  for (let i = 0; i < item.entries.length; i++) {
    try {
      await executeLayoutEntry(item.entries[i]);
    } catch (error) {
      itemLogger.error(
        {
          entryIndex: i,
          windowTitle: item.entries[i].windowTitle,
          error: error instanceof Error ? error.message : String(error),
        },
        'レイアウトエントリの実行に失敗しました'
      );
    }

    // エントリ間にディレイを挿入
    if (i < item.entries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, GROUP_LAUNCH_DELAY_MS));
    }
  }

  itemLogger.info({ displayName: item.displayName }, 'レイアウト実行完了');
}

export function setupItemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OPEN_ITEM, async (_event, item: LauncherItem) => {
    await openItem(item);
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_PARENT_FOLDER, async (_event, item: LauncherItem) => {
    await openParentFolder(item);
  });

  ipcMain.handle(
    IPC_CHANNELS.EXECUTE_GROUP,
    async (_event, group: GroupItem, allItems: AppItem[]) => {
      await executeGroup(group, allItems);
    }
  );

  ipcMain.handle(IPC_CHANNELS.EXECUTE_LAYOUT, async (_event, item: LayoutItem) => {
    await executeLayout(item);
  });

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
  });
}
