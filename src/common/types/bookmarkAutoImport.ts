/**
 * ブックマーク自動取込機能の型定義
 *
 * 起動時に事前登録したルールに基づいて、ブラウザのブックマークを
 * 自動的にデータファイルにインポートする機能で使用する型を定義
 */

/** ブックマーク自動取込ルール */
export interface BookmarkAutoImportRule {
  /** 8文字の一意ID */
  id: string;
  /** ルール名 */
  name: string;
  /** 有効/無効 */
  enabled: boolean;

  /** ソースブラウザ */
  browserId: 'chrome' | 'edge';
  /** プロファイルID（空配列=全プロファイル） */
  profileIds: string[];

  /** フォルダパス（例: "bookmark_bar/開発"） */
  folderPaths: string[];
  /** フォルダフィルタモード */
  folderFilterMode: 'include' | 'exclude';
  /** サブフォルダのブックマークも含めるか（デフォルト: true） */
  includeSubfolders: boolean;
  /** URLパターン（正規表現、空=全URL） */
  urlPattern: string;
  /** 名前パターン（正規表現、空=全名前） */
  namePattern: string;

  /** インポート先データファイル名（例: "datafiles/data.json"） */
  targetFile: string;
  /** インポート時にdisplayNameに付ける接頭辞 */
  prefix: string;
  /** インポート時にdisplayNameに付ける接尾辞 */
  suffix: string;
  /** フォルダ名の付与モード */
  folderNameMode: 'none' | 'parent' | 'fullPath' | 'relativePath';

  /** 作成日時（Unixタイムスタンプ ms） */
  createdAt: number;
  /** 更新日時（Unixタイムスタンプ ms） */
  updatedAt: number;
  /** 最終実行日時（Unixタイムスタンプ ms） */
  lastExecutedAt?: number;
  /** 最終実行結果 */
  lastResult?: BookmarkAutoImportResult;
}

/** 自動取込の実行結果 */
export interface BookmarkAutoImportResult {
  /** 成功したかどうか */
  success: boolean;
  /** 登録件数 */
  importedCount: number;
  /** 削除件数（前回分のクリア） */
  deletedCount: number;
  /** エラーメッセージ */
  errorMessage?: string;
  /** 実行日時（Unixタイムスタンプ ms） */
  executedAt: number;
}

/** ブックマーク自動取込の設定全体 */
export interface BookmarkAutoImportSettings {
  /** 起動時に自動実行するかどうか */
  autoRunOnStartup: boolean;
  /** ルールの配列 */
  rules: BookmarkAutoImportRule[];
}

/** デフォルトの自動取込設定 */
export const DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS: BookmarkAutoImportSettings = {
  autoRunOnStartup: false,
  rules: [],
};

/** ブックマークのフォルダ構造（ツリーUI用） */
export interface BookmarkFolder {
  /** フォルダパス（例: "bookmark_bar/開発/Tools"） */
  path: string;
  /** フォルダ名（例: "Tools"） */
  name: string;
  /** 子フォルダ */
  children: BookmarkFolder[];
  /** 直下のブックマーク数 */
  bookmarkCount: number;
}

/** フォルダパス付きのブックマーク情報（フィルタ用） */
export interface BookmarkWithFolder {
  /** ブックマークの表示名 */
  displayName: string;
  /** ブックマークのURL */
  url: string;
  /** 所属フォルダパス（例: "bookmark_bar/開発"） */
  folderPath: string;
}
