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
  /** アイコン（base64エンコードされたデータURL） */
  icon?: string;
}
