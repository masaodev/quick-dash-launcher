/**
 * ワークスペースデータのマイグレーションユーティリティ
 */
import type { Workspace, WorkspaceGroup, ArchivedWorkspaceGroup } from '@common/types';
import logger from '@common/logger';

import type { WorkspaceStoreInstance } from './types.js';

/**
 * 旧データの name → displayName マイグレーションを実行
 * @param groups グループ配列
 * @param storeName ログ出力用のストア名
 * @returns マイグレーション結果（マイグレーション済み配列とマイグレーションが必要だったかのフラグ）
 */
export function migrateGroupDisplayName<T extends WorkspaceGroup | ArchivedWorkspaceGroup>(
  groups: T[],
  storeName: string
): { migratedGroups: T[]; needsMigration: boolean } {
  let needsMigration = false;

  const migratedGroups = groups.map((group) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawGroup = group as any;
    if (rawGroup.name !== undefined && rawGroup.displayName === undefined) {
      needsMigration = true;
      const { name, ...rest } = rawGroup;
      return { ...rest, displayName: name } as T;
    }
    return group;
  });

  if (needsMigration) {
    logger.info(`Migrated ${storeName}: name → displayName`);
  }

  return { migratedGroups, needsMigration };
}

/** デフォルトワークスペースID */
export const DEFAULT_WORKSPACE_ID = 'default';

/** デフォルトワークスペースオブジェクト */
export const DEFAULT_WORKSPACE: Workspace = {
  id: DEFAULT_WORKSPACE_ID,
  displayName: 'デフォルト',
  order: 0,
  createdAt: 0,
};

/**
 * マルチワークスペースへのマイグレーション（冪等）
 * - workspaces が空/未定義 → デフォルトWS作成
 * - workspaceId 未設定の groups/items → 'default' 付与
 */
export function migrateToMultiWorkspace(store: WorkspaceStoreInstance): void {
  let workspaces = store.get('workspaces');

  // workspaces が未定義または空の場合、デフォルトWSを作成
  if (!workspaces || workspaces.length === 0) {
    workspaces = [{ ...DEFAULT_WORKSPACE, createdAt: Date.now() }];
    store.set('workspaces', workspaces);
    logger.info('Migration: created default workspace');
  }

  // groups に workspaceId を付与
  const groups = store.get('groups') || [];
  let groupsMigrated = false;
  const migratedGroups = groups.map((g) => {
    if (!g.workspaceId) {
      groupsMigrated = true;
      return { ...g, workspaceId: DEFAULT_WORKSPACE_ID };
    }
    return g;
  });
  if (groupsMigrated) {
    store.set('groups', migratedGroups);
    logger.info('Migration: assigned default workspaceId to groups');
  }

  // items に workspaceId を付与
  const items = store.get('items') || [];
  let itemsMigrated = false;
  const migratedItems = items.map((i) => {
    if (!i.workspaceId) {
      itemsMigrated = true;
      return { ...i, workspaceId: DEFAULT_WORKSPACE_ID };
    }
    return i;
  });
  if (itemsMigrated) {
    store.set('items', migratedItems);
    logger.info('Migration: assigned default workspaceId to items');
  }
}
