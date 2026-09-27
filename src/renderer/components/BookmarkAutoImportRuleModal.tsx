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
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
        // プロファイル未選択の場合、最初のプロファイルを自動選択
        if (editingRule.profileIds.length === 0) {
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
          setLoadError(
            error instanceof Error ? error.message : 'ブックマークの読み込みに失敗しました'
          );
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

  const handleProfileChange = (profileId: string) => {
    updateRule({ profileIds: profileId === '' ? [] : [profileId], folderPaths: [] });
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
      ? 'HTML ファイルはルールにできません（ルールは Chrome / Edge から直接読みます）'
      : !editingRule.name.trim()
        ? 'ルール名を入力してください'
        : undefined;

  const title = isImportMode
    ? 'ブラウザのブックマークの追加'
    : `ブックマーク自動取込 - ${rule ? 'ルールを編集' : '新規ルール作成'}`;

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
            <span>
              条件で絞り込んだブックマークを取り込みます。「今回だけ取り込む」は未保存の変更として追加し、
              あとは自分で編集します。「ルールとして保存」は設定にルールを追加してすぐ実行し、
              以後はルールがブラウザ側の変更に追従します。
            </span>
            {onOpenAutoImportSettings && (
              <Button
                variant="info"
                size="sm"
                onClick={() => {
                  onCancel();
                  onOpenAutoImportSettings();
                }}
              >
                自動取込の設定を開く
              </Button>
            )}
          </div>
        )}

        <div className="auto-import-rule-form">
          {/* ルール名 */}
          <div className="auto-import-form-field">
            <label>
              {isImportMode ? 'ルール名（ルールとして保存するときに使います）:' : 'ルール名:'}
            </label>
            <input
              type="text"
              value={editingRule.name}
              onChange={(e) => updateRule({ name: e.target.value })}
              placeholder="例: 開発系ブックマーク"
            />
          </div>

          {/* ソース */}
          <div className="auto-import-form-section">
            <h4>取込元</h4>

            {isImportMode && (
              <div className="auto-import-form-field">
                <label>種類:</label>
                <div className="browser-radio-group">
                  <label>
                    <input
                      type="radio"
                      name="sourceKind"
                      value="browser"
                      checked={sourceKind === 'browser'}
                      onChange={() => handleSourceKindChange('browser')}
                    />
                    ブラウザから直接読む
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="sourceKind"
                      value="html"
                      checked={sourceKind === 'html'}
                      onChange={() => handleSourceKindChange('html')}
                    />
                    HTML ファイル（他ブラウザからのエクスポート）
                  </label>
                </div>
              </div>
            )}

            {sourceKind === 'browser' && (
              <>
                <div className="auto-import-form-field">
                  <label>ブラウザ:</label>
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
                      <span className="field-description">
                        インストール済みブラウザが見つかりません
                      </span>
                    )}
                  </div>
                </div>

                {selectedBrowser && selectedBrowser.profiles.length > 0 && (
                  <div className="auto-import-form-field">
                    <label>プロファイル:</label>
                    <div className="profile-checkboxes">
                      {selectedBrowser.profiles.map((profile) => (
                        <label key={profile.id}>
                          <input
                            type="radio"
                            name="profileId"
                            value={profile.id}
                            checked={editingRule.profileIds[0] === profile.id}
                            onChange={() => handleProfileChange(profile.id)}
                          />
                          {profile.displayName}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {sourceKind === 'html' && (
              <div className="auto-import-form-field">
                <label>ファイル:</label>
                <div className="auto-import-file-select">
                  <Button variant="info" size="sm" onClick={handleSelectHtmlFile}>
                    ファイルを選択
                  </Button>
                  <span className="auto-import-file-name">
                    {htmlFile ? htmlFile.name : '未選択'}
                  </span>
                </div>
              </div>
            )}

            <div className="field-description auto-import-load-status">
              {isLoadingBookmarks
                ? 'ブックマークを読み込み中...'
                : loadError
                  ? `読み込みに失敗: ${loadError}`
                  : `${allBookmarks.length} 件のブックマークを読み込みました`}
            </div>
          </div>

          {/* フィルタ条件 */}
          <div className="auto-import-form-section">
            <h4>フィルタ条件</h4>

            {folders.length > 0 && (
              <div className="auto-import-form-field">
                <label>フォルダ:</label>
                <div className="folder-filter-mode">
                  <label>
                    <input
                      type="radio"
                      name="folderFilterMode"
                      value="include"
                      checked={editingRule.folderFilterMode === 'include'}
                      onChange={() => updateRule({ folderFilterMode: 'include' })}
                    />
                    選択フォルダのみ
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="folderFilterMode"
                      value="exclude"
                      checked={editingRule.folderFilterMode === 'exclude'}
                      onChange={() => updateRule({ folderFilterMode: 'exclude' })}
                    />
                    選択フォルダを除外
                  </label>
                </div>
                <div className="folder-tree-container">{renderFolderTree(folders)}</div>
                <label className="auto-import-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingRule.includeSubfolders}
                    onChange={(e) => updateRule({ includeSubfolders: e.target.checked })}
                  />
                  サブフォルダのブックマークも含める
                </label>
                <div className="field-description">
                  {editingRule.folderPaths.length === 0
                    ? '未選択の場合は全フォルダが対象になります'
                    : `${editingRule.folderPaths.length}フォルダ選択中`}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="auto-import-form-field">
                <label>URLパターン（正規表現）:</label>
                <input
                  type="text"
                  value={editingRule.urlPattern}
                  onChange={(e) => updateRule({ urlPattern: e.target.value })}
                  placeholder="例: github\.com"
                />
                <div
                  className={`field-description${patternValidity.urlPatternValid ? '' : ' auto-import-pattern-error'}`}
                >
                  {patternValidity.urlPatternValid
                    ? '未入力時は全URL対象'
                    : '正規表現として読めないため、この条件は無視されます'}
                </div>
              </div>

              <div className="auto-import-form-field">
                <label>名前パターン（正規表現）:</label>
                <input
                  type="text"
                  value={editingRule.namePattern}
                  onChange={(e) => updateRule({ namePattern: e.target.value })}
                  placeholder="例: 開発|ツール"
                />
                <div
                  className={`field-description${patternValidity.namePatternValid ? '' : ' auto-import-pattern-error'}`}
                >
                  {patternValidity.namePatternValid
                    ? '未入力時は全名前対象'
                    : '正規表現として読めないため、この条件は無視されます'}
                </div>
              </div>
            </div>
          </div>

          {/* インポート先 */}
          <div className="auto-import-form-section">
            <h4>インポート先</h4>
            <div className="auto-import-form-field">
              <label>データファイル:</label>
              <select
                value={editingRule.targetFile}
                onChange={(e) => updateRule({ targetFile: e.target.value })}
              >
                {dataFiles.map((file) => (
                  <option key={file} value={file}>
                    {dataFileLabels[file] ? `${dataFileLabels[file]}（${file}）` : file}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 表示名の設定 */}
          <div className="auto-import-form-section">
            <h4>表示名の設定</h4>
            <div className="form-row">
              <div className="auto-import-form-field">
                <label>接頭辞:</label>
                <input
                  type="text"
                  value={editingRule.prefix}
                  onChange={(e) => updateRule({ prefix: e.target.value })}
                  placeholder="例: [Chrome] "
                />
              </div>
              <div className="auto-import-form-field">
                <label>接尾辞:</label>
                <input
                  type="text"
                  value={editingRule.suffix}
                  onChange={(e) => updateRule({ suffix: e.target.value })}
                  placeholder="例:  (自動)"
                />
              </div>
            </div>
            <div className="auto-import-form-field">
              <label>フォルダ名付与:</label>
              <select
                value={editingRule.folderNameMode}
                onChange={(e) =>
                  updateRule({
                    folderNameMode: e.target.value as BookmarkAutoImportRule['folderNameMode'],
                  })
                }
              >
                <option value="none">なし</option>
                <option value="parent">直近の親フォルダ</option>
                <option value="fullPath">フルパス</option>
                <option value="relativePath">ルート除外パス</option>
              </select>
              <div className="field-description">
                表示名にフォルダ名を付与（例: [Tools] ブックマーク名）
              </div>
            </div>
          </div>

          {/* プレビュー（常時） */}
          <div className="auto-import-form-section">
            <h4>プレビュー</h4>
            <div className="auto-import-preview" data-testid="bookmark-preview">
              <div className="auto-import-preview-header">
                <span className="auto-import-preview-count">
                  マッチ: {previewItems.length}件
                  {allBookmarks.length > 0 && ` / ${allBookmarks.length}件`}
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
                      ...他 {previewItems.length - PREVIEW_LIMIT}件
                    </div>
                  )}
                </div>
              ) : (
                <div className="field-description">
                  {allBookmarks.length === 0
                    ? '取込元を選ぶとブックマークが読み込まれます'
                    : '条件に一致するブックマークはありません'}
                </div>
              )}
            </div>
          </div>

          {/* 重複（今回だけ取り込むときの扱い） */}
          {duplicateCheckResult && duplicateCheckResult.duplicateCount > 0 && (
            <div className="duplicate-warning-section">
              <div className="duplicate-warning-message">
                <span className="duplicate-warning-icon">&#9888;</span>
                <span>
                  取込先に同じ URL が {duplicateCheckResult.duplicateCount}
                  件あります（「今回だけ取り込む」のときの扱い）
                </span>
              </div>
              <div className="duplicate-options-section">
                <span className="duplicate-options-label">重複時の処理:</span>
                <label className="duplicate-option">
                  <input
                    type="radio"
                    name="duplicateHandling"
                    value="skip"
                    checked={duplicateHandling === 'skip'}
                    onChange={() => setDuplicateHandling('skip')}
                  />
                  <span>スキップ（重複アイテムはインポートしない）</span>
                </label>
                <label className="duplicate-option">
                  <input
                    type="radio"
                    name="duplicateHandling"
                    value="overwrite"
                    checked={duplicateHandling === 'overwrite'}
                    onChange={() => setDuplicateHandling('overwrite')}
                  />
                  <span>上書き（既存アイテムを新しい情報で更新）</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="auto-import-modal-footer">
          <Button variant="cancel" onClick={onCancel}>
            キャンセル
          </Button>
          {isImportMode ? (
            <>
              <Button
                variant="primary"
                onClick={handleImportOnce}
                disabled={importCandidates.length === 0 || isSaving}
                title="絞り込んだブックマークを未保存の変更として追加します（印は付きません）"
              >
                今回だけ取り込む ({importCandidates.length}件)
              </Button>
              <Button
                variant="info"
                onClick={handleSave}
                disabled={!canSaveAsRule || isSaving}
                title={saveDisabledReason ?? '設定にルールを追加してすぐ実行します'}
              >
                {isSaving ? '保存中...' : 'ルールとして保存'}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!editingRule.name.trim() || isSaving}
            >
              {isSaving ? '保存中...' : '保存'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookmarkAutoImportRuleModal;
