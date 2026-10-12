import { DataFileTab } from './data';
import { BookmarkAutoImportSettings } from './bookmarkAutoImport';

/**
 * ウィンドウの固定モードを表す列挙型
 * 3段階のモードを循環的に切り替え可能
 */
export type WindowPinMode =
  | 'normal' // 通常モード: フォーカスが外れたら非表示、最上面ではない
  | 'alwaysOnTop' // 常に最上面モード: 常に最上面に表示、フォーカスが外れても非表示にならない
  | 'stayVisible'; // 表示固定モード: 最上面ではないが、フォーカスが外れても非表示にならない

/**
 * ウィンドウの表示位置モードを表す列挙型
 */
export type WindowPositionMode =
  | 'center' // 画面中央に表示
  | 'cursor' // マウスカーソルの位置に表示
  | 'cursorMonitorCenter' // カーソルのモニター中央に表示
  | 'fixed'; // 固定位置に表示（手動で移動した位置を記憶）

/**
 * ワークスペースの表示位置モードを表す列挙型
 */
export type WorkspacePositionMode =
  | 'primaryLeft' // @deprecated 後方互換性のため残存。displayLeftに移行
  | 'primaryRight' // @deprecated 後方互換性のため残存。displayRightに移行
  | 'displayLeft' // 指定ディスプレイの左端に配置
  | 'displayRight' // 指定ディスプレイの右端に配置（デフォルト）
  | 'fixed'; // 固定位置に表示（手動で移動した位置を記憶）

/**
 * ディスプレイ情報を表すインターフェース
 */
export interface DisplayInfo {
  /** ディスプレイインデックス（0始まり） */
  index: number;
  /** 表示名（例: "ディスプレイ 1 (プライマリ)"） */
  label: string;
  /** プライマリディスプレイかどうか */
  isPrimary: boolean;
  /** 作業領域の幅 */
  width: number;
  /** 作業領域の高さ */
  height: number;
  /** 作業領域のX座標 */
  x: number;
  /** 作業領域のY座標 */
  y: number;
}

/** Store 版の StartupTask の状態（WinRT の StartupTaskState に対応） */
export type StoreAutoLaunchState =
  'disabled' | 'disabledByUser' | 'enabled' | 'disabledByPolicy' | 'enabledByPolicy';

/**
 * OS 側の自動起動の状態（設定画面の案内に使う）
 * - store: Store 版（MSIX）。Windows の StartupTask の状態を持つ
 * - shortcut: ポータブル版・インストーラー版（スタートアップのショートカット）
 * - unsupported: 開発モードなど
 */
export type AutoLaunchStatus =
  | { mode: 'store'; state: StoreAutoLaunchState }
  | { mode: 'shortcut'; enabled: boolean }
  | { mode: 'unsupported' };

/**
 * アプリケーションの設定を管理するインターフェース
 * electron-storeを使用して永続化される
 */
export interface AppSettings {
  /** この設定ファイルを作成したアプリバージョン（初回作成時のみ記録） */
  createdWithVersion?: string;
  /** この設定ファイルを最後に更新したアプリバージョン */
  updatedWithVersion?: string;
  /** ランチャー起動ホットキー（例: 'Alt+Space'。未設定の空文字は初回起動扱い） */
  hotkey: string;
  /** ウィンドウの初期幅（デフォルト: 600） */
  windowWidth: number;
  /** ウィンドウの初期高さ（デフォルト: 400） */
  windowHeight: number;
  /** 管理ウィンドウの幅（デフォルト: 1200） */
  editModeWidth: number;
  /** 管理ウィンドウの高さ（デフォルト: 1000） */
  editModeHeight: number;
  /** アプリの自動起動設定 */
  autoLaunch: boolean;
  /** QuickDashLauncher CLI（qdl コマンド）を PATH から使えるようにする（デフォルト: false） */
  cliEnabled: boolean;
  /** バックアップ機能の有効/無効（デフォルト: false） */
  backupEnabled: boolean;
  /** バックアップファイルの保存件数上限（デフォルト: 10） */
  backupRetention: number;
  /** タブ表示の有効/無効（デフォルト: true） */
  showDataFileTabs: boolean;
  /** デフォルトで表示するタブ（タブ表示ON時のみ有効、デフォルト: 'datafiles/data.json'） */
  defaultFileTab: string;
  /** データファイルタブの設定（ファイル名リスト、タブ名、表示順序） */
  dataFileTabs: DataFileTab[];
  /** データファイルの名前定義（物理ファイル名 → データファイル名） */
  dataFileLabels: Record<string, string>;
  /** ウィンドウ表示位置モード（デフォルト: 'cursorMonitorCenter'） */
  windowPositionMode: WindowPositionMode;
  /** 固定位置のX座標（windowPositionMode='fixed'時に使用、デフォルト: 0） */
  windowPositionX: number;
  /** 固定位置のY座標（windowPositionMode='fixed'時に使用、デフォルト: 0） */
  windowPositionY: number;
  /** ワークスペースウィンドウの不透明度（0-100%、デフォルト: 100） */
  workspaceOpacity: number;
  /** ワークスペースウィンドウの背景のみを透過（デフォルト: false） */
  workspaceBackgroundTransparent: boolean;
  /** メイン画面表示時にワークスペースを自動表示（デフォルト: false） */
  autoShowWorkspace: boolean;
  /** ワークスペースウィンドウの表示位置モード（デフォルト: 'displayRight'） */
  workspacePositionMode: WorkspacePositionMode;
  /** ワークスペースのターゲットディスプレイ番号（displayLeft/displayRight時に使用、デフォルト: 0） */
  workspaceTargetDisplayIndex: number;
  /** 固定位置のX座標（workspacePositionMode='fixed'時に使用、デフォルト: 0） */
  workspacePositionX: number;
  /** 固定位置のY座標（workspacePositionMode='fixed'時に使用、デフォルト: 0） */
  workspacePositionY: number;
  /** ワークスペースウィンドウを全仮想デスクトップに表示（デフォルト: true） */
  workspaceVisibleOnAllDesktops: boolean;
  /** 切り離しウィンドウを全仮想デスクトップに表示（デフォルト: true） */
  detachedVisibleOnAllDesktops: boolean;
  /** グループアイテムを並列起動する（デフォルト: false） */
  parallelGroupLaunch: boolean;
  /** メインウィンドウの下に、気づきにくいキー操作のヒントを表示する（デフォルト: true） */
  showKeyboardHints: boolean;
  /** ウィンドウ検索で起動のホットキー（デフォルト: 'Ctrl+Alt+Space'、空の場合は無効） */
  itemSearchHotkey: string;
  /** クリップボードデータもバックアップに含めるか（デフォルト: false） */
  backupIncludeClipboard: boolean;
  /** ブックマーク自動取込設定 */
  bookmarkAutoImport: BookmarkAutoImportSettings;
  /** メインウィンドウ非表示時に切り離しウィンドウも連動して非表示にする（デフォルト: true） */
  hideDetachedWithMainWindow: boolean;
  /** ウィンドウ吸着（モニター端へのスナップ）の有効/無効（デフォルト: true） */
  windowSnapEnabled: boolean;
}
