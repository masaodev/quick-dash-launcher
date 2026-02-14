/**
 * システム通知サービス
 *
 * Electron Notification APIを使用してOS標準の通知を表示します。
 * ウィンドウが閉じた後でも通知を表示できます。
 */

import * as path from 'path';

import { Notification, nativeImage, app } from 'electron';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationOptions {
  /** 通知タイトル */
  title: string;
  /** 通知本文 */
  body: string;
  /** 通知タイプ（アイコン選択用） */
  type?: NotificationType;
  /** 通知をクリックした時のコールバック */
  onClick?: () => void;
}

/**
 * システム通知を表示する
 *
 * @param options 通知オプション
 */
export function showNotification(options: NotificationOptions): void {
  // Notification APIがサポートされているかチェック
  if (!Notification.isSupported()) {
    console.warn('Notifications are not supported on this system');
    return;
  }

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: nativeImage.createFromPath(getAppIconPath()),
    silent: false,
  });

  // クリックイベントのハンドリング
  if (options.onClick) {
    notification.on('click', options.onClick);
  }

  notification.show();
}

function getAppIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(app.getAppPath(), 'assets', 'icon.ico');
}
