/**
 * ウィンドウの状態
 */
export type WindowState = 'normal' | 'minimized' | 'maximized';

/**
 * 仮想デスクトップ情報
 */
export interface VirtualDesktopInfo {
  /** 仮想デスクトップがサポートされているか */
  supported: boolean;
  /** デスクトップ数（サポートされていない場合は-1） */
  desktopCount: number;
  /** 現在のデスクトップ番号（1から開始、サポートされていない場合は-1） */
  currentDesktop: number;
  /** デスクトップ名のマップ（キー: デスクトップ番号1-N、値: 名前またはundefined） */
  desktopNames?: Record<number, string | undefined>;
}

/**
 * ウィンドウ情報
 * ウィンドウ検索機能で取得されるウィンドウの情報
 */
export interface WindowInfo {
  /** ウィンドウハンドル */
  hwnd: number | bigint;
  /** ウィンドウタイトル */
  title: string;
  /** X座標 */
  x: number;
  /** Y座標 */
  y: number;
  /** 幅 */
  width: number;
  /** 高さ */
  height: number;
  /** プロセスID */
  processId: number;
  /** 表示状態 */
  isVisible: boolean;
  /** 実行ファイルのパス */
  executablePath?: string;
  /** プロセス名（実行ファイル名） */
  processName?: string;
  /** ウィンドウの状態 */
  windowState?: WindowState;
  /** アイコン（base64エンコードされたデータURL） */
  icon?: string;
  /** 仮想デスクトップ番号（1から開始、取得できない場合は-1） */
  desktopNumber?: number;
  /** 全ての仮想デスクトップにピン止めされているか */
  isPinned?: boolean;
}
