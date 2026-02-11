/**
 * ブックマーク自動取込設定コンポーネント
 *
 * AdminSettingsTabの「ブックマーク自動取込」カテゴリで表示される
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { BookmarkAutoImportRule } from '@common/types/bookmarkAutoImport';
import { summarizeImportResults } from '@common/utils/bookmarkImportUtils';

import { useBookmarkAutoImport } from '../hooks/useBookmarkAutoImport';
import { useToast } from '../hooks/useToast';

import { Button } from './ui';
import BookmarkAutoImportRuleModal from './BookmarkAutoImportRuleModal';

import '../styles/components/BookmarkAutoImport.css';

const BookmarkAutoImportSettings: React.FC = () => {
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
    previewRule,
  } = useBookmarkAutoImport();

  const { showSuccess, showError, showWarning } = useToast();

  const [editingRule, setEditingRule] = useState<BookmarkAutoImportRule | null | 'new'>(null);
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [dataFileLabels, setDataFileLabels] = useState<Record<string, string>>({});

  // データファイル一覧とラベルを取得
  useEffect(() => {
    window.electronAPI.getDataFiles().then(setDataFiles).catch(console.error);
    window.electronAPI
      .getSettings()
      .then((appSettings) => setDataFileLabels(appSettings.dataFileLabels || {}))
      .catch(console.error);
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

  const handleDeleteRule = useCallback(
    async (ruleId: string) => {
      if (window.confirm('このルールを削除しますか？')) {
        await deleteRule(ruleId);
      }
    },
    [deleteRule]
  );

  const handleExecuteRule = useCallback(
    async (rule: BookmarkAutoImportRule) => {
      const result = await executeRule(rule);
      if (result.success) {
        showSuccess(
          `ブックマーク取込（${rule.name}）: ${result.importedCount}件登録, ${result.deletedCount}件削除`
        );
      } else {
        showError(`ブックマーク取込（${rule.name}）: エラー - ${result.errorMessage}`);
      }
    },
    [executeRule, showSuccess, showError]
  );

  const handleExecuteAll = useCallback(async () => {
    const results = await executeAllRules();
    const { message, hasError } = summarizeImportResults(results);
    if (hasError) {
      showWarning(message);
    } else {
      showSuccess(message);
    }
  }, [executeAllRules, showSuccess, showWarning]);

  const formatLastResult = (rule: BookmarkAutoImportRule): string => {
    if (!rule.lastExecutedAt) return '未実行';

    const date = new Date(rule.lastExecutedAt);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    if (rule.lastResult?.success) {
      return `${dateStr} - ${rule.lastResult.importedCount}件登録, ${rule.lastResult.deletedCount}件削除`;
    } else if (rule.lastResult) {
      return `${dateStr} - エラー: ${rule.lastResult.errorMessage}`;
    }
    return dateStr;
  };

  const getBrowserDisplayName = (browserId: string): string => {
    return browserId === 'chrome' ? 'Chrome' : 'Edge';
  };

  if (isLoading) {
    return <div className="auto-import-empty">読み込み中...</div>;
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
          起動時に自動実行する
        </label>
        <Button
          variant="primary"
          className="execute-all-button"
          onClick={handleExecuteAll}
          disabled={
            executingRuleId !== null || settings.rules.filter((r) => r.enabled).length === 0
          }
        >
          {executingRuleId === 'all' ? '実行中...' : '今すぐ全ルール実行'}
        </Button>
      </div>

      {/* ルール一覧 */}
      <div className="auto-import-rules-header">
        <h4>ルール一覧</h4>
      </div>

      {settings.rules.length === 0 ? (
        <div className="auto-import-empty">
          ルールがまだ登録されていません。「+ ルールを追加」で新しいルールを作成してください。
        </div>
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
                    title="今すぐ実行"
                  >
                    {executingRuleId === rule.id ? '実行中...' : '実行'}
                  </button>
                  <button onClick={() => setEditingRule(rule)} title="編集">
                    編集
                  </button>
                  <button className="danger" onClick={() => handleDeleteRule(rule.id)} title="削除">
                    削除
                  </button>
                </div>
              </div>

              <div className="auto-import-rule-detail">
                <div className="rule-source">
                  {getBrowserDisplayName(rule.browserId)}
                  {rule.profileIds.length > 0
                    ? ` > ${rule.profileIds.join(', ')}`
                    : ' > 全プロファイル'}
                  {rule.folderPaths.length > 0
                    ? ` > ${rule.folderPaths.join(', ')}`
                    : ' > 全フォルダ'}
                </div>
                <div className="rule-target">
                  {dataFileLabels[rule.targetFile]
                    ? `${dataFileLabels[rule.targetFile]}（${rule.targetFile}）`
                    : rule.targetFile}
                </div>
                <div
                  className={`rule-last-result ${rule.lastResult && !rule.lastResult.success ? 'error' : ''}`}
                >
                  前回: {formatLastResult(rule)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ルール追加ボタン */}
      <div className="auto-import-add-rule">
        <button onClick={() => setEditingRule('new')}>+ ルールを追加</button>
      </div>

      {/* ルール編集モーダル */}
      {editingRule !== null && (
        <BookmarkAutoImportRuleModal
          rule={editingRule === 'new' ? null : editingRule}
          dataFiles={dataFiles}
          dataFileLabels={dataFileLabels}
          onSave={handleSaveRule}
          onCancel={() => setEditingRule(null)}
          onPreview={previewRule}
        />
      )}
    </div>
  );
};

export default BookmarkAutoImportSettings;
