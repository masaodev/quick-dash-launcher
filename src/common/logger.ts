import pino from 'pino';

// Node.jsエラーオブジェクトの型定義
interface NodeError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
}

const logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

function serializeError(error: Error): Record<string, unknown> {
  const nodeError = error as NodeError;
  return {
    name: nodeError.name,
    message: nodeError.message,
    stack: nodeError.stack,
    code: nodeError.code,
    errno: nodeError.errno,
    syscall: nodeError.syscall,
    path: nodeError.path,
  };
}

function safeStringify(obj: unknown, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      if (value instanceof Error) {
        return serializeError(value);
      }
      if (typeof value === 'function') {
        return '[Function]';
      }
      if (typeof value === 'undefined') {
        return '[Undefined]';
      }
      return value;
    },
    space
  );
}

const logger = pino({
  name: 'QuickDashLauncher',
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    error: (error: unknown) => {
      if (error instanceof Error) {
        return serializeError(error);
      }
      return error;
    },
  },
  // Electronメインプロセス向けのカスタムログフォーマッター
  hooks: {
    logMethod(this: pino.Logger, args: Parameters<pino.LogFn>, method: pino.LogFn) {
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
      // 通常の処理（pino v10の型に合わせてキャスト）
      return method.apply(this, args as Parameters<pino.LogFn>);
    },
  },
  // Electronのメインプロセスではworkerベースのtransportを避ける
  // 代わりにシンプルなコンソール出力を使用
});

export default logger;

export function createChildLogger(context: string) {
  return logger.child({ context });
}

// 主要なコンテキスト用のロガー
export const iconLogger = createChildLogger('icon');
export const dataLogger = createChildLogger('data');
export const windowLogger = createChildLogger('window');
export const faviconLogger = createChildLogger('favicon');
export const itemLogger = createChildLogger('item');
