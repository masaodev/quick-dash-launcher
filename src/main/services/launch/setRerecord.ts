/**
 * メイン画面の右クリック「今の位置を記録し直す」
 *
 * 置き場所のある行のウィンドウを今の画面から探し、位置を取り直してデータファイルに保存する。
 * 行の追加・削除はしない（それは編集画面の「今の位置を記録」）。結果はトーストで知らせる
 */
import * as path from 'path';

import { itemLogger } from '@common/logger';
import type { SetItem } from '@common/types';
import { FileUtils } from '@common/utils/fileUtils';
import { parseJsonDataFileLenient } from '@common/utils/jsonParser';
import { rerecordSetPlacements } from '@common/utils/setWindowMatching';

import { getAllWindows } from '../../utils/nativeWindowControl.js';
import { getDesktopCount } from '../../utils/virtualDesktop/index.js';
import { PathManager } from '../../config/pathManager.js';
import { updateSetItemById } from '../data/dataItemWriter.js';
import { notifyDataChanged } from '../../ipc/notifications.js';
import { showToastWindow } from '../overlayWindowService.js';
import { mainI18n } from '../mainI18n.js';

/**
 * ファイルにある今のセットを読む（画面が持っていた内容は古いことがある。外で編集されていたら、それを戻さないように）
 */
function readCurrentSet(item: SetItem): SetItem {
  if (!item.sourceFile) return item;
  const content = FileUtils.safeReadTextFile(
    path.join(PathManager.getConfigFolder(), item.sourceFile)
  );
  if (content === null) return item;
  try {
    const found = parseJsonDataFileLenient(content).data.items.find((i) => i.id === item.id);
    return found?.type === 'set' ? { ...item, ...found } : item;
  } catch {
    return item;
  }
}

export async function rerecordSetPositions(shown: SetItem): Promise<void> {
  if (!shown.id) return;
  const item = readCurrentSet(shown);
  const t = mainI18n.t.bind(mainI18n);

  const windows = getAllWindows({ includeAllVirtualDesktops: true });
  const result = rerecordSetPlacements(item.entries, windows, getDesktopCount());
  itemLogger.info(
    { setName: item.displayName, changed: result.changed, notFound: result.notFound },
    'セットの位置を記録し直しました'
  );

  if (result.changed > 0) {
    updateSetItemById(
      PathManager.getConfigFolder(),
      shown.id,
      {
        displayName: item.displayName,
        entries: result.entries,
        launchMode: item.launchMode,
        customIcon: item.customIcon,
      },
      item.memo
    );
    notifyDataChanged();
  }

  const lines: string[] = [
    result.changed > 0
      ? t('set.redo.savedCount', { count: result.changed })
      : t('set.redo.noChange'),
  ];
  if (result.notFound > 0) lines.push(t('set.redo.notFoundCount', { count: result.notFound }));
  await showToastWindow({
    type: result.notFound > 0 ? 'warning' : 'success',
    message: `${item.displayName}: ${lines.join(' ')}`,
  });
}
