import { useEffect, useRef, useState } from 'react';
import type { EditableJsonItem } from '@common/types/editableItem';
import { isPathExistenceCheckable } from '@common/utils/pathExistence';

/** 存在確認の対象になるパス（単一アイテムとフォルダ取込のローカルパス） */
function checkablePathOf(item: EditableJsonItem): string | null {
  const jsonItem = item.item;
  if (jsonItem.type !== 'item' && jsonItem.type !== 'dir') return null;
  const itemPath = jsonItem.path || '';
  return isPathExistenceCheckable(itemPath) ? itemPath : null;
}

/**
 * アイテムのパスが実在するかを取得する（リンク切れの印に使う）
 *
 * 未確認のパスだけを IPC でまとめて確認する。refreshKey が変わったら（読み込み・保存）全部を確認し直す。
 *
 * @returns Map<パス, 実在するか>。確認対象外のパスは含まない
 */
export function useAdminPathExistence(
  items: EditableJsonItem[],
  refreshKey: number
): Map<string, boolean> {
  const [existence, setExistence] = useState<Map<string, boolean>>(new Map());
  const checkedRef = useRef<Set<string>>(new Set());
  const lastRefreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    if (lastRefreshKeyRef.current !== refreshKey) {
      lastRefreshKeyRef.current = refreshKey;
      checkedRef.current = new Set();
    }

    const pending = new Set<string>();
    for (const item of items) {
      const itemPath = checkablePathOf(item);
      if (itemPath && !checkedRef.current.has(itemPath)) {
        pending.add(itemPath);
      }
    }
    if (pending.size === 0) return;

    const paths = [...pending];
    paths.forEach((p) => checkedRef.current.add(p));
    let cancelled = false;

    window.electronAPI
      .checkPathsExist(paths)
      .then((result) => {
        if (cancelled) return;
        setExistence((prev) => {
          const next = new Map(prev);
          for (const [p, exists] of Object.entries(result)) {
            next.set(p, exists);
          }
          return next;
        });
      })
      .catch(() => {
        // 確認できなかったパスは次の機会にもう一度確認する
        paths.forEach((p) => checkedRef.current.delete(p));
      });

    return () => {
      cancelled = true;
    };
  }, [items, refreshKey]);

  return existence;
}

export { checkablePathOf };
