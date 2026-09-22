/**
 * 並び順（order）の適用ヘルパー
 */

/**
 * 指定 id の order を書き換える（配列をその場で変更し、更新した件数を返す）
 *
 * マップに無い要素は触らない。存在しない id は無視する
 */
export function applyOrders<T extends { id: string; order: number }>(
  list: T[],
  orders: Map<string, number>
): number {
  let updated = 0;
  for (const entry of list) {
    const order = orders.get(entry.id);
    if (order !== undefined && entry.order !== order) {
      entry.order = order;
      updated++;
    }
  }
  return updated;
}
