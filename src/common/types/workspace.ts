import { LauncherItem } from './launcher';
import type { ClipboardFormat } from './clipboard';

/**
 * ワークスペースのグループ
 * アイテムを論理的にグループ化して整理する
 */
export interface WorkspaceGroup {
  /** グループの一意識別子（UUID） */
  id: string;
  /** グループ名 */
  displayName: string;
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
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'windowOperation' | 'group' | 'clipboard';
  /** アイテムのアイコン（実行時にキャッシュから取得、ファイルには保存しない） */
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
  /** ウィンドウ制御設定（ウィンドウ検索・位置・サイズ制御） */
  windowConfig?: import('./launcher').WindowConfig;
  /** ウィンドウ操作：X座標（windowOperation専用、オプション） */
  windowX?: number;
  /** ウィンドウ操作：Y座標（windowOperation専用、オプション） */
  windowY?: number;
  /** ウィンドウ操作：幅（windowOperation専用、オプション） */
  windowWidth?: number;
  /** ウィンドウ操作：高さ（windowOperation専用、オプション） */
  windowHeight?: number;
  /** ウィンドウ操作：仮想デスクトップ番号（windowOperation専用、オプション） */
  virtualDesktopNumber?: number;
  /** ウィンドウ操作：ウィンドウをアクティブにするか（windowOperation専用、オプション） */
  activateWindow?: boolean;
  /** ウィンドウ操作：プロセス名で検索（windowOperation専用、オプション） */
  processName?: string;
  /** ウィンドウ操作：アクティブモニターの中央に移動するか（windowOperation専用、オプション） */
  moveToActiveMonitorCenter?: boolean;
  /** ウィンドウ操作：全仮想デスクトップにピン止めするか（windowOperation専用、オプション） */
  pinToAllDesktops?: boolean;
  /** グループ内のアイテム名リスト（group専用） */
  itemNames?: string[];
  /** 自由記述メモ（オプション） */
  memo?: string;
  /** クリップボードデータファイルへの参照（clipboard専用） */
  clipboardDataRef?: string;
  /** クリップボードの保存フォーマット（clipboard専用） */
  clipboardFormats?: ClipboardFormat[];
  /** クリップボードの保存日時（clipboard専用） */
  clipboardSavedAt?: number;
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
  itemType:
    | 'url'
    | 'file'
    | 'folder'
    | 'app'
    | 'customUri'
    | 'group'
    | 'windowOperation'
    | 'clipboard';
  /** アイテムのアイコン（実行時にキャッシュから取得、ファイルには保存しない） */
  icon?: string;
  /** カスタムアイコンのファイル名（オプション） */
  customIcon?: string;
  /** 実行時のコマンドライン引数（オプション） */
  args?: string;
  /** 実行日時（timestamp） */
  executedAt: number;
  /** ウィンドウ操作：X座標（windowOperation専用、オプション） */
  windowX?: number;
  /** ウィンドウ操作：Y座標（windowOperation専用、オプション） */
  windowY?: number;
  /** ウィンドウ操作：幅（windowOperation専用、オプション） */
  windowWidth?: number;
  /** ウィンドウ操作：高さ（windowOperation専用、オプション） */
  windowHeight?: number;
  /** ウィンドウ操作：仮想デスクトップ番号（windowOperation専用、オプション） */
  virtualDesktopNumber?: number;
  /** ウィンドウ操作：ウィンドウをアクティブにするか（windowOperation専用、オプション） */
  activateWindow?: boolean;
  /** ウィンドウ操作：プロセス名で検索（windowOperation専用、オプション） */
  processName?: string;
  /** ウィンドウ操作：アクティブモニターの中央に移動するか（windowOperation専用、オプション） */
  moveToActiveMonitorCenter?: boolean;
  /** ウィンドウ操作：全仮想デスクトップにピン止めするか（windowOperation専用、オプション） */
  pinToAllDesktops?: boolean;
  /** グループ内のアイテム名リスト（group専用） */
  itemNames?: string[];
  /** クリップボードデータファイルへの参照（clipboard専用） */
  clipboardDataRef?: string;
  /** クリップボードの保存フォーマット（clipboard専用） */
  clipboardFormats?: ClipboardFormat[];
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

/**
 * アーカイブされたワークスペースグループ
 * WorkspaceGroupを拡張し、アーカイブ関連の情報を追加
 */
export interface ArchivedWorkspaceGroup extends WorkspaceGroup {
  /** アーカイブ日時（timestamp） */
  archivedAt: number;
  /** アーカイブ前のorder（復元時の参考用） */
  originalOrder: number;
  /** アーカイブ時のアイテム数（表示用） */
  itemCount: number;
}

/**
 * アーカイブされたワークスペースアイテム
 * WorkspaceItemを拡張し、アーカイブ関連の情報を追加
 */
export interface ArchivedWorkspaceItem extends WorkspaceItem {
  /** アーカイブ日時（timestamp） */
  archivedAt: number;
  /** アーカイブグループID（どのグループと一緒にアーカイブされたか） */
  archivedGroupId: string;
}
