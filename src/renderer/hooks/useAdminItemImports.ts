import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DataFileTab,
  DuplicateHandlingOption,
  ScannedAppItem,
  SimpleBookmarkItem,
} from '@common/types';
import type {
  BookmarkAutoImportResult,
  BookmarkAutoImportRule,
} from '@common/types/bookmarkAutoImport';
import { checkAppDuplicates } from '@common/utils/appDuplicateDetector';
import { checkDuplicates } from '@common/utils/duplicateDetector';

import type { AppImportDestination } from '../components/AppImportModal';

import type { AdminItemEditing } from './useAdminItemEditing';
import type { useAdminTabStructure } from './useAdminTabStructure';
import type { useToast } from './useToast';

type Toast = ReturnType<typeof useToast>;

interface UseAdminItemImportsOptions {
  editing: Pick<AdminItemEditing, 'workingItems' | 'importBookmarks' | 'importApps'>;
  dataFileTabs: DataFileTab[];
  getFileLabel: (fileName: string) => string;
  /** 新しいタブ・ファイルを取込先に選んだとき、それを作る */
  createImportFile: ReturnType<typeof useAdminTabStructure>['createImportFile'];
  /** 取り込んだ先のタブ・ファイルを開く */
  onShowTarget: (target: { tabIndex: number; fileName: string }) => void;
  addAutoImportRule: (rule: BookmarkAutoImportRule) => Promise<unknown>;
  executeAutoImportRule: (rule: BookmarkAutoImportRule) => Promise<BookmarkAutoImportResult>;
  toast: Pick<Toast, 'showSuccess' | 'showInfo' | 'showWarning'>;
  /** メインウィンドウから開くよう頼まれた取込画面 */
  pendingImportModal: 'bookmark' | 'app' | null;
  onClearPendingImportModal: () => void;
}

/**
 * アイテム管理のブックマーク取込・アプリ取込（取込画面の開閉と、取り込んだ結果の反映）
 *
 * 取り込んだアイテムは未保存の変更として追加し、取り込んだ先のタブ・ファイルを開く
 */
