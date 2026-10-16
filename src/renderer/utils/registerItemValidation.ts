import type { RegisterItem } from '@common/types';
import { hasItemWindowSwitch } from '@common/utils/itemWindowConversion';

/**
 * 登録・編集フォームのパス欄の入力漏れ（無ければ undefined）
 *
 * - フォルダ取込はパスが要る
 * - 単一アイテムは、パスか対象ウィンドウ（exe 名かタイトル）のどちらかがあればよい
 *   （パスが空なら、開いているウィンドウへ切り替えるだけのアイテムになる）
 * - セット・ウィンドウ操作・クリップボードはパスを持たない
 */
export function registerPathError(
  item: RegisterItem
): 'register.errors.pathRequired' | 'register.errors.pathOrWindowRequired' | undefined {
  if (item.path?.trim()) return undefined;
  if (item.itemCategory === 'dir') return 'register.errors.pathRequired';
  if (item.itemCategory === 'item' && !hasItemWindowSwitch(item)) {
    return 'register.errors.pathOrWindowRequired';
  }
  return undefined;
}
