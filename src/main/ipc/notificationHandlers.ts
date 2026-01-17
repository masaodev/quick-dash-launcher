/**
 * システム通知IPCハンドラー
 *
 * レンダラープロセスからの通知リクエストを処理します。
 */

import { ipcMain } from 'electron';
import { SHOW_NOTIFICATION, SHOW_TOAST_WINDOW } from '@common/ipcChannels';

import {
  showNotification,
  NotificationOptions,
  NotificationType,
} from '../services/notificationService.js';
import { showToastWindow, ToastType } from '../services/toastWindowService.js';

/**
 * OS通知リクエストの型定義
 */
export interface ShowNotificationRequest {
  /** 通知タイトル */
  title: string;
  /** 通知本文 */
  body: string;
  /** 通知タイプ（アイコン選択用） */
  type?: NotificationType;
}

/**
 * トーストウィンドウリクエストの型定義
 */
export interface ShowToastWindowRequest {
  /** 表示メッセージ */
  message: string;
  /** トーストの種類 */
  type?: ToastType;
  /** 表示時間（ミリ秒） */
  duration?: number;
}

/**
 * システム通知関連のIPCハンドラーを登録する
 *
 * レンダラープロセスからSHOW_NOTIFICATIONリクエストを受け取り、
 * OS標準通知を表示します。
 */
export function setupNotificationHandlers(): void {
  // OS標準通知ハンドラー
  ipcMain.handle(
    SHOW_NOTIFICATION,
    async (_event, request: ShowNotificationRequest): Promise<void> => {
      const options: NotificationOptions = {
        title: request.title,
        body: request.body,
        type: request.type,
      };

      showNotification(options);
    }
  );

  // トーストウィンドウハンドラー
  ipcMain.handle(
    SHOW_TOAST_WINDOW,
    async (_event, request: ShowToastWindowRequest): Promise<void> => {
      await showToastWindow({
        message: request.message,
        type: request.type,
        duration: request.duration,
      });
    }
  );
}
