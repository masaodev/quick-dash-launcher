/** トーストのアイテムタイプ */
export type ToastItemType =
  | 'url'
  | 'file'
  | 'folder'
  | 'app'
  | 'customUri'
  | 'windowSwitch'
  | 'windowActivate'
  | 'windowClose'
  | 'windowPin'
  | 'windowUnpin'
  | 'windowMoveDesktop'
  | 'workspaceAdd'
  | 'clipboard'
  | 'set'
  | 'bookmarkImport';

/** トーストウィンドウへ送られる表示イベントのデータ */
export interface ToastEventData {
  message?: string;
  type: string;
  duration: number;
  itemType?: string;
  displayName?: string;
  path?: string;
  icon?: string;
  itemCount?: number;
  itemNames?: string[];
}

/** 通知・トーストの種類 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * トースト表示オプション
 *
 * 必ず itemType + displayName を指定してリッチ形式で表示すること。
 * message + type のみの旧形式（シンプルデザイン）は非推奨。
 */
export interface ToastOptions {
  /** 補足メッセージ（リッチ形式のアクション文言として使用） */
  message?: string;
  /** トーストの種類（色と表示時間が決まる。省かない） */
  type: NotificationType;
  /** 長めに出す（2 行以上・件数や名前の並び）。表示時間は src/common/constants.ts の toastDurationMs が決める */
  long?: boolean;
  /** アイテムタイプ */
  itemType?: ToastItemType;
  /** 表示名 */
  displayName?: string;
  /** パス（URL含む） */
  path?: string;
  /** アイコン（Base64データURLまたはURL） */
  icon?: string;
  /** グループ内アイテム数 */
  itemCount?: number;
  /** グループ内アイテム名（最大3件） */
  itemNames?: string[];
}
