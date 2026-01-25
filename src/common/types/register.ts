/**
 * 登録関連の型定義
 *
 * RegisterModal、フォルダ取込、ウィンドウ操作アイテムで使用される型定義を提供します。
 */

import type { WindowConfig, LauncherItem } from './launcher';
import type { JsonDirOptions } from './json-data';

/**
 * ウィンドウ操作アイテムの設定オブジェクト型定義
 *
 * RegisterModalで使用されるウィンドウ操作アイテムの編集用型。
 * JsonWindowItem（JSON形式のデータ型）と同じフィールドを持つが、
 * 編集フローでの使用を目的としているため別の型として定義されています。
 *
 * @see JsonWindowItem - JSON形式のウィンドウ操作アイテム
 */
export interface WindowOperationConfig {
  displayName: string;
  windowTitle: string;
  processName?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  moveToActiveMonitorCenter?: boolean;
  virtualDesktopNumber?: number;
  activateWindow?: boolean;
  pinToAllDesktops?: boolean;
}

/**
 * RegisterModalで使用されるアイテム型
 */
export interface RegisterItem {
  displayName: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  targetTab: string;
  targetFile?: string;
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  customIcon?: string;
  windowConfig?: WindowConfig;
  itemCategory: 'item' | 'dir' | 'group' | 'window';
  dirOptions?: JsonDirOptions;
  groupItemNames?: string[];
  windowOperationConfig?: WindowOperationConfig;
}
