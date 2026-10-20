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
  /** パス → 記録（ワークスペースから開いたとき・フォルダ取込で展開したアイテムを開いたとき（展開元のフォルダのパス）。キーは launchUsagePathKey） */
  byPath: Record<string, LaunchUsageRecord>;
}

/**
 * パスの記録のキー（大文字小文字・前後の空白・末尾の区切り文字は区別しない）
 *
 * 引数は含めない。ワークスペースのアイテムはメインのコピーで、ショートカット（.lnk）の引数が付いたり、
 * フォルダの末尾に \ が付いたりして、メインのアイテムと引数・表記がずれることがあるため
 */
export function launchUsagePathKey(itemPath: string): string {
  return itemPath
    .trim()
    .replace(/[\\/]+$/, '')
    .toLowerCase();
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
