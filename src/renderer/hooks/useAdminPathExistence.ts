import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditableJsonItem, PathExistenceStatus } from '@common/types/editableItem';
import type { SetEntry } from '@common/types/launcher';
import { isPathExistenceCheckable } from '@common/utils/pathExistence';

/** 存在確認の対象になるパス（単一アイテムとフォルダ取込のローカルパス） */
export function checkablePathOf(item: EditableJsonItem): string | null {
  const jsonItem = item.item;
  if (jsonItem.type !== 'item' && jsonItem.type !== 'dir') return null;
  const itemPath = jsonItem.path || '';
  return isPathExistenceCheckable(itemPath) ? itemPath : null;
}

/** セットの行のうち、パスを直接書いた行の確認できるパス（登録済みのアイテムを指す行は、そのアイテムの行で確かめる。A3-79 #8） */
export function checkableSetEntryPathOf(entry: SetEntry): string | null {
  const entryPath = entry.open?.path || '';
  return isPathExistenceCheckable(entryPath) ? entryPath : null;
}

/** 存在確認の対象になるパスをすべて（セットは行ごと） */
function checkablePathsOf(item: EditableJsonItem): string[] {
  const jsonItem = item.item;
  if (jsonItem.type === 'set') {
    return jsonItem.entries
      .map(checkableSetEntryPathOf)
      .filter((entryPath): entryPath is string => entryPath !== null);
  }
  const itemPath = checkablePathOf(item);
  return itemPath ? [itemPath] : [];
}

export interface PathCheckSummary {
  /** 確認したパスの数（重複は 1 つに数える） */
  checked: number;
  missing: number;
  /** 時間内に応答が無かった数（ネットワークパスなど。リンク切れとは数えない） */
  unknown: number;
}

/**
 * アイテムのパスが実在するかを、求められたときだけ確認する（「リンク切れを確認」）
 *
 * 自動では確認しない。ネットワークパスは応答に時間がかかることがあるため。
 * 結果は refreshKey が変わったら（読み込み・保存）捨てる。
 */
export function useAdminPathExistence(refreshKey: number) {
  const [results, setResults] = useState<Map<string, PathExistenceStatus>>(new Map());
  const [checking, setChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const lastRefreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    if (lastRefreshKeyRef.current === refreshKey) return;
    lastRefreshKeyRef.current = refreshKey;
    setResults(new Map());
    setHasChecked(false);
  }, [refreshKey]);

  const runCheck = useCallback(async (items: EditableJsonItem[]): Promise<PathCheckSummary> => {
    const paths = new Set<string>();
    for (const item of items) {
      for (const itemPath of checkablePathsOf(item)) paths.add(itemPath);
    }

    setChecking(true);
    try {
      const result = paths.size > 0 ? await window.electronAPI.checkPathsExist([...paths]) : {};
      const next = new Map<string, PathExistenceStatus>(Object.entries(result));
      setResults(next);
      setHasChecked(true);
      let missing = 0;
      let unknown = 0;
      for (const status of next.values()) {
        if (status === 'missing') missing++;
        else if (status === 'unknown') unknown++;
      }
      return { checked: next.size, missing, unknown };
    } finally {
      setChecking(false);
    }
  }, []);

  return { results, checking, hasChecked, runCheck };
}
