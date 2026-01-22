/**
 * アイコン処理結果の詳細情報
 */
export interface IconProgressResult {
  /** アイテム名またはURL */
  itemName: string;
  /** 成功したかどうか */
  success: boolean;
  /** エラーメッセージ（失敗時のみ） */
  errorMessage?: string;
  /** 処理の種別（ファビコン取得またはアイコン抽出） */
  type: 'favicon' | 'icon';
}

/**
 * 単一フェーズの進捗情報
 */
export interface IconPhaseProgress {
  /** 処理の種別（ファビコン取得またはアイコン抽出） */
  type: 'favicon' | 'icon';
  /** 現在処理完了したアイテム数 */
  current: number;
  /** 処理対象の総アイテム数 */
  total: number;
  /** 現在処理中のアイテム名またはURL */
  currentItem: string;
  /** エラーが発生したアイテム数 */
  errors: number;
  /** 処理開始時刻（ミリ秒） */
  startTime: number;
  /** 処理が完了したかどうか */
  isComplete: boolean;
  /** 処理結果の詳細リスト */
  results?: IconProgressResult[];
}

/**
 * アイコン取得処理の統合進捗状況を表すインターフェース
 * 複数フェーズ（ファビコン取得 + アイコン抽出）の進捗を一括管理する
 */
export interface IconProgress {
  /** 現在のフェーズ番号（1から開始） */
  currentPhase: number;
  /** 総フェーズ数 */
  totalPhases: number;
  /** 各フェーズの進捗情報 */
  phases: IconPhaseProgress[];
  /** 全体の処理が完了したかどうか */
  isComplete: boolean;
  /** 全体の処理開始時刻（ミリ秒） */
  startTime: number;
  /** 全体の処理完了時刻（ミリ秒、完了時のみ設定） */
  completedTime?: number;
}

/**
 * アイコン取得進捗状態の管理用インターフェース
 * React コンポーネント内での状態管理に使用される
 */
export interface IconProgressState {
  /** 進捗処理がアクティブかどうか */
  isActive: boolean;
  /** 現在の進捗情報 */
  progress: IconProgress | null;
}

/**
 * アイコン取得エラー記録
 * エラーになったアイテムを記録し、次回の取得時にスキップするために使用
 */
export interface IconFetchErrorRecord {
  /** 識別キー（URL または ファイルパス） */
  key: string;
  /** 取得タイプ（ファビコンまたはアイコン） */
  type: 'favicon' | 'icon';
  /** エラーメッセージ */
  errorMessage: string;
  /** エラー発生時刻（ミリ秒） */
  errorAt: number;
  /** 失敗回数 */
  failCount: number;
}
