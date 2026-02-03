/**
 * ブックマークインポート機能で使用される、シンプルなブックマークアイテムのインターフェース
 * HTMLブックマークファイルから抽出されたブックマーク情報を表す
 */
export interface SimpleBookmarkItem {
  /** ブックマークの一意識別子 */
  id: string;
  /** ブックマークの表示名 */
  displayName: string;
  /** ブックマークのURL */
  url: string;
  /** インポート時の選択状態 */
  checked: boolean;
}

/**
 * ブラウザのプロファイル情報
 * Chrome/Edgeの各プロファイルを表す
 */
export interface BrowserProfile {
  /** プロファイルID（フォルダ名: 'Default', 'Profile 1' 等） */
  id: string;
  /** プロファイルの表示名（Preferencesから取得） */
  displayName: string;
  /** ブックマークファイルの絶対パス */
  bookmarkPath: string;
}

/**
 * インストール済みブラウザの情報
 * ブラウザの検出結果とプロファイル一覧を保持
 */
export interface BrowserInfo {
  /** ブラウザの識別子 */
  id: 'chrome' | 'edge';
  /** ブラウザの表示名 */
  displayName: string;
  /** インストールされているかどうか */
  installed: boolean;
  /** 検出されたプロファイルのリスト */
  profiles: BrowserProfile[];
}

/**
 * 重複時の処理オプション
 * - 'overwrite': 既存アイテムを新しい情報で上書き
 * - 'skip': 重複アイテムはインポートしない
 */
export type DuplicateHandlingOption = 'overwrite' | 'skip';

/**
 * 重複チェックの結果
 * ブックマークインポート時に既存アイテムとの重複を検出した結果を表す
 */
export interface DuplicateCheckResult {
  /** 重複しているブックマークの件数 */
  duplicateCount: number;
  /** 新規（重複していない）ブックマークの件数 */
  newCount: number;
  /** 重複している既存アイテムのID一覧 */
  duplicateExistingIds: string[];
  /** 重複しているブックマークのID一覧 */
  duplicateBookmarkIds: string[];
}