export function useAdminItemImports({
  editing,
  dataFileTabs,
  getFileLabel,
  createImportFile,
  onShowTarget,
  addAutoImportRule,
  executeAutoImportRule,
  toast,
  pendingImportModal,
  onClearPendingImportModal,
}: UseAdminItemImportsOptions) {
  const { t } = useTranslation();
  const { showSuccess, showInfo, showWarning } = toast;
  const { workingItems } = editing;

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isAppImportModalOpen, setIsAppImportModalOpen] = useState(false);

  // メインウィンドウからのインポートモーダル表示リクエストを処理
  useEffect(() => {
    if (!pendingImportModal) return;

    switch (pendingImportModal) {
      case 'bookmark':
        setIsBookmarkModalOpen(true);
        break;
      case 'app':
        setIsAppImportModalOpen(true);
        break;
    }
    onClearPendingImportModal();
  }, [pendingImportModal]);

  /**
   * 取込画面の取込先を、実在のデータファイルにする。新しいタブ・ファイルならここで作る。
   * 作れなかったら null（理由は警告のトーストで出す。取込画面は開いたまま）
   */
  const resolveImportTarget = async (
    destination: AppImportDestination
  ): Promise<{ tabIndex: number; fileName: string; fileLabel: string } | null> => {
    if (destination.kind === 'existing') {
      return {
        tabIndex: dataFileTabs.findIndex((tab) => tab.files.includes(destination.fileName)),
        fileName: destination.fileName,
        fileLabel: getFileLabel(destination.fileName),
      };
    }
    return createImportFile(destination);
  };

  /** ブックマーク取込画面「N 件を取り込む」: 未保存の変更として追加（印は付かない） */
  const handleBookmarkImport = async (
    bookmarks: SimpleBookmarkItem[],
    duplicateHandling: DuplicateHandlingOption,
    destination: AppImportDestination
  ): Promise<boolean> => {
    const target = await resolveImportTarget(destination);
    if (!target) return false;
    // スキップのときは取込先に登録済みの分は入らない
    const fileItems = workingItems.filter((item) => item.meta.sourceFile === target.fileName);
    const addedCount =
      duplicateHandling === 'skip'
        ? checkDuplicates(bookmarks, fileItems).newCount
        : bookmarks.length;
    editing.importBookmarks(bookmarks, duplicateHandling, target.fileName);
    onShowTarget(target);
    showInfo(t('itemManager.imported', { count: addedCount, file: target.fileLabel }));
    return true;
  };

  /**
   * ブックマーク取込画面「同期を始めて取り込む」: 設定にルールを足してすぐ実行する（自動取込と同じ置き換え方式）。
   * 取込先が新しいタブ・ファイルなら先に作り、そのファイルをルールの取込先にする
   */
  const handleBookmarkSaveAsRule = async (
    draft: BookmarkAutoImportRule,
    destination: AppImportDestination
  ): Promise<boolean> => {
    const target = await resolveImportTarget(destination);
    if (!target) return false;
    const rule = { ...draft, targetFile: target.fileName };
    try {
      await addAutoImportRule(rule);
    } catch (error) {
      // 取込先は作ったので、そのタブ・ファイルを開いてから知らせる（画面は開いたまま）
      onShowTarget(target);
      showWarning(
        t('itemManager.ruleSaveFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return false;
    }
    onShowTarget(target);
    let result: BookmarkAutoImportResult;
    try {
      result = await executeAutoImportRule(rule);
    } catch (error) {
      // 実行の IPC が例外で失敗したときも、success: false と同じく知らせる
      result = {
        success: false,
        importedCount: 0,
        deletedCount: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
        executedAt: Date.now(),
      };
    }
    if (result.success) {
      const message = t('itemManager.ruleSavedAndRun', {
        name: rule.name,
        count: result.importedCount,
      });
      if (result.manualDuplicateCount) {
        showWarning(
          t('itemManager.ruleManualDuplicates', { message, count: result.manualDuplicateCount })
        );
      } else {
        showSuccess(message);
      }
    } else {
      showWarning(
        t('itemManager.ruleRunFailed', { name: rule.name, error: result.errorMessage ?? '' })
      );
    }
    return true;
  };

  /**
   * アプリ取込画面「取り込む」: 新しいタブ・ファイルが取込先ならここで作ってから、未保存の変更として追加する。
   * 取り込んだ先のタブ・ファイルを開く。ファイルを作れなかったら false（取込画面は開いたまま）
   */
  const handleAppImport = async (
    apps: ScannedAppItem[],
    duplicateHandling: DuplicateHandlingOption,
    destination: AppImportDestination
  ): Promise<boolean> => {
    const target = await resolveImportTarget(destination);
    if (!target) return false;
    // スキップのときは取込先に登録済みの分は入らない
    const fileItems = workingItems.filter((item) => item.meta.sourceFile === target.fileName);
    const addedCount =
      duplicateHandling === 'skip' ? checkAppDuplicates(apps, fileItems).newCount : apps.length;
    editing.importApps(apps, duplicateHandling, target.fileName);
    onShowTarget(target);
    showInfo(t('itemManager.imported', { count: addedCount, file: target.fileLabel }));
    return true;
  };

  return {
    isBookmarkModalOpen,
    openBookmarkModal: () => setIsBookmarkModalOpen(true),
    closeBookmarkModal: () => setIsBookmarkModalOpen(false),
    isAppImportModalOpen,
    openAppImportModal: () => setIsAppImportModalOpen(true),
    closeAppImportModal: () => setIsAppImportModalOpen(false),
    handleBookmarkImport,
    handleBookmarkSaveAsRule,
    handleAppImport,
  };
}
