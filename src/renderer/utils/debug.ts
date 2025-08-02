/**
 * 開発環境専用のデバッグユーティリティ
 * プロダクション環境では何も出力しない
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 開発環境でのみconsole.logを出力
 */
export const debugLog = (message: string, ...args: unknown[]): void => {
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

/**
 * 開発環境でのみconsole.infoを出力
 */
export const debugInfo = (message: string, ...args: unknown[]): void => {
  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${message}`, ...args);
  }
};

/**
 * 常にconsole.warnを出力（重要な情報）
 */
export const logWarn = (message: string, ...args: unknown[]): void => {
  console.warn(`[WARN] ${message}`, ...args);
};

/**
 * 常にconsole.errorを出力（エラー）
 */
export const logError = (message: string, ...args: unknown[]): void => {
  console.error(`[ERROR] ${message}`, ...args);
};
