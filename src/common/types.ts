/**
 * 型定義の統合エクスポート
 *
 * すべての型定義とユーティリティ関数をドメイン別に整理し、再エクスポートします。
 * 既存のコードとの互換性を保つため、このファイルからすべてインポート可能です。
 *
 * Note: 型定義はtypes/配下の各ファイルで定義され、types/index.tsでも統合エクスポートされています。
 * このファイルは後方互換性のため、同じ型定義を再エクスポートしています。
 * 新しい型を追加する場合は、types/配下の適切なファイルとtypes/index.ts、
 * そしてこのファイルの3箇所を更新してください。
 */

// ランチャー関連の型
export type {
  WindowConfig,
  LauncherItem,
  LauncherItemNew,
  GroupItem,
  WindowOperationItem,
  AppItem,
} from './types/launcher';

// ワークスペース関連の型
export type {
  WorkspaceItem,
  WorkspaceItemNew,
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
export type {
  AppSettings,
  WindowPinMode,
  WindowPositionMode,
  WorkspacePositionMode,
} from './types/settings';

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
export type { WindowInfo, VirtualDesktopInfo, WindowState } from './types/window';

// アプリケーション情報
export type { AppInfo } from './types/app';

// 登録関連の型と関数
export type { RegisterItem, DirOptions, WindowOperationConfig } from './types/register';
export { parseDirOptionsFromString, formatDirOptionsToString } from './types/register';

// 型ガード関数をエクスポート（新規追加）
export {
  isWindowInfo,
  isLauncherItem,
  isGroupItem,
  isWindowOperationItem,
  isWorkspaceItem,
  isDragItemData,
} from './types/guards';
