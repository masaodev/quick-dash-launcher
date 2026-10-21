import type { RegisterItem, WorkspaceItem, WorkspaceLauncherItem } from '@common/types';
import { itemWindowSwitchFields, omitItemWindowSwitch } from '@common/utils/itemWindowConversion';
import { registerItemToWorkspaceItemUpdate } from '@common/utils/workspaceConverters';

import { launcherTypeForPath } from './registerItemExecution';

/**
 * ワークスペースのアイテム編集の「試しに実行」に渡すアイテムを、編集中の内容から作る
 *
 * 起動に使う欄（パス・引数・ウィンドウ設定・クリップボードの中身・セットの行と開き方）を編集中の値に差し替える。
 * クリップボードを取り直して未保存のときは、まだファイルが無いので保存済みの中身で試す
 */
export function toTrialWorkspaceItem(saved: WorkspaceItem, editing: RegisterItem): WorkspaceItem {
  if (saved.type === 'item' && editing.itemCategory === 'item') {
    return {
      ...omitItemWindowSwitch(saved),
      ...itemWindowSwitchFields(editing),
      displayName: editing.displayName,
      path: editing.path,
      args: editing.args || undefined,
      launcherType:
        editing.type === 'clipboard'
          ? saved.launcherType
          : (launcherTypeForPath(
              editing.path,
              editing.type
            ) as WorkspaceLauncherItem['launcherType']),
    };
  }
  if (saved.type === 'set' && editing.itemCategory === 'set') {
    return {
      ...saved,
      displayName: editing.displayName,
      entries: editing.setEntries ?? saved.entries,
      launchMode: editing.setLaunchMode ?? saved.launchMode,
    };
  }
  if (saved.type === 'clipboard' && editing.itemCategory === 'clipboard') {
    return {
      ...saved,
      displayName: editing.displayName,
      dataFileRef: editing.clipboardDataRef || saved.dataFileRef,
    };
  }
  return saved;
}

/**
 * まだ保存していない新規のアイテム（グループの右クリック「新しく入力して追加」）を、試しに実行する形にする
 *
 * 保存済みのアイテムが無いので、入力中の中身から仮のアイテムを作り、編集と同じ組み立てに通す
 */
export function toTrialNewWorkspaceItem(editing: RegisterItem): WorkspaceItem {
  const body = registerItemToWorkspaceItemUpdate(editing);
  const base = { id: '', workspaceId: '', order: 0, addedAt: 0 };
  const draft = (
    body.type === 'item' ? { ...base, ...body, launcherType: 'app' } : { ...base, ...body }
  ) as WorkspaceItem;
  return toTrialWorkspaceItem(draft, editing);
}
