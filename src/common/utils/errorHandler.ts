/**
 * 共通エラーハンドリングユーティリティ
 *
 * アプリケーション全体で統一されたエラーハンドリングを提供します。
 */

import logger from '@common/logger';

/**
 * 非同期操作のエラーハンドリングラッパー
 *
 * @param operation - 実行する非同期操作
 * @param errorMessage - エラー発生時のメッセージ
 * @param onError - エラー発生時の追加処理（オプション）
 * @returns 操作の結果、エラー時はnull
 *
 * @example
 * ```typescript
 * const result = await handleAsyncError(
 *   () => window.electronAPI.fetchFavicon(url),
 *   'ファビコン取得エラー'
 * );
 * if (result) {
 *   // 成功時の処理
 * }
 * ```
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  onError?: (error: Error) => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    logger.error({ err: error }, errorMessage);
    if (onError && error instanceof Error) {
      onError(error);
    }
    return null;
  }
}

/**
 * 同期操作のエラーハンドリングラッパー
 *
 * @param operation - 実行する同期操作
 * @param errorMessage - エラー発生時のメッセージ
 * @param onError - エラー発生時の追加処理（オプション）
 * @returns 操作の結果、エラー時はnull
 *
 * @example
 * ```typescript
 * const result = handleSyncError(
 *   () => JSON.parse(data),
 *   'JSONパースエラー'
 * );
 * ```
 */
export function handleSyncError<T>(
  operation: () => T,
  errorMessage: string,
  onError?: (error: Error) => void
): T | null {
  try {
    return operation();
  } catch (error) {
    logger.error({ err: error }, errorMessage);
    if (onError && error instanceof Error) {
      onError(error);
    }
    return null;
  }
}

/**
 * エラーログのみ記録（処理は継続）
 *
 * @param error - エラーオブジェクト
 * @param context - エラーコンテキスト
 *
 * @example
 * ```typescript
 * logError(error, 'データ保存中');
 * ```
 */
export function logError(error: unknown, context: string): void {
  logger.error({ err: error }, context);
}

/**
 * Renderer専用：デバッグログとしてエラーを出力
 * （本番環境ではコンソールに出力されない）
 */
export function debugError(message: string, error?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[DEBUG] ${message}`, error);
  }
}

/**
 * Renderer専用：デバッグログとして情報を出力
 * （本番環境ではコンソールに出力されない）
 */
export function debugLog(message: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`, ...args);
  }
}
