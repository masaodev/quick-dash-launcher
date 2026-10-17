/**
 * ブックマーク自動取込設定コンポーネント
 *
 * AdminSettingsTabの「ブックマーク自動取込」カテゴリで表示される
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BrowserInfo, DataFileTab } from '@common/types';
import type { BookmarkAutoImportRule } from '@common/types/bookmarkAutoImport';
import { formatImportSummary, summarizeImportResults } from '@common/utils/bookmarkImportUtils';

import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';
import {
  useAdminTabStructure,
  type ConfirmOptions,
  type TabStructureSettings,
} from '../hooks/useAdminTabStructure';
import type { ImportDestination } from '../hooks/useImportDestination';
import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';
import { bookmarkFolderLabel } from '../utils/bookmarkFolderLabel';

import { Button } from './ui';
import BookmarkAutoImportRuleModal from './BookmarkAutoImportRuleModal';
import ConfirmDialog from './ConfirmDialog';

import '../styles/components/BookmarkAutoImport.css';

interface BookmarkAutoImportSettingsProps {
  /** 「一度だけ取り込む」→ アイテム管理の手動取込モーダルを開く */
  onOpenManualImport?: () => void;
  /** タブ・データファイルの構成（ルールの取込先の帯に使う） */
  dataFileTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
  showDataFileTabs: boolean;
  /** ルールの取込先に新しいタブ・データファイルを作ったとき、管理画面全体の設定に反映する */
  onTabStructureSaved: (settings: Partial<TabStructureSettings>) => void;
}

/** 新しいタブを作るときの確認（タブを表示するか）。開いているあいだだけ resolve を持つ */
interface PendingConfirm extends ConfirmOptions {
  message: string;
  resolve: (ok: boolean) => void;
}

