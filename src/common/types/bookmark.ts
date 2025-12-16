/**
 * ブックマークインポート機能で使用される、シンプルなブックマークアイテムのインターフェース
 * HTMLブックマークファイルから抽出されたブックマーク情報を表す
 */
export interface SimpleBookmarkItem {
  /** ブックマークの一意識別子 */
  id: string;
  /** ブックマークの表示名 */
  name: string;
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
  name: string;
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
  name: string;
  /** インストールされているかどうか */
  installed: boolean;
  /** 検出されたプロファイルのリスト */
  profiles: BrowserProfile[];
}
