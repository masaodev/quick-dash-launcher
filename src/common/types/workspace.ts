import { LauncherItem } from './launcher';

/**
 * ワークスペースのグループ
 * アイテムを論理的にグループ化して整理する
 */
export interface WorkspaceGroup {
  /** グループの一意識別子（UUID） */
  id: string;
  /** グループ名 */
  name: string;
  /** グループの色（CSS変数名またはカラーコード） */
  color: string;
  /** 並び順（0から開始） */
  order: number;
  /** 折りたたみ状態（true: 折りたたみ） */
  collapsed: boolean;
  /** 作成日時（timestamp） */
  createdAt: number;
}

/**
 * ワークスペースに追加されたアイテム
 * メイン画面のアイテムを完全にコピーし、独立して管理される
 * 元のアイテムが変更・削除されても影響を受けない
 */
export interface WorkspaceItem {
  /** アイテムの一意識別子（UUID） */
  id: string;
  /** ワークスペース内での表示名（編集可能） */
  displayName: string;
  /** 元のアイテム名（参照用） */
  originalName: string;
  /** アイテムのパス、URL、またはコマンド */
  path: string;
  /** アイテムのタイプ */
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  /** アイテムのアイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
  /** カスタムアイコンのファイル名（オプション） */
  customIcon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** ショートカットファイルのリンク先のパス（オプション） */
  originalPath?: string;
  /** 並び順（0から開始） */
  order: number;
  /** 追加日時（timestamp） */
  addedAt: number;
  /** 所属グループID（未設定の場合はundefined = 未分類） */
  groupId?: string;
  /** グループラベル（将来的な拡張用、廃止予定） */
  label?: string;
}

/**
 * 実行履歴アイテム
 * メインウィンドウで実行されたアイテムの履歴を記録する
 */
export interface ExecutionHistoryItem {
  /** 履歴アイテムの一意識別子（UUID） */
  id: string;
  /** アイテム名 */
  itemName: string;
  /** アイテムのパス、URL、またはコマンド */
  itemPath: string;
  /** アイテムのタイプ */
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'group';
  /** アイテムのアイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** 実行日時（timestamp） */
  executedAt: number;
}

/**
 * ドラッグ&ドロップで転送されるデータの型
 * ワークスペース内のアイテム、実行履歴、グループのドラッグを型安全に扱う
 */
export type DragItemData =
  | { type: 'workspace-item'; itemId: string; currentGroupId?: string }
  | { type: 'history-item'; historyItem: LauncherItem }
  | { type: 'group'; groupId: string };

/**
 * ドロップターゲットのデータ型
 * ドロップ先の種別と識別子を表す
 */
export interface DropTargetData {
  /** ドロップ先のタイプ */
  targetType: 'group' | 'item' | 'uncategorized';
  /** グループID（targetType='group'の場合） */
  groupId?: string;
  /** アイテムID（targetType='item'の場合） */
  itemId?: string;
}