const BookmarkAutoImportSettings: React.FC<BookmarkAutoImportSettingsProps> = ({
  onOpenManualImport,
  dataFileTabs,
  dataFileLabels,
  showDataFileTabs,
  onTabStructureSaved,
}) => {
  const { t, i18n } = useTranslation();
  const {
    settings,
    isLoading,
    executingRuleId,
    toggleAutoRunOnStartup,
    toggleRuleEnabled,
    addRule,
    updateRule,
    deleteRule,
    executeRule,
    executeAllRules,
  } = useBookmarkAutoImport();

  const { showSuccess, showError, showWarning } = useToast();

  const [editingRule, setEditingRule] = useState<BookmarkAutoImportRule | null | 'new'>(null);
  const [deleteConfirmRuleId, setDeleteConfirmRuleId] = useState<string | null>(null);
  const [deleteAlsoItems, setDeleteAlsoItems] = useState(false);
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);

  // 新しいタブを作るときの「タブを表示するか」の確認
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const pendingConfirmRef = useRef<PendingConfirm | null>(null);
  pendingConfirmRef.current = pendingConfirm;
  const confirmAsync = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => setPendingConfirm({ ...options, message, resolve })),
    []
  );
  const closeConfirm = (ok: boolean) => {
    pendingConfirmRef.current?.resolve(ok);
    setPendingConfirm(null);
  };

  // ルールの取込先に新しいタブ・データファイルを作る（アイテム管理の取込画面と同じ作り方）。
  // ここではファイルを消さないので、アイテム数の数え方と削除時の後始末は使わない
  const tabStructure = useAdminTabStructure({
    dataFileTabs,
    dataFileLabels,
    showDataFileTabs,
    onSaved: onTabStructureSaved,
    confirm: confirmAsync,
    showSuccess,
    showWarning,
    countItems: () => ({ total: 0, unsaved: 0 }),
    dropFileItems: () => undefined,
  });

  useEffect(() => {
    // ルール一覧でプロファイルを表示名で出すため（見つからなければ ID のまま）
    window.electronAPI
      .detectInstalledBrowsers()
      .then(setBrowsers)
      .catch((error) => logError('ブラウザの検出に失敗:', error));
  }, []);

  /** ルールを保存する。取込先が新しいタブ・ファイルなら先に作る（作れなかったら false で画面は開いたまま） */
  const handleSaveRule = async (
    rule: BookmarkAutoImportRule,
    destination: ImportDestination
  ): Promise<boolean> => {
    let targetFile: string;
    if (destination.kind === 'existing') {
      targetFile = destination.fileName;
    } else {
      const created = await tabStructure.createImportFile(destination);
      if (!created) return false;
      targetFile = created.fileName;
    }
    const saved = { ...rule, targetFile };
    try {
      if (editingRule === 'new') {
        await addRule(saved);
      } else {
        await updateRule(saved);
      }
    } catch (error) {
      logError('ルールの保存に失敗しました:', error);
      showError(
        t('itemManager.ruleSaveFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return false;
    }
    setEditingRule(null);
    return true;
  };

  const handleDeleteRule = useCallback((ruleId: string) => {
    setDeleteAlsoItems(false);
    setDeleteConfirmRuleId(ruleId);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmRuleId) {
      await deleteRule(deleteConfirmRuleId, deleteAlsoItems);
      setDeleteConfirmRuleId(null);
    }
  }, [deleteConfirmRuleId, deleteAlsoItems, deleteRule]);

  const handleExecuteRule = useCallback(
    async (rule: BookmarkAutoImportRule) => {
      const result = await executeRule(rule);
      if (result.success) {
        const message = t('bookmarkAutoImport.ruleResult', {
          name: rule.name,
          imported: result.importedCount,
          deleted: result.deletedCount,
        });
        if (result.manualDuplicateCount) {
          showWarning(
            t('bookmarkAutoImport.manualDuplicates', {
              message,
              count: result.manualDuplicateCount,
            })
          );
        } else {
          showSuccess(message);
        }
      } else {
        showError(
          t('bookmarkAutoImport.ruleError', { name: rule.name, error: result.errorMessage ?? '' })
        );
      }
    },
    [executeRule, showSuccess, showWarning, showError, t]
  );

  const handleExecuteAll = useCallback(async () => {
    const results = await executeAllRules();
    const summary = summarizeImportResults(results);
    const message = formatImportSummary(summary, t);
    if (summary.hasError) {
      showWarning(message);
    } else {
      showSuccess(message);
    }
  }, [executeAllRules, showSuccess, showWarning, t]);

  const formatLastResult = (rule: BookmarkAutoImportRule): string => {
    if (!rule.lastExecutedAt) return t('bookmarkAutoImport.neverRun');

    const dateStr = new Date(rule.lastExecutedAt).toLocaleString(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    if (rule.lastResult?.success) {
      const counts = {
        date: dateStr,
        imported: rule.lastResult.importedCount,
        deleted: rule.lastResult.deletedCount,
      };
      return rule.lastResult.manualDuplicateCount
        ? t('bookmarkAutoImport.lastResultWithDuplicates', {
            ...counts,
            count: rule.lastResult.manualDuplicateCount,
          })
        : t('bookmarkAutoImport.lastResult', counts);
    } else if (rule.lastResult) {
      return t('bookmarkAutoImport.lastError', {
        date: dateStr,
        error: rule.lastResult.errorMessage ?? '',
      });
    }
    return dateStr;
  };

  const getBrowserDisplayName = (browserId: string): string => {
    return browserId === 'chrome' ? 'Chrome' : 'Edge';
  };

  const getProfileNames = (rule: BookmarkAutoImportRule): string => {
    const profiles = browsers.find((b) => b.id === rule.browserId)?.profiles ?? [];
    return rule.profileIds
      .map((id) => profiles.find((p) => p.id === id)?.displayName ?? id)
      .join(', ');
  };

  /** ルール一覧のフォルダの表示（一番上のフォルダは画面の言葉にし、除くときはそう書く） */
  const describeFolders = (rule: BookmarkAutoImportRule): string => {
    if (rule.folderPaths.length === 0) return t('bookmarkAutoImport.allFolders');
    const names = rule.folderPaths
      .map((path) =>
        path
          .split('/')
          .map((name) => bookmarkFolderLabel(name, t))
          .join(' / ')
      )
      .join(t('common.listSeparator'));
    return rule.folderFilterMode === 'exclude'
      ? t('bookmarkRule.foldersExcluded', { folders: names })
      : names;
  };

  if (isLoading) {
    return <div className="auto-import-empty">{t('bookmarkAutoImport.loading')}</div>;
  }

  return (
    <div className="bookmark-auto-import">
      {/* 全体設定 */}
      <div className="auto-import-global-controls">
        <label>
          <input
            type="checkbox"
            checked={settings.autoRunOnStartup}
            onChange={toggleAutoRunOnStartup}
          />
          {t('bookmarkAutoImport.autoRunOnStartup')}
        </label>
        <Button
          variant="primary"
          className="execute-all-button"
          onClick={handleExecuteAll}
          disabled={
            executingRuleId !== null || settings.rules.filter((r) => r.enabled).length === 0
          }
        >
          {executingRuleId === 'all'
            ? t('bookmarkAutoImport.running')
            : t('bookmarkAutoImport.runAll')}
        </Button>
      </div>

      {/* 手動取込との使い分け。ルールは「そのルールで入れた分を全削除して入れ直す」置き換え方式 */}
      <div className="auto-import-hint">
        <span>{t('bookmarkAutoImport.hint')}</span>
        {onOpenManualImport && (
          <Button variant="secondary" size="sm" onClick={onOpenManualImport}>
            {t('bookmarkAutoImport.manualImport')}
          </Button>
        )}
      </div>

      {/* ルール一覧 */}
      <div className="auto-import-rules-header">
        <h4>{t('bookmarkAutoImport.rules')}</h4>
      </div>

      {settings.rules.length === 0 ? (
        <div className="auto-import-empty">{t('bookmarkAutoImport.noRules')}</div>
      ) : (
        <div className="auto-import-rule-list">
          {settings.rules.map((rule) => (
            <div
              key={rule.id}
              className={`auto-import-rule-card ${!rule.enabled ? 'disabled' : ''}`}
            >
              <div className="auto-import-rule-card-header">
                <label>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleRuleEnabled(rule.id)}
                  />
                </label>
                <span className="auto-import-rule-name">{rule.name}</span>

                <div className="auto-import-rule-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExecuteRule(rule)}
                    disabled={executingRuleId !== null}
                    title={t('bookmarkAutoImport.runNow')}
                  >
                    {executingRuleId === rule.id
                      ? t('bookmarkAutoImport.running')
                      : t('bookmarkAutoImport.run')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                    title={t('bookmarkAutoImport.edit')}
                  >
                    {t('bookmarkAutoImport.edit')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                    title={t('bookmarkAutoImport.delete')}
                  >
                    {t('bookmarkAutoImport.delete')}
                  </Button>
                </div>
              </div>

              <div className="auto-import-rule-detail">
                <div className="rule-source">
                  {getBrowserDisplayName(rule.browserId)}
                  {` > ${rule.profileIds.length > 0 ? getProfileNames(rule) : t('bookmarkAutoImport.allProfiles')}`}
                  {` > ${describeFolders(rule)}`}
                  {rule.namePattern &&
                    t('bookmarkAutoImport.nameCondition', { word: rule.namePattern })}
                  {rule.urlPattern &&
                    t('bookmarkAutoImport.urlCondition', { word: rule.urlPattern })}
                </div>
                <div className="rule-target">
                  {dataFileLabels[rule.targetFile]
                    ? t('importCommon.fileWithName', {
                        label: dataFileLabels[rule.targetFile],
                        file: rule.targetFile,
                      })
                    : rule.targetFile}
                </div>
                <div
                  className={`rule-last-result ${rule.lastResult && !rule.lastResult.success ? 'error' : ''}`}
                >
                  {t('bookmarkAutoImport.previous', { result: formatLastResult(rule) })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ルール追加ボタン */}
      <div className="auto-import-add-rule">
        <button onClick={() => setEditingRule('new')}>{t('bookmarkAutoImport.addRule')}</button>
      </div>

      {/* ルール編集モーダル */}
      {editingRule !== null && (
        <BookmarkAutoImportRuleModal
          rule={editingRule === 'new' ? null : editingRule}
          dataFileTabs={dataFileTabs}
          dataFileLabels={dataFileLabels}
          onSave={handleSaveRule}
          onCancel={() => setEditingRule(null)}
        />
      )}

      {/* 新しいタブを作るときの確認 */}
      <ConfirmDialog
        isOpen={pendingConfirm !== null}
        onClose={() => closeConfirm(false)}
        onConfirm={() => closeConfirm(true)}
        title={pendingConfirm?.title}
        message={pendingConfirm?.message ?? ''}
        confirmText={pendingConfirm?.confirmText}
        cancelText={pendingConfirm?.cancelText}
      />

      {/* ルール削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={deleteConfirmRuleId !== null}
        onClose={() => setDeleteConfirmRuleId(null)}
        onConfirm={handleDeleteConfirm}
        title={t('bookmarkAutoImport.deleteTitle')}
        message={t('bookmarkAutoImport.deleteConfirm')}
        confirmText={t('bookmarkAutoImport.delete')}
        danger
        showCheckbox
        checkboxLabel={t('bookmarkAutoImport.deleteItemsToo')}
        checkboxChecked={deleteAlsoItems}
        onCheckboxChange={setDeleteAlsoItems}
      />
    </div>
  );
};

export default BookmarkAutoImportSettings;
