/**
 * ランチャーアプリケーションで表示・実行されるアイテムの基本インターフェース
 * ファイル、アプリケーション、URL、フォルダなど様々なタイプのアイテムに対応
 */
export interface LauncherItem {
  /** アイテムの表示名 */
  name: string;
  /** アイテムのパス、URL、またはコマンド */
  path: string;
  /** アイテムのタイプ（URL、ファイル、フォルダ、アプリケーション、カスタムURI） */
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  /** アイテムのアイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
  /** カスタムアイコンのファイル名（custom-iconsフォルダ内の相対パス、オプション） */
  customIcon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** ショートカットファイル（.lnk）のリンク先のパス（オプション） */
  originalPath?: string;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用） */
  lineNumber?: number;
  /** フォルダ取込アイテムによって展開されたアイテムかどうか */
  isDirExpanded?: boolean;
  /** フォルダ取込アイテムから展開された場合の元ディレクトリパス */
  expandedFrom?: string;
  /** フォルダ取込アイテムから展開された場合のオプション情報（人間が読める形式） */
  expandedOptions?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
}

/**
 * 複数のアイテムをまとめて一括起動するためのグループアイテム
 * 既存のアイテム名を参照して、順次実行する
 */
export interface GroupItem {
  /** グループの表示名 */
  name: string;
  /** アイテムタイプ（常に'group'） */
  type: 'group';
  /** グループ内で参照するアイテム名のリスト */
  itemNames: string[];
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用） */
  lineNumber?: number;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
}

/**
 * アプリケーションで扱うすべてのアイテムの統合型
 * 通常のLauncherItemとGroupItemの両方を扱える
 */
export type AppItem = LauncherItem | GroupItem;
