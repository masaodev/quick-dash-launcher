/**
 * 検索履歴のエントリーを表すインターフェース
 * ユーザーが実行時に入力した検索クエリと実行日時を保持する
 */
export interface SearchHistoryEntry {
  /** 検索クエリ文字列 */
  query: string;
  /** 実行日時（ISO文字列形式） */
  timestamp: string;
}

/**
 * 検索履歴の状態管理用インターフェース
 * キーボードナビゲーションでの履歴巡回に使用される
 */
export interface SearchHistoryState {
  /** 履歴エントリーのリスト（最新が先頭） */
  entries: SearchHistoryEntry[];
  /** 現在選択中の履歴インデックス（-1は履歴を使用していない状態） */
  currentIndex: number;
}
