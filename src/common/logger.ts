import pino from 'pino';

// 開発環境かどうかを判定
const isDevelopment = process.env.NODE_ENV === 'development';

// ログレベルの設定
const logLevel = isDevelopment ? 'debug' : 'info';

// Pinoロガーの設定
const logger = pino({
  name: 'QuickDashLauncher',
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  // Electronのメインプロセスではworkerベースのtransportを避ける
  // 代わりにシンプルなコンソール出力を使用
});

export default logger;

// 便利なヘルパー関数
export const createChildLogger = (context: string) => {
  return logger.child({ context });
};

// 主要なコンテキスト用のロガー
export const iconLogger = createChildLogger('icon');
export const dataLogger = createChildLogger('data');
export const windowLogger = createChildLogger('window');
export const ipcLogger = createChildLogger('ipc');
export const faviconLogger = createChildLogger('favicon');
export const editLogger = createChildLogger('edit');
export const itemLogger = createChildLogger('item');
