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

  // アプリアイコンを取得
  const iconPath = getAppIconPath();

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    silent: false,
  });

  // クリックイベントのハンドリング
  if (options.onClick) {
    notification.on('click', options.onClick);
  }

  notification.show();
}

/**
 * アイテム起動通知を表示する
 *
 * @param itemName 起動したアイテム名
 */
export function showItemLaunchNotification(itemName: string): void {
  showNotification({
    title: 'QuickDashLauncher',
    body: `${itemName} を起動しました`,
    type: 'success',
  });
}

/**
 * グループ起動通知を表示する
 *
 * @param groupName グループ名
 * @param itemCount 起動したアイテム数
 */
export function showGroupLaunchNotification(groupName: string, itemCount: number): void {
  showNotification({
    title: 'QuickDashLauncher',
    body: `${groupName} (${itemCount}件) を起動しました`,
    type: 'success',
  });
}

/**
 * エラー通知を表示する
 *
 * @param message エラーメッセージ
 */
export function showErrorNotification(message: string): void {
  showNotification({
    title: 'QuickDashLauncher - エラー',
    body: message,
    type: 'error',
  });
}

/**
 * アプリアイコンのパスを取得する
 *
 * @returns アイコンファイルのパス、見つからない場合はundefined
 */
function getAppIconPath(): string | undefined {
  // 開発環境とプロダクション環境で異なるパスを使用
  if (app.isPackaged) {
    // プロダクション環境: resourcesPathからアイコンを取得
    return path.join(process.resourcesPath, 'icon.ico');
  } else {
    // 開発環境: プロジェクトルートのassetsフォルダからアイコンを取得
    return path.join(app.getAppPath(), 'assets', 'icon.ico');
  }
}
