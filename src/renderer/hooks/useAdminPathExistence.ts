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
function checkableSetEntryPathOf(entry: SetEntry): string | null {
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

/** 1 つのアイテムの確認結果 */
export interface ItemPathCheck {
  /** 確かめていない・対象外なら undefined */
  status?: PathExistenceStatus;
  /** セットの行のうち見つからない行の名前（セット以外は空） */
  missingSetRows: string[];
}

/**
 * アイテムの確認結果を、パスごとの結果から決める
 *
 * セット（A3-79 #8）は行をまとめる。見つからない行＝パスを直接書いて確かめたら無かった行と、指すアイテムが
 * 一覧（どのデータファイルでも）から消えた行。指すアイテムのパスが無いときは、そのアイテムの行に出るので数えない。
 * ✓ はパスを直接書いた行を確かめて全部あったときだけ（登録済みのアイテムを指す行だけのセットは空のまま）
 *
 * @param itemIds 一覧にあるアイテムの id（未保存の編集を含む全データファイル）
 */
export function evaluateItemPathCheck(
  item: EditableJsonItem,
  results: ReadonlyMap<string, PathExistenceStatus>,
  itemIds: ReadonlySet<string>
): ItemPathCheck {
  const jsonItem = item.item;
  if (jsonItem.type !== 'set') {
    const itemPath = checkablePathOf(item);
    return { status: itemPath ? results.get(itemPath) : undefined, missingSetRows: [] };
  }
  const missingSetRows: string[] = [];
  const rowStatuses: PathExistenceStatus[] = [];
  jsonItem.entries.forEach((entry, index) => {
    const entryPath = checkableSetEntryPathOf(entry);
    const rowStatus = entryPath ? results.get(entryPath) : undefined;
    if (rowStatus) rowStatuses.push(rowStatus);
    const dangling = !entryPath && !!entry.itemId && !itemIds.has(entry.itemId);
    if (rowStatus === 'missing' || dangling) {
      missingSetRows.push(entry.label || entry.open?.path || `#${index + 1}`);
    }
  });
  const status: PathExistenceStatus | undefined =
    missingSetRows.length > 0
      ? 'missing'
      : rowStatuses.includes('unknown')
        ? 'unknown'
        : rowStatuses.length > 0
          ? 'exists'
          : undefined;
  return { status, missingSetRows };
}

export interface PathCheckSummary {
  /** 結果が出たアイテムの数（セットは 1 件） */
  checked: number;
  /** 見つからないアイテムの数（ステータスバーの「リンク切れ: N 件」と同じ数え方） */
  missing: number;
  /** 時間内に応答が無かったアイテムの数（ネットワークパスなど。リンク切れとは数えない） */
  unknown: number;
}

/**
 * アイテムのパスが実在するかを、求められたときだけ確認する（「リンク切れを確認」）
 *
 * 自動では確認しない。ネットワークパスは応答に時間がかかることがあるため。
 * 結果は確認したアイテム（表示中のデータファイル）にだけ出し、refreshKey が変わったら（読み込み・保存）捨てる。
 */
export function useAdminPathExistence(refreshKey: number) {
  const [results, setResults] = useState<Map<string, PathExistenceStatus>>(new Map());
  /** 確認したアイテムの id（ほかのデータファイルのアイテムには結果を出さない） */
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const lastRefreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    if (lastRefreshKeyRef.current === refreshKey) return;
    lastRefreshKeyRef.current = refreshKey;
    setResults(new Map());
    setCheckedIds(new Set());
    setHasChecked(false);
  }, [refreshKey]);

  /**
   * @param items 確かめるアイテム（表示中のデータファイル）
   * @param itemIds 一覧にあるアイテムの id（セットの行が指すアイテムが消えたかを見る）
   */
  const runCheck = useCallback(
    async (items: EditableJsonItem[], itemIds: ReadonlySet<string>): Promise<PathCheckSummary> => {
      const paths = new Set<string>();
      for (const item of items) {
        for (const itemPath of checkablePathsOf(item)) paths.add(itemPath);
      }

      setChecking(true);
      try {
        const result = paths.size > 0 ? await window.electronAPI.checkPathsExist([...paths]) : {};
        const next = new Map<string, PathExistenceStatus>(Object.entries(result));
        setResults(next);
        setCheckedIds(new Set(items.map((item) => item.item.id)));
        setHasChecked(true);
        const summary: PathCheckSummary = { checked: 0, missing: 0, unknown: 0 };
        for (const item of items) {
          const { status } = evaluateItemPathCheck(item, next, itemIds);
          if (!status) continue;
          summary.checked++;
          if (status === 'missing') summary.missing++;
          else if (status === 'unknown') summary.unknown++;
        }
        return summary;
      } finally {
        setChecking(false);
      }
    },
    []
  );

  return { results, checkedIds, checking, hasChecked, runCheck };
}
