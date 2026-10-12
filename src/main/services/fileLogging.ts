/**
 * ログをファイル（設定フォルダの logs/main.log）にも残す
 *
 * - pino のロガーの出力（setLogFileSink）
 * - console.warn・console.error（ロガーを使っていない古いコードが多いので、同じファイルに 1 行ずつ足す）
 * - 捕まえられなかった例外（uncaughtExceptionMonitor。終わり方は変えない）
 */

import { format } from 'util';

import logger, { setLogFileSink } from '@common/logger';

import { RotatingLogFile } from './rotatingLogFile.js';

/** pino の数値のレベル（warn=40・error=50） */
const CONSOLE_LEVELS = { warn: 40, error: 50 } as const;

/** console の 1 回分を、pino と同じ形の JSON 1 行にする */
export function formatConsoleLine(level: number, args: unknown[], time = new Date()): string {
  return (
    JSON.stringify({
      level,
      time: time.toISOString(),
      name: 'QuickDashLauncher',
      context: 'console',
      msg: format(...args),
    }) + '\n'
  );
}

/** ファイルへの出力を始める。二重起動で終わる側では呼ばない（ほかの起動とファイルを取り合うため） */
export function startFileLogging(dir: string): RotatingLogFile {
  const file = new RotatingLogFile(dir);
  setLogFileSink((line) => file.write(line));

  for (const method of ['warn', 'error'] as const) {
    // console.warn・console.error を差し替えるので、ここだけ console を直接触る
    // eslint-disable-next-line no-console
    const original = console[method].bind(console);
    // eslint-disable-next-line no-console
    console[method] = (...args: unknown[]) => {
      original(...args);
      file.write(formatConsoleLine(CONSOLE_LEVELS[method], args));
    };
  }

  process.on('uncaughtExceptionMonitor', (error, origin) => {
    logger.fatal({ error, origin }, '捕まえられなかった例外');
  });

  return file;
}
