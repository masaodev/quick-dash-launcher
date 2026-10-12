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

// 標準出力に加えて、メインプロセスが setLogFileSink で渡したファイルにも書く
//（本番のポータブル版では標準出力が残らないため。ファイルの大きさの上限はメインプロセス側で守る）
const stdout = pino.destination(1);
let fileSink: ((line: string) => void) | null = null;

/** ログの書き込み先にファイルを足す（null で外す）。メインプロセスの起動時に呼ぶ */
export function setLogFileSink(sink: ((line: string) => void) | null): void {
  fileSink = sink;
}

// ファイルを先に書き、どちらかが失敗してももう片方には書く（本番で残るのはファイルだけ）
const destination: pino.DestinationStream = {
  write(line: string) {
    try {
      fileSink?.(line);
    } catch {
      // ファイル側の失敗は rotatingLogFile の中で扱う
    }
    try {
      stdout.write(line);
    } catch {
      // GUI アプリとして起動したときなど、標準出力が使えないことがある
    }
  },
};

const logger = pino(
  {
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
    // Electronのメインプロセスではworkerベースのtransportを避け、destination で
    // ファイル（同期）と標準出力（非同期の SonicBoom）に書く
  },
  destination
);

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
