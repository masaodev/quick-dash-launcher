/**
 * ウィンドウ操作の項目のうち、表示名とタイトル以外の 9 つ（プロセス名・位置・サイズ・動作）
 */

import type { WindowItemConfig } from '../types/launcher.js';

export type WindowPlacement = Omit<WindowItemConfig, 'displayName' | 'windowTitle'>;

/** 9 項目の名前（保存形式のキーの順） */
export const WINDOW_PLACEMENT_KEYS = [
  'processName',
  'x',
  'y',
  'width',
  'height',
  'moveToActiveMonitorCenter',
  'virtualDesktopNumber',
  'activateWindow',
  'pinToAllDesktops',
] as const satisfies readonly (keyof WindowPlacement)[];

/** 9 項目だけを写す。値が無い項目も undefined のキーとして残す（キーの順は保存形式と同じ） */
export function pickWindowPlacement(source: WindowPlacement): WindowPlacement {
  return {
    processName: source.processName,
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
    moveToActiveMonitorCenter: source.moveToActiveMonitorCenter,
    virtualDesktopNumber: source.virtualDesktopNumber,
    activateWindow: source.activateWindow,
    pinToAllDesktops: source.pinToAllDesktops,
  };
}
