import { useEffect, useRef, useState } from 'react';
import type { DataFileTab } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

interface UseRevealItemParams {
  /** 見せる行の id（ランチャーの WSグループの行の F2 から届く）。null なら何もしない */
  revealItemId: string | null;
  workingItems: readonly EditableJsonItem[];
  /** 今の検索・絞り込みの後の一覧（今のデータファイルの分） */
  filteredItems: readonly EditableJsonItem[];
  dataFileTabs: readonly DataFileTab[];
  selectedDataFile: string;
  /** その行のデータファイル（とタブ）へ切り替える */
  showFile: (tabIndex: number, fileName: string) => void;
  /** 検索欄と見出しの ▾ の絞り込みを外す（その行が隠れているときだけ呼ぶ） */
  clearSearchAndFilters: () => void;
  /** その行の編集画面を開く（一覧の ✏️ と同じ） */
  openEditor: (item: EditableJsonItem) => void;
  /** 見せ終えた（見つからずにあきらめたときも呼ぶ） */
  onHandled: () => void;
}

/**
 * アイテム管理で、指定した id の行を見せて編集画面を開く（A3-229 W8）
 *
 * その行のタブ・データファイルへ切り替え、検索・絞り込みで隠れていれば外し、編集画面を開く。
 * 行は選ばない（選ぶとツールバーが選択中の操作に変わり、検索欄が消えるため）。
 * スクロールは一覧（AdminItemManagerList）がするので、スクロールする行の id を返す。
 * 状態の切り替えは 1 回の描画で済まないので、切り替えるたびに描き直してから次の段へ進む
 */
export function useRevealItem({
  revealItemId,
  workingItems,
  filteredItems,
  dataFileTabs,
  selectedDataFile,
  showFile,
  clearSearchAndFilters,
  openEditor,
  onHandled,
}: UseRevealItemParams): { scrollToItemId: string | null; onScrolled: () => void } {
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  // 絞り込みを外しても見えないときに外し続けないよう、外したかを覚えておく
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!revealItemId) {
      clearedRef.current = false;
      return;
    }
    // 読み込み前（まだ 1 件も無い）は待つ
    if (workingItems.length === 0) return;

    const target = workingItems.find((item) => item.item.id === revealItemId);
    if (!target) {
      // 消された・保存前に読み直したなど。何もせずに終える
      onHandled();
      return;
    }

    const fileName = target.meta.sourceFile;
    if (fileName !== selectedDataFile) {
      showFile(
        dataFileTabs.findIndex((tab) => (tab.files ?? []).includes(fileName)),
        fileName
      );
      return;
    }

    if (!filteredItems.includes(target) && !clearedRef.current) {
      clearedRef.current = true;
      clearSearchAndFilters();
      return;
    }

    setScrollToItemId(revealItemId);
    clearedRef.current = false;
    onHandled();
    openEditor(target);
  }, [revealItemId, workingItems, filteredItems, selectedDataFile]);

  return { scrollToItemId, onScrolled: () => setScrollToItemId(null) };
}
