/**
 * 型定義の統合エクスポート
 *
 * すべての型定義をドメイン別に整理し、再エクスポートします。
 * 既存のコードとの互換性を保つため、このファイルからすべてインポート可能です。
 */

// ランチャー関連の型
export type { WindowConfig, LauncherItem, GroupItem, AppItem } from './types/launcher';

// ワークスペース関連の型
export type {
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  DragItemData,
  DropTargetData,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
} from './types/workspace';

// データファイル関連の型
export type { RawDataLine, DataFileTab } from './types/data';

// 設定関連の型
export type { AppSettings, WindowPinMode, WindowPositionMode } from './types/settings';

// アイコン関連の型
export type {
  IconProgressResult,
  IconPhaseProgress,
  IconProgress,
  IconProgressState,
} from './types/icon';

// ブックマーク関連の型
export type { SimpleBookmarkItem, BrowserProfile, BrowserInfo } from './types/bookmark';

// 検索関連の型
export type { SearchHistoryEntry, SearchHistoryState, SearchMode } from './types/search';

// ウィンドウ関連の型
export type { WindowInfo } from './types/window';

// アプリケーション情報
export type { AppInfo } from './types/app';
