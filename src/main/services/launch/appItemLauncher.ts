import { itemLogger } from '@common/logger';
import type { AppItem, LauncherItem, SetItem } from '@common/types';
import { isClipboardItem, isLauncherItem, isSetItem } from '@common/types/guards';
import type { LaunchOptions } from '@common/types/launchUsage';
import { hasItemWindowSwitch, pickItemWindowSwitch } from '@common/utils/itemWindowConversion';

import { showToastWindow } from '../overlayWindowService.js';
import { LaunchUsageService } from '../launchUsageService.js';
import { ClipboardService } from '../clipboardService.js';
import { mainI18n } from '../mainI18n.js';

import { executeSet, indexItemsById, notifySetFailures } from './setExecutor.js';
import { openSingleItem } from './itemOpener.js';

/**
 * メインウィンドウのアイテムを開く処理（画面の Enter と CLI の open で共通）
 */

/** 単一アイテムを開き、開けたら起動の記録に数える（登録・編集フォームで試しに開いたときは数えない） */
export async function openLauncherItem(item: LauncherItem, options?: LaunchOptions): Promise<void> {
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

  if ((await openSingleItem(item)) && !options?.trial) {
    await recordLauncherItemLaunch(item);
  }
}

/** メインウィンドウの単一アイテムを開けたことを、起動の記録に数える */
export async function recordLauncherItemLaunch(item: LauncherItem): Promise<void> {
  // フォルダ取込で展開したアイテムは id がその場で振られるので、展開元のフォルダ取込の行の id で数える
  const usage = LaunchUsageService.getInstance();
  if (item.isDirExpanded) await usage?.recordById(item.expandedFromId);
  else if (item.id) await usage?.recordById(item.id);
  else await usage?.recordByPath(item.path);
}

/** セットを開き、失敗した行を知らせ、1 つでも開けたら起動の記録に数える */
export async function executeSetItem(item: SetItem, allItems: AppItem[]): Promise<void> {
  const byId = indexItemsById(allItems);
  const result = await executeSet(item, (itemId) => byId.get(itemId));
  await notifySetFailures(item, result);
  if (!result.skipped && !result.cancelled && result.successCount > 0) {
    await LaunchUsageService.getInstance()?.recordById(item.id);
  }
}

/**
 * どの種類のアイテムでも、メインウィンドウで Enter を押したときと同じように開く（CLI の open 用）
 *
 * 画面の Enter はトーストをレンダラーが出すので、ここでは同じトーストを本体から出す
 */
export async function launchAppItem(item: AppItem, allItems: AppItem[]): Promise<void> {
  if (isClipboardItem(item)) {
    const restored = await ClipboardService.getInstance().restoreClipboard(item.clipboardDataRef);
    await showToastWindow(
      restored.success
        ? { type: 'success', displayName: item.displayName, itemType: 'clipboard' }
        : {
            type: 'error',
            message: mainI18n.t('launcher.messages.launchFailed', {
              name: item.displayName,
              error: restored.error ?? '',
            }),
          }
    );
    if (!restored.success) throw new Error(restored.error ?? 'restore failed');
    return;
  }
  if (isSetItem(item)) {
    await showToastWindow({
      type: 'success',
      displayName: item.displayName,
      itemType: 'set',
      itemCount: item.entries.length,
    });
    await executeSetItem(item, allItems);
    return;
  }
  if (isLauncherItem(item)) {
    await showToastWindow({
      type: 'success',
      displayName: item.displayName,
      itemType: item.type,
      path: item.path,
    });
    await openLauncherItem(item);
  }
}
