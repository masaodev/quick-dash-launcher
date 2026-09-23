/** トーストのアイテムタイプ */
export type ToastItemType =
  | 'url'
  | 'file'
  | 'folder'
  | 'app'
  | 'customUri'
  | 'group'
  | 'windowOperation'
  | 'windowActivate'
  | 'windowClose'
  | 'windowPin'
  | 'windowUnpin'
  | 'windowMoveDesktop'
  | 'workspaceAdd'
  | 'clipboard'
  | 'layout'
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
