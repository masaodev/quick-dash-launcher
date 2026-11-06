/**
 * 速さとメモリの計測（A3-254）
 *
 * - 起動の区切り: プロセスが動き出してからの経過ミリ秒を覚え、起動が落ち着いたところで 1 行にまとめてログに出す
 * - 表示の時間: ホットキーでランチャーを出すたびの段階（メイン側と画面側）を 1 行にまとめる。
 *   描画が止まったとき（A3-130 の調べもの）は警告で出す
 * - メモリ: 起動の 1 分後と 1 時間後に、プロセスの種類ごとのメモリとメインのヒープをログに出す
 */
import { performance } from 'node:perf_hooks';

import { app } from 'electron';
import logger, { windowLogger } from '@common/logger';

// ---- 起動の区切り ----

const startupMarks: Record<string, number> = {};
let startupReported = false;

/** 起動の区切りを覚える（同じ名前は最初の 1 回だけ。報告した後は覚えない） */
export function markStartup(name: string): void {
  if (startupReported || name in startupMarks) return;
  startupMarks[name] = Math.round(performance.now());
}

/** 覚えた起動の区切りを 1 行で出す（1 回だけ） */
export function reportStartup(): void {
  if (startupReported) return;
  startupReported = true;
  logger.info({ startupMs: { ...startupMarks } }, '起動の計測');
}

/** 指定ミリ秒後に起動の区切りを出す（起動の直後に続く読み込みも含めるため、少し待ってから出す） */
export function scheduleStartupReport(delayMs: number): void {
  setTimeout(reportStartup, delayMs).unref();
}

/** テスト用: 起動の区切りを空に戻す */
export function resetStartupMarksForTest(): void {
  for (const key of Object.keys(startupMarks)) delete startupMarks[key];
  startupReported = false;
}

/** テスト用: 覚えている起動の区切り */
export function getStartupMarksForTest(): Record<string, number> {
  return { ...startupMarks };
}

// ---- 表示の時間 ----

type ShowTiming = { startTime: number; steps: Record<string, number> };
let currentShow: ShowTiming | null = null;

/** ホットキーで表示し始めた（startTime は Date.now() の値） */
export function beginShowTiming(startTime: number | undefined): void {
  currentShow = startTime === undefined ? null : { startTime, steps: {} };
}

/** メイン側の段階を覚える（表示し始めてからの経過ミリ秒） */
export function recordShowStep(label: string): void {
  if (!currentShow) return;
  currentShow.steps[label] = Date.now() - currentShow.startTime;
}

/**
 * 画面側から届いた段階を受け取る（logPerformanceTiming）
 *
 * - `window-show-complete…`: メイン側の段階とまとめて 1 行を info で出す
 * - `animation-frame-stalled…`: 描画が止まった。警告で出す（後から完了が届いても出す）
 * - それ以外: 覚えておき、完了の行に含める
 * @returns 出した行の種類（テスト用）
 */
export function receiveRendererTiming(
  label: string,
  durationMs: number
): 'complete' | 'stalled' | 'recorded' {
  const show = currentShow ?? { startTime: 0, steps: {} };
  show.steps[label] = Math.round(durationMs);
  if (label.startsWith('animation-frame-stalled')) {
    windowLogger.warn({ showMs: { ...show.steps } }, '表示したのに描画が止まっています');
    return 'stalled';
  }
  if (label.startsWith('window-show-complete')) {
    windowLogger.info({ showMs: { ...show.steps } }, '表示の時間');
    currentShow = null;
    return 'complete';
  }
  currentShow = show;
  return 'recorded';
}

// ---- メモリ ----

/** app.getAppMetrics() の 1 件のうち、使うところだけ */
export type ProcessMetricLike = {
  type: string;
  memory: { workingSetSize: number; privateBytes?: number };
};

export type MemorySummary = Record<
  string,
  { count: number; workingSetMB: number; privateMB: number }
>;

const toMB = (kb: number) => Math.round((kb / 1024) * 10) / 10;

/** プロセスの種類ごとに数とメモリ（MB）を合計する。Electron の値は KB */
export function summarizeAppMetrics(metrics: ProcessMetricLike[]): MemorySummary {
  const sums: Record<string, { count: number; ws: number; priv: number }> = {};
  for (const m of metrics) {
    const s = (sums[m.type] ??= { count: 0, ws: 0, priv: 0 });
    s.count++;
    s.ws += m.memory.workingSetSize;
    s.priv += m.memory.privateBytes ?? 0;
  }
  const total = { count: 0, ws: 0, priv: 0 };
  const result: MemorySummary = {};
  for (const [type, s] of Object.entries(sums)) {
    result[type] = { count: s.count, workingSetMB: toMB(s.ws), privateMB: toMB(s.priv) };
    total.count += s.count;
    total.ws += s.ws;
    total.priv += s.priv;
  }
  result.total = { count: total.count, workingSetMB: toMB(total.ws), privateMB: toMB(total.priv) };
  return result;
}

/** 今のメモリを 1 行で出す */
export function logMemoryMetrics(label: string): void {
  try {
    const usage = process.memoryUsage();
    const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
    logger.info(
      {
        label,
        processes: summarizeAppMetrics(app.getAppMetrics()),
        mainHeapMB: {
          rss: mb(usage.rss),
          heapUsed: mb(usage.heapUsed),
          heapTotal: mb(usage.heapTotal),
          external: mb(usage.external),
          arrayBuffers: mb(usage.arrayBuffers),
        },
      },
      'メモリの計測'
    );
  } catch (error) {
    logger.warn({ error }, 'メモリの計測に失敗しました');
  }
}

/** 起動の 1 分後と 1 時間後にメモリを出す */
export function scheduleMemoryMetrics(): void {
  setTimeout(() => logMemoryMetrics('startup+1m'), 60_000).unref();
  setTimeout(() => logMemoryMetrics('startup+1h'), 60 * 60_000).unref();
}
