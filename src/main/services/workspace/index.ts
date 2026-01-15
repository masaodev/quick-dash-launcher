/**
 * ワークスペースサービスモジュール
 *
 * @module workspace
 */

export { WorkspaceService } from './WorkspaceService.js';
export { WorkspaceItemManager } from './WorkspaceItemManager.js';
export { WorkspaceGroupManager } from './WorkspaceGroupManager.js';
export { WorkspaceArchiveManager } from './WorkspaceArchiveManager.js';
export type { WorkspaceStoreInstance, ArchiveStoreInstance } from './types.js';

// デフォルトエクスポートはWorkspaceService
export { default } from './WorkspaceService.js';
