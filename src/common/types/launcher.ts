import { WindowInfo } from './window';
import type { ClipboardFormat } from './clipboard';
import type { DirOptionsForProcessing } from './json-data';

/**
 * ウィンドウ制御の設定情報
 * ウィンドウ操作アイテムの実行と、ウィンドウを探して位置・サイズを当てる処理（windowActivator）の内部で使う。
 * 単一アイテムの保存形式では使わない（旧形式の windowConfig。読み込み時に ItemWindowSwitch に変換する）
 *
 * ワイルドカード検索:
 * - タイトルにワイルドカード文字（*または?）が含まれている場合、ワイルドカードマッチングを実行
 *   - `*`: 任意の0文字以上の文字列
 *   - `?`: 任意の1文字
 * - ワイルドカード文字が含まれていない場合、完全一致検索を実行
 * - 大文字小文字は区別しない
 */
export interface WindowConfig {
  /** ウィンドウタイトル（検索用、必須） */
  title: string;
  /** プロセス名で検索（部分一致、省略時は検索なし） */
  processName?: string;
  /** X座標（仮想スクリーン座標系、省略時は位置変更なし） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、省略時は位置変更なし） */
  y?: number;
  /** 幅（省略時はサイズ変更なし） */
  width?: number;
  /** 高さ（省略時はサイズ変更なし） */
  height?: number;
  /** アクティブモニター（マウスカーソルがあるモニター）の中央に移動するかどうか（省略時はfalse） */
  moveToActiveMonitorCenter?: boolean;
  /** 仮想デスクトップ番号（1から開始、省略時は移動なし、Windows 10以降） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするかどうか（省略時はtrue） */
  activateWindow?: boolean;
  /** 全仮想デスクトップにピン止めするかどうか（省略時はfalse） */
  pinToAllDesktops?: boolean;
}

/**
 * 単一アイテムのウィンドウ切り替え（セットの行と同じ形・同じ実行処理）
 *
 * window があれば、開く前にそのウィンドウを探し、見つかれば前面に出す（placement があれば位置を合わせる）。
 * 見つからなければ開く（placement があれば、出てくるのを待って位置を合わせる）。
 * 旧形式の windowConfig は読み込み時にこの形に変換する（itemWindowConversion.ts）
 */
export interface ItemWindowSwitch {
  /** 探すウィンドウ（無ければウィンドウ切り替えをしない） */
  window?: SetWindowMatch;
  /** 位置。無ければ見つかったウィンドウを前面に出すだけ（開いたウィンドウは動かさない） */
  placement?: SetPlacement;
  /** ウィンドウが開いていたとき: move＝開き直さず前面に出す（既定）／openNew＝もう 1 つ開く */
  ifOpen?: 'move' | 'openNew';
  /** 見つけたウィンドウを前面に出すか（既定 true。セットの行と既定が違う） */
  activateWindow?: boolean;
  /** 開いてからウィンドウが出るのを待つ秒数（位置があるときだけ使う。既定 30） */
  waitSeconds?: number;
  /** 全仮想デスクトップにピン止めするか（既定 false） */
  pinToAllDesktops?: boolean;
}

/**
 * ランチャーアプリケーションで表示・実行されるアイテムの基本インターフェース
 * ファイル、アプリケーション、URL、フォルダなど様々なタイプのアイテムに対応
 */
export interface LauncherItem extends ItemWindowSwitch {
  /** アイテムの表示名 */
  displayName: string;
  /** アイテムのパス、URL、またはコマンド */
  path: string;
  /** アイテムのタイプ（URL、ファイル、フォルダ、アプリケーション、カスタムURI、クリップボード） */
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard';
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
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** フォルダ取込アイテムによって展開されたアイテムかどうか */
  isDirExpanded?: boolean;
  /** フォルダ取込アイテムから展開された場合の元ディレクトリパス */
  expandedFrom?: string;
  /** フォルダ取込アイテムから展開された場合の取込の設定（ツールチップと、展開元の編集に使う） */
  expandedOptions?: DirOptionsForProcessing;
  /** フォルダ取込アイテムから展開された場合の元のdirディレクティブID */
  expandedFromId?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** 自由記述メモ（オプション） */
  memo?: string;
  /** 自動取込ルールのID（このフィールドがあるアイテムは自動管理対象） */
  autoImportRuleId?: string;
  /** クリップボードデータファイルへの参照（クリップボードアイテムのみ） */
  clipboardDataRef?: string;
  /** クリップボードの保存フォーマット（クリップボードアイテムのみ） */
  clipboardFormats?: ClipboardFormat[];
  /** クリップボードの保存日時（クリップボードアイテムのみ） */
  clipboardSavedAt?: number;
}

