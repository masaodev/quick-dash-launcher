/**
 * アイテムを「管理者として実行」する（メインウィンドウの右クリック・Ctrl+Shift+Enter、ワークスペースの右クリック）
 *
 * 起動の記録は開けたときだけ数える（UAC で「いいえ」を押したときは数えない）
 */
import { itemLogger } from '@common/logger';
import type { LauncherItem, WorkspaceItem } from '@common/types';
import { canRunAsAdmin } from '@common/utils/runAsAdmin';

import { showToastWindow } from '../overlayWindowService.js';
import { LaunchUsageService } from '../launchUsageService.js';
import { WorkspaceService } from '../workspace/index.js';
import { ensureMainItemIndex } from '../workspace/workspaceRefOperations.js';

import { openSingleItemAsAdmin } from './itemOpener.js';
import { recordLauncherItemLaunch } from './appItemLauncher.js';

/** メインウィンドウの単一アイテムを管理者として開く（起動中のトーストはレンダラーが出す） */
export async function openLauncherItemAsAdmin(item: LauncherItem): Promise<void> {
  if (!canRunAsAdmin(item)) return;
  itemLogger.info(
    { name: item.displayName, path: item.path, args: item.args || 'なし' },
    'アイテムを管理者として起動中'
  );
  if (await openSingleItemAsAdmin(item)) {
    await recordLauncherItemLaunch(item);
  }
}

/** ワークスペースのアイテムを管理者として開く（参照はメインウィンドウのアイテムの今の中身で開く） */
export async function openWorkspaceItemAsAdmin(requested: WorkspaceItem): Promise<void> {
  let item = requested;
  if (requested.ref) {
    await ensureMainItemIndex();
    const workspaceService = await WorkspaceService.getInstance();
    item = (await workspaceService.findResolvedItem(requested.id)) ?? requested;
  }
  if (item.type !== 'item' || !canRunAsAdmin({ type: item.launcherType, path: item.path })) return;

  itemLogger.info(
    { id: item.id, name: item.displayName, path: item.path },
    'ワークスペースのアイテムを管理者として起動中'
  );
  await showToastWindow({
    type: 'success',
    displayName: item.displayName,
    itemType: item.launcherType,
    path: item.path,
    icon: item.icon,
  });
  if (!(await openSingleItemAsAdmin(item))) return;
  // 参照はメインウィンドウのアイテムの id で数える。コピーはパスでメインのアイテムに寄せる
  const usage = LaunchUsageService.getInstance();
  if (item.ref) await usage?.recordById(item.ref.itemId);
  else await usage?.recordByPath(item.path);
}
