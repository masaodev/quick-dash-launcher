import { useCallback, useRef } from 'react';
import type { AppSettings, DataFileTab } from '@common/types';

import { logError } from '../utils/debug';
import {
  TabStructureEdits,
  type MoveDirection,
  type TabStructure,
  type TabStructureEdit,
} from '../utils/tabManager';

/** アイテム管理画面から変えるタブ構成の設定 */
export type TabStructureSettings = Pick<
  AppSettings,
  'dataFileTabs' | 'dataFileLabels' | 'showDataFileTabs'
>;

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
        const unsavedNote = unsaved > 0 ? `。保存していない変更 ${unsaved} 件も失われます` : '';
        return `・「${fileLabel(fileName)}」（${fileName.replace(/^datafiles\//, '')}）: アイテム ${total} 件${unsavedNote}`;
      });
      return `⚠️ 次のデータファイルがディスクから消えます。元に戻せません。\n${lines.join('\n')}`;
    },
    [countItems, fileLabel]
  );

  /** 計算した構成を確定する。成功したら true */
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
            throw new Error(result.error || `${fileName} を作れませんでした`);
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
            showWarning(`${fileName} を削除できませんでした。${result.error ?? ''}`);
          }
          disabledRules.push(...(result.disabledRules ?? []));
        }

        showSuccess(successMessage);
        if (disabledRules.length > 0) {
          showWarning(
            `取込先のデータファイルが無くなったため、自動取込のルールを無効にしました: ${disabledRules.join('、')}`
          );
        }
        return true;
      } catch (error) {
        logError('タブ構成の保存に失敗しました:', error);
        const message = error instanceof Error ? error.message : String(error);
        showWarning(`タブ設定の保存に失敗しました。${message}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [onSaved, showSuccess, showWarning, dropFileItems]
  );

  /** タブを末尾に足す。足したタブの位置を返す（やめた・失敗したら null） */
  const addTab = useCallback(
    async (tabName: string): Promise<number | null> => {
      const filesOnDisk = await window.electronAPI.getDataFiles().catch(() => []);
      const edit = TabStructureEdits.addTab(structureRef.current, tabName, filesOnDisk);
      const extra: Partial<TabStructureSettings> = {};
      if (edit.ok && !showDataFileTabs) {
        const show = await confirm(
          'メイン画面にタブを表示しない設定になっています。\nこのままでは、作ったタブはメイン画面に出ません。タブを表示しますか？',
          { title: 'タブの表示', confirmText: '表示する', cancelText: '表示しない' }
        );
        if (show) extra.showDataFileTabs = true;
      }
      const name = edit.ok ? edit.structure.tabs[edit.structure.tabs.length - 1].name : '';
      const saved = await commit(edit, `タブ「${name}」を作りました`, extra);
      return saved && edit.ok ? edit.structure.tabs.length - 1 : null;
    },
    [commit, confirm, showDataFileTabs]
  );

  const renameTab = useCallback(
    (tabIndex: number, tabName: string) =>
      commit(
        TabStructureEdits.renameTab(structureRef.current, tabIndex, tabName),
        'タブ名を変えました'
      ),
    [commit]
  );

  const moveTab = useCallback(
    (tabIndex: number, direction: MoveDirection) =>
      commit(
        TabStructureEdits.moveTab(structureRef.current, tabIndex, direction),
        'タブを移動しました'
      ),
    [commit]
  );

  const deleteTab = useCallback(
    async (tabIndex: number): Promise<boolean> => {
      const tab = structureRef.current.tabs[tabIndex];
      const edit = TabStructureEdits.deleteTab(structureRef.current, tabIndex);
      if (!edit.ok || !tab) return commit(edit, '');
      const detail =
        edit.filesToDelete.length > 0
          ? describeDeletion(edit.filesToDelete)
          : 'データファイルはほかのタブでも使っているため、消えません。';
      const confirmed = await confirm(`タブ「${tab.name}」を削除しますか？\n\n${detail}`, {
        title: 'タブの削除',
        confirmText: '削除',
        danger: edit.filesToDelete.length > 0,
      });
      if (!confirmed) return false;
      return commit(edit, `タブ「${tab.name}」を削除しました`);
    },
    [commit, confirm, describeDeletion]
  );

  /** 新しいデータファイルを作ってタブに入れる。作ったファイル名を返す */
  const addNewFile = useCallback(
    async (tabIndex: number): Promise<string | null> => {
      const filesOnDisk = await window.electronAPI.getDataFiles().catch(() => []);
      const edit = TabStructureEdits.addNewFileToTab(structureRef.current, tabIndex, filesOnDisk);
      const fileName = edit.ok ? edit.filesToCreate[0] : '';
      const label = edit.ok ? edit.structure.labels[fileName] : '';
      const saved = await commit(edit, `データファイル「${label}」を作りました`);
      return saved ? fileName : null;
    },
    [commit]
  );

  const addExistingFile = useCallback(
    async (tabIndex: number, fileName: string): Promise<boolean> =>
      commit(
        TabStructureEdits.addExistingFileToTab(structureRef.current, tabIndex, fileName),
        `データファイル「${fileLabel(fileName)}」をタブに入れました`
      ),
    [commit, fileLabel]
  );

  const renameFile = useCallback(
    (fileName: string, label: string) =>
      commit(
        TabStructureEdits.renameFile(structureRef.current, fileName, label),
        'データファイルの名前を変えました'
      ),
    [commit]
  );

  const moveFile = useCallback(
    (tabIndex: number, fileName: string, direction: MoveDirection) =>
      commit(
        TabStructureEdits.moveFileInTab(structureRef.current, tabIndex, fileName, direction),
        'データファイルを移動しました'
      ),
    [commit]
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
          ? `データファイル「${label}」を削除しますか？\n\n${describeDeletion(edit.filesToDelete)}`
          : `データファイル「${label}」をこのタブから外しますか？\n\nほかのタブでも使っているため、ファイルとアイテムはそのまま残ります。`,
        deletes
          ? { title: 'データファイルの削除', confirmText: '削除', danger: true }
          : { title: 'タブから外す', confirmText: '外す' }
      );
      if (!confirmed) return false;
      return commit(
        edit,
        deletes ? `データファイル「${label}」を削除しました` : `「${label}」をタブから外しました`
      );
    },
    [commit, confirm, describeDeletion, fileLabel]
  );

  return {
    addTab,
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
