/**
 * ワークスペースサービスで使用する型定義
 */
import type {
  WorkspaceItem,
  WorkspaceGroup,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
} from '@common/types';

/**
 * electron-storeのインスタンス型（workspace.json用）
 */
export type WorkspaceStoreInstance = {
  get(key: 'items'): WorkspaceItem[];
  get(key: 'groups'): WorkspaceGroup[];
  set(key: 'items', value: WorkspaceItem[]): void;
  set(key: 'groups', value: WorkspaceGroup[]): void;
  store: { items: WorkspaceItem[]; groups: WorkspaceGroup[] };
  clear(): void;
  path: string;
};

/**
 * 切り離しウィンドウの永続化状態
 */
export type DetachedWindowState = {
  collapsedStates: Record<string, boolean>;
  bounds: { x: number; y: number; width: number; height: number };
};

/**
 * electron-storeのインスタンス型（workspace-detached.json用）
 */
export type DetachedStoreInstance = {
  get(key: 'windows'): Record<string, DetachedWindowState>;
  set(key: 'windows', value: Record<string, DetachedWindowState>): void;
  store: { windows: Record<string, DetachedWindowState> };
  clear(): void;
  path: string;
};

/**
 * electron-storeのインスタンス型（workspace-archive.json用）
 */
export type ArchiveStoreInstance = {
  get(key: 'groups'): ArchivedWorkspaceGroup[];
  get(key: 'items'): ArchivedWorkspaceItem[];
  set(key: 'groups', value: ArchivedWorkspaceGroup[]): void;
  set(key: 'items', value: ArchivedWorkspaceItem[]): void;
  store: { groups: ArchivedWorkspaceGroup[]; items: ArchivedWorkspaceItem[] };
  clear(): void;
  path: string;
};
