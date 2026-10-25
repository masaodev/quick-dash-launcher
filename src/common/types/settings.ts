import type { LanguageSetting } from '../i18n/languages';

import { DataFileTab } from './data';
import { BookmarkAutoImportSettings } from './bookmarkAutoImport';

/**
 * ウィンドウの固定モードを表す列挙型
 * 3段階のモードを循環的に切り替え可能
 */
export type WindowPinMode =
  | 'normal' // 通常モード: フォーカスが外れたら非表示、最上面ではない
  | 'alwaysOnTop' // 常に最前面モード: 常に最前面に表示、フォーカスが外れても非表示にならない
  | 'stayVisible'; // 表示固定モード: 最上面ではないが、フォーカスが外れても非表示にならない

/**
 * ピン留めの段階（メイン・ワークスペース・切り離しで共通）
 * 0=なし、1=表示固定（隠さずに残す）、2=常に最前面（表示固定に加えて、ほかのウィンドウより前面）
 * 📌 のクリックは 0 と 1 の切り替え（2 のときは 0 に戻す）、2 は右クリックのメニューで選ぶ
 */
export type PinLevel = 0 | 1 | 2;

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

/** workspaceTargetDisplayIndex で「メインウィンドウと同じディスプレイ」を指す値 */
export const MAIN_WINDOW_DISPLAY_INDEX = -1;

/** 固定位置で最後に置いた場所（ウィンドウの左上の画面座標） */
export interface FixedPosition {
  x: number;
  y: number;
}

/**
 * 切り離しウィンドウの表示位置モード
 */
export type DetachedPositionMode =
  | 'saved' // 置いた場所に表示する
  | 'mainDisplay'; // メインウィンドウと一緒に出すとき、メインウィンドウと同じディスプレイの同じ位置に表示する（既定）

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
 * アイテム管理の一覧の列の表示と幅（列の id ごと。書かれていない列は既定のまま）
 */
export interface AdminItemColumnsSetting {
  /** 列を出すか（true=出す、false=隠す） */
  visible: Record<string, boolean>;
  /** ドラッグで変えた列の幅（px） */
  widths: Record<string, number>;
}

/**
 * アプリケーションの設定を管理するインターフェース
 * electron-storeを使用して永続化される
 */
export interface AppSettings {
  /** この設定ファイルを作成したアプリバージョン（初回作成時のみ記録） */
  createdWithVersion?: string;
  /** この設定ファイルを最後に更新したアプリバージョン */
  updatedWithVersion?: string;
  /** 表示言語（auto は Windows の表示言語に合わせる。デフォルト: 'auto'） */
  language: LanguageSetting;
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
  /** 固定位置で最後に置いた場所（windowPositionMode='fixed'時に使用。null＝まだ置いていない、デフォルト: null） */
  windowFixedPosition: FixedPosition | null;
  /** ワークスペースウィンドウの不透明度（0-100%、デフォルト: 100） */
  workspaceOpacity: number;
  /** ワークスペースウィンドウ・切り離しウィンドウの背景だけを透明にする（デフォルト: false。オンの間は workspaceOpacity を使わない） */
  workspaceBackgroundTransparent: boolean;
  /** ワークスペースウィンドウの表示位置モード（デフォルト: 'displayRight'） */
  workspacePositionMode: WorkspacePositionMode;
  /** ワークスペースのターゲットディスプレイ番号（displayLeft/displayRight時に使用、-1＝メインウィンドウと同じディスプレイ、デフォルト: -1） */
  workspaceTargetDisplayIndex: number;
  /** 固定位置で最後に置いた場所（workspacePositionMode='fixed'時に使用。null＝まだ置いていない、デフォルト: null） */
  workspaceFixedPosition: FixedPosition | null;
  /** ワークスペースウィンドウを全仮想デスクトップに表示（デフォルト: true） */
  workspaceVisibleOnAllDesktops: boolean;
  /** 切り離しウィンドウを全仮想デスクトップに表示（デフォルト: true） */
  detachedVisibleOnAllDesktops: boolean;
  /** メインウィンドウの下に、気づきにくいキー操作のヒントを表示する（デフォルト: true） */
  showKeyboardHints: boolean;
  /** メインウィンドウの検索で、表示名に加えてメモにも当てる（デフォルト: false） */
  searchMemo: boolean;
  /** ウィンドウ検索で起動のホットキー（デフォルト: 'Ctrl+Alt+Space'、空の場合は無効） */
  itemSearchHotkey: string;
  /** クリップボードデータもバックアップに含めるか（デフォルト: false） */
  backupIncludeClipboard: boolean;
  /** ブックマーク自動取込設定 */
  bookmarkAutoImport: BookmarkAutoImportSettings;
  /** 切り離しウィンドウの表示位置モード（デフォルト: 'mainDisplay'） */
  detachedPositionMode: DetachedPositionMode;
  /** ディスプレイの端に近づけたら吸着する（デフォルト: true） */
  windowSnapEnabled: boolean;
  /** アイテムを起動した記録（最終起動・起動回数）を残す（デフォルト: true。手元の item-usage.json にだけ書く） */
  recordLaunchUsage: boolean;
  /** アイテム管理の一覧の列の表示と幅（デフォルト: すべて既定） */
  adminItemColumns: AdminItemColumnsSetting;
}
