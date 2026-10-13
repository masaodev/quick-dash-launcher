/**
 * ブックマーク取込の条件編集モーダル
 *
 * 2 つの入口から同じ画面を使う:
 * - 設定「ブックマーク自動取込」から（mode='rule'）: ルールの新規作成・編集。フッターは「保存」
 * - アイテム管理「ブラウザのブックマークを追加」から（mode='import'）: 同じ条件（ブラウザ／プロファイル／
 *   フォルダ／URL・名前パターン／表示名）で絞り込み、「今回だけ取り込む」か「ルールとして保存」を選ぶ。
 *   取込元に HTML ファイル（他ブラウザからのエクスポート）も選べる（ルールにはできない）
 *
 * ブックマークは取込元を決めた時点でフォルダ付きの一覧を 1 回読み、絞り込みと表示名の生成は
 * レンダラー側（@common/utils/bookmarkRuleFilter）で行う。条件を変えるたびにプレビューが更新される
 *
 * 画面: ブックマーク取込画面（ルール編集と共通）
 * 画面仕様: docs/screens/bookmark-import-modal.md
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { generateId } from '@common/utils/jsonParser';
import { DEFAULT_DATA_FILE } from '@common/types';
import type { BrowserInfo, DuplicateHandlingOption, SimpleBookmarkItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import type { BookmarkAutoImportRule, BookmarkWithFolder } from '@common/types/bookmarkAutoImport';
import {
  applyBookmarkRuleFilters,
  buildBookmarkDisplayName,
  buildBookmarkFolderTree,
  validateBookmarkRulePatterns,
} from '@common/utils/bookmarkRuleFilter';
import { checkDuplicates } from '@common/utils/duplicateDetector';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { logError } from '../utils/debug';

import { Button } from './ui';
import DuplicateHandlingSection from './DuplicateHandlingSection';

/** 取込元の種類。ルールにできるのはブラウザだけ */
type SourceKind = 'browser' | 'html';

interface BookmarkAutoImportRuleModalProps {
  /** 'rule'=設定からルールを編集（既定）、'import'=アイテム管理から取り込む */
  mode?: 'rule' | 'import';
  rule: BookmarkAutoImportRule | null; // null = 新規作成
  dataFiles: string[];
  dataFileLabels: Record<string, string>;
  /** import モードの取込先の初期値（アイテム管理で選んでいるデータファイル） */
  defaultTargetFile?: string;
  /** import モード: 重複判定に使う既存アイテム（全データファイル分。取込先で絞る） */
  existingItems?: EditableJsonItem[];
  onSave: (rule: BookmarkAutoImportRule) => Promise<void>;
  onCancel: () => void;
  /** import モード: 絞り込んだブックマークを今回だけ取り込む（未保存の変更として追加） */
  onImportOnce?: (
    bookmarks: SimpleBookmarkItem[],
    duplicateHandling: DuplicateHandlingOption,
    targetFile: string
  ) => void;
  /** import モード: 設定「ブックマーク自動取込」を開く（既存ルールの確認用。モーダルは閉じる） */
  onOpenAutoImportSettings?: () => void;
}

/** プレビューに出す上限（それ以上は件数だけ） */
const PREVIEW_LIMIT = 50;

