/**
 * 型定義の統合エクスポート
 *
 * すべての型定義をドメイン別に整理し、再エクスポートします。
 * 既存のコードとの互換性を保つため、このファイルからすべてインポート可能です。
 */

// ランチャー関連の型
export type { WindowConfig, LauncherItem, GroupItem, AppItem } from './launcher';

// ワークスペース関連の型
export type {
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  DragItemData,
  DropTargetData,
} from './workspace';

// データファイル関連の型
export type { RawDataLine, DataFileTab } from './data';

// 設定関連の型
export type { AppSettings, WindowPinMode, WindowPositionMode } from './settings';

// アイコン関連の型
export type {
  IconProgressResult,
  IconPhaseProgress,
  IconProgress,
  IconProgressState,
} from './icon';

// ブックマーク関連の型
export type { SimpleBookmarkItem, BrowserProfile, BrowserInfo } from './bookmark';

// 検索関連の型
export type { SearchHistoryEntry, SearchHistoryState, SearchMode } from './search';

// ウィンドウ関連の型
export type { WindowInfo } from './window';

// アプリケーション情報
export type { AppInfo } from './app';
