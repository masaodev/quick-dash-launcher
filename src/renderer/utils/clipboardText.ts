import type { RegisterItem } from '@common/types';

/** クリップボードアイテムの中身が決まっているか（書いた本文があるか、取り込み・保存済みの中身があるか） */
export function hasClipboardContent(item: RegisterItem): boolean {
  if (item.clipboardText !== undefined) return item.clipboardText.trim() !== '';
  return !!item.clipboardSessionId || !!item.clipboardDataRef;
}

/**
 * 「テキストを書く」で書いた本文があれば、テキストだけの実データとして保存し、参照に置き換えた item を返す。
 * 本文がなければ item をそのまま返す。保存に失敗したらエラー文を投げる
 */
export async function saveClipboardText(item: RegisterItem): Promise<RegisterItem> {
  if (item.itemCategory !== 'clipboard' || item.clipboardText === undefined) return item;

  const result = await window.electronAPI.clipboardAPI.saveText(item.clipboardText);
  if (!result.success || !result.dataFileRef) {
    throw new Error(result.error);
  }
  // 取り込んであった中身は使わなくなるので、メインプロセス側の保持も捨てる
  if (item.clipboardSessionId) {
    window.electronAPI.clipboardAPI.discardSession(item.clipboardSessionId).catch(() => undefined);
  }
  return {
    ...item,
    clipboardDataRef: result.dataFileRef,
    clipboardFormats: result.formats || ['text'],
    clipboardPreview: result.preview || '',
    clipboardSavedAt: result.savedAt,
    clipboardSessionId: undefined,
    clipboardText: undefined,
  };
}
