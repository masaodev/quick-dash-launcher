/**
 * ワークスペースサービスモジュール
 *
 * @module workspace
 */

export { WorkspaceService } from './WorkspaceService.js';
export { WorkspaceItemManager } from './WorkspaceItemManager.js';
export { WorkspaceGroupManager } from './WorkspaceGroupManager.js';
export { WorkspaceArchiveManager } from './WorkspaceArchiveManager.js';
export type {
  WorkspaceStoreInstance,
  ArchiveStoreInstance,
  DetachedStoreInstance,
  DetachedWindowState,
} from './types.js';
export { default } from './WorkspaceService.js';
