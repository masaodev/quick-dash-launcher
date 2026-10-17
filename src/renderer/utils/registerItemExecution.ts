import type { LauncherItem, RegisterItem } from '@common/types';
import { itemWindowSwitchFields } from '@common/utils/itemWindowConversion';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { debugLog, logError } from './debug';

/** 「試しに実行」ボタンを出さない種別 */
const NON_EXECUTABLE_CATEGORIES: ReadonlyArray<RegisterItem['itemCategory']> = ['dir'];

/** 登録フォームの内容を保存前に「試しに実行」できる種別か */
export function canTryExecute(item: RegisterItem | undefined): boolean {
  return !!item && !NON_EXECUTABLE_CATEGORIES.includes(item.itemCategory);
}

/**
 * 「試しに実行」を押せなくするか。クリップボードは保存済みの実データをコピーするので、
 * 取り込み直した直後や書きかけのテキストなど、まだ保存していない中身のときは試せない
 */
/**
 * ワークスペースの編集画面の「試しに実行」を押せなくするか。こちらは取り込み直した直後・書きかけでも
 * 保存済みの中身で試す（workspaceTrialItem）ので、保存済みの実データが無いときだけ押せなくする
 */
export function isWorkspaceTryExecuteBlocked(item: RegisterItem | undefined): boolean {
  if (!item || item.itemCategory !== 'clipboard') return false;
  return !item.clipboardDataRef || !!item.clipboardDataMissing;
}

export function isTryExecuteBlocked(item: RegisterItem | undefined): boolean {
  if (!item || item.itemCategory !== 'clipboard') return false;
  return (
    !!item.clipboardSessionId ||
    item.clipboardText !== undefined ||
    !item.clipboardDataRef ||
    !!item.clipboardDataMissing
  );
}

/**
 * 今のパスに合う種別（種別はパス欄を離れたときに決めるので、その前に試したときに古い種別のままにしない）
 *
 * パスが空なら切り替えるだけの種別、空でないのに切り替えるだけの種別のままならパスから判定し直す
 */
export function launcherTypeForPath(
  path: string,
  type: LauncherItem['type']
): LauncherItem['type'] {
  if (!path.trim()) return 'windowSwitch';
  return type === 'windowSwitch' ? detectItemTypeSync(path) : type;
}

/** 登録フォームの内容を、起動用の LauncherItem に変換する（起動対象でない種別は null） */
export function toLauncherItem(item: RegisterItem): LauncherItem | null {
  switch (item.itemCategory) {
    case 'dir':
    case 'set':
      return null;
    case 'clipboard':
      return {
        displayName: item.displayName,
        path: '',
        type: 'clipboard',
        customIcon: item.customIcon,
        clipboardDataRef: item.clipboardDataRef,
        clipboardFormats: item.clipboardFormats,
        clipboardSavedAt: item.clipboardSavedAt,
      };
    default:
      return {
        displayName: item.displayName,
        path: item.path,
        // パス欄を離れる前に試したときも、今のパスに合う種別にする
        type: launcherTypeForPath(item.path, item.type),
        args: item.args,
        customIcon: item.customIcon,
        ...itemWindowSwitchFields(item),
      };
  }
}

/**
 * 登録フォームの内容を保存前に実行してみる
 *
 * 登録フォームは独立した子ウィンドウで開き、開いている間はメインウィンドウがモーダル
 * モードになる（フォーカスが外れても隠れない）ので、ピンモードの切り替えは不要。
 */
export async function tryExecuteRegisterItem(item: RegisterItem): Promise<void> {
  try {
    if (item.itemCategory === 'set') {
      // 行は全タブのアイテムから探す（保存前の内容で試す）
      const allItems = await window.electronAPI.loadDataFiles('internal');
      await window.electronAPI.executeSet(
        {
          type: 'set',
          displayName: item.displayName,
          entries: item.setEntries ?? [],
          launchMode: item.setLaunchMode,
        },
        allItems
      );
    } else if (item.itemCategory === 'dir') {
      debugLog('フォルダ取込アイテムは実行ボタンからは実行できません');
    } else {
      const launcherItem = toLauncherItem(item);
      if (launcherItem) {
        await window.electronAPI.openItem(launcherItem);
      }
    }
  } catch (error) {
    logError('アイテムの実行に失敗しました:', error);
  }
}
