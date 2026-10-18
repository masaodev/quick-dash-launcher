import { windowLogger } from '@common/logger';
import type { WorkspacePositionMode } from '@common/types';

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

export async function migrateRemovedWindowSettings(): Promise<void> {
  // 2 つの読み替えは別々に試す（表示位置の読み替えが失敗しても、消した設定の読み替えは進める）
  try {
    await migrateLegacyWorkspacePosition(await SettingsService.getInstance());
  } catch (error) {
    windowLogger.warn({ error }, '古いワークスペースの表示位置の読み替えに失敗しました');
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
