/**
 * 旧形式のグループ・ウィンドウ配置（レイアウト）をセットに変換する
 *
 * 変換で動きを変えない: グループは開くだけの行に、レイアウトのエントリは置き場所付きの行にする。
 * レイアウトのタイトルは、今の実行と同じく前後に * を付けた部分一致にして写す。
 */
import type { JsonGroupItem, JsonLayoutItem, JsonSetItem } from '../types/json-data';
import type { LayoutWindowEntry, SetEntry, SetLaunchMode, SetPlacement } from '../types/launcher';

/**
 * タイトルを部分一致のパターンにする（ワイルドカードが無ければ前後に * を付ける）
 *
 * サクラエディタの編集中マーク（"* filename.txt - sakura"）などのタイトルの変化に追従するため、
 * レイアウトの実行はこの形で探していた
 */
export function toPartialMatchTitle(windowTitle: string): string {
  if (!windowTitle) return windowTitle;
  let result = windowTitle;
  if (!result.startsWith('*')) result = `*${result}`;
  if (!result.endsWith('*')) result = `${result}*`;
  return result;
}

/** グループに書かれた名前の解決結果 */
export type GroupNameResolution =
  /** 登録済みのアイテム（id で指す） */
  | { itemId: string }
  /** フォルダ取込で展開したアイテム（id を持たないので、パスを行の中に持つ） */
  | { open: { path: string; args?: string } };

/**
 * グループをセットに変換する
 *
 * @param resolveName グループに書かれた表示名から、指す先を返す（見つからなければ undefined）
 * @param launchMode 設定「グループアイテムを並列起動」から決めた開き方
 */
export function convertGroupToSet(
  group: JsonGroupItem,
  resolveName: (name: string) => GroupNameResolution | undefined,
  launchMode: SetLaunchMode
): JsonSetItem {
  const entries: SetEntry[] = group.itemNames.map((name) => {
    const resolved = resolveName(name);
    if (!resolved) return { label: name };
    if ('itemId' in resolved) return { itemId: resolved.itemId };
    return { open: resolved.open, label: name };
  });
  return withCommonFields(group, {
    id: group.id,
    type: 'set',
    displayName: group.displayName,
    entries,
    ...(launchMode === 'parallel' ? { launchMode } : {}),
  });
}

/** レイアウトのエントリを 1 行に変換する */
export function convertLayoutEntryToSetEntry(entry: LayoutWindowEntry): SetEntry {
  const result: SetEntry = {};
  if (entry.launchApp && entry.executablePath) {
    result.open = entry.args
      ? { path: entry.executablePath, args: entry.args }
      : { path: entry.executablePath };
  }
  const title = entry.windowTitle ? toPartialMatchTitle(entry.windowTitle) : undefined;
  // 旧ウィンドウ配置の画面はウィンドウタイトルを行の名前として出していた（無いとパスの末尾になり、何の行か分からない）
  const label = entry.windowTitle?.replace(/^[\s*]+|[\s*]+$/g, '');
  if (label) result.label = label;
  if (entry.processName || title) {
    result.window = {
      ...(entry.processName ? { processName: entry.processName } : {}),
      ...(title ? { title } : {}),
    };
  }
  const placement: SetPlacement = {};
  if (entry.x !== undefined) placement.x = entry.x;
  if (entry.y !== undefined) placement.y = entry.y;
  if (entry.width !== undefined) placement.width = entry.width;
  if (entry.height !== undefined) placement.height = entry.height;
  if (entry.virtualDesktopNumber !== undefined) {
    placement.virtualDesktopNumber = entry.virtualDesktopNumber;
  }
  // 座標の無いエントリに空の位置を付けると「位置のある行」に数えられる（📍・記録し直し・進み具合の表示）
  if (Object.keys(placement).length > 0) result.placement = placement;
  return result;
}

/** レイアウトをセットに変換する（レイアウトは同時に実行していたので parallel） */
export function convertLayoutToSet(layout: JsonLayoutItem): JsonSetItem {
  return withCommonFields(layout, {
    id: layout.id,
    type: 'set',
    displayName: layout.displayName,
    entries: layout.entries.map((entry) => convertLayoutEntryToSetEntry(entry)),
    launchMode: 'parallel',
    ...(layout.customIcon ? { customIcon: layout.customIcon } : {}),
  });
}

/** メモ・更新日時を引き継ぐ */
function withCommonFields(
  source: { memo?: string; updatedAt?: number },
  target: JsonSetItem
): JsonSetItem {
  return {
    ...target,
    ...(source.memo !== undefined ? { memo: source.memo } : {}),
    ...(source.updatedAt !== undefined ? { updatedAt: source.updatedAt } : {}),
  };
}
