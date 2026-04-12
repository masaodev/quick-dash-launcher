import { ipcMain, shell } from 'electron';
import { itemLogger } from '@common/logger';
import {
  LauncherItem,
  GroupItem,
  WindowItem,
  AppItem,
  WindowConfig,
  LayoutExecutionProgress,
  LayoutEntryProgress,
} from '@common/types';
import type { LayoutItem, LayoutWindowEntry } from '@common/types';
import { GROUP_LAUNCH_DELAY_MS } from '@common/constants';
import { isLauncherItem, isWindowItem } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';
import { SettingsService } from '../services/settingsService.js';
import { findWindowByTitle, createTitleMatcher } from '../utils/windowMatcher.js';
import { findWindowHwndByTitle } from '../utils/nativeWindowControl.js';
import {
  showLayoutProgressWindow,
  hideLayoutProgressWindow,
  getLayoutProgressWindow,
} from '../services/layoutProgressWindowService.js';

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
    shell.showItemInFolder(item.path);
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
  MAX_WAIT_MS: 30000,
  /** ポーリング間隔（ミリ秒） */
  POLL_INTERVAL_MS: 2000,
};

/** レイアウト並列実行の同時実行数 */
const LAYOUT_CONCURRENCY = 3;

/** レイアウトキャンセルフラグ */
let layoutCancelled = false;

/** レイアウト進捗イベントのチャンネルマップ */
const LAYOUT_PROGRESS_CHANNELS = {
  start: IPC_CHANNELS.EVENT_LAYOUT_PROGRESS_START,
  update: IPC_CHANNELS.EVENT_LAYOUT_PROGRESS_UPDATE,
  complete: IPC_CHANNELS.EVENT_LAYOUT_PROGRESS_COMPLETE,
} as const;

/**
 * レイアウト進捗をミニウィンドウに送信する
 */
function sendLayoutProgress(
  eventType: 'start' | 'update' | 'complete',
  progress: LayoutExecutionProgress
): void {
  const win = getLayoutProgressWindow();
  if (!win) return;

  if (eventType === 'start') {
    win.webContents.send(LAYOUT_PROGRESS_CHANNELS[eventType], progress);
  } else {
    // update/completeではiconを除外してIPC転送量を削減
    const lightweight = {
      ...progress,
      entries: progress.entries.map(({ icon: _icon, ...rest }) => rest),
    };
    win.webContents.send(LAYOUT_PROGRESS_CHANNELS[eventType], lightweight);
  }
}

/**
 * レイアウトエントリの失敗を記録して進捗を通知する
 */
function failLayoutEntry(
  progress: LayoutExecutionProgress,
  index: number,
  errorMessage: string
): void {
  progress.entries[index].status = 'failed';
  progress.entries[index].errorMessage = errorMessage;
  sendLayoutProgress('update', progress);
}

/**
 * レイアウト用にウィンドウタイトルを部分一致パターンに正規化する
 * ワイルドカードが含まれていない場合、前後に * を付加して部分一致にする。
 * 片方のみにワイルドカードがある場合（例: "title*"）、もう片方にも * を付加する。
 * これにより、サクラエディタの編集中マーク（"* filename.txt - sakura"）等の
 * タイトル変動に対応する。
 */
function toPartialMatchTitle(windowTitle: string): string {
  if (!windowTitle) return windowTitle;
  let result = windowTitle;
  if (!result.startsWith('*')) {
    result = `*${result}`;
  }
  if (!result.endsWith('*')) {
    result = `${result}*`;
  }
  return result;
}

/**
 * ウィンドウが出現するまで待機する（キャンセル対応）
 * titleMatcherをループ外でプリコンパイルし、ポーリング毎の正規表現再生成を回避
 */
