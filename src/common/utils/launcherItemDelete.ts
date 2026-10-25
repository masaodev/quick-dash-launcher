import type { AppItem } from '../types';
import { isLauncherItem, isWindowInfo } from '../types/guards';

/**
 * メインウィンドウの右クリック「削除…」で消せるアイテムの id を返す。消せないときは null
 *
 * - フォルダ取込で並んだアイテムは出さない（消すとフォルダ取込の行ごと消えてしまう。編集でもフォルダ取込の行が開く）
 * - ブックマーク自動取込のアイテムは出さない（消しても次の取込で戻る。除外は取込ルールの側で行う）
 * - id の無いもの（ウィンドウ検索の行など）は消せない
 */
export function getDeletableItemId(item: AppItem): string | null {
  if (isWindowInfo(item)) return null;
  if (isLauncherItem(item) && (item.isDirExpanded || item.autoImportRuleId)) return null;
  return item.id ?? null;
}
