/**
 * アプリインポート機能で使用される型定義
 * スタートメニューからスキャンされたアプリケーション情報を表す
 */

/** ターゲットファイルの種別 */
export type AppTargetType = 'app' | 'other';

/** スキャンされたアプリケーションアイテム */
export interface ScannedAppItem {
  /** 一意識別子 */
  id: string;
  /** 表示名（.lnkファイル名から拡張子を除いたもの） */
  displayName: string;
  /** .lnkファイルのパス */
  shortcutPath: string;
  /** ターゲット（解決先）のパス */
  targetPath: string;
  /** コマンドライン引数 */
  args?: string;
  /** 選択状態 */
  checked: boolean;
  /** ターゲットファイルの種別 */
  targetType: AppTargetType;
  /** ターゲットファイルの拡張子 */
  targetExtension: string;
}

/** アプリスキャン結果 */
export interface AppScanResult {
  /** スキャンされたアプリケーション一覧 */
  apps: ScannedAppItem[];
  /** スキャン所要時間（ms） */
  scanDuration: number;
}
