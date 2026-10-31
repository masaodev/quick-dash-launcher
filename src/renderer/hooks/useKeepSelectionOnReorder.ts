import { useLayoutEffect, useRef } from 'react';
import type { AppItem } from '@common/types';

/**
 * 並べ方だけが変わったとき（よく開く順の回数を読み直した）に、選んでいたアイテムの選択を保つ
 *
 * 選択は番号で持っているので、並びが変わると同じ番号の別のアイテムに移り、そのまま Enter を押すと
 * 別のアイテムが開く。ランチャーを出したままにしているとき、開いた後にウィンドウへ戻ると回数が増えて
 * 並びが変わるので起きる。`orderKey`（並べ方を決めるもの）が変わったときだけ、選んでいたアイテムを探して
 * 番号を合わせ直す（検索語やタブが変わったときは、今までどおり呼び出し側が先頭に戻す）
 */
export function useKeepSelectionOnReorder(
  items: AppItem[],
  selectedIndex: number,
  setSelectedIndex: (index: number) => void,
  orderKey: unknown
): void {
  const selectedRef = useRef<AppItem | undefined>(undefined);
  const orderKeyRef = useRef(orderKey);

  useLayoutEffect(() => {
    if (orderKeyRef.current !== orderKey) {
      orderKeyRef.current = orderKey;
      const selected = selectedRef.current;
      const index = selected ? items.indexOf(selected) : -1;
      if (index >= 0 && index !== selectedIndex) {
        setSelectedIndex(index);
        return;
      }
    }
    selectedRef.current = items[selectedIndex];
  }, [items, selectedIndex, setSelectedIndex, orderKey]);
}
