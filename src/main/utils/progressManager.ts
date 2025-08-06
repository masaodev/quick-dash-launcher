import { BrowserWindow } from 'electron';
import { IconProgress } from '@common/types';

/**
 * 進捗報告機能の共通クラス
 * アイコン取得やファビコン取得など、時間のかかる処理の進捗状況を
 * レンダラープロセスに通知するための統一インターフェース
 */
export class ProgressManager {
  private current = 0;
  private errors = 0;
  private readonly startTime: number;

  constructor(
    private type: 'favicon' | 'icon',
    private total: number,
    private mainWindow: BrowserWindow | null
  ) {
    this.startTime = Date.now();
  }

  /**
   * 進捗開始を通知
   */
  start(): void {
    this.sendProgressUpdate('start', {
      type: this.type,
      current: 0,
      total: this.total,
      currentItem: '',
      errors: 0,
      startTime: this.startTime,
      isComplete: false,
    });
  }

  /**
   * 進捗更新を通知
   * @param currentItem - 現在処理中のアイテム名
   * @param incrementErrors - エラーカウントを増加させるかどうか
   */
  update(currentItem: string, incrementErrors = false): void {
    if (incrementErrors) {
      this.errors++;
    }

    this.sendProgressUpdate('update', {
      type: this.type,
      current: this.current,
      total: this.total,
      currentItem,
      errors: this.errors,
      startTime: this.startTime,
      isComplete: false,
    });

    this.current++;
  }

  /**
   * 進捗完了を通知
   */
  complete(): void {
    this.sendProgressUpdate('complete', {
      type: this.type,
      current: this.current,
      total: this.total,
      currentItem: '',
      errors: this.errors,
      startTime: this.startTime,
      isComplete: true,
    });
  }

  /**
   * 進捗状況をレンダラープロセスに送信する
   * @private
   */
  private sendProgressUpdate(
    eventType: 'start' | 'update' | 'complete',
    progress: IconProgress
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
