import { ipcMain, shell } from 'electron';
import { itemLogger } from '@common/logger';
import { LauncherItem, WindowItem, AppItem, WindowConfig } from '@common/types';
import type { SetItem } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { pickWindowPlacement } from '@common/utils/windowPlacement';
import { hasItemWindowSwitch, pickItemWindowSwitch } from '@common/utils/itemWindowConversion';

import { tryActivateWindow } from '../utils/windowActivator.js';
import { isBareFileName, resolveFromPath } from '../utils/pathResolver.js';
import { checkPathsExist } from '../services/data/pathExistenceChecker.js';
import { expandEnvironmentVariables } from '../services/icon/iconFileCache.js';
import { launchItem } from '../utils/itemLauncher.js';
import { hideLayoutProgressWindow, showToastWindow } from '../services/overlayWindowService.js';
import { hideMainWindowOnExecute } from '../windowManager.js';
import {
  executeLauncherItem,
  executeSet,
  notifyLauncherItemFailure,
  notifySetFailures,
} from '../services/launch/setExecutor.js';
import { mainI18n } from '../services/mainI18n.js';

/**
 * WindowItemからWindowConfigを生成する
 */
function createWindowConfig(item: WindowItem): WindowConfig {
  return {
    title: item.windowTitle,
    ...pickWindowPlacement(item),
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
      window: hasItemWindowSwitch(item) ? JSON.stringify(pickItemWindowSwitch(item)) : 'なし',
    },
    'アイテムを起動中'
  );

  // ウィンドウ切り替えがあれば、セットの 1 行と同じ処理で開く（見つかれば前面に出す・位置を当てる）
  if (hasItemWindowSwitch(item)) {
    const result = await executeLauncherItem(item);
    await notifyLauncherItemFailure(item, result);
    return;
  }

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
  itemLogger.info({ name: item.displayName, type: item.type, path: item.path }, '親フォルダを開く');

  if (item.type !== 'file' && item.type !== 'folder' && item.type !== 'app') return;

  // ストアアプリなど（shell:AppsFolder\...）は、URL と同じく親フォルダを持たない
  if (/^shell:/i.test(item.path)) {
    await notifyParentFolder(item, mainI18n.t('launcher.messages.noContainingFolder'));
    return;
  }

  // ファイル名だけで登録したアプリ（notepad.exe など）は、起動と同じく PATH から探す
  //（ファイル・フォルダは PATH から探さない。別のフォルダの同名ファイルを選んでしまう）
  const target =
    item.type === 'app' && isBareFileName(item.path)
      ? await resolveFromPath(item.path)
      : expandEnvironmentVariables(item.path);
  // 応答しないネットワークパスで止まらないよう、時間切れつきで確かめる。
  // 時間切れ（unknown）のときは、あるものとして開いてみる
  const status = target ? (await checkPathsExist([target]))[target] : 'missing';
  if (!target || status === 'missing') {
    // 押しても無反応だと故障に見えるので知らせる
    await notifyParentFolder(item, mainI18n.t('items.containingFolderNotFound'));
    return;
  }
  shell.showItemInFolder(target);
}

/** 親フォルダを開けないことを知らせる（ランチャーは隠れた後なので、画面内ではなくトーストで出す） */
async function notifyParentFolder(item: LauncherItem, message: string): Promise<void> {
  await showToastWindow({
    displayName: item.displayName,
    itemType: item.type,
    type: 'warning',
    message,
  });
}

export function setupItemHandlers(): void {
  // 各実行ハンドラでは、起動処理の前にメインウィンドウを閉じる
  // （blur待ちにすると起動の遅いアプリでウィンドウが残り、Enter連打で多重起動するため）
  ipcMain.handle(IPC_CHANNELS.OPEN_ITEM, async (_event, item: LauncherItem) => {
    hideMainWindowOnExecute();
    await openItem(item);
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_PARENT_FOLDER, async (_event, item: LauncherItem) => {
    hideMainWindowOnExecute();
    await openParentFolder(item);
  });

  ipcMain.handle(IPC_CHANNELS.EXECUTE_SET, async (_event, item: SetItem, allItems: AppItem[]) => {
    hideMainWindowOnExecute();
    const byId = new Map<string, AppItem>();
    for (const appItem of allItems) {
      if ('id' in appItem && appItem.id) byId.set(appItem.id, appItem);
    }
    const result = await executeSet(item, (itemId) => byId.get(itemId));
    await notifySetFailures(item, result);
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

    hideMainWindowOnExecute();

    const windowConfig = createWindowConfig(item);
    const result = await tryActivateWindow(windowConfig, item.windowTitle, itemLogger, {
      followDesktop: true,
    });

    if (!result.windowFound) {
      itemLogger.warn({ windowTitle: item.windowTitle }, 'ウィンドウが見つかりませんでした');
    }
  });
}
