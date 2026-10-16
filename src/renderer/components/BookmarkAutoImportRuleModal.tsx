/**
 * 画面: ブックマークの取込ルールの追加・編集（設定「ブックマーク自動取込」の「＋ ルールを追加」「編集」から）
 * 画面仕様: docs/screens/bookmark-rule-modal.md
 *
 * 上から「取込先の帯 → ルール名 → 条件（取込元・フォルダ・名前・URL）→ このルールで取り込まれるもの →
 * オプション設定（表示名）」。条件を変えると、すぐ下の一覧が変わる。名前・URL は「その文字を含む」だけ。
 * アイテム管理から開く取込画面（BookmarkImportModal）はフォルダを選ぶだけで、細かい条件はこの画面で決める
 *
 * ブックマークは取込元を決めた時点でフォルダ付きの一覧を 1 回読み、絞り込みと表示名の生成は
 * 自動取込の実行と同じ処理（@common/utils/bookmarkRuleFilter）で行う
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { generateId } from '@common/utils/jsonParser';
import type { BrowserInfo, DataFileTab } from '@common/types';
import type {
  BookmarkAutoImportRule,
  BookmarkFolder,
  BookmarkWithFolder,
} from '@common/types/bookmarkAutoImport';
import {
  applyBookmarkRuleFilters,
  buildBookmarkDisplayName,
  buildBookmarkFolderTree,
} from '@common/utils/bookmarkRuleFilter';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useImportDestination, type ImportDestination } from '../hooks/useImportDestination';
import { logError } from '../utils/debug';
import { bookmarkFolderLabel } from '../utils/bookmarkFolderLabel';

import { Button } from './ui';
import ImportDestinationBand from './ImportDestinationBand';

interface BookmarkAutoImportRuleModalProps {
  rule: BookmarkAutoImportRule | null; // null = 新規作成
  dataFileTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
  /** 保存する。取込先が新しいタブ・ファイルなら呼び出し側が作る。作れなかったら false（画面は開いたまま） */
  onSave: (rule: BookmarkAutoImportRule, destination: ImportDestination) => Promise<boolean>;
  onCancel: () => void;
}

/** 結果の一覧に出す上限（それ以上は件数だけ） */
const PREVIEW_LIMIT = 200;

