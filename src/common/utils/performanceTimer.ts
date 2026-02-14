/**
 * パフォーマンス計測用のタイマークラス
 * 開始時刻から各ステップまでの経過時間を計測してログに出力する
 */
export class PerformanceTimer {
  private startTime: number | undefined;
  private logger?: (message: string) => void;

  /**
   * @param startTime 開始時刻（Date.now()の値）
   * @param logger ログ出力関数（省略時は何もしない）
   */
  constructor(startTime?: number, logger?: (message: string) => void) {
    this.startTime = startTime;
    this.logger = logger;
  }

  /**
   * 現在までの経過時間をログに出力
   * @param label ログラベル
   */
  log(label: string): void {
    if (this.startTime !== undefined && this.logger) {
      const duration = Date.now() - this.startTime;
      this.logger(`[Performance] ${label}: ${duration}ms`);
    }
  }

  /**
   * 計測が有効かどうかを返す
   */
  isEnabled(): boolean {
    return this.startTime !== undefined;
  }

  /**
   * 開始時刻を取得
   */
  getStartTime(): number | undefined {
    return this.startTime;
  }
}
