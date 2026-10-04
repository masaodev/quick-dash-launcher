import type { LauncherItem, RegisterItem } from '@common/types';
import { buildLayoutItemFromRegisterItem } from '@common/utils/layoutUtils';
import { normalizeWindowTitleForProcessOnly } from '@common/utils/windowTitle';

import { debugLog, logError } from './debug';

/** 「試しに実行」ボタンを出さない種別 */
const NON_EXECUTABLE_CATEGORIES: ReadonlyArray<RegisterItem['itemCategory']> = [
  'dir',
  'group',
  'clipboard',
];

/** 登録フォームの内容を保存前に「試しに実行」できる種別か */
export function canTryExecute(item: RegisterItem | undefined): boolean {
  return !!item && !NON_EXECUTABLE_CATEGORIES.includes(item.itemCategory);
}

/** 登録フォームの内容を、起動用の LauncherItem に変換する（起動対象でない種別は null） */
export function toLauncherItem(item: RegisterItem): LauncherItem | null {
  switch (item.itemCategory) {
    case 'dir':
    case 'group':
    case 'window':
    case 'layout':
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
        type: item.type,
        args: item.args,
        customIcon: item.customIcon,
        windowConfig: item.windowConfig,
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
    if (item.itemCategory === 'window') {
      if (!item.windowOperationConfig) {
        logError('ウィンドウ操作設定が不足しています');
        return;
      }
      const { windowTitle, processName } = item.windowOperationConfig;
      await window.electronAPI.executeWindowOperation({
        ...item.windowOperationConfig,
        // 保存時と同じく、タイトルが空でプロセス名だけなら "*" で探す
        windowTitle: normalizeWindowTitleForProcessOnly(windowTitle, processName) ?? windowTitle,
        displayName: item.displayName,
        type: 'window',
      });
    } else if (item.itemCategory === 'layout') {
      await window.electronAPI.executeLayout(buildLayoutItemFromRegisterItem(item));
    } else if (item.itemCategory === 'group') {
      debugLog('グループアイテムは実行ボタンからは実行できません');
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
