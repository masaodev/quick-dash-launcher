import { beforeEach, describe, expect, it, vi } from 'vitest';

const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));

vi.mock('electron', () => ({ app: { getAppMetrics: vi.fn(() => []) } }));
vi.mock('@common/logger', () => ({
  default: { info, warn },
  windowLogger: { info, warn },
}));

import {
  beginShowTiming,
  getStartupMarksForTest,
  markStartup,
  receiveRendererTiming,
  recordShowStep,
  reportStartup,
  resetStartupMarksForTest,
  summarizeAppMetrics,
} from './perfMetrics';

beforeEach(() => {
  info.mockClear();
  warn.mockClear();
  resetStartupMarksForTest();
  beginShowTiming(undefined);
});

describe('起動の区切り', () => {
  it('同じ名前は最初の 1 回だけ覚え、報告は 1 回だけ出す', () => {
    markStartup('ready');
    const first = getStartupMarksForTest().ready;
    markStartup('ready');
    expect(getStartupMarksForTest().ready).toBe(first);

    reportStartup();
    reportStartup();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toEqual({ startupMs: { ready: first } });
  });

  it('報告した後の区切りは覚えない（2 回目以降の読み直しで上書きしない）', () => {
    markStartup('ready');
    reportStartup();
    markStartup('first-data-loaded');
    expect(getStartupMarksForTest()).not.toHaveProperty('first-data-loaded');
  });
});

describe('表示の時間', () => {
  it('メイン側と画面側の段階を、描画が終わったところで 1 行にまとめる', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    beginShowTiming(990);
    recordShowStep('position-set');

    expect(receiveRendererTiming('renderer-received', 120.4)).toBe('recorded');
    expect(info).not.toHaveBeenCalled();

    expect(receiveRendererTiming('window-show-complete', 161.6)).toBe('complete');
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]).toEqual([
      { showMs: { 'position-set': 10, 'renderer-received': 120, 'window-show-complete': 162 } },
      '表示の時間',
    ]);
    vi.restoreAllMocks();
  });

  it('描画が止まったときは警告で出す', () => {
    beginShowTiming(Date.now());
    expect(receiveRendererTiming('animation-frame-stalled-hidden', 1000)).toBe('stalled');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toEqual({
      showMs: { 'animation-frame-stalled-hidden': 1000 },
    });
  });

  it('メイン側の計測が無くても画面側の完了は出す', () => {
    expect(receiveRendererTiming('window-show-complete-window-search', 50)).toBe('complete');
    expect(info.mock.calls[0][0]).toEqual({
      showMs: { 'window-show-complete-window-search': 50 },
    });
  });
});

describe('summarizeAppMetrics', () => {
  it('プロセスの種類ごとに数と MB を合計し、全体の合計も付ける', () => {
    const result = summarizeAppMetrics([
      { type: 'Browser', memory: { workingSetSize: 102_400, privateBytes: 51_200 } },
      { type: 'Tab', memory: { workingSetSize: 51_200, privateBytes: 25_600 } },
      { type: 'Tab', memory: { workingSetSize: 51_200 } },
    ]);
    expect(result).toEqual({
      Browser: { count: 1, workingSetMB: 100, privateMB: 50 },
      Tab: { count: 2, workingSetMB: 100, privateMB: 25 },
      total: { count: 3, workingSetMB: 200, privateMB: 75 },
    });
  });
});
