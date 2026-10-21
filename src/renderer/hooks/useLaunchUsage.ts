import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const lastJson = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      window.electronAPI
        .getLaunchUsage()
        .then((next) => {
          if (cancelled) return;
          // 変わっていなければ置き換えない（戻ってくるたびに一覧を絞り込み直し、描き直さないように）
          const json = JSON.stringify(next);
          if (json === lastJson.current) return;
          lastJson.current = json;
          setSnapshot(next);
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

  // 並べ替え・絞り込み・各行で何度も引くので、記録を読み直すまでアイテムごとに覚えておく
  //（編集したアイテムは別のオブジェクトになるので、古い結果は使わない）
  const cache = useMemo(
    () => new WeakMap<EditableJsonItem, LaunchUsageRecord | undefined>(),
    [snapshot]
  );

  /** そのアイテムの記録（id の記録と、同じパスの記録を足したもの）。無ければ undefined */
  const usageOf = useCallback(
    (item: EditableJsonItem): LaunchUsageRecord | undefined => {
      if (!snapshot) return undefined;
      if (cache.has(item)) return cache.get(item);
      const json = item.item;
      const byPath =
        json.type === 'item' && json.path
          ? snapshot.byPath[launchUsagePathKey(json.path)]
          : undefined;
      // フォルダ取込の行は、展開したアイテムを開いた記録（その行の id で数えている）
      const record = mergeLaunchUsage(snapshot.byId[json.id], byPath);
      cache.set(item, record);
      return record;
    },
    [snapshot, cache]
  );

  return { since: snapshot?.since ?? null, loaded: snapshot !== null, usageOf };
}

export type LaunchUsage = ReturnType<typeof useLaunchUsage>;