const createEmptyRule = (targetFile: string): BookmarkAutoImportRule => ({
  id: generateId(),
  name: '',
  enabled: true,
  browserId: 'chrome',
  profileIds: [],
  folderPaths: [],
  folderFilterMode: 'include',
  includeSubfolders: true,
  urlPattern: '',
  namePattern: '',
  targetFile,
  prefix: '',
  suffix: '',
  folderNameMode: 'none',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const BookmarkAutoImportRuleModal: React.FC<BookmarkAutoImportRuleModalProps> = ({
  mode = 'rule',
  rule,
  dataFiles,
  dataFileLabels,
  defaultTargetFile,
  existingItems = [],
  onSave,
  onCancel,
  onImportOnce,
  onOpenAutoImportSettings,
}) => {
  const { t } = useTranslation();
  const isImportMode = mode === 'import';
  const modalRef = useRef<HTMLDivElement>(null);
  const [editingRule, setEditingRule] = useState<BookmarkAutoImportRule>(
    rule || createEmptyRule(defaultTargetFile || DEFAULT_DATA_FILE)
  );
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [browsersLoaded, setBrowsersLoaded] = useState(false);
  const [sourceKind, setSourceKind] = useState<SourceKind>('browser');
  const [htmlFile, setHtmlFile] = useState<{ path: string; name: string } | null>(null);
  const [allBookmarks, setAllBookmarks] = useState<BookmarkWithFolder[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandlingOption>('skip');
  const [isSaving, setIsSaving] = useState(false);

  const updateRule = (fields: Partial<BookmarkAutoImportRule>) => {
    setEditingRule((prev) => ({ ...prev, ...fields, updatedAt: Date.now() }));
  };

  useModalKeyboard({ isOpen: true, modalRef, onClose: onCancel });

  // ブラウザ検出
  useEffect(() => {
    window.electronAPI
      .detectInstalledBrowsers()
      .then((detected) => {
        setBrowsers(detected);
        // 新規のときだけ最初のプロファイルを選ぶ。既存ルールの空配列は「全プロファイル」なのでそのまま
        if (!rule && editingRule.profileIds.length === 0) {
          const browser = detected.find((b) => b.id === editingRule.browserId);
          if (browser?.installed && browser.profiles.length > 0) {
            updateRule({ profileIds: [browser.profiles[0].id] });
          }
        }
      })
      .catch((error) => logError('ブラウザの検出に失敗しました:', error))
      .finally(() => setBrowsersLoaded(true));
  }, []);

  const selectedBrowser = browsers.find((b) => b.id === editingRule.browserId);

  // 取込元が決まったらフォルダ付きの一覧を読む（絞り込みはこの一覧に対してレンダラーで行う）
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<BookmarkWithFolder[]> => {
      if (sourceKind === 'html') {
        if (!htmlFile) return [];
        return window.electronAPI.parseBookmarkFileWithFolders(htmlFile.path);
      }
      if (!browsersLoaded) return [];
      const browser = browsers.find((b) => b.id === editingRule.browserId);
      if (!browser || !browser.installed) return [];
      const targetProfiles =
        editingRule.profileIds.length === 0
          ? browser.profiles
          : browser.profiles.filter((p) => editingRule.profileIds.includes(p.id));
      const lists = await Promise.all(
        targetProfiles.map((p) =>
          window.electronAPI.bookmarkAutoImportAPI.getBookmarksWithFolders(p.bookmarkPath)
        )
      );
      return lists.flat();
    };

    setIsLoadingBookmarks(true);
    setLoadError(null);
    load()
      .then((bookmarks) => {
        if (!cancelled) setAllBookmarks(bookmarks);
      })
      .catch((error) => {
        logError('ブックマークの読み込みに失敗しました:', error);
        if (!cancelled) {
          setAllBookmarks([]);
          setLoadError(error instanceof Error ? error.message : t('bookmarkRule.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBookmarks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    sourceKind,
    htmlFile,
    browsersLoaded,
    browsers,
    editingRule.browserId,
    editingRule.profileIds,
  ]);

  const folders = useMemo(() => buildBookmarkFolderTree(allBookmarks), [allBookmarks]);
  const patternValidity = useMemo(() => validateBookmarkRulePatterns(editingRule), [editingRule]);

  /** 条件で絞り込み、表示名を変換した結果（常時プレビュー） */
  const previewItems = useMemo(
    () =>
      applyBookmarkRuleFilters(allBookmarks, editingRule).map((bookmark) => ({
        ...bookmark,
        displayName: buildBookmarkDisplayName(bookmark, editingRule),
      })),
    [allBookmarks, editingRule]
  );

  /** 今回だけ取り込むときの形（重複判定と取込に使う） */
  const importCandidates = useMemo<SimpleBookmarkItem[]>(
    () =>
      previewItems.map((item, index) => ({
        id: `bookmark-${index}`,
        displayName: item.displayName,
        url: item.url,
        checked: true,
      })),
    [previewItems]
  );

  const duplicateCheckResult = useMemo(() => {
    if (!isImportMode || importCandidates.length === 0) return null;
    const targetItems = existingItems.filter(
      (item) => item.meta.sourceFile === editingRule.targetFile
    );
    return checkDuplicates(importCandidates, targetItems);
  }, [isImportMode, importCandidates, existingItems, editingRule.targetFile]);

  const handleBrowserChange = (browserId: 'chrome' | 'edge') => {
    const browser = browsers.find((b) => b.id === browserId);
    const firstProfileId =
      browser?.installed && browser.profiles.length > 0 ? [browser.profiles[0].id] : [];
    updateRule({ browserId, profileIds: firstProfileId, folderPaths: [] });
  };

  /** 「すべてのプロファイル」（空配列）の切り替え。外したら最初のプロファイルだけにする */
  const handleAllProfilesToggle = () => {
    if (editingRule.profileIds.length === 0) {
      const first = selectedBrowser?.profiles[0];
      updateRule({ profileIds: first ? [first.id] : [], folderPaths: [] });
    } else {
      updateRule({ profileIds: [], folderPaths: [] });
    }
  };

  /** 個別のプロファイルの切り替え。最後の 1 つは外せない（空配列は「すべて」の意味になるため） */
  const handleProfileToggle = (profileId: string) => {
    // 今は無いプロファイルの ID（削除済みなど）は、触った時点で落とす
    const current = editingRule.profileIds.filter((id) =>
      selectedBrowser?.profiles.some((p) => p.id === id)
    );
    const next = current.includes(profileId)
      ? current.filter((id) => id !== profileId)
      : [...current, profileId];
    if (next.length === 0) return;
    updateRule({ profileIds: next, folderPaths: [] });
  };

  const handleSourceKindChange = (kind: SourceKind) => {
    setSourceKind(kind);
    updateRule({ folderPaths: [] });
  };

  const handleSelectHtmlFile = async () => {
    try {
      const filePath = await window.electronAPI.selectBookmarkFile();
      if (!filePath) return;
      setHtmlFile({ path: filePath, name: filePath.split(/[\\/]/).pop() || filePath });
      updateRule({ folderPaths: [] });
    } catch (error) {
      logError('ブックマークファイルの選択に失敗しました:', error);
    }
  };

  const handleFolderToggle = (folderPath: string) => {
    setEditingRule((prev) => {
      const newFolderPaths = prev.folderPaths.includes(folderPath)
        ? prev.folderPaths.filter((p) => p !== folderPath)
        : [...prev.folderPaths, folderPath];
      return { ...prev, folderPaths: newFolderPaths, updatedAt: Date.now() };
    });
  };

  const handleSave = async () => {
    if (!editingRule.name.trim()) return;
    setIsSaving(true);
    try {
      await onSave({ ...editingRule, updatedAt: Date.now() });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportOnce = () => {
    if (!onImportOnce || importCandidates.length === 0) return;
    onImportOnce(importCandidates, duplicateHandling, editingRule.targetFile);
  };

  const canSaveAsRule = editingRule.name.trim().length > 0 && sourceKind === 'browser';
  const saveDisabledReason =
    sourceKind === 'html'
      ? t('bookmarkRule.htmlCannotBeRule')
      : !editingRule.name.trim()
        ? t('bookmarkRule.nameRequired')
        : undefined;

  const title = isImportMode
    ? t('bookmarkRule.importTitle')
    : rule
      ? t('bookmarkRule.editTitle')
      : t('bookmarkRule.newTitle');

  // フォルダツリーレンダリング
  const renderFolderTree = (
    folderList: ReturnType<typeof buildBookmarkFolderTree>,
    depth: number = 0
  ): React.ReactNode => {
    return folderList.map((folder) => (
      <div key={folder.path}>
        <div className="folder-tree-item" style={{ paddingLeft: `${depth * 16}px` }}>
          <label>
            <input
              type="checkbox"
              checked={editingRule.folderPaths.includes(folder.path)}
              onChange={() => handleFolderToggle(folder.path)}
            />
            {folder.name}
            <span className="folder-count">({folder.bookmarkCount})</span>
          </label>
        </div>
        {folder.children.length > 0 && renderFolderTree(folder.children, depth + 1)}
      </div>
    ));
  };

  const installedBrowsers = browsers.filter((b) => b.installed);
  /** 空配列＝すべてのプロファイル（あとから増えたプロファイルも対象） */
  const isAllProfiles = editingRule.profileIds.length === 0;
  /** 選択中のうち、今のブラウザに実在するプロファイル */
  const selectedProfileIds = editingRule.profileIds.filter((id) =>
    selectedBrowser?.profiles.some((p) => p.id === id)
  );

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className={`modal-content auto-import-rule-modal${isImportMode ? ' import-mode' : ''}`}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <h3>{title}</h3>

        {isImportMode && (
          <div className="auto-import-import-hint">
            <span>{t('bookmarkRule.importHint')}</span>
            {onOpenAutoImportSettings && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onCancel();
                  onOpenAutoImportSettings();
                }}
              >
                {t('bookmarkRule.openAutoImportSettings')}
              </Button>
            )}
          </div>
        )}

        <div className="auto-import-rule-form">
          {/* ルール名 */}
          <div className="auto-import-form-field">
            <label>{isImportMode ? t('bookmarkRule.nameForImport') : t('bookmarkRule.name')}</label>
            <input
              type="text"
              value={editingRule.name}
              onChange={(e) => updateRule({ name: e.target.value })}
              placeholder={t('bookmarkRule.namePlaceholder')}
            />
          </div>

          {/* ソース */}
          <div className="auto-import-form-section">
            <h4>{t('importCommon.source')}</h4>

            {isImportMode && (
              <div className="auto-import-form-field">
                <label>{t('bookmarkRule.sourceKind')}</label>
                <div className="browser-radio-group">
                  <label>
                    <input
                      type="radio"
                      name="sourceKind"
                      value="browser"
                      checked={sourceKind === 'browser'}
                      onChange={() => handleSourceKindChange('browser')}
                    />
                    {t('bookmarkRule.fromBrowser')}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="sourceKind"
                      value="html"
                      checked={sourceKind === 'html'}
                      onChange={() => handleSourceKindChange('html')}
                    />
                    {t('bookmarkRule.fromHtml')}
                  </label>
                </div>
              </div>
            )}

            {sourceKind === 'browser' && (
              <>
                <div className="auto-import-form-field">
                  <label>{t('bookmarkRule.browser')}</label>
                  <div className="browser-radio-group">
                    {installedBrowsers.map((browser) => (
                      <label key={browser.id}>
                        <input
                          type="radio"
                          name="browserId"
                          value={browser.id}
                          checked={editingRule.browserId === browser.id}
                          onChange={() => handleBrowserChange(browser.id)}
                        />
                        {browser.displayName}
                      </label>
                    ))}
                    {browsersLoaded && installedBrowsers.length === 0 && (
                      <span className="field-description">{t('bookmarkRule.noBrowsers')}</span>
                    )}
                  </div>
                </div>

                {selectedBrowser && selectedBrowser.profiles.length > 0 && (
                  <div className="auto-import-form-field">
                    <label>{t('bookmarkRule.profile')}</label>
                    <div className="profile-checkboxes">
                      {selectedBrowser.profiles.length > 1 && (
                        <label>
                          <input
                            type="checkbox"
                            checked={isAllProfiles}
                            onChange={handleAllProfilesToggle}
                          />
                          {t('bookmarkRule.allProfiles')}
                        </label>
                      )}
                      {selectedBrowser.profiles.map((profile) => {
                        const checked =
                          isAllProfiles || editingRule.profileIds.includes(profile.id);
                        const isLastChecked =
                          !isAllProfiles &&
                          selectedProfileIds.length === 1 &&
                          selectedProfileIds[0] === profile.id;
                        return (
                          <label key={profile.id}>
                            <input
                              type="checkbox"
                              value={profile.id}
                              checked={checked}
                              disabled={isAllProfiles || isLastChecked}
                              onChange={() => handleProfileToggle(profile.id)}
                            />
                            {profile.displayName}
                          </label>
                        );
                      })}
                    </div>
                    {!isAllProfiles && selectedProfileIds.length === 0 && (
                      <span className="field-description">
                        {t('bookmarkRule.profilesNotFound', {
                          profiles: editingRule.profileIds.join(', '),
                        })}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            {sourceKind === 'html' && (
              <div className="auto-import-form-field">
                <label>{t('bookmarkRule.file')}</label>
                <div className="auto-import-file-select">
                  <Button variant="secondary" size="sm" onClick={handleSelectHtmlFile}>
                    {t('bookmarkRule.selectFile')}
                  </Button>
                  <span className="auto-import-file-name">
                    {htmlFile ? htmlFile.name : t('bookmarkRule.noFile')}
                  </span>
                </div>
              </div>
            )}

            <div className="field-description auto-import-load-status">
              {isLoadingBookmarks
                ? t('bookmarkRule.loading')
                : loadError
                  ? t('bookmarkRule.loadError', { error: loadError })
                  : t('bookmarkRule.loaded', { count: allBookmarks.length })}
            </div>
          </div>

          {/* フィルタ条件 */}
          <div className="auto-import-form-section">
            <h4>{t('bookmarkRule.filters')}</h4>

            {folders.length > 0 && (
              <div className="auto-import-form-field">
                <label>{t('bookmarkRule.folder')}</label>
                <div className="folder-filter-mode">
                  <label>
                    <input
                      type="radio"
                      name="folderFilterMode"
                      value="include"
                      checked={editingRule.folderFilterMode === 'include'}
                      onChange={() => updateRule({ folderFilterMode: 'include' })}
                    />
                    {t('bookmarkRule.includeFolders')}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="folderFilterMode"
                      value="exclude"
                      checked={editingRule.folderFilterMode === 'exclude'}
                      onChange={() => updateRule({ folderFilterMode: 'exclude' })}
                    />
                    {t('bookmarkRule.excludeFolders')}
                  </label>
                </div>
                <div className="folder-tree-container">{renderFolderTree(folders)}</div>
                <label className="auto-import-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingRule.includeSubfolders}
                    onChange={(e) => updateRule({ includeSubfolders: e.target.checked })}
                  />
                  {t('bookmarkRule.includeSubfolders')}
                </label>
                <div className="field-description">
                  {editingRule.folderPaths.length === 0
                    ? t('bookmarkRule.noFolderSelected')
                    : t('bookmarkRule.foldersSelected', { count: editingRule.folderPaths.length })}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="auto-import-form-field">
                <label>{t('bookmarkRule.urlPattern')}</label>
                <input
                  type="text"
                  value={editingRule.urlPattern}
                  onChange={(e) => updateRule({ urlPattern: e.target.value })}
                  placeholder={t('bookmarkRule.urlPatternPlaceholder')}
                />
                <div
                  className={`field-description${patternValidity.urlPatternValid ? '' : ' auto-import-pattern-error'}`}
                >
                  {patternValidity.urlPatternValid
                    ? t('bookmarkRule.urlPatternEmpty')
                    : t('bookmarkRule.invalidPattern')}
                </div>
              </div>

              <div className="auto-import-form-field">
                <label>{t('bookmarkRule.namePattern')}</label>
                <input
                  type="text"
                  value={editingRule.namePattern}
                  onChange={(e) => updateRule({ namePattern: e.target.value })}
                  placeholder={t('bookmarkRule.namePatternPlaceholder')}
                />
                <div
                  className={`field-description${patternValidity.namePatternValid ? '' : ' auto-import-pattern-error'}`}
                >
                  {patternValidity.namePatternValid
                    ? t('bookmarkRule.namePatternEmpty')
                    : t('bookmarkRule.invalidPattern')}
                </div>
              </div>
            </div>
          </div>

          {/* インポート先 */}
          <div className="auto-import-form-section">
            <h4>{t('bookmarkRule.target')}</h4>
            <div className="auto-import-form-field">
              <label>{t('bookmarkRule.dataFile')}</label>
              <select
                value={editingRule.targetFile}
                onChange={(e) => updateRule({ targetFile: e.target.value })}
              >
                {dataFiles.map((file) => (
                  <option key={file} value={file}>
                    {dataFileLabels[file]
                      ? t('importCommon.fileWithName', { label: dataFileLabels[file], file })
                      : file}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 表示名の設定 */}
          <div className="auto-import-form-section">
            <h4>{t('bookmarkRule.displayName')}</h4>
            <div className="form-row">
              <div className="auto-import-form-field">
                <label>{t('bookmarkRule.prefix')}</label>
                <input
                  type="text"
                  value={editingRule.prefix}
                  onChange={(e) => updateRule({ prefix: e.target.value })}
                  placeholder={t('bookmarkRule.prefixPlaceholder')}
                />
              </div>
              <div className="auto-import-form-field">
                <label>{t('bookmarkRule.suffix')}</label>
                <input
                  type="text"
                  value={editingRule.suffix}
                  onChange={(e) => updateRule({ suffix: e.target.value })}
                  placeholder={t('bookmarkRule.suffixPlaceholder')}
                />
              </div>
            </div>
            <div className="auto-import-form-field">
              <label>{t('bookmarkRule.folderNameMode')}</label>
              <select
                value={editingRule.folderNameMode}
                onChange={(e) =>
                  updateRule({
                    folderNameMode: e.target.value as BookmarkAutoImportRule['folderNameMode'],
                  })
                }
              >
                {(['none', 'parent', 'fullPath', 'relativePath'] as const).map((mode) => (
                  <option key={mode} value={mode}>
                    {t(`bookmarkRule.folderNameModes.${mode}`)}
                  </option>
                ))}
              </select>
              <div className="field-description">{t('bookmarkRule.folderNameModeDescription')}</div>
            </div>
          </div>

          {/* プレビュー（常時） */}
          <div className="auto-import-form-section">
            <h4>{t('bookmarkRule.preview')}</h4>
            <div className="auto-import-preview" data-testid="bookmark-preview">
              <div className="auto-import-preview-header">
                <span className="auto-import-preview-count">
                  {t('bookmarkRule.matched', { count: previewItems.length })}
                  {allBookmarks.length > 0 &&
                    t('bookmarkRule.ofTotal', { count: allBookmarks.length })}
                </span>
              </div>
              {previewItems.length > 0 ? (
                <div className="auto-import-preview-list">
                  {previewItems.slice(0, PREVIEW_LIMIT).map((item, index) => (
                    <div key={index} className="auto-import-preview-item">
                      <span className="preview-name">{item.displayName}</span>
                      <span className="preview-url">{item.url}</span>
                    </div>
                  ))}
                  {previewItems.length > PREVIEW_LIMIT && (
                    <div className="auto-import-preview-more">
                      {t('bookmarkRule.more', { count: previewItems.length - PREVIEW_LIMIT })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="field-description">
                  {allBookmarks.length === 0
                    ? t('bookmarkRule.selectSource')
                    : t('bookmarkRule.noMatches')}
                </div>
              )}
            </div>
          </div>

          {/* 重複（今回だけ取り込むときの扱い） */}
          {duplicateCheckResult && duplicateCheckResult.duplicateCount > 0 && (
            <DuplicateHandlingSection
              message={t('bookmarkRule.duplicates', { count: duplicateCheckResult.duplicateCount })}
              value={duplicateHandling}
              onChange={setDuplicateHandling}
              name="duplicateHandling"
            />
          )}
        </div>

        {/* フッター */}
        <div className="auto-import-modal-footer">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          {isImportMode ? (
            <>
              <Button
                variant="primary"
                onClick={handleImportOnce}
                disabled={importCandidates.length === 0 || isSaving}
                title={t('bookmarkRule.importOnceTitle')}
              >
                {t('bookmarkRule.importOnce', { count: importCandidates.length })}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={!canSaveAsRule || isSaving}
                title={saveDisabledReason ?? t('bookmarkRule.saveAsRuleTitle')}
              >
                {isSaving ? t('importCommon.saving') : t('bookmarkRule.saveAsRule')}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!editingRule.name.trim() || isSaving}
            >
              {isSaving ? t('importCommon.saving') : t('importCommon.save')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookmarkAutoImportRuleModal;
