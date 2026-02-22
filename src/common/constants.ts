/**
 * アプリケーション全体で使用する定数
 */

/**
 * グループ起動時のアイテム間の待機時間（ミリ秒）
 * 各アイテムを順次起動する際、安定性のために適用される遅延
 */
export const GROUP_LAUNCH_DELAY_MS = 100;

/**
 * ブックマークファイルの最大サイズ（バイト）
 * これを超えるファイルは読み込まれない
 */
export const MAX_BOOKMARK_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** 階層深さごとのグループデフォルト色 */
const GROUP_DEFAULT_COLORS_BY_DEPTH: Record<number, string> = {
  0: 'var(--color-primary)',
  1: '#00897b',
  2: 'var(--color-secondary)',
};

export function getDefaultGroupColor(depth: number): string {
  return GROUP_DEFAULT_COLORS_BY_DEPTH[depth] ?? 'var(--color-primary)';
}

/**
 * デスクトップタブのID定数
 */
export const DESKTOP_TAB = {
  /** すべてのウィンドウを表示 */
  ALL: 0,
  /** ピン止めされたウィンドウを表示 */
  PINNED: -2,
} as const;
