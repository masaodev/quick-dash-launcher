/**
 * ホットキー入力欄の録画中の状態
 *
 * 録画中は、押したキーがそのまま入力欄に届くよう次の 2 つを行う。
 * - QDL 自身のホットキーを外す（今のホットキーを押してもランチャーが開かない）
 * - Windows のウィンドウメニューを出さない（Alt+Space で開き、キーが入力欄に届かなくなる）
 *
 * 子ウィンドウはメイン画面とレンダラーを共有していて、通知元の WebContents から
 * 入力欄のあるウィンドウを特定できないため、ウィンドウメニューは全ウィンドウで止める。
 */
import { BrowserWindow, type WebContents } from 'electron';
import logger from '@common/logger';

import { HotkeyService } from './hotkeyService.js';

/** 録画中の WebContents の id */
const recordingSenders = new Set<number>();
/** ウィンドウメニューを止める処理を付けたウィンドウ */
const guardedWindows = new WeakSet<BrowserWindow>();
/** 終了時に録画を終わらせる処理を付けた WebContents */
const watchedSenders = new WeakSet<WebContents>();

export function isHotkeyRecording(): boolean {
  return recordingSenders.size > 0;
}

function guardSystemMenu(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (guardedWindows.has(win)) continue;
    guardedWindows.add(win);
    win.on('system-context-menu', (event) => {
      if (isHotkeyRecording()) event.preventDefault();
    });
  }
}

function withHotkeyService(action: (service: HotkeyService) => void): void {
  try {
    action(HotkeyService.getInstance());
  } catch (error) {
    // 初期化前（テスト用にホットキーを無効にしているとき等）は外すホットキーが無い
    logger.warn({ error }, 'ホットキーの一時解除・再登録をスキップしました');
  }
}

/**
 * 録画の開始・終了を受け取る
 * 最初の録画が始まったらホットキーを外し、すべての録画が終わったら登録し直す
 */
export function setHotkeyRecording(sender: WebContents, recording: boolean): void {
  const wasRecording = isHotkeyRecording();

  if (recording) {
    recordingSenders.add(sender.id);
    if (!watchedSenders.has(sender)) {
      watchedSenders.add(sender);
      // 録画中にレンダラーが落ちても、ホットキーを外したままにしない
      const senderId = sender.id;
      sender.once('destroyed', () => stopRecordingFor(senderId));
    }
    guardSystemMenu();
  } else {
    recordingSenders.delete(sender.id);
  }
  applyRecordingChange(wasRecording);
}

function stopRecordingFor(senderId: number): void {
  const wasRecording = isHotkeyRecording();
  recordingSenders.delete(senderId);
  applyRecordingChange(wasRecording);
}

function applyRecordingChange(wasRecording: boolean): void {
  const nowRecording = isHotkeyRecording();
  if (!wasRecording && nowRecording) {
    withHotkeyService((service) => service.suspendHotkeys());
  } else if (wasRecording && !nowRecording) {
    withHotkeyService((service) => service.resumeHotkeys());
  }
}
