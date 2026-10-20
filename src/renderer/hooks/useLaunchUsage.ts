import { useCallback, useEffect, useState } from 'react';
import type { EditableJsonItem } from '@common/types/editableItem';
import {
  launchUsagePathKey,
  mergeLaunchUsage,
  type LaunchUsageRecord,
  type LaunchUsageSnapshot,
} from '@common/types/launchUsage';

import { logError } from '../utils/debug';

/**
 * アイテムを起動した記録（最終起動・起動回数）
 *
 * 管理ウィンドウを開いたときと、ほかのウィンドウから戻ってきたとき（focus）に読み直す
 */
export function useLaunchUsage() {
  const [snapshot, setSnapshot] = useState<LaunchUsageSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      window.electronAPI
        .getLaunchUsage()
        .then((next) => {
          if (!cancelled) setSnapshot(next);
        })
        .catch((error) => logError('起動の記録を読めませんでした:', error));
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, []);

  /** そのアイテムの記録（id の記録と、同じパスの記録を足したもの）。無ければ undefined */
  const usageOf = useCallback(
    (item: EditableJsonItem): LaunchUsageRecord | undefined => {
      if (!snapshot) return undefined;
      const json = item.item;
      // フォルダ取込の行は、展開したアイテムを開いた記録（展開元のフォルダのパスで数えている）
      const byPath =
        (json.type === 'item' || json.type === 'dir') && json.path
          ? snapshot.byPath[launchUsagePathKey(json.path)]
          : undefined;
      return mergeLaunchUsage(snapshot.byId[json.id], byPath);
    },
    [snapshot]
  );

  return { since: snapshot?.since ?? null, loaded: snapshot !== null, usageOf };
}

export type LaunchUsage = ReturnType<typeof useLaunchUsage>;
