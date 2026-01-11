import { DataFileTab } from './data';

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
  | 'primaryLeft' // プライマリディスプレイの左端に配置
  | 'primaryRight' // プライマリディスプレイの右端に配置
  | 'fixed'; // 固定位置に表示（手動で移動した位置を記憶）

/**
 * アプリケーションの設定を管理するインターフェース
 * electron-storeを使用して永続化される
 */
export interface AppSettings {
  /** この設定ファイルを作成したアプリバージョン（初回作成時のみ記録） */
  createdWithVersion?: string;
  /** この設定ファイルを最後に更新したアプリバージョン */
  updatedWithVersion?: string;
  /** グローバルホットキー（デフォルト: 'Alt+Space'） */
  hotkey: string;
  /** ウィンドウの初期幅（デフォルト: 600） */
  windowWidth: number;
  /** ウィンドウの初期高さ（デフォルト: 400） */
  windowHeight: number;
  /** 編集モード時のウィンドウ幅（デフォルト: 1000） */
  editModeWidth: number;
  /** 編集モード時のウィンドウ高さ（デフォルト: 700） */
  editModeHeight: number;
  /** アプリの自動起動設定 */
  autoLaunch: boolean;
  /** バックアップ機能の有効/無効（デフォルト: false） */
  backupEnabled: boolean;
  /** アプリ起動時のバックアップ（デフォルト: false） */
  backupOnStart: boolean;
  /** データ編集時のバックアップ（デフォルト: false） */
  backupOnEdit: boolean;
  /** 最小バックアップ間隔（分）（デフォルト: 5） */
  backupInterval: number;
  /** バックアップファイルの保存件数上限（デフォルト: 20） */
  backupRetention: number;
  /** タブ表示の有効/無効（デフォルト: false） */
  showDataFileTabs: boolean;
  /** デフォルトで表示するタブ（タブ表示ON時のみ有効、デフォルト: 'data.txt'） */
  defaultFileTab: string;
  /** データファイルタブの設定（ファイル名リスト、タブ名、表示順序） */
  dataFileTabs: DataFileTab[];
  /** データファイルの名前定義（物理ファイル名 → データファイル名） */
  dataFileLabels: Record<string, string>;
  /** ウィンドウ表示位置モード（デフォルト: 'center'） */
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
  /** ワークスペースウィンドウの表示位置モード（デフォルト: 'primaryRight'） */
  workspacePositionMode: WorkspacePositionMode;
  /** 固定位置のX座標（workspacePositionMode='fixed'時に使用、デフォルト: 0） */
  workspacePositionX: number;
  /** 固定位置のY座標（workspacePositionMode='fixed'時に使用、デフォルト: 0） */
  workspacePositionY: number;
}
