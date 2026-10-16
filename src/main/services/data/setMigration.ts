/**
 * 旧形式のグループ・ウィンドウ配置（レイアウト）をセットに変換する（データファイル・ワークスペースの読み込み時に 1 回だけ）
 *
 * 変換は戻せない（それより前の版はセットを読めない）ので、書き換える前に全設定ファイルのスナップショットを残す。
 * 動きは変えない: グループは開くだけの行、レイアウトのエントリは置き場所付きの行にする（setConversion.ts）
 */
import type { AppItem, JsonGroupItem, JsonLayoutItem, SetLaunchMode } from '@common/types';
import { isLauncherItem, isRecord } from '@common/types/guards';
import { validateJsonGroupItem, validateJsonLayoutItem } from '@common/utils/jsonParser';
import {
  convertGroupToSet,
  convertLayoutToSet,
  type GroupNameResolution,
} from '@common/utils/setConversion';

/** グループに書かれた名前を解決する関数 */
export type GroupNameResolver = (name: string) => GroupNameResolution | undefined;

/**
 * 読み込んだアイテムから、グループの名前の解決表を作る
 *
 * 旧来のグループの実行と同じく、同じ名前が複数あれば後のものを使う。
 * フォルダ取込で展開したアイテムは id を持たないので、パスを行の中に持つ
 */
export function buildGroupNameResolver(items: readonly AppItem[]): GroupNameResolver {
  const map = new Map<string, GroupNameResolution>();
  for (const item of items) {
    if (isLauncherItem(item)) {
      if (item.isDirExpanded || !item.id) {
        map.set(item.displayName, {
          open: item.args ? { path: item.path, args: item.args } : { path: item.path },
        });
      } else {
        map.set(item.displayName, { itemId: item.id });
      }
    }
  }
  return (name) => map.get(name);
}

/** ワークスペースのアイテムが持つ、所属・並び順などの項目（変換しても残す） */
const WORKSPACE_META_KEYS = [
  'workspaceId',
  'groupId',
  'order',
  'addedAt',
  'archivedAt',
  'archivedGroupId',
] as const;

/** 旧形式のグループ・レイアウトを含むか */
export function hasLegacySetItems(items: unknown): boolean {
  return (
    Array.isArray(items) &&
    items.some((item) => isRecord(item) && (item.type === 'group' || item.type === 'layout'))
  );
}

/**
 * アイテムの配列（JSON のまま）の中のグループ・レイアウトをセットに置き換える
 *
 * 検証に通らないもの（壊れたグループなど）はそのまま残す（読み込みで不正なアイテムとして扱われる）
 */
export function convertLegacySetItems(
  items: unknown[],
  resolveName: GroupNameResolver,
  groupLaunchMode: SetLaunchMode
): { items: unknown[]; changed: boolean } {
  let changed = false;
  const result = items.map((raw) => {
    if (!isRecord(raw) || (raw.type !== 'group' && raw.type !== 'layout')) return raw;
    try {
      const converted =
        raw.type === 'group'
          ? convertGroupToSet(
              validateJsonGroupItem(raw) as JsonGroupItem,
              resolveName,
              groupLaunchMode
            )
          : convertLayoutToSet(validateJsonLayoutItem(raw) as JsonLayoutItem);
      const meta: Record<string, unknown> = {};
      for (const key of WORKSPACE_META_KEYS) {
        if (raw[key] !== undefined) meta[key] = raw[key];
      }
      changed = true;
      return { ...converted, ...meta };
    } catch {
      return raw;
    }
  });
  return { items: result, changed };
}
