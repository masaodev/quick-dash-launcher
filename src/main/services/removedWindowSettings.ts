import { windowLogger } from '@common/logger';
import type { FixedPosition, WorkspacePositionMode } from '@common/types';

import { SettingsService } from './settingsService.js';
import { WorkspaceService } from './workspace/index.js';

/**
 * 設定から外した 2 つの項目を、ワークスペースの状態と 📌 に読み替える（起動時に 1 回）
 *
 * - autoShowWorkspace（メインウィンドウ表示時にワークスペースを自動表示）
 * - hideDetachedWithMainWindow（メインウィンドウと一緒に切り離しウィンドウも隠す）
 *
 * 今は「📌 なし＝メインウィンドウと一緒に出て一緒に隠れる」「📌 あり＝隠れずに残る」で決まる。
 * 前と同じ見え方になるように読み替えて、古いキーは settings.json から消す。
 *
 * ほかに、古い表示位置の値（primaryLeft・primaryRight）と、固定位置の座標の古いキー（X・Y を別々に持っていた）も読み替える。
 */

export const REMOVED_WINDOW_SETTING_KEYS = [
  'autoShowWorkspace',
  'hideDetachedWithMainWindow',
] as const;

export interface RemovedWindowSettingsPlan {
  /** 開いている切り離しウィンドウのうち、📌 なしのものを表示固定にする */
  pinUnpinnedDetached: boolean;
  /** ワークスペースを「開いていて表示固定」にする */
  openWorkspace: boolean;
}

/** 古い値から、読み替えの中身を決める */
export function planRemovedWindowSettings(
  removed: Record<string, unknown>
): RemovedWindowSettingsPlan {
  return {
    // 一緒に隠さない設定だった → 切り離しウィンドウは残っていた。📌 を押して同じ見え方にする
    pinUnpinnedDetached: removed.hideDetachedWithMainWindow === false,
    // 自動表示の設定だった → ワークスペースはメインと一緒に出て、隠れずに残っていた。開いていて表示固定にする
    openWorkspace: removed.autoShowWorkspace === true,
  };
}

/**
 * 古い表示位置の値（プライマリディスプレイの左端・右端）を、今の値に読み替える。読み替えないときは null
 * 古い値のままだと、設定画面でディスプレイを選んでも効かない
 */
export function planLegacyWorkspacePosition(
  mode: WorkspacePositionMode
): 'displayLeft' | 'displayRight' | null {
  if (mode === 'primaryLeft') return 'displayLeft';
  if (mode === 'primaryRight') return 'displayRight';
  return null;
}

/** primaryLeft・primaryRight を、プライマリディスプレイの番号付きの displayLeft・displayRight にする */
async function migrateLegacyWorkspacePosition(settings: SettingsService): Promise<void> {
  const next = planLegacyWorkspacePosition(await settings.get('workspacePositionMode'));
  if (!next) return;
  const { screen } = await import('electron');
  const primaryId = screen.getPrimaryDisplay().id;
  const primaryIndex = screen.getAllDisplays().findIndex((d) => d.id === primaryId);
  await settings.set('workspaceTargetDisplayIndex', Math.max(primaryIndex, 0));
  await settings.set('workspacePositionMode', next);
  windowLogger.info(`古い設定を読み替え: ワークスペースの表示位置を ${next} にしました`);
}

/** 固定位置の座標を X・Y の 2 つのキーで持っていたときの古いキー */
export const REMOVED_FIXED_POSITION_KEYS = [
  'windowPositionX',
  'windowPositionY',
  'workspacePositionX',
  'workspacePositionY',
] as const;

/**
 * 古い X・Y を、固定位置で最後に置いた場所に読み替える。まだ置いていないときは null
 *
 * 古いキーは (0, 0) を「まだ置いていない」の印に使っていた。(0, 0) を保存しても次に出すときに置き直して
 * 上書きしていたので、残っている (0, 0) は「まだ置いていない」の意味になる
 */
export function planLegacyFixedPosition(x: unknown, y: unknown): FixedPosition | null {
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x === 0 && y === 0) return null;
  return { x, y };
}

/** windowPositionX・Y と workspacePositionX・Y を、windowFixedPosition と workspaceFixedPosition に移す */
async function migrateLegacyFixedPositions(settings: SettingsService): Promise<void> {
  const removed = await settings.readRemovedKeys(REMOVED_FIXED_POSITION_KEYS);
  if (Object.keys(removed).length === 0) return;
  const windowFixedPosition = planLegacyFixedPosition(
    removed.windowPositionX,
    removed.windowPositionY
  );
  const workspaceFixedPosition = planLegacyFixedPosition(
    removed.workspacePositionX,
    removed.workspacePositionY
  );
  await settings.set('windowFixedPosition', windowFixedPosition);
  await settings.set('workspaceFixedPosition', workspaceFixedPosition);
  // 読み替えを保存できたときだけ消す（古いキーが残っていることが、まだ読み替えていない印になる）
  await settings.deleteRemovedKeys(REMOVED_FIXED_POSITION_KEYS);
  windowLogger.info(
    { windowFixedPosition, workspaceFixedPosition },
    '古い設定を読み替え: 固定位置の座標を新しいキーに移しました'
  );
}

export async function migrateRemovedWindowSettings(): Promise<void> {
  // 読み替えは別々に試す（1 つが失敗しても、ほかの読み替えは進める）
  try {
    await migrateLegacyWorkspacePosition(await SettingsService.getInstance());
  } catch (error) {
    windowLogger.warn({ error }, '古いワークスペースの表示位置の読み替えに失敗しました');
  }
  try {
    await migrateLegacyFixedPositions(await SettingsService.getInstance());
  } catch (error) {
    windowLogger.warn({ error }, '古い固定位置の座標の読み替えに失敗しました');
  }
  try {
    const settings = await SettingsService.getInstance();
    const removed = await settings.readRemovedKeys(REMOVED_WINDOW_SETTING_KEYS);
    if (Object.keys(removed).length === 0) return;

    const plan = planRemovedWindowSettings(removed);
    const ws = await WorkspaceService.getInstance();
    if (plan.pinUnpinnedDetached) {
      const count = await ws.pinAllUnpinnedDetached();
      windowLogger.info(`古い設定を読み替え: 切り離しウィンドウ ${count} 個を表示固定にしました`);
    }
    if (plan.openWorkspace) {
      await ws.saveWorkspaceWindowState({ open: true, pinLevel: 1 });
      windowLogger.info('古い設定を読み替え: ワークスペースを開いた状態（表示固定）にしました');
    }
    // 読み替えをすべて保存できたときだけ消す（失敗したら次の起動でやり直す）
    await settings.deleteRemovedKeys(REMOVED_WINDOW_SETTING_KEYS);
  } catch (error) {
    windowLogger.warn({ error }, '古いウィンドウ設定の読み替えに失敗しました');
  }
}
