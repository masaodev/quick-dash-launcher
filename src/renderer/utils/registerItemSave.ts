import type { RegisterItem, EditingAppItem } from '@common/types';

/**
 * 登録フォームの内容をデータファイルへ保存する
 *
 * 新規登録は register-items、編集は種別ごとの update-*-by-id で更新する。保存先が変わった
 * 編集は「削除して登録し直す」。以前は App.tsx にあったが、登録・編集を独立した子ウィンドウで
 * 行うようになったため切り出した（メイン画面は data-changed で読み直す）
 *
 * @returns 'registered' | 'updated'（編集だったかどうか）
 */
export async function saveRegisterItems(
  items: RegisterItem[],
  editingItem: EditingAppItem | null | undefined
): Promise<'registered' | 'updated'> {
  if (!editingItem || items.length !== 1) {
    await window.electronAPI.registerItems(items);
    return 'registered';
  }

  const item = items[0];
  const targetFile = item.targetFile || item.targetTab;
  const isFileChanged = targetFile !== editingItem.sourceFile;

  if (!editingItem.jsonItemId) {
    throw new Error('アイテムIDが見つかりません');
  }
  const itemId = editingItem.jsonItemId;

  if (isFileChanged) {
    await window.electronAPI.deleteItemsById([{ id: itemId }]);
    await window.electronAPI.registerItems([item]);
  } else if (item.itemCategory === 'dir') {
    await window.electronAPI.updateDirItemById(itemId, item.path, item.dirOptions, item.memo);
  } else if (item.itemCategory === 'group') {
    await window.electronAPI.updateGroupItemById(
      itemId,
      item.displayName,
      item.groupItemNames || [],
      item.memo
    );
  } else if (item.itemCategory === 'window') {
    const cfg = item.windowOperationConfig;
    if (!cfg) throw new Error('windowOperationConfig is required for window items');
    await window.electronAPI.updateWindowItemById(
      itemId,
      { ...cfg, displayName: item.displayName },
      item.memo
    );
  } else if (item.itemCategory === 'layout') {
    await window.electronAPI.updateLayoutItemById(
      itemId,
      item.displayName,
      item.layoutEntries || [],
      item.memo
    );
  } else {
    await window.electronAPI.updateItemById({
      id: itemId,
      newItem: {
        displayName: item.displayName,
        path: item.path,
        type: item.type,
        args: item.args,
        customIcon: item.customIcon,
        windowConfig: item.windowConfig,
        memo: item.memo,
      },
    });
  }
  return 'updated';
}
