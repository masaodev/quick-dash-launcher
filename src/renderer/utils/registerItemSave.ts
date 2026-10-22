import i18next from 'i18next';
import type { RegisterItem, EditingAppItem } from '@common/types';
import { itemWindowSwitchFields } from '@common/utils/itemWindowConversion';
import { toSavedSetEntries } from '@common/utils/workspaceConverters';

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
  formItems: RegisterItem[],
  editingItem: EditingAppItem | null | undefined
): Promise<'registered' | 'updated'> {
  // セットの行の、画面の中だけで使う印は保存しない
  const items = formItems.map((item) =>
    item.setEntries ? { ...item, setEntries: toSavedSetEntries(item.setEntries) } : item
  );
  if (!editingItem || items.length !== 1) {
    await window.electronAPI.registerItems(items);
    return 'registered';
  }

  const item = items[0];
  const targetFile = item.targetFile || item.targetTab;
  const isFileChanged = targetFile !== editingItem.sourceFile;

  if (!editingItem.jsonItemId) {
    throw new Error(i18next.t('register.itemIdNotFound'));
  }
  const itemId = editingItem.jsonItemId;

  if (isFileChanged) {
    await window.electronAPI.deleteItemsById([{ id: itemId }]);
    // id を引き継ぐ（変えるとセットの行が「アイテムが見つかりません」になる）
    await window.electronAPI.registerItems([{ ...item, keepId: itemId }]);
  } else if (item.itemCategory === 'dir') {
    await window.electronAPI.updateDirItemById(itemId, item.path, item.dirOptions, item.memo);
  } else if (item.itemCategory === 'set') {
    await window.electronAPI.updateSetItemById(
      itemId,
      {
        displayName: item.displayName,
        entries: item.setEntries || [],
        launchMode: item.setLaunchMode,
        customIcon: item.customIcon,
      },
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
        ...itemWindowSwitchFields(item),
        memo: item.memo,
      },
    });
  }
  return 'updated';
}
