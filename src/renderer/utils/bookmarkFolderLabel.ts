import type { TFunction } from 'i18next';

/** ブラウザのブックマークの一番上のフォルダ（Chrome / Edge の roots のキー） */
type RootFolder = 'bookmark_bar' | 'other' | 'synced';
const ROOT_FOLDERS: readonly string[] = ['bookmark_bar', 'other', 'synced'];

/**
 * フォルダの表示名。一番上のフォルダはブラウザ内部のキー（bookmark_bar など）なので、画面の言葉に置き換える。
 * ルールに保存するパスはキーのまま
 */
export function bookmarkFolderLabel(name: string, t: TFunction): string {
  if (!ROOT_FOLDERS.includes(name)) return name;
  return t(`bookmarkImportModal.rootFolders.${name as RootFolder}`);
}
