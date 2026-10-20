/**
 * key を入れた（入っていれば外した）新しい Set を返す。元の Set は変えない（state の更新に使う）
 */
export function toggleInSet<T>(set: ReadonlySet<T>, key: T): Set<T> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
