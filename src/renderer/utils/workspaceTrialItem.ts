import type { RegisterItem, WorkspaceItem } from '@common/types';
import {
  omitItemWindowSwitch,
  windowConfigToSwitchFields,
} from '@common/utils/itemWindowConversion';

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
      ...windowConfigToSwitchFields(editing.windowConfig),
      displayName: editing.displayName,
      path: editing.path,
      args: editing.args || undefined,
      launcherType: editing.type === 'clipboard' ? saved.launcherType : editing.type,
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