const createEmptyRule = (): BookmarkAutoImportRule => ({
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
  targetFile: '',
  prefix: '',
  suffix: '',
  folderNameMode: 'none',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const BookmarkAutoImportRuleModal: React.FC<BookmarkAutoImportRuleModalProps> = ({
  rule,
  dataFileTabs,
  dataFileLabels,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [editingRule, setEditingRule] = useState<BookmarkAutoImportRule>(
    // 「サブフォルダも含める」は画面から外した（いつも含める）
    rule ? { ...rule, includeSubfolders: true } : createEmptyRule()
  );
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [browsersLoaded, setBrowsersLoaded] = useState(false);
  const [allBookmarks, setAllBookmarks] = useState<BookmarkWithFolder[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [folderPanelOpen, setFolderPanelOpen] = useState(false);
  const [namingOpen, setNamingOpen] = useState(
    Boolean(rule && (rule.prefix || rule.suffix || rule.folderNameMode !== 'none'))
  );

  const dest = useImportDestination({
    isOpen: true,
    dataFileTabs,
    dataFileLabels,
    initialTabIndex: 0,
    initialFile: rule?.targetFile,
    defaultName: t('bookmarkImportModal.defaultName'),
  });

  const updateRule = (fields: Partial<BookmarkAutoImportRule>) => {
    setEditingRule((prev) => ({ ...prev, ...fields, updatedAt: Date.now() }));
  };

  useModalKeyboard({ isOpen: true, modalRef, onClose: onCancel });

  // プロファイルの選択肢は、外をクリックしたら閉じる
  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (!profileMenuRef.current?.contains(e.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileMenuOpen]);

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
  const installedBrowsers = browsers.filter((b) => b.installed);

  // 取込元が決まったらフォルダ付きの一覧を読む（絞り込みはこの一覧に対してレンダラーで行う）
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<BookmarkWithFolder[]> => {
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
  }, [browsersLoaded, browsers, editingRule.browserId, editingRule.profileIds]);

  const folders = useMemo(() => buildBookmarkFolderTree(allBookmarks), [allBookmarks]);

  /** 条件で絞り込み、表示名を変換した結果 */
  const matchedItems = useMemo(
    () =>
      applyBookmarkRuleFilters(allBookmarks, editingRule).map((bookmark) => ({
        ...bookmark,
        displayName: buildBookmarkDisplayName(bookmark, editingRule),
      })),
    [allBookmarks, editingRule]
  );

  const folderLabel = (path: string) => bookmarkFolderLabel(path.split('/').pop() ?? path, t);
  const pathLabel = (path: string) =>
    path
      .split('/')
      .map((name) => bookmarkFolderLabel(name, t))
      .join(' / ');

  /** フォルダの欄のボタンに出す要約 */
  const folderSummary =
    editingRule.folderPaths.length === 0
      ? t('bookmarkRule.allFolders')
      : t(
          editingRule.folderFilterMode === 'include'
            ? 'bookmarkRule.foldersIncluded'
            : 'bookmarkRule.foldersExcluded',
          { folders: editingRule.folderPaths.map(folderLabel).join(t('common.listSeparator')) }
        );

  /** ルール名が空のときに使う名前（条件から作る） */
  const autoName = (() => {
    const folderNames = editingRule.folderPaths.map(folderLabel).join(t('common.listSeparator'));
    const including = folderNames !== '' && editingRule.folderFilterMode === 'include';
    if (editingRule.namePattern) {
      return t('bookmarkRule.autoNameWithWord', {
        base: including ? folderNames : t('bookmarkImportModal.defaultName'),
        word: editingRule.namePattern,
      });
    }
    if (including) return folderNames;
    if (folderNames) return t('bookmarkRule.autoNameExcluding', { folders: folderNames });
    return t('bookmarkImportModal.allBookmarksRuleName');
  })();
  const effectiveName = editingRule.name.trim() || autoName;

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

  const handleFolderToggle = (folderPath: string) => {
    setEditingRule((prev) => {
      const newFolderPaths = prev.folderPaths.includes(folderPath)
        ? prev.folderPaths.filter((p) => p !== folderPath)
        : [...prev.folderPaths, folderPath];
      return { ...prev, folderPaths: newFolderPaths, updatedAt: Date.now() };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await onSave(
        { ...editingRule, name: effectiveName, includeSubfolders: true, updatedAt: Date.now() },
        dest.destination
      );
      if (!saved) setIsSaving(false);
    } catch (error) {
      logError('ルールの保存に失敗しました:', error);
      setIsSaving(false);
    }
  };

  const title = rule ? t('bookmarkRule.editTitle') : t('bookmarkRule.newTitle');
  /** 空配列＝すべてのプロファイル（あとから増えたプロファイルも対象） */
  const isAllProfiles = editingRule.profileIds.length === 0;
  /** 選択中のうち、今のブラウザに実在するプロファイル */
  const selectedProfileIds = editingRule.profileIds.filter((id) =>
    selectedBrowser?.profiles.some((p) => p.id === id)
  );
  const profileSummary = isAllProfiles
    ? t('bookmarkRule.allProfiles')
    : selectedProfileIds.length > 0
      ? selectedProfileIds
          .map((id) => selectedBrowser?.profiles.find((p) => p.id === id)?.displayName ?? id)
          .join(t('common.listSeparator'))
      : editingRule.profileIds.join(t('common.listSeparator'));

  const namingSummary = [
    editingRule.prefix && t('bookmarkRule.prefixSummary', { text: editingRule.prefix }),
    editingRule.suffix && t('bookmarkRule.suffixSummary', { text: editingRule.suffix }),
    editingRule.folderNameMode !== 'none' &&
      t(`bookmarkRule.folderNameModes.${editingRule.folderNameMode}`),
  ]
    .filter(Boolean)
    .join(t('common.listSeparator'));

  const renderFolderTree = (list: BookmarkFolder[], depth: number = 0): React.ReactNode =>
    list.map((folder) => {
      const checked = editingRule.folderPaths.includes(folder.path);
      return (
        <div key={folder.path}>
          <label
            className={`bookmark-rule-folder${checked ? ' selected' : ''}`}
            style={{ paddingLeft: `calc(var(--spacing-md) + ${depth} * var(--spacing-xl))` }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => handleFolderToggle(folder.path)}
            />
            <span className="bookmark-rule-folder-name">
              📁 {bookmarkFolderLabel(folder.name, t)}
            </span>
          </label>
          {folder.children.length > 0 && renderFolderTree(folder.children, depth + 1)}
        </div>
      );
    });

  const statusText = isLoadingBookmarks
    ? t('bookmarkRule.loading')
    : loadError
      ? t('bookmarkRule.loadError', { error: loadError })
      : t('bookmarkRule.loaded', { count: allBookmarks.length });

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content import-modal bookmark-rule-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="import-header">
          <h3>{title}</h3>
          <div className="import-selection">
            <span>
              {t('bookmarkRule.matchedCount', { count: matchedItems.length })}
              {allBookmarks.length > 0 && t('bookmarkRule.ofTotal', { count: allBookmarks.length })}
            </span>
          </div>
        </div>

        <div className="import-hint">{t('bookmarkRule.hint')}</div>

        <ImportDestinationBand dest={dest} />

        <div className="bookmark-rule-body">
          <div className="bookmark-rule-form">
            <label className="bookmark-rule-label" htmlFor="bookmark-rule-name">
              {t('bookmarkRule.name')}
            </label>
            <input
              id="bookmark-rule-name"
              type="text"
              value={editingRule.name}
              onChange={(e) => updateRule({ name: e.target.value })}
              placeholder={t('bookmarkRule.namePlaceholder', { name: autoName })}
            />
          </div>

          <div className="bookmark-rule-divider" />

          <div className="bookmark-rule-form">
            {/* 取込元 */}
            <span className="bookmark-rule-label">{t('importCommon.source')}</span>
            <div className="bookmark-rule-line">
              <select
                aria-label={t('bookmarkRule.browser')}
                value={editingRule.browserId}
                onChange={(e) => handleBrowserChange(e.target.value as 'chrome' | 'edge')}
              >
                {installedBrowsers.map((browser) => (
                  <option key={browser.id} value={browser.id}>
                    {browser.displayName}
                  </option>
                ))}
              </select>
              {selectedBrowser && selectedBrowser.profiles.length > 0 && (
                <div className="bookmark-rule-dropdown" ref={profileMenuRef}>
                  <button
                    type="button"
                    className={`bookmark-rule-dropdown-button${profileMenuOpen ? ' open' : ''}`}
                    aria-haspopup="true"
                    aria-expanded={profileMenuOpen}
                    aria-label={t('bookmarkRule.profile')}
                    onClick={() => setProfileMenuOpen((open) => !open)}
                  >
                    <span>{profileSummary}</span>
                    <span className="bookmark-rule-caret">{profileMenuOpen ? '▲' : '▼'}</span>
                  </button>
                  {profileMenuOpen && (
                    <div className="bookmark-rule-dropdown-menu">
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
                  )}
                </div>
              )}
              <span className="bookmark-rule-status">{statusText}</span>
            </div>
            {browsersLoaded && installedBrowsers.length === 0 && (
              <div className="bookmark-rule-wide field-description">
                {t('bookmarkRule.noBrowsers')}
              </div>
            )}
            {!isAllProfiles && selectedBrowser && selectedProfileIds.length === 0 && (
              <div className="bookmark-rule-wide field-description bookmark-rule-error">
                {t('bookmarkRule.profilesNotFound', {
                  profiles: editingRule.profileIds.join(', '),
                })}
              </div>
            )}

            {/* フォルダ（▼ で木が開く） */}
            <span className="bookmark-rule-label">{t('bookmarkRule.folder')}</span>
            <div className="bookmark-rule-line">
              <button
                type="button"
                className={`bookmark-rule-dropdown-button${folderPanelOpen ? ' open' : ''}`}
                aria-expanded={folderPanelOpen}
                onClick={() => setFolderPanelOpen((open) => !open)}
              >
                <span>{folderSummary}</span>
                <span className="bookmark-rule-caret">{folderPanelOpen ? '▲' : '▼'}</span>
              </button>
            </div>
            {folderPanelOpen && (
              <div className="bookmark-rule-wide bookmark-rule-folders">
                <div className="bookmark-rule-folders-head">
                  {t('bookmarkRule.folderTreeHeader')}
                </div>
                <div className="bookmark-rule-folders-body">
                  {folders.length > 0 ? (
                    renderFolderTree(folders)
                  ) : (
                    <div className="bookmark-import-empty">{t('bookmarkRule.selectSource')}</div>
                  )}
                </div>
                <div className="bookmark-rule-folders-foot">
                  <span>{t('bookmarkRule.checkedFolders')}</span>
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
              </div>
            )}

            {/* 名前・URL（その文字を含むものだけ） */}
            <label className="bookmark-rule-label" htmlFor="bookmark-rule-name-word">
              {t('bookmarkRule.nameWord')}
            </label>
            <div className="bookmark-rule-line">
              <input
                id="bookmark-rule-name-word"
                type="text"
                value={editingRule.namePattern}
                onChange={(e) => updateRule({ namePattern: e.target.value })}
                placeholder={t('bookmarkRule.nameWordPlaceholder')}
              />
              <span className="field-description">{t('bookmarkRule.nameWordDescription')}</span>
            </div>
            <label className="bookmark-rule-label" htmlFor="bookmark-rule-url-word">
              {t('bookmarkRule.urlWord')}
            </label>
            <div className="bookmark-rule-line">
              <input
                id="bookmark-rule-url-word"
                type="text"
                value={editingRule.urlPattern}
                onChange={(e) => updateRule({ urlPattern: e.target.value })}
                placeholder={t('bookmarkRule.urlWordPlaceholder')}
              />
              <span className="field-description">{t('bookmarkRule.urlWordDescription')}</span>
            </div>
          </div>

          {/* このルールで取り込まれるもの */}
          <div className="bookmark-import-list bookmark-rule-result" data-testid="bookmark-preview">
            <div className="bookmark-import-list-head">
              <span>{t('bookmarkRule.resultHeader')}</span>
              <span className="bookmark-import-list-note">
                {t('bookmarkRule.matchedCount', { count: matchedItems.length })}
              </span>
            </div>
            <div className="bookmark-import-list-body">
              {matchedItems.length === 0 ? (
                <div className="bookmark-import-empty">
                  {allBookmarks.length === 0
                    ? t('bookmarkRule.selectSource')
                    : t('bookmarkRule.noMatches')}
                </div>
              ) : (
                <>
                  {matchedItems.slice(0, PREVIEW_LIMIT).map((item, index) => (
                    <div key={index} className="bookmark-rule-item">
                      <div className="bookmark-import-title">
                        <span>{item.displayName}</span>
                      </div>
                      <div className="bookmark-import-url">
                        {item.folderPath && `${pathLabel(item.folderPath)} · `}
                        {item.url}
                      </div>
                    </div>
                  ))}
                  {matchedItems.length > PREVIEW_LIMIT && (
                    <div className="bookmark-import-empty">
                      {t('bookmarkRule.more', { count: matchedItems.length - PREVIEW_LIMIT })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* オプション設定（表示名）。登録画面のオプション設定と同じ畳み方 */}
          <div className="bookmark-rule-options">
            <button
              type="button"
              className="bookmark-rule-options-toggle"
              aria-expanded={namingOpen}
              onClick={() => setNamingOpen((open) => !open)}
            >
              <span className="bookmark-rule-caret">{namingOpen ? '▼' : '▶'}</span>
              <span>{t('bookmarkRule.namingOptions')}</span>
              <span className="bookmark-rule-options-summary">
                {namingSummary || t('bookmarkRule.namingNone')}
              </span>
            </button>
            {namingOpen && (
              <div className="bookmark-rule-options-body">
                <label>
                  <span>{t('bookmarkRule.prefix')}</span>
                  <input
                    type="text"
                    value={editingRule.prefix}
                    onChange={(e) => updateRule({ prefix: e.target.value })}
                    placeholder={t('bookmarkRule.prefixPlaceholder')}
                  />
                </label>
                <label>
                  <span>{t('bookmarkRule.suffix')}</span>
                  <input
                    type="text"
                    value={editingRule.suffix}
                    onChange={(e) => updateRule({ suffix: e.target.value })}
                    placeholder={t('bookmarkRule.suffixPlaceholder')}
                  />
                </label>
                <label>
                  <span>{t('bookmarkRule.folderNameMode')}</span>
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
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="import-footer">
          <span className="import-echo">
            {t('importCommon.destinationEcho', { target: dest.destinationText })}
          </span>
          <div className="import-actions">
            <Button variant="secondary" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving || !effectiveName.trim()}
            >
              {isSaving ? t('importCommon.saving') : t('importCommon.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookmarkAutoImportRuleModal;
