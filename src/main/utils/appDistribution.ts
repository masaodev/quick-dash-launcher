import { app } from 'electron';
import type { AppDistribution } from '@common/types';

/**
 * 配布形式を判定する。Store 版は process.windowsStore、
 * ポータブル版はランチャーが設定する PORTABLE_EXECUTABLE_FILE で見分ける
 */
export function getAppDistribution(): AppDistribution {
  if (!app.isPackaged) return 'dev';
  if (process.windowsStore === true) return 'store';
  if (process.env.PORTABLE_EXECUTABLE_FILE) return 'portable';
  return 'installer';
}
