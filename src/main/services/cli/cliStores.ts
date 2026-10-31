import { generateUniqueId } from '@common/utils/jsonParser';
import { setTabManagerTranslator } from '@common/utils/tabManager';
import type { TabManagerTranslate } from '@common/utils/tabManager';
import { createChildLogger } from '@common/logger';
import type { AppItem, WindowInfo } from '@common/types';
import { isLauncherItem, isWindowInfo } from '@common/types/guards';
import { screen } from 'electron';

import PathManager from '../../config/pathManager.js';
import { SettingsService } from '../settingsService.js';
import { loadEditableItems } from '../data/editableItemsStore.js';
import {
  appendJsonItems,
  deleteItemsById,
  moveItemToFile,
  replaceItemById,
} from '../data/dataItemWriter.js';
import { withFolderMarker } from '../../utils/folderPathProbe.js';
import {
  notifySettingsChanged,
  reapplySettingsFromDisk,
  saveSettings,
} from '../../ipc/settingsHandlers.js';
import HotkeyService from '../hotkeyService.js';
import { createDataFile, deleteDataFile } from '../data/dataFileOps.js';
import { notifyDataChanged, notifyWorkspaceChanged } from '../../ipc/notifications.js';
import { closeDetachedWindowsForGroup } from '../../ipc/workspaceHandlers.js';
import { getLastLoadReport, reloadConfigFiles } from '../data/dataFileLoader.js';
import { convertJsonItemToAppItems } from '../data/jsonItemConverter.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';
import {
  convertRefToCopy,
  ensureMainItemIndex,
  findLinkCandidates,
  linkToMainItem,
  moveWorkspaceItemToMain,
} from '../workspace/workspaceRefOperations.js';
import { showToastWindow } from '../overlayWindowService.js';
import { ClipboardService } from '../clipboardService.js';
import { mainI18n } from '../mainI18n.js';
import { launchAppItem } from '../launch/appItemLauncher.js';
import { showMainWindow } from '../../windowManager.js';
import { showWorkspaceWindow } from '../../workspaceWindowManager.js';

import { CliError } from './cliArgs.js';
import { itemName } from './cliLauncherCommands.js';
import type { LauncherStore } from './cliLauncherCommands.js';
import type { TabStore } from './cliTabCommands.js';
import type { SettingsStore } from './cliSettingsCommands.js';
import type { CliContext } from './cliCommands.js';

const cliLogger = createChildLogger('cli');

/**
 * メイン画面のアイテムの読み書きを、本体の既存の処理につなぐ
 * （登録画面・編集画面と同じ書き込み経路。トラッカー・破損ファイルの扱いもそのまま）
 */
function createLauncherStore(configFolder: string): LauncherStore {
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
    remove: (id) => deleteItemsById(configFolder, [id]),
    countWorkspaceRefs: async (id) =>
      (await (await WorkspaceService.getInstance()).countRefs([id]))[id] ?? 0,
    markFolder: withFolderMarker,
    newId: generateUniqueId,
  };
}

/**
 * タブ構成の読み書きを、アイテム管理画面と同じ処理につなぐ（データファイルの作成・削除、設定の保存と通知）
 */
function createTabStore(configFolder: string): TabStore {
  return {
    async load() {
      const settings = await SettingsService.getInstance();
      const [tabs, labels, defaultFileTab, showDataFileTabs] = await Promise.all([
        settings.get('dataFileTabs'),
        settings.get('dataFileLabels'),
        settings.get('defaultFileTab'),
        settings.get('showDataFileTabs'),
      ]);
      return { tabs, labels: labels ?? {}, defaultFileTab, showDataFileTabs };
    },
    filesOnDisk: () => PathManager.getDataFiles(),
    async countItems() {
      const result = await loadEditableItems(configFolder);
      if (result.error) throw new CliError('unavailable', result.error);
      const counts = new Map<string, number>();
      for (const entry of result.items) {
        counts.set(entry.meta.sourceFile, (counts.get(entry.meta.sourceFile) ?? 0) + 1);
      }
      return counts;
    },
    createFile(fileName) {
      const result = createDataFile(configFolder, fileName);
      if (!result.success) throw new CliError('unavailable', result.error ?? fileName);
    },
    async deleteFile(fileName) {
      const result = await deleteDataFile(configFolder, fileName);
      if (!result.success) throw new CliError('unavailable', result.error ?? fileName);
      return result.disabledRules ?? [];
    },
    save: (structure) =>
      saveSettings({ dataFileTabs: structure.tabs, dataFileLabels: structure.labels }),
  };
}