/**
 * ウィンドウ操作アイテム
 * 既存のウィンドウを検索・アクティブ化し、位置・サイズを制御する
 *
 * ワイルドカード検索:
 * - windowTitleにワイルドカード文字（*または?）が含まれている場合、ワイルドカードマッチングを実行
 *   - `*`: 任意の0文字以上の文字列
 *   - `?`: 任意の1文字
 * - ワイルドカード文字が含まれていない場合、完全一致検索を実行
 * - 大文字小文字は区別しない
 */
export interface WindowItem {
  /** アイテムタイプ（常に'window'） */
  type: 'window';
  /** アイテムリストでの表示名 */
  displayName: string;
  /** ウィンドウタイトル（検索用、必須） */
  windowTitle: string;
  /** プロセス名で検索（部分一致、省略時は検索なし） */
  processName?: string;
  /** X座標（仮想スクリーン座標系、省略時は位置変更なし） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、省略時は位置変更なし） */
  y?: number;
  /** 幅（省略時はサイズ変更なし） */
  width?: number;
  /** 高さ（省略時はサイズ変更なし） */
  height?: number;
  /** アクティブモニター（マウスカーソルがあるモニター）の中央に移動するかどうか（省略時はfalse） */
  moveToActiveMonitorCenter?: boolean;
  /** 仮想デスクトップ番号（1から開始、省略時は移動なし、Windows 10以降） */
  virtualDesktopNumber?: number;
  /** ウィンドウをアクティブにするかどうか（省略時はtrue） */
  activateWindow?: boolean;
  /** 全仮想デスクトップにピン止めするかどうか（省略時はfalse） */
  pinToAllDesktops?: boolean;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** 自由記述メモ（オプション） */
  memo?: string;
}

/**
 * IDベースで window アイテムを更新するときの設定値
 */
export type WindowItemConfig = Pick<
  WindowItem,
  | 'displayName'
  | 'windowTitle'
  | 'processName'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'moveToActiveMonitorCenter'
  | 'virtualDesktopNumber'
  | 'activateWindow'
  | 'pinToAllDesktops'
>;

/**
 * クリップボードアイテム
 * クリップボードの内容を保存し、後から復元できる
 */
export interface ClipboardItem {
  /** アイテムタイプ（常に'clipboard'） */
  type: 'clipboard';
  /** アイテムリストでの表示名 */
  displayName: string;
  /** クリップボードデータファイルへの参照（clipboard-data/{id}.json） */
  clipboardDataRef: string;
  /** 保存日時（timestamp） */
  savedAt: number;
  /** プレビューテキスト（最初の100文字程度） */
  preview?: string;
  /** 保存されているフォーマット */
  formats: ClipboardFormat[];
  /** カスタムアイコンのファイル名（オプション） */
  customIcon?: string;
  /** 表示用のアイコン（customIcon から読んだ base64 データ URL。実行時のみで保存しない） */
  icon?: string;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** 自由記述メモ（オプション） */
  memo?: string;
}

/**
 * 旧形式のウィンドウ配置（レイアウト）の 1 ウィンドウ分（読み込み時にセットの行に変換する）
 */
export interface LayoutWindowEntry {
  /** ウィンドウタイトル（検索用） */
  windowTitle: string;
  /** プロセス名（部分一致検索用、オプション） */
  processName?: string;
  /** 実行ファイルのパス（アプリ起動用、オプション） */
  executablePath?: string;
  /** コマンドライン引数（オプション） */
  args?: string;
  /** X座標（仮想スクリーン座標系、オプション） */
  x?: number;
  /** Y座標（仮想スクリーン座標系、オプション） */
  y?: number;
  /** 幅（オプション） */
  width?: number;
  /** 高さ（オプション） */
  height?: number;
  /** 仮想デスクトップ番号（1から開始、オプション） */
  virtualDesktopNumber?: number;
  /** アプリを起動するかどうか（falseの場合は既存ウィンドウの位置変更のみ） */
  launchApp: boolean;
  /** アイコン（base64エンコードされたデータURL、オプション） */
  icon?: string;
}

/** LayoutWindowEntry から icon を除いた型（JSON保存用） */
export type LayoutWindowEntryWithoutIcon = Omit<LayoutWindowEntry, 'icon'>;

// レイアウト実行の進捗型
/** skipped: 動かすだけの行で、ウィンドウが開いていなかったので何もしなかった（失敗とは数えない） */
export type LayoutEntryStatus = 'waiting' | 'launching' | 'success' | 'failed' | 'skipped';

export interface LayoutEntryProgress {
  index: number;
  windowTitle: string;
  processName?: string;
  icon?: string;
  status: LayoutEntryStatus;
  errorMessage?: string;
}

export interface LayoutExecutionProgress {
  layoutName: string;
  entries: LayoutEntryProgress[];
  isComplete: boolean;
  isCancelled: boolean;
}

/**
 * セットの行の「動かすウィンドウ」。どのウィンドウをこの行のウィンドウとみなすか
 *
 * 結び付けた相手の hwnd は開き直すたびに変わるので持たず、次にどう探すかだけを持つ
 */
export interface SetWindowMatch {
  /** exe のファイル名（部分一致。例: WindowsTerminal.exe） */
  processName?: string;
  /** ウィンドウタイトル（ワイルドカード可）。省略時はプロセス名だけで探す */
  title?: string;
}

/** セットの行の「位置」 */
export interface SetPlacement {
  /** X座標（仮想スクリーン座標系） */
  x?: number;
  /** Y座標（仮想スクリーン座標系） */
  y?: number;
  /** 幅 */
  width?: number;
  /** 高さ */
  height?: number;
  /** 仮想デスクトップ番号（1から開始） */
  virtualDesktopNumber?: number;
  /** 最大化して置くとき 'maximized'（通常の大きさなら省略） */
  state?: 'maximized';
}

/** セットの行の中だけで持つ「開くもの」 */
export interface SetOpenTarget {
  /** ファイル・フォルダ・exe・URL・カスタム URI */
  path: string;
  /** コマンドライン引数 */
  args?: string;
}

/** セットの行。開くもの（itemId か open）・動かすウィンドウ・位置を持つ */
export interface SetEntry {
  /** 登録済みのアイテムの id（どのデータファイルのアイテムでもよい） */
  itemId?: string;
  /** この行の中だけで持つ開くもの（itemId と同時には持たない） */
  open?: SetOpenTarget;
  /** 行の名前。open の行や、指すアイテムが見つからない行の表示に使う */
  label?: string;
  /** 動かすウィンドウ */
  window?: SetWindowMatch;
  /** 位置。無ければ開くだけ */
  placement?: SetPlacement;
  /** ウィンドウが開いていたとき: move＝開き直さず位置だけ合わせる（既定）／openNew＝もう 1 つ開く */
  ifOpen?: 'move' | 'openNew';
  /** 置いたウィンドウを前面に出すか（既定 false＝出さない） */
  activateWindow?: boolean;
  /** 開いてからウィンドウが出るのを待つ秒数（既定 30） */
  waitSeconds?: number;
}

/** セットの開き方: sequential＝順番に（既定）／parallel＝同時に */
export type SetLaunchMode = 'sequential' | 'parallel';

/**
 * セットアイテム
 * 複数のアイテムをまとめて開き、必要なら決まった位置に並べる（グループとウィンドウ配置を統合した種別）
 */
export interface SetItem {
  /** アイテムタイプ（常に'set'） */
  type: 'set';
  /** セットの表示名 */
  displayName: string;
  /** 行の一覧（上から順に開く） */
  entries: SetEntry[];
  /** 開き方（省略時は順番に） */
  launchMode?: SetLaunchMode;
  /** カスタムアイコンのファイル名（オプション） */
  customIcon?: string;
  /** 表示用のアイコン（customIcon から読んだ base64 データ URL。実行時のみで保存しない） */
  icon?: string;
  /** 元のデータファイル */
  sourceFile?: string;
  /** データファイル内の行番号（編集機能で使用、非推奨：IDベースアクセスを推奨） */
  lineNumber?: number;
  /** JSONアイテムのID（JSON形式の場合） */
  id?: string;
  /** 編集モードで変更されたかどうか */
  isEdited?: boolean;
  /** 自由記述メモ（オプション） */
  memo?: string;
}

/** ID でセットを更新するときの設定値 */
export type SetItemFields = Pick<SetItem, 'displayName' | 'entries' | 'launchMode' | 'customIcon'>;

/**
 * アプリケーションで扱うすべてのアイテムの統合型
 * 通常のLauncherItem、WindowItem、ClipboardItem、SetItem、WindowInfo（ウィンドウ検索結果）を扱える
 */
export type AppItem = LauncherItem | WindowItem | ClipboardItem | SetItem | WindowInfo;
