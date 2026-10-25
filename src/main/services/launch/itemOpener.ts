import type { Logger } from 'pino';
import { itemLogger } from '@common/logger';
import { hasItemWindowSwitch } from '@common/utils/itemWindowConversion';

import {
  launchItem,
  launchItemAsAdmin,
  type LaunchableItem,
  type LaunchResult,
} from '../../utils/itemLauncher.js';
import { showToastWindow } from '../overlayWindowService.js';
import { mainI18n } from '../mainI18n.js';

import {
  executeLauncherItem,
  notifyLauncherItemFailure,
  type ExecutableLauncherItem,
} from './setExecutor.js';

/** アイテムを開けなかったら、理由をエラーのトーストで知らせる（メイン画面・ワークスペースで共通） */
export async function notifyLaunchFailure(
  displayName: string | undefined,
  result: LaunchResult
): Promise<void> {
  // UAC で「いいえ」を押したときは知らせない
  if (result.success || result.cancelled) return;
  await showToastWindow({
    type: 'error',
    message: mainI18n.t('launcher.messages.launchFailed', {
      name: displayName ?? '',
      error: result.error,
    }),
  }).catch((error) => itemLogger.error({ error }, '起動の失敗のトーストを出せませんでした'));
}

/**
 * 単一アイテムを開く（メイン画面・ワークスペースで共通。クリップボードとセットは呼び出し側で扱う）
 *
 * ウィンドウ切り替えがあれば、セットの 1 行と同じ処理で開く（見つかれば前面に出す・位置を当てる）。
 * 無ければ普通に開く。うまくいかなかったときはトーストで知らせる
 *
 * @returns 開けたか（知らせるのはこの関数の中で済んでいる）
 */
export async function openSingleItem(
  item: ExecutableLauncherItem,
  logger: Logger = itemLogger
): Promise<boolean> {
  if (hasItemWindowSwitch(item)) {
    const result = await executeLauncherItem(item, undefined, logger);
    await notifyLauncherItemFailure(item, result);
    return result.errorCount === 0;
  }

  const result = await launchItem(
    {
      type: item.type,
      path: item.path,
      args: item.args,
      displayName: item.displayName,
      runAsAdmin: item.runAsAdmin,
    },
    logger
  );
  await notifyLaunchFailure(item.displayName, result);
  return result.success;
}

/**
 * 単一アイテムを管理者として開く（メイン画面・ワークスペースで共通。対象かどうかは呼び出し側で確かめる）
 *
 * UAC で「いいえ」を押したときは何も知らせない。それ以外の失敗は普通に開けなかったときと同じトーストで知らせる。
 * ウィンドウ切り替えは使わない（管理者で開いたウィンドウは、権限の低い QuickDashLauncher から動かせない）
 *
 * @returns 開けたか
 */
export async function openSingleItemAsAdmin(
  item: Pick<LaunchableItem, 'path' | 'args' | 'displayName'>,
  logger: Logger = itemLogger
): Promise<boolean> {
  const result = await launchItemAsAdmin(item, logger);
  if (result.status === 'failed') {
    await notifyLaunchFailure(item.displayName, { success: false, error: result.error });
  }
  return result.status === 'launched';
}
