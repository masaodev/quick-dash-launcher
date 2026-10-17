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
  /** 保存されていたプロファイルを置き換えたときの知らせ（見つからない・複数やすべてで保存されていた） */
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [folderPanelOpen, setFolderPanelOpen] = useState(false);
  // 表示名の欄は幅を取らないので、初めから開いておく（閉じることもできる）
  const [namingOpen, setNamingOpen] = useState(true);

  const dest = useImportDestination({
    isOpen: true,
    dataFileTabs,
    dataFileLabels,
    initialTabIndex: 0,
    initialFile: rule?.targetFile,
    defaultName: t('bookmarkImportModal.defaultName'),
  });

  // 編集するルールの取込先が、どのタブにも無いデータファイルのとき（帯では選べない）。
  // 「変更」を押すまでは、そのファイルのまま保存する
  const unlistedTarget =
    rule && rule.targetFile && !dataFileTabs.some((tab) => tab.files.includes(rule.targetFile))
      ? rule.targetFile
      : null;
  const [changeUnlisted, setChangeUnlisted] = useState(false);
  const keepUnlisted = unlistedTarget !== null && !changeUnlisted;
  const destination: ImportDestination = keepUnlisted
    ? { kind: 'existing', fileName: unlistedTarget }
    : dest.destination;
  const destinationText = keepUnlisted
    ? dataFileLabels[unlistedTarget] || unlistedTarget
    : dest.destinationText;

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
        // プロファイルは 1 つだけ選ぶ。保存されていたものが見つからなければ（「すべて」で保存した古いルールも）、
        // 最初のプロファイルにする
        const browser = detected.find((b) => b.id === editingRule.browserId);
        if (browser?.installed && browser.profiles.length > 0) {
          const found = editingRule.profileIds.find((id) =>
            browser.profiles.some((p) => p.id === id)
          );
          const resolved = found ?? browser.profiles[0].id;
          if (rule && rule.profileIds.length !== 1) {
            // 複数・すべてのプロファイルで保存されていたルール。保存すると 1 つになることを知らせる
            const name = browser.profiles.find((p) => p.id === resolved)?.displayName ?? resolved;
            setProfileNotice(t('bookmarkRule.profilesNarrowed', { profile: name }));
          } else if (!found && rule) {
            setProfileNotice(
              t('bookmarkRule.profilesNotFound', { profiles: rule.profileIds.join(', ') })
            );
          }
          if (editingRule.profileIds.length !== 1 || editingRule.profileIds[0] !== resolved) {
            // 別のプロファイルに替わるときは、フォルダの指定も外す（手で選び替えたときと同じ）
            updateRule(
              found ? { profileIds: [resolved] } : { profileIds: [resolved], folderPaths: [] }
            );
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
          {
            // 3 つ以上は数でまとめる（どれかはフォルダの木で分かる）
            folders:
              editingRule.folderPaths.length > 2
                ? t('bookmarkRule.foldersCount', { count: editingRule.folderPaths.length })
                : editingRule.folderPaths.map(folderLabel).join(t('common.listSeparator')),
          }
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
        destination
      );
      if (!saved) setIsSaving(false);
    } catch (error) {
      logError('ルールの保存に失敗しました:', error);
      setIsSaving(false);
    }
  };

  const title = rule ? t('bookmarkRule.editTitle') : t('bookmarkRule.newTitle');
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

        {keepUnlisted ? (
          <div className="import-dest">
            <span className="import-dest-label">{t('importCommon.destination')}</span>
            <span>{destinationText}</span>
            <span className="import-dest-label">{t('bookmarkRule.unlistedTarget')}</span>
            <Button variant="secondary" size="sm" onClick={() => setChangeUnlisted(true)}>
              {t('bookmarkRule.changeTarget')}
            </Button>
          </div>
        ) : (
          <ImportDestinationBand dest={dest} />
        )}

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
            <span className="bookmark-rule-label">{t('bookmarkRule.source')}</span>
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
                <select
                  aria-label={t('bookmarkRule.profile')}
                  value={editingRule.profileIds[0] ?? ''}
                  onChange={(e) => {
                    setProfileNotice(null);
                    updateRule({ profileIds: [e.target.value], folderPaths: [] });
                  }}
                >
                  {selectedBrowser.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
                </select>
              )}
              <span className="bookmark-rule-status">{statusText}</span>
            </div>
            {browsersLoaded && installedBrowsers.length === 0 && (
              <div className="bookmark-rule-wide field-description">
                {t('bookmarkRule.noBrowsers')}
              </div>
            )}
            {profileNotice && (
              <div className="bookmark-rule-wide field-description bookmark-rule-error">
                {profileNotice}
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
                <span className="bookmark-rule-dropdown-text">{folderSummary}</span>
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

          {/* 上の一覧と続いて見えないよう、ルール名の下と同じ点線で区切る */}
          <div className="bookmark-rule-divider" />

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
            {t('importCommon.destinationEcho', { target: destinationText })}
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
