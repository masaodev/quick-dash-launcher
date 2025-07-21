import pino from 'pino';
import util from 'util';

// 開発環境かどうかを判定
const isDevelopment = process.env.NODE_ENV === 'development';

// ログレベルの設定
const logLevel = isDevelopment ? 'debug' : 'info';

// Electronメインプロセス用の安全なシリアライゼーション関数
const safeStringify = (obj: any, space?: number): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
        code: (value as any).code,
        errno: (value as any).errno,
        syscall: (value as any).syscall,
        path: (value as any).path,
      };
    }
    if (typeof value === 'function') {
      return '[Function]';
    }
    if (typeof value === 'undefined') {
      return '[Undefined]';
    }
    return value;
  }, space);
};

// Electronメインプロセス向けのPino設定
const logger = pino({
  name: 'QuickDashLauncher',
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  // Electronメインプロセス用の包括的なシリアライザー
  serializers: {
    err: pino.stdSerializers.err,
    error: (error: any) => {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
          errno: (error as any).errno,
          syscall: (error as any).syscall,
          path: (error as any).path,
        };
      }
      return error;
    },
  },
  // Electronメインプロセス向けのカスタムログフォーマッター
  hooks: {
    logMethod(this: pino.Logger, args: any[], method: any) {
      // 2つの引数でメッセージとオブジェクトが渡された場合の処理
      if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'object') {
        const [message, data] = args;
        const safeData = JSON.parse(safeStringify(data));
        return method.call(this, { msg: message, ...safeData });
      }
      // 1つの引数でオブジェクトが渡された場合の処理
      if (args.length === 1 && typeof args[0] === 'object') {
        const safeData = JSON.parse(safeStringify(args[0]));
        return method.call(this, safeData);
      }
      // 通常の処理
      return method.apply(this, args);
    }
  },
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
