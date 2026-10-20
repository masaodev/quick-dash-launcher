import type { RegisterItem } from '@common/types';
import { DIR_OPTIONS_DEFAULTS } from '@common/types';

import { debugInfo } from './debug';

/**
 * 種別を変えたときに、ほかの種別の欄を片付けて新しい種別の初期値を入れる（登録画面・ワークスペースの新規で共通）
 *
 * 渡したアイテムは変えず、新しいアイテムを返す。未確定のクリップボードの取り込みは使われなくなるので、
 * メインプロセス側の保持も捨てる
 */
export function applyItemCategoryChange(
  source: RegisterItem,
  category: RegisterItem['itemCategory']
): RegisterItem {
  const item: RegisterItem = { ...source, itemCategory: category };
  const clearCommonFields = () => {
    delete item.folderProcessing;
    delete item.dirOptions;
  };
  const clearClipboardFields = () => {
    if (item.clipboardSessionId) {
      window.electronAPI.clipboardAPI
        .discardSession(item.clipboardSessionId)
        .catch((error) => debugInfo('クリップボードセッションの破棄に失敗:', error));
    }
    delete item.clipboardDataRef;
    delete item.clipboardFormats;
    delete item.clipboardSavedAt;
    delete item.clipboardPreview;
    delete item.clipboardSessionId;
    delete item.clipboardText;
  };

  switch (category) {
    case 'dir':
      item.folderProcessing = 'expand';
      item.dirOptions ??= { ...DIR_OPTIONS_DEFAULTS };
      clearClipboardFields();
      break;
    case 'set':
      clearCommonFields();
      clearClipboardFields();
      item.setEntries ??= [];
      break;
    case 'clipboard':
      clearCommonFields();
      item.path = '';
      item.type = 'clipboard';
      break;
    default:
      clearCommonFields();
      clearClipboardFields();
      break;
  }
  return item;
}
