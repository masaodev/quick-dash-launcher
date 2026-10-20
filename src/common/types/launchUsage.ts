/**
 * アイテムを起動した記録（item-usage.json。アイテム管理の「最終起動」「起動回数」の列に使う）
 */

export interface LaunchUsageRecord {
  /** 最後に起動した日時（Unix ミリ秒） */
  lastLaunchedAt: number;
  /** 起動した回数 */
  count: number;
}

export interface LaunchUsageSnapshot {
  /** 記録を始めた日時（それより前の起動は記録に無い） */
  since: number;
  /** データファイルのアイテムの id → 記録（メイン画面・セットから開いたとき） */
  byId: Record<string, LaunchUsageRecord>;
  /** パスと引数 → 記録（ワークスペース・フォルダ取込の展開から開いたとき。キーは launchUsagePathKey） */
  byPath: Record<string, LaunchUsageRecord>;
}

/** パスと引数の記録のキー（大文字小文字と前後の空白は区別しない） */
export function launchUsagePathKey(itemPath: string, args?: string): string {
  return `${itemPath.trim().toLowerCase()}\u0000${(args ?? '').trim()}`;
}

/** id とパスの記録を足す（最後の日時は新しいほう、回数は合計）。どちらも無ければ undefined */
export function mergeLaunchUsage(
  ...records: Array<LaunchUsageRecord | undefined>
): LaunchUsageRecord | undefined {
  let merged: LaunchUsageRecord | undefined;
  for (const record of records) {
    if (!record) continue;
    merged = merged
      ? {
          lastLaunchedAt: Math.max(merged.lastLaunchedAt, record.lastLaunchedAt),
          count: merged.count + record.count,
        }
      : { ...record };
  }
  return merged;
}
