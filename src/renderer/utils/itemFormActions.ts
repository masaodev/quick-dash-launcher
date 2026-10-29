import type { TFunction } from 'i18next';
import type { RegisterItem } from '@common/types';
import { DIR_OPTIONS_DEFAULTS } from '@common/types';
import { detectItemType } from '@common/utils/itemTypeDetector';

import type { ItemEditFieldErrors } from '../components/ItemEditFields';

import { hasClipboardContent, saveClipboardText } from './clipboardText';
import { logError } from './debug';
import { registerPathError } from './registerItemValidation';

/**
 * 登録画面（useRegisterForm）とワークスペースの編集画面（useWorkspaceItemEditForm）が分け合う、1 件分の処理
 *
 * 2 つの画面は状態の持ち方（複数件の配列・1 件）が違うので、フックは分けたまま中身だけをここに置く（A3-105）。
 * 片方だけ直す漏れを防ぐため、検証・パスの付け直し・クリップボードの確定・アイコンの取得はここで直す
 */

/** トーストを出す関数（useToast から渡す） */
export interface ItemFormNotify {
  showWarning: (message: string) => void;
  showError: (message: string) => void;
}

/** キャッシュ済みのアイコンを引く（パスを持たない種別・フォルダは引かない） */
export async function loadCachedIconsForItems(
  items: RegisterItem[]
): Promise<Record<string, string>> {
  const itemsNeedingIcons = items.filter(
    (item) => !item.icon && item.path?.trim() && item.type !== 'folder' && item.type !== 'clipboard'
  );
  if (itemsNeedingIcons.length === 0) {
    return {};
  }
  const launcherItems = itemsNeedingIcons.map((item) => ({
    path: item.path,
    type: item.type,
    displayName: item.displayName,
  }));
  return window.electronAPI.loadCachedIcons(launcherItems);
}

/** 前後から外す空白（半角の空白・タブ・改行だけ。全角スペースで終わるフォルダ名は Windows で作れるので残す） */
const EDGE_WHITESPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g;

/**
 * パス欄に入れた文字を、保存する形に整える（前後の空白と、全体を囲む `"` を外す）
 *
 * エクスプローラーの「パスのコピー」は `"C:\…\a.exe"` と引用符付きでコピーするので、そのまま貼ると
 * 開けないアイテムになる。前の空白が付いた `https://…` は URL と判定されない。
 * 中にも `"` があるとき（`"C:\a.exe" "引数"` のように引数まで入れた）は、どこまでがパスか分からないので触らない
 */
export function normalizePathInput(path: string): string {
  const trimmed = path.replace(EDGE_WHITESPACE, '');
  const m = trimmed.match(/^"([^"]+)"$/);
  return m ? m[1].replace(EDGE_WHITESPACE, '') : trimmed;
}

/** 保存の前にパスを整える（パスを持たないクリップボードはそのまま。変わらなければ同じオブジェクト） */
export function withNormalizedPath(item: RegisterItem): RegisterItem {
  if (item.itemCategory === 'clipboard' || typeof item.path !== 'string') return item;
  const path = normalizePathInput(item.path);
  return path === item.path ? item : { ...item, path };
}

/**
 * パス欄を離れたとき（または「選択」で選んだとき）に、パスに合わせて種別・アイコンを決め直す
 *
 * 判定を待つ間にほかの欄が変わっても戻さないよう、今の内容に当てる関数を返す。決め直すものが無ければ undefined
 *
 * @param pickedPath 「選択」で選んだパス（まだ item に入っていない）
 */
export async function resolvePathChange(
  item: RegisterItem,
  pickedPath?: string
): Promise<((current: RegisterItem) => RegisterItem) | undefined> {
  if (item.itemCategory === 'clipboard') return undefined;
  const rawPath = pickedPath ?? item.path;
  const path = typeof rawPath === 'string' ? normalizePathInput(rawPath) : rawPath;
  // 整えて変わったときは、欄の表示も整えた形にする
  const pathChanged = pickedPath !== undefined || path !== item.path;
  if (!path?.trim()) {
    // パスを空にした単一アイテムは、開いているウィンドウに切り替えるだけの種別にする
    if (item.itemCategory === 'item' && item.type !== 'windowSwitch') {
      return (current) => ({ ...current, type: 'windowSwitch', icon: undefined });
    }
    return undefined;
  }

  const newType = await detectItemType(path);
  const cachedIcon =
    newType === 'folder'
      ? undefined
      : (await loadCachedIconsForItems([{ ...item, path, type: newType }]))[path];

  return (current) => {
    const next: RegisterItem = {
      ...current,
      ...(pathChanged && { path }),
      type: newType,
    };
    if (newType === 'folder') {
      next.folderProcessing ??= 'folder';
      next.dirOptions ??= { ...DIR_OPTIONS_DEFAULTS };
    } else {
      delete next.folderProcessing;
      delete next.dirOptions;
      if (cachedIcon) next.icon = cachedIcon;
    }
    return next;
  };
}