/**
 * 設定の読み書きを、設定画面と同じ処理につなぐ（保存と副作用の適用・通知、ホットキーの登録）
 */
function createSettingsStore(): SettingsStore {
  return {
    load: async () => (await SettingsService.getInstance()).getAll(),
    displayCount: () => screen.getAllDisplays().length,
    validateHotkey: async (hotkey) => (await SettingsService.getInstance()).validateHotkey(hotkey),
    isHotkeyAvailable: (hotkey, key) =>
      HotkeyService.getInstance().isHotkeyAvailable(hotkey, key === 'itemSearchHotkey'),
    async changeHotkey(key, hotkey) {
      const service = HotkeyService.getInstance();
      const success =
        key === 'hotkey'
          ? await service.changeHotkey(hotkey)
          : await service.changeItemSearchHotkey(hotkey);
      // changeHotkey は設定を書くだけなので、開いている設定画面に知らせる
      notifySettingsChanged();
      return success;
    },
    save: (settings) => saveSettings(settings),
  };
}

/**
 * CLI のコマンドに渡す道具一式（本体の処理・通知・トースト）
 */
export function createCliContext(
  configFolder: string,
  base: Pick<CliContext, 'appVersion' | 'pid'>
): CliContext {
  // タブ構成の計算が返す理由の文言を、CLI の応答と同じ言語（main の i18next）で出す
  setTabManagerTranslator((key, options) =>
    (mainI18n.t as unknown as TabManagerTranslate)(key, options)
  );
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
    tabs: createTabStore(configFolder),
    settings: createSettingsStore(),
    workspace: {
      loadWorkspaces: async () => (await WorkspaceService.getInstance()).loadWorkspaces(),
      createWorkspace: async (name) => (await WorkspaceService.getInstance()).createWorkspace(name),
      renameWorkspace: async (id, name) =>
        (await WorkspaceService.getInstance()).renameWorkspace(id, name),
      deleteWorkspace: async (id) => (await WorkspaceService.getInstance()).deleteWorkspace(id),
      reorderWorkspaces: async (ids) =>
        (await WorkspaceService.getInstance()).reorderWorkspaces(ids),
      loadGroups: async () => (await WorkspaceService.getInstance()).loadGroups(),
      // 参照はメインウィンドウのアイテムの中身で埋めて返す
      loadItems: async () => {
        await ensureMainItemIndex();
        return (await WorkspaceService.getInstance()).loadResolvedItems();
      },
      canRef: async (itemId) => (await ensureMainItemIndex()).byId.has(itemId),
      addRef: async (itemId, groupId, workspaceId) => {
        const index = await ensureMainItemIndex();
        const main = index.byId.get(itemId);
        if (!main) return undefined;
        return (await WorkspaceService.getInstance()).addRef(
          { ...main, id: itemId },
          groupId,
          workspaceId
        );
      },
      updateDisplayName: async (id, displayName) =>
        (await WorkspaceService.getInstance()).updateDisplayName(id, displayName),
      convertToCopy: (id) => convertRefToCopy(id),
      linkToMain: (id, mainItemId) => linkToMainItem(id, mainItemId),
      moveToMain: (id, file) => moveWorkspaceItemToMain(id, file),
      findLinkCandidates: async (id) => (await findLinkCandidates(id)).map((c) => c.itemId),
      addItem: async (item, groupId, workspaceId) =>
        (await WorkspaceService.getInstance()).addItem(item, groupId, workspaceId),
      updateItem: async (id, update) =>
        (await WorkspaceService.getInstance()).updateItem(id, update),
      removeItem: async (id) => (await WorkspaceService.getInstance()).removeItem(id),
      moveItemToGroup: async (id, groupId) =>
        (await WorkspaceService.getInstance()).moveItemToGroup(id, groupId),
      moveItemToWorkspace: async (id, workspaceId, groupId) =>
        (await WorkspaceService.getInstance()).moveItemToWorkspace(id, workspaceId, groupId),
      reorderMixed: async (parentGroupId, entries) =>
        (await WorkspaceService.getInstance()).reorderMixed(parentGroupId, entries),
      createGroup: async (name, color, parentGroupId, workspaceId) =>
        (await WorkspaceService.getInstance()).createGroup(name, color, parentGroupId, workspaceId),
      updateGroup: async (id, updates) =>
        (await WorkspaceService.getInstance()).updateGroup(id, updates),
      deleteGroup: async (id) => (await WorkspaceService.getInstance()).deleteGroup(id),
      archiveGroup: async (id) => (await WorkspaceService.getInstance()).archiveGroup(id),
      loadArchivedGroups: async () => (await WorkspaceService.getInstance()).loadArchivedGroups(),
      loadArchivedItems: async () => {
        await ensureMainItemIndex();
        return (await WorkspaceService.getInstance()).loadResolvedArchivedItems();
      },
      moveGroupToWorkspace: async (id, workspaceId) =>
        (await WorkspaceService.getInstance()).moveGroupToWorkspace(id, workspaceId),
    },
    markFolder: withFolderMarker,
    changed: (target, message) => {
      // 設定は保存の処理が各ウィンドウに知らせ済みなので、トーストだけ出す
      if (target === 'launcher') notifyDataChanged();
      else if (target === 'workspace') notifyWorkspaceChanged();
      showToastWindow({ message, type: 'success' }).catch((error) =>
        cliLogger.warn({ error }, 'CLI のトーストの表示に失敗')
      );
    },
    beforeGroupRemoved: closeDetachedWindowsForGroup,
    // メイン画面の読み込みと同じ変換（.lnk はリンク先を読む）。フォルダ取込・WSグループは中身に展開されるので 1 件にならない
    launcherAppItem: async (entry) => {
      const converted = await convertJsonItemToAppItems(entry.item, entry.file, 0, new Set(), 0);
      return entry.item.type !== 'dir' && entry.item.type !== 'wsgroup' && converted.length === 1
        ? converted[0]
        : undefined;
    },
    duplicateClipboardData: (ref) => ClipboardService.getInstance().duplicateClipboardData(ref),
    // 画面で Enter を押したのと同じく、読み込んだ形（.lnk のリンク先・セットの行の解決）で開く
    openLauncherEntry: async (entry) => {
      const name = itemName(entry.item);
      if (entry.item.type === 'dir') {
        throw new CliError('invalid', mainI18n.t('cli.errors.cannotOpenDir', { name }));
      }
      if (entry.item.type === 'wsgroup') {
        throw new CliError('invalid', mainI18n.t('cli.errors.cannotOpenWsGroup', { name }));
      }
      const all = await reloadConfigFiles(configFolder, 'internal');
      const item = all.find(
        (i): i is Exclude<AppItem, WindowInfo> =>
          !isWindowInfo(i) && !(isLauncherItem(i) && i.isDirExpanded) && i.id === entry.item.id
      );
      if (!item) throw new CliError('invalid', mainI18n.t('cli.errors.cannotOpen', { name }));
      try {
        await launchAppItem(item, all);
      } catch (error) {
        throw new CliError(
          'unavailable',
          mainI18n.t('cli.errors.openFailed', { name, error: (error as Error)?.message ?? '' })
        );
      }
      return { type: item.type };
    },
    show: async (target) => {
      if (target === 'workspace') await showWorkspaceWindow();
      else await showMainWindow();
    },
    clipboard: {
      save: (text) => {
        const result = ClipboardService.getInstance().saveText(text);
        if (!result.success || !result.dataFileRef) {
          throw new CliError(
            'unavailable',
            result.error ?? mainI18n.t('cli.errors.saveTextFailed')
          );
        }
        return {
          dataFileRef: result.dataFileRef,
          savedAt: result.savedAt ?? Date.now(),
          preview: result.preview ?? '',
          formats: result.formats ?? ['text'],
        };
      },
      read: (dataFileRef) =>
        ClipboardService.getInstance().readContent({ dataFileRef })?.text ?? null,
    },
  };
}
