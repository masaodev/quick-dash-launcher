import { itemLogger } from '@common/logger';
import type { LayoutWindowEntry } from '@common/types';

import { extractIcon } from '../ipc/iconHandlers.js';
import PathManager from '../config/pathManager.js';

import { runWithConcurrency } from './concurrency.js';

/** アイコン解決の同時実行数（extractIconは子プロセス起動を伴い得る） */
const LAYOUT_ICON_CONCURRENCY = 4;

/**
 * アイコン未設定のレイアウトエントリについて、executablePathからアイコンを解決する
 *
 * ワークスペース経由のレイアウトは保存時点のアイコンをそのまま持つため、
 * 保存時に取得できなかったエントリ（カスタムURI等）はiconを持たない。
 * これを補完することで進捗オーバーレイのアイコン欠けを防ぐ。
 *
 * レイアウトの起動を待たせないよう、呼び出し側では実行開始後に解決する想定。
 *
 * @returns executablePath → アイコン(dataURL)のマップ。取得できなかったパスは含まない
 */
export async function resolveLayoutEntryIcons(
  entries: LayoutWindowEntry[]
): Promise<Map<string, string>> {
  const targets = [
    ...new Set(entries.filter((e) => !e.icon && e.executablePath).map((e) => e.executablePath!)),
  ];
  const resolved = new Map<string, string>();
  if (targets.length === 0) return resolved;

  const iconsFolder = PathManager.getAppsFolder();
  const tasks = targets.map((execPath) => async () => {
    try {
      const icon = await extractIcon(execPath, iconsFolder);
      if (icon) resolved.set(execPath, icon);
    } catch (error) {
      itemLogger.warn({ execPath, error }, 'レイアウトエントリのアイコン解決に失敗');
    }
  });

  await runWithConcurrency(tasks, LAYOUT_ICON_CONCURRENCY);
  return resolved;
}
