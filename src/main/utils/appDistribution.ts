import { app } from 'electron';
import type { AppDistribution } from '@common/types';

import { isPortableEdition } from './portableMode.js';

/**
 * 配布形式を判定する。Store 版は process.windowsStore、
 * ポータブル版は ZIP に入れた印のファイル（portable.txt）で見分ける。
 * 以前の 1 ファイルの exe のポータブル版は、ランチャーが設定する PORTABLE_EXECUTABLE_FILE で見分ける
 */
export function getAppDistribution(): AppDistribution {
  if (!app.isPackaged) return 'dev';
  if (process.windowsStore === true) return 'store';
  if (isPortableEdition(process.execPath)) return 'portable';
  if (process.env.PORTABLE_EXECUTABLE_FILE) return 'portable';
  return 'installer';
}
