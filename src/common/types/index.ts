/**
 * 型定義の統合エクスポート
 *
 * すべての型定義をドメイン別に整理し、再エクスポートします。
 * 既存のコードとの互換性を保つため、このファイルからすべてインポート可能です。
 */

// ランチャー関連の型
export type {
  WindowConfig,
  ItemWindowSwitch,
  LauncherItem,
  ClipboardItem,
  LayoutWindowEntry,
  LayoutWindowEntryWithoutIcon,
  LayoutEntryStatus,
  LayoutEntryProgress,
  LayoutExecutionProgress,
  SetItem,
  SetItemFields,
  SetEntry,
  SetWindowMatch,
  SetPlacement,
  SetOpenTarget,
  SetLaunchMode,
  AppItem,
} from './launcher';

// ワークスペース関連の型
export type {
  Workspace,
  WorkspaceItem,
  WorkspaceLauncherItem,
  WorkspaceClipboardItem,
  WorkspaceSetItem,
  WorkspaceItemUpdate,
  WorkspaceGroup,
  WorkspaceGroupView,
  WorkspaceGroupUpdate,
  LauncherItemType,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
  MixedChild,
  MixedOrderEntry,
  GroupDropZone,
} from './workspace';

// ワークスペース設定ファイル（ファイル形式 2.0）の型・定数
export type {
  JsonWorkspaceFile,
  JsonWorkspace,
  JsonWorkspaceGroup,
  JsonWorkspaceItem,
  JsonWorkspaceLauncherItem,
  JsonWorkspaceClipboardItem,
  JsonWorkspaceSetItem,
  JsonWorkspaceArchiveFile,
  JsonArchivedWorkspaceGroup,
  JsonArchivedWorkspaceItem,
  WorkspaceUiStateFile,
  DetachedWindowState,
} from './json-workspace';
export {
  JSON_WORKSPACE_VERSION,
  JSON_WORKSPACE_ITEM_TYPES,
  WORKSPACE_UI_STATE_VERSION,
  DEFAULT_WORKSPACE_DISPLAY_NAME,
} from './json-workspace';

// データファイル関連の型・定数
export { DEFAULT_DATA_FILE } from './data';
export type { DataFileTab } from './data';

// JSONデータファイル関連の型
export type {
  JsonDataFile,
  JsonItem,
  JsonLauncherItem,
  JsonDirItem,
  JsonDirOptions,
  JsonGroupItem,
  JsonClipboardItem,
  JsonLayoutItem,
  JsonSetItem,
  DirOptionsForProcessing,
} from './json-data';
export {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonClipboardItem,
  isJsonSetItem,
  JSON_DATA_VERSION,
  JSON_ID_LENGTH,
  DIR_OPTIONS_DEFAULTS,
} from './json-data';

// クリップボード関連の型
export type {
  SerializableClipboard,
  ClipboardFormat,
  ClipboardCaptureResult,
  ClipboardRestoreResult,
  CurrentClipboardState,
  ClipboardSessionCaptureResult,
  ClipboardSessionCommitResult,
  ClipboardContent,
  ClipboardContentSource,
} from './clipboard';
export {
  MAX_IMAGE_SIZE_BYTES,
  PREVIEW_MAX_LENGTH,
  THUMBNAIL_MAX_WIDTH,
  THUMBNAIL_MAX_HEIGHT,
} from './clipboard';

// 設定関連の型
export type {
  AppSettings,
  WindowPinMode,
  WindowPositionMode,
  WorkspacePositionMode,
  DisplayInfo,
  AutoLaunchStatus,
  StoreAutoLaunchState,
} from './settings';

// アイコン関連の型
export type {
  IconProgressResult,
  IconPhaseProgress,
  IconProgress,
  IconProgressState,
  IconFetchErrorRecord,
} from './icon';

// ブックマーク関連の型
export type {
  SimpleBookmarkItem,
  BrowserProfile,
  BrowserInfo,
  DuplicateHandlingOption,
  DuplicateCheckResult,
} from './bookmark';

// ブックマーク自動取込関連の型
export type {
  BookmarkAutoImportRule,
  BookmarkAutoImportResult,
  BookmarkAutoImportSettings,
  BookmarkFolder,
  BookmarkWithFolder,
} from './bookmarkAutoImport';
export { DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS } from './bookmarkAutoImport';

// アプリインポート関連の型
export type { ScannedAppItem, AppScanResult } from './appImport';

// 検索関連の型
export type { SearchHistoryEntry, SearchHistoryState, SearchMode } from './search';

// ウィンドウ関連の型
export type { WindowInfo, VirtualDesktopInfo, WindowState, Bounds, AdminTab } from './window';

// アプリケーション情報
export type { AppInfo, AppDistribution } from './app';

// 登録関連の型
export type { RegisterItem, RegisterSetEntry } from './register';

// 編集用アイテムの型と関数
export type {
  EditingItemMeta,
  EditingLauncherItem,
  EditingSetItem,
  EditingAppItem,
} from './editingItem';
export { isEditingLauncherItem, isEditingSetItem, isEditableJsonItem } from './editingItem';

// 編集可能なJSONアイテムの型
export type { EditableJsonItem, LoadEditableItemsResult, ValidationResult } from './editableItem';
export { validateEditableItem } from './editableItem';

// メイン画面が開く子ウィンドウ（登録・編集、アイコン取得結果）の型
export type {
  MainChildWindowRequest,
  RegisterWindowRequest,
  IconProgressDetailWindowRequest,
  MainChildWindowResult,
  MainChildWindowReturn,
} from './mainChildWindow';
export type { ConfirmWindowRequest, ConfirmWindowResult } from './confirmWindow';

// トースト関連の型
export type { ToastItemType, ToastEventData, NotificationType, ToastOptions } from './toast';

// バックアップ関連の型
export type { SnapshotInfo, BackupStatus } from './backup';

// 型ガード関数
export { isWindowInfo, isLauncherItem, isClipboardItem, isSetItem } from './guards';
