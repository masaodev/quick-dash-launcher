import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, DataFileTab } from '@common/types';
import {
  TabStructureEdits,
  type MoveDirection,
  type TabStructure,
  type TabStructureEdit,
} from '@common/utils/tabManager';

import { logError } from '../utils/debug';

/** アイテム管理画面から変えるタブ構成の設定 */
export type TabStructureSettings = Pick<
  AppSettings,
  'dataFileTabs' | 'dataFileLabels' | 'showDataFileTabs'
>;

/** 取込で作る新しいデータファイルの置き場 */
export type NewImportFileTarget =
  | { kind: 'newFile'; tabIndex: number; fileLabel: string }
  | { kind: 'newTab'; tabName: string; fileLabel: string };

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface UseAdminTabStructureProps {
  dataFileTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
  showDataFileTabs: boolean;
  /** 保存した設定を管理画面全体（AdminApp）の状態に反映する */
  onSaved: (settings: Partial<TabStructureSettings>) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  /** データファイルのアイテム数（作業中の一覧）と、そのうち保存していない変更の数 */
  countItems: (fileName: string) => { total: number; unsaved: number };
  /** 消すデータファイルのアイテムを作業中の一覧から除く */
  dropFileItems: (fileName: string) => void;
}

/**
 * アイテム管理画面のタブ・データファイルの構成を、1 操作ずつその場で確定する
 *
 * 新しいファイルを作る → 設定を保存する → 要らなくなったファイルを消す、の順に行う
 * （設定の保存に失敗しても、アイテムが入ったファイルは消えていないように）。
 * アイテムの未保存の変更（「変更を保存」で確定するもの）とは独立している。
 */
