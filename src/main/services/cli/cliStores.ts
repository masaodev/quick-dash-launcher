import { generateUniqueId } from '@common/utils/jsonParser';
import { createChildLogger } from '@common/logger';

import PathManager from '../../config/pathManager.js';
import { SettingsService } from '../settingsService.js';
import { loadEditableItems } from '../data/editableItemsStore.js';
import { appendJsonItems, moveItemToFile, replaceItemById } from '../data/dataItemWriter.js';
import { deleteItemsById } from '../../ipc/editHandlers.js';
import { withFolderMarker } from '../../utils/folderPathProbe.js';
import { reapplySettingsFromDisk } from '../../ipc/settingsHandlers.js';
import { notifyDataChanged, notifyWorkspaceChanged } from '../../ipc/notifications.js';
import { closeDetachedWindowsForGroup } from '../../ipc/workspaceHandlers.js';
import { getLastLoadReport, reloadConfigFiles } from '../data/dataFileLoader.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import { showToastWindow } from '../overlayWindowService.js';
import { mainI18n } from '../mainI18n.js';

import { CliError } from './cliArgs.js';
import type { LauncherStore } from './cliLauncherCommands.js';
import type { CliContext } from './cliCommands.js';

const cliLogger = createChildLogger('cli');

/**
 * メイン画面のアイテムの読み書きを、本体の既存の処理につなぐ
 * （登録画面・編集画面と同じ書き込み経路。トラッカー・破損ファイルの扱いもそのまま）
 */
export function createLauncherStore(configFolder: string): LauncherStore {
  return {
    async load() {
      const result = await loadEditableItems(configFolder);
      if (result.error) throw new CliError('unavailable', result.error);
      return result.items.map((e) => ({
        item: e.item,
        file: e.meta.sourceFile,
        ...(e.meta.isValid
          ? {}
          : { invalid: e.meta.validationError ?? mainI18n.t('cli.errors.invalidItem') }),
      }));
    },
    dataFiles: () => PathManager.getDataFiles(),
    async tabs() {
      return (await SettingsService.getInstance()).get('dataFileTabs');
    },
    append: (file, item) => appendJsonItems(configFolder, file, [item]),
    replace: (item) => replaceItemById(configFolder, item),
    move: (item, from, to) => moveItemToFile(configFolder, item, from, to),
    remove: (id) => deleteItemsById(configFolder, [{ id }]),
    markFolder: withFolderMarker,
    newId: generateUniqueId,
  };
}

/**
 * CLI のコマンドに渡す道具一式（本体の処理・通知・トースト）
 */
export function createCliContext(
  configFolder: string,
  base: Pick<CliContext, 'appVersion' | 'pid'>
): CliContext {
  return {
    ...base,
    configFolder,
    reload: async () => {
      // メイン画面の F5 と同じく、設定の再適用に失敗してもデータの読み直しは続ける
      await reapplySettingsFromDisk().catch((error) =>
        cliLogger.warn({ error }, 'CLI の reload で設定の再適用に失敗')
      );
      await reloadConfigFiles(configFolder, 'explicit');
      notifyDataChanged();
      return getLastLoadReport();
    },
    lastReport: getLastLoadReport,
    // 外部で編集されていたら、ここで検知してスナップショットを残す（ワークスペースは読み直さないと書き込みを断られる）
    syncBeforeWrite: async () => {
      await reloadConfigFiles(configFolder, 'internal');
    },
    launcher: createLauncherStore(configFolder),
    workspace: {
      loadWorkspaces: async () => (await WorkspaceService.getInstance()).loadWorkspaces(),
      createWorkspace: async (name) => (await WorkspaceService.getInstance()).createWorkspace(name),
      renameWorkspace: async (id, name) =>
        (await WorkspaceService.getInstance()).renameWorkspace(id, name),
      deleteWorkspace: async (id) => (await WorkspaceService.getInstance()).deleteWorkspace(id),
      reorderWorkspaces: async (ids) =>
        (await WorkspaceService.getInstance()).reorderWorkspaces(ids),
      loadGroups: async () => (await WorkspaceService.getInstance()).loadGroups(),
      loadItems: async () => (await WorkspaceService.getInstance()).loadItems(),
      addItem: async (item, groupId, workspaceId) =>
        (await WorkspaceService.getInstance()).addItem(item, groupId, workspaceId),
      updateItem: async (id, update) =>
        (await WorkspaceService.getInstance()).updateItem(id, update),
      removeItem: async (id) => (await WorkspaceService.getInstance()).removeItem(id),
      moveItemToGroup: async (id, groupId) =>
        (await WorkspaceService.getInstance()).moveItemToGroup(id, groupId),
      moveItemToWorkspace: async (id, workspaceId) =>
        (await WorkspaceService.getInstance()).moveItemToWorkspace(id, workspaceId),
      reorderMixed: async (parentGroupId, entries) =>
        (await WorkspaceService.getInstance()).reorderMixed(parentGroupId, entries),
      createGroup: async (name, color, parentGroupId, workspaceId) =>
        (await WorkspaceService.getInstance()).createGroup(name, color, parentGroupId, workspaceId),
      updateGroup: async (id, updates) =>
        (await WorkspaceService.getInstance()).updateGroup(id, updates),
      deleteGroup: async (id, deleteItems) =>
        (await WorkspaceService.getInstance()).deleteGroup(id, deleteItems),
      archiveGroup: async (id) => (await WorkspaceService.getInstance()).archiveGroup(id),
      loadArchivedGroups: async () => (await WorkspaceService.getInstance()).loadArchivedGroups(),
      loadArchivedItems: async () => (await WorkspaceService.getInstance()).loadArchivedItems(),
      moveGroupToWorkspace: async (id, workspaceId) =>
        (await WorkspaceService.getInstance()).moveGroupToWorkspace(id, workspaceId),
    },
    markFolder: withFolderMarker,
    changed: (target, message) => {
      if (target === 'launcher') notifyDataChanged();
      else notifyWorkspaceChanged();
      showToastWindow({ message, type: 'success' }).catch((error) =>
        cliLogger.warn({ error }, 'CLI のトーストの表示に失敗')
      );
    },
    beforeGroupRemoved: closeDetachedWindowsForGroup,
  };
}
