/**
 * 型定義の統合エクスポート
 *
 * すべての型定義をドメイン別に整理し、再エクスポートします。
 * 既存のコードとの互換性を保つため、このファイルからすべてインポート可能です。
 */

// ランチャー関連の型
export type {
  WindowConfig,
  LauncherItem,
  GroupItem,
  WindowItem,
  ClipboardItem,
  AppItem,
} from './launcher';

// ワークスペース関連の型
export type {
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  DragItemData,
  DropTargetData,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
} from './workspace';

// データファイル関連の型
export type { DataFileTab } from './data';

// JSONデータファイル関連の型
export type {
  JsonDataFile,
  JsonItem,
  JsonLauncherItem,
  JsonDirItem,
  JsonDirOptions,
  JsonGroupItem,
  JsonWindowItem,
  JsonClipboardItem,
  DirOptionsForProcessing,
} from './json-data';
export {
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
  isJsonClipboardItem,
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
  ClipboardPreview,
  CurrentClipboardState,
  ClipboardSessionCaptureResult,
  ClipboardSessionCommitResult,
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

// 検索関連の型
export type { SearchHistoryEntry, SearchHistoryState, SearchMode } from './search';

// ウィンドウ関連の型
export type { WindowInfo, VirtualDesktopInfo, WindowState } from './window';

// アプリケーション情報
export type { AppInfo } from './app';

// 登録関連の型
export type { RegisterItem, WindowOperationConfig } from './register';

// 編集用アイテムの型と関数
export type {
  EditingItemMeta,
  EditingLauncherItem,
  EditingGroupItem,
  EditingWindowItem,
  EditingAppItem,
} from './editingItem';
export { isEditingLauncherItem, isEditingGroupItem, isEditingWindowItem } from './editingItem';

// 編集可能なJSONアイテムの型
export type { EditableJsonItem, LoadEditableItemsResult, ValidationResult } from './editableItem';
export { validateEditableItem } from './editableItem';

// トースト関連の型
export type { ToastItemType } from './toast';

// 型ガード関数
export {
  isWindowInfo,
  isLauncherItem,
  isGroupItem,
  isWindowItem,
  isClipboardItem,
  isWorkspaceItem,
  isDragItemData,
} from './guards';
