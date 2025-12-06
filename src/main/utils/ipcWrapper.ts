import { ipcMain } from 'electron';
import logger from '@common/logger';

/**
 * エラーハンドリング付きIPCハンドラーを作成するユーティリティ関数
 * 全てのIPCハンドラーで共通のエラーハンドリングパターンを統一し、
 * ログ出力とエラー処理を標準化する
 */
export function createSafeIpcHandler<T extends unknown[], R>(
  channel: string,
  handler: (...args: T) => Promise<R>,
  loggerContext: string
): void {
  ipcMain.handle(channel, async (_event, ...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error({ channel, error }, `${loggerContext}に失敗`);
      throw error;
    }
  });
}

/**
 * 同期的なハンドラー用のラッパー関数
 * 同期処理にも対応したエラーハンドリング
 */
export function createSafeIpcHandlerSync<T extends unknown[], R>(
  channel: string,
  handler: (...args: T) => R,
  loggerContext: string
): void {
  ipcMain.handle(channel, async (_event, ...args: T) => {
    try {
      return handler(...args);
    } catch (error) {
      logger.error({ channel, error }, `${loggerContext}に失敗`);
      throw error;
    }
  });
}
