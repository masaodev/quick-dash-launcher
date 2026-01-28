/**
 * ワークスペースデータのマイグレーションユーティリティ
 */
import type { WorkspaceGroup, ArchivedWorkspaceGroup } from '@common/types';
import logger from '@common/logger';

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
