import { BrowserWindow } from 'electron';
import { IconProgress, IconPhaseProgress, IconProgressResult } from '@common/types';

/**
 * 進捗報告機能の共通クラス
 * アイコン取得やファビコン取得など、時間のかかる処理の進捗状況を
 * レンダラープロセスに通知するための統一インターフェース
 */
export class ProgressManager {
  private current = 0;
  private errors = 0;
  private readonly startTime: number;
  private results: IconProgressResult[] = [];

  constructor(
    private type: 'favicon' | 'icon',
    private total: number,
    private mainWindow: BrowserWindow | null
  ) {
    this.startTime = Date.now();
  }

  private buildProgress(currentItem: string, isComplete: boolean): IconPhaseProgress {
    return {
      type: this.type,
      current: this.current,
      total: this.total,
      currentItem,
      errors: this.errors,
      startTime: this.startTime,
      isComplete,
      results: this.results,
    };
  }

  start(): void {
    this.results = [];
    this.sendProgressUpdate('start', this.buildProgress('', false));
  }

  update(currentItem: string, incrementErrors = false, errorMessage?: string): void {
    if (incrementErrors) {
      this.errors++;
    }

    this.results.push({
      itemName: currentItem,
      success: !incrementErrors,
      errorMessage: incrementErrors ? errorMessage : undefined,
      type: this.type,
    });

    this.sendProgressUpdate('update', this.buildProgress(currentItem, false));
    this.current++;
  }

  complete(): void {
    this.sendProgressUpdate('complete', this.buildProgress('', true));
  }

  /**
   * 進捗状況をレンダラープロセスに送信する
   * @private
   */
  private sendProgressUpdate(
    eventType: 'start' | 'update' | 'complete',
    progress: IconPhaseProgress
  ): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(`icon-progress-${eventType}`, progress);
    }
  }

  /**
   * 現在の進捗カウントを取得
   */
  getCurrentCount(): number {
    return this.current;
  }

  /**
   * エラー数を取得
   */
  getErrorCount(): number {
    return this.errors;
  }
}

/**
 * 統合進捗管理クラス
 * 複数のフェーズ（ファビコン取得 + アイコン抽出）を統合して管理する
 */
export class CombinedProgressManager {
  private phases: IconPhaseProgress[] = [];
  private currentPhaseIndex = 0;
  private readonly globalStartTime: number;

  constructor(
    private phaseTypes: ('favicon' | 'icon')[],
    private phaseTotals: number[],
    private mainWindow: BrowserWindow | null
  ) {
    if (phaseTypes.length !== phaseTotals.length) {
      throw new Error('phaseTypes と phaseTotals の長さが一致しません');
    }
    this.globalStartTime = Date.now();
  }

  /**
   * 統合進捗開始を通知
   */
  start(): void {
    // 各フェーズの初期状態を作成
    this.phases = this.phaseTypes.map((type, index) => ({
      type,
      current: 0,
      total: this.phaseTotals[index],
      currentItem: '',
      errors: 0,
      startTime: 0, // フェーズ開始時に設定
      isComplete: false,
      results: [],
    }));

    // 最初のフェーズを開始
    if (this.phases.length > 0) {
      this.phases[0].startTime = Date.now();
    }

    this.sendCombinedProgress();
  }

  /**
   * 現在のフェーズの進捗更新を通知
   * @param currentItem - 現在処理中のアイテム名
   * @param incrementErrors - エラーカウントを増加させるかどうか
   * @param errorMessage - エラーメッセージ（エラー時のみ）
   */
  update(currentItem: string, incrementErrors = false, errorMessage?: string): void {
    if (this.currentPhaseIndex >= this.phases.length) {
      return; // すでに全フェーズ完了
    }

    const currentPhase = this.phases[this.currentPhaseIndex];

    if (incrementErrors) {
      currentPhase.errors++;
    }

    // 結果を記録
    if (!currentPhase.results) {
      currentPhase.results = [];
    }
    currentPhase.results.push({
      itemName: currentItem,
      success: !incrementErrors,
      errorMessage: incrementErrors ? errorMessage : undefined,
      type: currentPhase.type,
    });

    currentPhase.currentItem = currentItem;
    currentPhase.current++;

    this.sendCombinedProgress();
  }

  /**
   * 現在のフェーズを完了して次のフェーズに進む
   */
  completePhase(): void {
    if (this.currentPhaseIndex >= this.phases.length) {
      return;
    }

    // 現在のフェーズを完了にマーク
    this.phases[this.currentPhaseIndex].isComplete = true;
    this.phases[this.currentPhaseIndex].currentItem = '';

    // 次のフェーズに進む
    this.currentPhaseIndex++;

    // 次のフェーズがあれば開始時刻を設定
    if (this.currentPhaseIndex < this.phases.length) {
      this.phases[this.currentPhaseIndex].startTime = Date.now();
    }

    this.sendCombinedProgress();
  }

  /**
   * すべてのフェーズを完了
   */
  completeAll(): void {
    // すべてのフェーズを完了にマーク
    this.phases.forEach((phase) => {
      phase.isComplete = true;
      phase.currentItem = '';
    });

    this.currentPhaseIndex = this.phases.length;

    this.sendCombinedProgress(true, Date.now());
  }

  /**
   * 統合進捗状況をレンダラープロセスに送信する
   * @private
   */
  private sendCombinedProgress(isComplete = false, completedTime?: number): void {
    if (!this.mainWindow) {
      return;
    }

    const progress: IconProgress = {
      currentPhase: this.currentPhaseIndex + 1,
      totalPhases: this.phases.length,
      phases: this.phases,
      isComplete: isComplete || this.currentPhaseIndex >= this.phases.length,
      startTime: this.globalStartTime,
      completedTime: completedTime,
    };

    const eventType = progress.isComplete
      ? 'complete'
      : this.currentPhaseIndex === 0 && this.phases[0].current === 0
        ? 'start'
        : 'update';

    this.mainWindow.webContents.send(`icon-progress-${eventType}`, progress);
  }

  /**
   * 現在のフェーズのインデックスを取得
   */
  getCurrentPhaseIndex(): number {
    return this.currentPhaseIndex;
  }

  /**
   * 現在のフェーズの進捗カウントを取得
   */
  getCurrentPhaseCount(): number {
    if (this.currentPhaseIndex >= this.phases.length) {
      return 0;
    }
    return this.phases[this.currentPhaseIndex].current;
  }

  /**
   * 現在のフェーズのエラー数を取得
   */
  getCurrentPhaseErrorCount(): number {
    if (this.currentPhaseIndex >= this.phases.length) {
      return 0;
    }
    return this.phases[this.currentPhaseIndex].errors;
  }
}
