/**
 * ブックマーク自動取込設定コンポーネント
 *
 * AdminSettingsTabの「ブックマーク自動取込」カテゴリで表示される
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { BrowserInfo } from '@common/types';
import type { BookmarkAutoImportRule } from '@common/types/bookmarkAutoImport';
import { formatImportSummary, summarizeImportResults } from '@common/utils/bookmarkImportUtils';

import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';
import { useToast } from '../hooks/useToast';

import { Button } from './ui';
import BookmarkAutoImportRuleModal from './BookmarkAutoImportRuleModal';
import ConfirmDialog from './ConfirmDialog';

import '../styles/components/BookmarkAutoImport.css';

interface BookmarkAutoImportSettingsProps {
  /** 「一度だけ取り込む」→ アイテム管理の手動取込モーダルを開く */
  onOpenManualImport?: () => void;
}

const BookmarkAutoImportSettings: React.FC<BookmarkAutoImportSettingsProps> = ({
  onOpenManualImport,
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
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [dataFileLabels, setDataFileLabels] = useState<Record<string, string>>({});
  const [deleteConfirmRuleId, setDeleteConfirmRuleId] = useState<string | null>(null);
  const [deleteAlsoItems, setDeleteAlsoItems] = useState(false);
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);

  // データファイル一覧とラベルを取得
  useEffect(() => {
    window.electronAPI.getDataFiles().then(setDataFiles).catch(console.error);
    window.electronAPI
      .getSettings()
      .then((appSettings) => setDataFileLabels(appSettings.dataFileLabels || {}))
      .catch(console.error);
    // ルール一覧でプロファイルを表示名で出すため（見つからなければ ID のまま）
    window.electronAPI.detectInstalledBrowsers().then(setBrowsers).catch(console.error);
  }, []);

  const handleSaveRule = useCallback(
    async (rule: BookmarkAutoImportRule) => {
      if (editingRule === 'new') {
        await addRule(rule);
      } else {
        await updateRule(rule);
      }
      setEditingRule(null);
    },
    [editingRule, addRule, updateRule]
  );

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
      const duplicates = rule.lastResult.manualDuplicateCount
        ? t('bookmarkAutoImport.lastResultDuplicates', {
            count: rule.lastResult.manualDuplicateCount,
          })
        : '';
      return t('bookmarkAutoImport.lastResult', {
        date: dateStr,
        imported: rule.lastResult.importedCount,
        deleted: rule.lastResult.deletedCount,
        duplicates,
      });
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
          <Button variant="info" size="sm" onClick={onOpenManualImport}>
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
                  <button
                    onClick={() => handleExecuteRule(rule)}
                    disabled={executingRuleId !== null}
                    title={t('bookmarkAutoImport.runNow')}
                  >
                    {executingRuleId === rule.id
                      ? t('bookmarkAutoImport.running')
                      : t('bookmarkAutoImport.run')}
                  </button>
                  <button onClick={() => setEditingRule(rule)} title={t('bookmarkAutoImport.edit')}>
                    {t('bookmarkAutoImport.edit')}
                  </button>
                  <button
                    className="danger"
                    onClick={() => handleDeleteRule(rule.id)}
                    title={t('bookmarkAutoImport.delete')}
                  >
                    {t('bookmarkAutoImport.delete')}
                  </button>
                </div>
              </div>

              <div className="auto-import-rule-detail">
                <div className="rule-source">
                  {getBrowserDisplayName(rule.browserId)}
                  {` > ${rule.profileIds.length > 0 ? getProfileNames(rule) : t('bookmarkAutoImport.allProfiles')}`}
                  {` > ${rule.folderPaths.length > 0 ? rule.folderPaths.join(', ') : t('bookmarkAutoImport.allFolders')}`}
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
          dataFiles={dataFiles}
          dataFileLabels={dataFileLabels}
          onSave={handleSaveRule}
          onCancel={() => setEditingRule(null)}
        />
      )}

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
