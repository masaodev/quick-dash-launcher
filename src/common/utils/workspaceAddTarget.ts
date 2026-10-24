/**
 * ワークスペースにアイテムを追加するウィンドウ（メインウィンドウのアイテムから選ぶ・新しく入力して追加）の追加先
 *
 * グループに足すときはグループの id、どのグループにも入れない（未分類に足す）ときは
 * `ws:<ワークスペースの id>` を 1 つの文字列で渡す（ウィンドウ名・URL のクエリにそのまま載せるため）
 */

const UNCATEGORIZED_PREFIX = 'ws:';

export type WorkspaceAddTarget =
  { kind: 'group'; groupId: string } | { kind: 'uncategorized'; workspaceId: string };

/** 未分類に足すときの追加先の文字列 */
export function uncategorizedAddTarget(workspaceId: string): string {
  return `${UNCATEGORIZED_PREFIX}${workspaceId}`;
}

/** 追加先の文字列を読む */
export function parseWorkspaceAddTarget(target: string): WorkspaceAddTarget {
  return target.startsWith(UNCATEGORIZED_PREFIX)
    ? { kind: 'uncategorized', workspaceId: target.slice(UNCATEGORIZED_PREFIX.length) }
    : { kind: 'group', groupId: target };
}