async function waitForWindow(windowTitle: string, processName?: string): Promise<boolean> {
  const titleMatcher = createTitleMatcher(windowTitle);
  const startTime = Date.now();
  while (Date.now() - startTime < LAYOUT_WAIT_CONFIG.MAX_WAIT_MS) {
    if (layoutCancelled) return false;
    const found = findWindowHwndByTitle(titleMatcher, processName);
    if (found) return true;
    await new Promise((resolve) => setTimeout(resolve, LAYOUT_WAIT_CONFIG.POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * レイアウトの各エントリを実行する
 */
async function executeLayoutEntry(
  entry: LayoutWindowEntry,
  index: number,
  progress: LayoutExecutionProgress
): Promise<void> {
  // キャンセルチェック
  if (layoutCancelled) {
    failLayoutEntry(progress, index, 'キャンセルされました');
    return;
  }

  // ステータスを「起動中」に更新
  progress.entries[index].status = 'launching';
  sendLayoutProgress('update', progress);

  // レイアウト用にタイトルを部分一致パターンに正規化
  const searchTitle = toPartialMatchTitle(entry.windowTitle);

  const windowConfig: WindowConfig = {
    title: searchTitle,
    processName: entry.processName,
    x: entry.x,
    y: entry.y,
    width: entry.width,
    height: entry.height,
    virtualDesktopNumber: entry.virtualDesktopNumber,
  };

  if (entry.launchApp && entry.executablePath) {
    // まず既存ウィンドウを検索
    const existingWindow = findWindowByTitle(searchTitle, entry.processName);
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
      const appeared = await waitForWindow(searchTitle, entry.processName);
      if (!appeared) {
        const errorMsg = layoutCancelled
          ? 'キャンセルされました'
          : 'ウィンドウ出現待機がタイムアウトしました';
        itemLogger.warn({ windowTitle: entry.windowTitle }, `レイアウト: ${errorMsg}`);
        failLayoutEntry(progress, index, errorMsg);
        return;
      }
    }
  }

  // キャンセルチェック
  if (layoutCancelled) {
    failLayoutEntry(progress, index, 'キャンセルされました');
    return;
  }

  // ウィンドウの位置・サイズ設定
  const result = await tryActivateWindow(windowConfig, entry.windowTitle, itemLogger);
  if (!result.windowFound) {
    itemLogger.warn(
      { windowTitle: entry.windowTitle },
      'レイアウト: ウィンドウが見つかりませんでした'
    );
    failLayoutEntry(progress, index, 'ウィンドウが見つかりませんでした');
    return;
  }

  progress.entries[index].status = 'success';
  sendLayoutProgress('update', progress);
}

/**
 * 並列実行数を制限しながらタスクを実行する
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<void> {
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      if (layoutCancelled) return;
      const currentIndex = index++;
      await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext());
  await Promise.all(workers);
}

/**
 * レイアウトを実行する（並列処理・進捗通知・キャンセル対応）
 */
export async function executeLayout(item: LayoutItem): Promise<void> {
  itemLogger.info(
    { displayName: item.displayName, entryCount: item.entries.length },
    'レイアウトを実行中'
  );

  // ミニウィンドウを表示
  await showLayoutProgressWindow();

  // キャンセルフラグをリセット
  layoutCancelled = false;

  // キャンセルリスナーを登録
  const cancelHandler = () => {
    layoutCancelled = true;
    itemLogger.info({ displayName: item.displayName }, 'レイアウト実行がキャンセルされました');
  };
  ipcMain.once(IPC_CHANNELS.LAYOUT_CANCEL, cancelHandler);

  // 進捗オブジェクトを初期化
  const entryProgresses: LayoutEntryProgress[] = item.entries.map((entry, i) => ({
    index: i,
    windowTitle: entry.windowTitle,
    processName: entry.processName,
    icon: entry.icon,
    status: 'waiting' as const,
  }));

  const progress: LayoutExecutionProgress = {
    layoutName: item.displayName,
    entries: entryProgresses,
    isComplete: false,
    isCancelled: false,
  };

  // 進捗開始を通知
  sendLayoutProgress('start', progress);

  // 各エントリの実行タスクを作成
  const tasks = item.entries.map((entry, i) => async () => {
    try {
      await executeLayoutEntry(entry, i, progress);
    } catch (error) {
      itemLogger.error(
        {
          entryIndex: i,
          windowTitle: entry.windowTitle,
          error: error instanceof Error ? error.message : String(error),
        },
        'レイアウトエントリの実行に失敗しました'
      );
      failLayoutEntry(progress, i, error instanceof Error ? error.message : String(error));
    }
  });

  // 並列実行（同時実行数制限あり）
  await runWithConcurrency(tasks, LAYOUT_CONCURRENCY);

  // キャンセルリスナーを削除
  ipcMain.removeListener(IPC_CHANNELS.LAYOUT_CANCEL, cancelHandler);

  // 完了通知
  progress.isComplete = true;
  progress.isCancelled = layoutCancelled;
  sendLayoutProgress('complete', progress);

  const successCount = progress.entries.filter((e) => e.status === 'success').length;
  const failedCount = progress.entries.filter((e) => e.status === 'failed').length;
  itemLogger.info(
    {
      displayName: item.displayName,
      total: item.entries.length,
      success: successCount,
      failed: failedCount,
      cancelled: layoutCancelled,
    },
    'レイアウト実行完了'
  );
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

  ipcMain.on(IPC_CHANNELS.CLOSE_LAYOUT_PROGRESS_WINDOW, () => {
    hideLayoutProgressWindow();
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