export function useAdminTabStructure({
  dataFileTabs,
  dataFileLabels,
  showDataFileTabs,
  onSaved,
  confirm,
  showSuccess,
  showWarning,
  countItems,
  dropFileItems,
}: UseAdminTabStructureProps) {
  const { t } = useTranslation();
  // 続けて操作したときに古い構成から計算しないよう、保存した構成をすぐ覚えておく
  const structureRef = useRef<TabStructure>({ tabs: dataFileTabs, labels: dataFileLabels });
  structureRef.current = { tabs: dataFileTabs, labels: dataFileLabels };
  const busyRef = useRef(false);

  const fileLabel = useCallback(
    (fileName: string) => structureRef.current.labels[fileName] || fileName,
    []
  );

  /** 消えるファイルの説明（確認ダイアログ用） */
  const describeDeletion = useCallback(
    (files: string[]): string => {
      const lines = files.map((fileName) => {
        const { total, unsaved } = countItems(fileName);
        const unsavedNote =
          unsaved > 0 ? t('itemManager.tabStructure.deletionUnsaved', { count: unsaved }) : '';
        return t('itemManager.tabStructure.deletionLine', {
          label: fileLabel(fileName),
          file: fileName.replace(/^datafiles\//, ''),
          count: total,
          unsaved: unsavedNote,
        });
      });
      return t('itemManager.tabStructure.deletionWarning', { lines: lines.join('\n') });
    },
    [countItems, fileLabel, t]
  );

  /** 計算した構成を確定する。成功したら true（successMessage が空ならトーストを出さない） */
  const commit = useCallback(
    async (
      edit: TabStructureEdit,
      successMessage: string,
      extra: Partial<TabStructureSettings> = {}
    ): Promise<boolean> => {
      if (!edit.ok) {
        showWarning(edit.reason);
        return false;
      }
      if (busyRef.current) return false;
      busyRef.current = true;
      try {
        for (const fileName of edit.filesToCreate) {
          const result = await window.electronAPI.createDataFile(fileName);
          if (!result.success) {
            throw new Error(
              result.error || t('itemManager.tabStructure.createFailed', { file: fileName })
            );
          }
        }

        const settings: Partial<TabStructureSettings> = {
          dataFileTabs: edit.structure.tabs,
          dataFileLabels: edit.structure.labels,
          ...extra,
        };
        await window.electronAPI.setMultipleSettings(settings);
        structureRef.current = edit.structure;
        onSaved(settings);

        const disabledRules: string[] = [];
        for (const fileName of edit.filesToDelete) {
          dropFileItems(fileName);
          const result = await window.electronAPI.deleteDataFile(fileName);
          if (!result.success) {
            showWarning(
              t('itemManager.tabStructure.deleteFailed', {
                file: fileName,
                error: result.error ?? '',
              })
            );
          }
          disabledRules.push(...(result.disabledRules ?? []));
        }

        if (successMessage) showSuccess(successMessage);
        if (disabledRules.length > 0) {
          showWarning(
            t('itemManager.tabStructure.rulesDisabled', {
              rules: disabledRules.join(t('common.listSeparator')),
            })
          );
        }
        return true;
      } catch (error) {
        logError('タブ構成の保存に失敗しました:', error);
        const message = error instanceof Error ? error.message : String(error);
        showWarning(t('itemManager.tabStructure.saveFailed', { error: message }));
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [onSaved, showSuccess, showWarning, dropFileItems, t]
  );

  /** タブ表示がオフなら、新しいタブを作るときに表示をオンにするかを聞く */
  const askShowTabs = useCallback(async (): Promise<Partial<TabStructureSettings>> => {
    if (showDataFileTabs) return {};
    const show = await confirm(t('itemManager.tabStructure.showTabsConfirm'), {
      title: t('itemManager.tabStructure.showTabsTitle'),
      confirmText: t('itemManager.tabStructure.showTabsYes'),
      cancelText: t('itemManager.tabStructure.showTabsNo'),
    });
    return show ? { showDataFileTabs: true } : {};
  }, [confirm, showDataFileTabs, t]);

  /** タブを末尾に足す。足したタブの位置を返す（やめた・失敗したら null） */
  const addTab = useCallback(
    async (tabName: string): Promise<number | null> => {
      const filesOnDisk = await window.electronAPI.getDataFiles().catch(() => []);
      const edit = TabStructureEdits.addTab(structureRef.current, tabName, filesOnDisk);
      const extra = edit.ok ? await askShowTabs() : {};
      const name = edit.ok ? edit.structure.tabs[edit.structure.tabs.length - 1].name : '';
      const saved = await commit(edit, t('itemManager.tabStructure.tabCreated', { name }), extra);
      return saved && edit.ok ? edit.structure.tabs.length - 1 : null;
    },
    [askShowTabs, commit, t]
  );

  /**
   * 取込の確定時に、取り込む先の新しいデータファイルを作る（新しいタブごと作ることもできる）。
   * 作ったファイルとそのタブの位置を返す（失敗したら null。理由は警告のトーストで出す）。
   * 取り込んだ結果は呼び出し側がまとめて知らせるので、ここでは成功のトーストを出さない
   */
  const createImportFile = useCallback(
    async (
      target: NewImportFileTarget
    ): Promise<{ tabIndex: number; fileName: string; fileLabel: string } | null> => {
      const filesOnDisk = await window.electronAPI.getDataFiles().catch(() => []);
      const edit =
        target.kind === 'newTab'
          ? TabStructureEdits.addTab(
              structureRef.current,
              target.tabName,
              filesOnDisk,
              target.fileLabel
            )
          : TabStructureEdits.addNewFileToTab(
              structureRef.current,
              target.tabIndex,
              filesOnDisk,
              target.fileLabel
            );
      const extra = edit.ok && target.kind === 'newTab' ? await askShowTabs() : {};
      const saved = await commit(edit, '', extra);
      if (!saved || !edit.ok) return null;
      const fileName = edit.filesToCreate[0];
      const tabIndex = target.kind === 'newTab' ? edit.structure.tabs.length - 1 : target.tabIndex;
      return { tabIndex, fileName, fileLabel: edit.structure.labels[fileName] };
    },
    [askShowTabs, commit]
  );

  const renameTab = useCallback(
    (tabIndex: number, tabName: string) =>
      commit(
        TabStructureEdits.renameTab(structureRef.current, tabIndex, tabName),
        t('itemManager.tabStructure.tabRenamed')
      ),
    [commit, t]
  );

  const moveTab = useCallback(
    (tabIndex: number, direction: MoveDirection) =>
      commit(
        TabStructureEdits.moveTab(structureRef.current, tabIndex, direction),
        t('itemManager.tabStructure.tabMoved')
      ),
    [commit, t]
  );

  const deleteTab = useCallback(
    async (tabIndex: number): Promise<boolean> => {
      const tab = structureRef.current.tabs[tabIndex];
      const edit = TabStructureEdits.deleteTab(structureRef.current, tabIndex);
      if (!edit.ok || !tab) return commit(edit, '');
      const detail =
        edit.filesToDelete.length > 0
          ? describeDeletion(edit.filesToDelete)
          : t('itemManager.tabStructure.tabDeleteKeepsFiles');
      const confirmed = await confirm(
        t('itemManager.tabStructure.tabDeleteConfirm', { name: tab.name, detail }),
        {
          title: t('itemManager.tabStructure.tabDeleteTitle'),
          confirmText: t('itemManager.deleteButton'),
          danger: edit.filesToDelete.length > 0,
        }
      );
      if (!confirmed) return false;
      return commit(edit, t('itemManager.tabStructure.tabDeleted', { name: tab.name }));
    },
    [commit, confirm, describeDeletion, t]
  );

  /** 新しいデータファイルを作ってタブに入れる。作ったファイル名を返す */
  const addNewFile = useCallback(
    async (tabIndex: number): Promise<string | null> => {
      const filesOnDisk = await window.electronAPI.getDataFiles().catch(() => []);
      const edit = TabStructureEdits.addNewFileToTab(structureRef.current, tabIndex, filesOnDisk);
      const fileName = edit.ok ? edit.filesToCreate[0] : '';
      const label = edit.ok ? edit.structure.labels[fileName] : '';
      const saved = await commit(edit, t('itemManager.tabStructure.fileCreated', { label }));
      return saved ? fileName : null;
    },
    [commit, t]
  );

  const addExistingFile = useCallback(
    async (tabIndex: number, fileName: string): Promise<boolean> =>
      commit(
        TabStructureEdits.addExistingFileToTab(structureRef.current, tabIndex, fileName),
        t('itemManager.tabStructure.fileAdded', { label: fileLabel(fileName) })
      ),
    [commit, fileLabel, t]
  );

  const renameFile = useCallback(
    (fileName: string, label: string) =>
      commit(
        TabStructureEdits.renameFile(structureRef.current, fileName, label),
        t('itemManager.tabStructure.fileRenamed')
      ),
    [commit, t]
  );

  const moveFile = useCallback(
    (tabIndex: number, fileName: string, direction: MoveDirection) =>
      commit(
        TabStructureEdits.moveFileInTab(structureRef.current, tabIndex, fileName, direction),
        t('itemManager.tabStructure.fileMoved')
      ),
    [commit, t]
  );

  /** ファイルをタブから外す（ほかのタブで使っていなければディスクからも消す） */
  const removeFile = useCallback(
    async (tabIndex: number, fileName: string): Promise<boolean> => {
      const edit = TabStructureEdits.removeFileFromTab(structureRef.current, tabIndex, fileName);
      if (!edit.ok) return commit(edit, '');
      const label = fileLabel(fileName);
      const deletes = edit.filesToDelete.length > 0;
      const confirmed = await confirm(
        deletes
          ? t('itemManager.tabStructure.fileDeleteConfirm', {
              label,
              detail: describeDeletion(edit.filesToDelete),
            })
          : t('itemManager.tabStructure.fileRemoveConfirm', { label }),
        deletes
          ? {
              title: t('itemManager.tabStructure.fileDeleteTitle'),
              confirmText: t('itemManager.deleteButton'),
              danger: true,
            }
          : {
              title: t('itemManager.tabStructure.fileRemoveTitle'),
              confirmText: t('itemManager.tabStructure.removeButton'),
            }
      );
      if (!confirmed) return false;
      return commit(
        edit,
        deletes
          ? t('itemManager.tabStructure.fileDeleted', { label })
          : t('itemManager.tabStructure.fileRemoved', { label })
      );
    },
    [commit, confirm, describeDeletion, fileLabel, t]
  );

  return {
    addTab,
    createImportFile,
    renameTab,
    moveTab,
    deleteTab,
    addNewFile,
    addExistingFile,
    renameFile,
    moveFile,
    removeFile,
  };
}

export type AdminTabStructure = ReturnType<typeof useAdminTabStructure>;