/** 保存の前に入力漏れを調べる（漏れが無ければ空のオブジェクト） */
export function validateItemForm(item: RegisterItem, t: TFunction): ItemEditFieldErrors {
  const errors: ItemEditFieldErrors = {};

  // フォルダ取込は名前を持たない
  if (item.itemCategory !== 'dir' && !item.displayName.trim()) {
    errors.displayName = t('register.errors.displayNameRequired');
  }

  const pathError = registerPathError(item);
  if (pathError) {
    errors.path = t(pathError);
  }

  if (item.itemCategory === 'set' && !item.setEntries?.length) {
    errors.setEntries = t('set.editor.entriesRequired');
  }

  if (item.itemCategory === 'clipboard' && !hasClipboardContent(item)) {
    errors.path = item.clipboardDataMissing
      ? t('register.errors.clipboardDataMissing')
      : t('register.errors.clipboardRequired');
  }

  return errors;
}

/**
 * テキストを書いた・クリップボードを取り直していたら、その中身をファイルに確定する
 *
 * 確定するものが無ければ item をそのまま返す。失敗したらトーストで知らせて null を返す
 */
export async function commitClipboardContent(
  item: RegisterItem,
  notify: ItemFormNotify,
  t: TFunction
): Promise<RegisterItem | null> {
  if (item.itemCategory !== 'clipboard') return item;

  if (item.clipboardText !== undefined) {
    try {
      return await saveClipboardText(item);
    } catch (error) {
      logError('クリップボードのテキストの保存に失敗:', error);
      notify.showError(
        (error instanceof Error && error.message) || t('register.errors.clipboardSaveFailed')
      );
      return null;
    }
  }

  if (!item.clipboardSessionId) return item;
  try {
    const result = await window.electronAPI.clipboardAPI.commitSession(item.clipboardSessionId);
    if (result.success && result.dataFileRef) {
      return {
        ...item,
        clipboardDataRef: result.dataFileRef,
        clipboardSavedAt: result.savedAt || item.clipboardSavedAt,
        clipboardSessionId: undefined,
      };
    }
    notify.showError(result.error || t('register.errors.clipboardSaveFailed'));
  } catch (error) {
    logError('クリップボードセッションのコミットに失敗:', error);
    notify.showError(t('register.errors.clipboardSaveFailed'));
  }
  return null;
}

/** 取り込んだまま確定していないクリップボードの中身を捨てる（キャンセル・削除のとき） */
export async function discardClipboardSession(item: RegisterItem): Promise<void> {
  if (!item.clipboardSessionId) return;
  try {
    await window.electronAPI.clipboardAPI.discardSession(item.clipboardSessionId);
  } catch (error) {
    logError('クリップボードセッションの破棄に失敗:', error);
  }
}

/** アイコンを取れる種別か（パスを持ち、フォルダ・クリップボードでない） */
export function canFetchIcon(item: RegisterItem): boolean {
  return !!item.path?.trim() && item.type !== 'folder' && item.type !== 'clipboard';
}

/**
 * アイコンを取り直す（URL のファビコンも getIconForItem が取る）
 *
 * 取れたアイコンは icon-cache にも入る。見つからない・失敗したときはトーストで知らせて undefined を返す
 */
export async function fetchItemIcon(
  item: RegisterItem,
  notify: ItemFormNotify,
  t: TFunction
): Promise<string | undefined> {
  try {
    const icon = await window.electronAPI.getIconForItem(item.path, item.type);
    if (icon) return icon;
    notify.showWarning(t('register.errors.iconNotFound'));
  } catch (error) {
    logError('アイコンの取得に失敗:', error);
    notify.showError(t('register.errors.iconFetchError'));
  }
  return undefined;
}
