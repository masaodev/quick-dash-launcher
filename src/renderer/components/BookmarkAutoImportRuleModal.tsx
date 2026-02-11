/**
 * ブックマーク自動取込ルール編集モーダル
 */

import React, { useState, useEffect, useCallback } from 'react';
import { generateId } from '@common/utils/jsonParser';
import { DEFAULT_DATA_FILE } from '@common/types';
import type { BrowserInfo } from '@common/types';
import type {
  BookmarkAutoImportRule,
  BookmarkFolder,
  BookmarkWithFolder,
} from '@common/types/bookmarkAutoImport';

import { Button } from './ui';

interface BookmarkAutoImportRuleModalProps {
  rule: BookmarkAutoImportRule | null; // null = 新規作成
  dataFiles: string[];
  dataFileLabels: Record<string, string>;
  onSave: (rule: BookmarkAutoImportRule) => Promise<void>;
  onCancel: () => void;
  onPreview: (rule: BookmarkAutoImportRule) => Promise<BookmarkWithFolder[]>;
}

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
  targetFile: DEFAULT_DATA_FILE,
  prefix: '',
  suffix: '',
  folderNameMode: 'none',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const BookmarkAutoImportRuleModal: React.FC<BookmarkAutoImportRuleModalProps> = ({
  rule,
  dataFiles,
  dataFileLabels,
  onSave,
  onCancel,
  onPreview,
}) => {
  const [editingRule, setEditingRule] = useState<BookmarkAutoImportRule>(rule || createEmptyRule());
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [previewItems, setPreviewItems] = useState<BookmarkWithFolder[] | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateRule = (fields: Partial<BookmarkAutoImportRule>) => {
    setEditingRule((prev) => ({ ...prev, ...fields }));
  };

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
      .catch(console.error);
  }, []);

  // フォルダ構造の読み込み
  const loadFolders = useCallback(async () => {
    const browser = browsers.find((b) => b.id === editingRule.browserId);
    if (!browser || !browser.installed) {
      setFolders([]);
      return;
    }

    const targetProfiles =
      editingRule.profileIds.length === 0
        ? browser.profiles
        : browser.profiles.filter((p) => editingRule.profileIds.includes(p.id));

    if (targetProfiles.length === 0) {
      setFolders([]);
      return;
    }

    try {
      // 最初のプロファイルからフォルダ構造を取得（代表的な構造表示用）
      const allFolders: BookmarkFolder[] = [];
      for (const profile of targetProfiles) {
        const profileFolders = await window.electronAPI.bookmarkAutoImportAPI.getFolders(
          profile.bookmarkPath
        );
        // 重複を避けるため最初のプロファイルのみ使用
        if (allFolders.length === 0) {
          allFolders.push(...profileFolders);
        }
      }
      setFolders(allFolders);
    } catch {
      setFolders([]);
    }
  }, [browsers, editingRule.browserId, editingRule.profileIds]);

  useEffect(() => {
    if (browsers.length > 0) {
      loadFolders();
    }
  }, [browsers, loadFolders]);

  const selectedBrowser = browsers.find((b) => b.id === editingRule.browserId);

  const handleBrowserChange = (browserId: 'chrome' | 'edge') => {
    const browser = browsers.find((b) => b.id === browserId);
    const firstProfileId =
      browser?.installed && browser.profiles.length > 0 ? [browser.profiles[0].id] : [];
    updateRule({ browserId, profileIds: firstProfileId, folderPaths: [], updatedAt: Date.now() });
    setPreviewItems(null);
  };

  const handleProfileChange = (profileId: string) => {
    updateRule({ profileIds: profileId === '' ? [] : [profileId], updatedAt: Date.now() });
    setPreviewItems(null);
  };

  const handleFolderToggle = (folderPath: string) => {
    setEditingRule((prev) => {
      const newFolderPaths = prev.folderPaths.includes(folderPath)
        ? prev.folderPaths.filter((p) => p !== folderPath)
        : [...prev.folderPaths, folderPath];
      return { ...prev, folderPaths: newFolderPaths, updatedAt: Date.now() };
    });
    setPreviewItems(null);
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const items = await onPreview(editingRule);
      setPreviewItems(items);
    } catch (error) {
      console.error('プレビューエラー:', error);
      setPreviewItems([]);
    } finally {
      setIsPreviewLoading(false);
    }
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

  // フォルダツリーレンダリング
  const renderFolderTree = (folderList: BookmarkFolder[], depth: number = 0): React.ReactNode => {
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

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content auto-import-rule-modal" onClick={(e) => e.stopPropagation()}>
        <h3>ブックマーク自動取込 - {rule ? 'ルールを編集' : '新規ルール作成'}</h3>

        <div className="auto-import-rule-form">
          {/* ルール名 */}
          <div className="auto-import-form-field">
            <label>ルール名:</label>
            <input
              type="text"
              value={editingRule.name}
              onChange={(e) => updateRule({ name: e.target.value })}
              placeholder="例: 開発系ブックマーク"
            />
          </div>

          {/* ソース */}
          <div className="auto-import-form-section">
            <h4>ソース</h4>

            <div className="auto-import-form-field">
              <label>ブラウザ:</label>
              <div className="browser-radio-group">
                {browsers
                  .filter((b) => b.installed)
                  .map((browser) => (
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
                {browsers.filter((b) => b.installed).length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
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
                    onChange={(e) =>
                      updateRule({ includeSubfolders: e.target.checked, updatedAt: Date.now() })
                    }
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
                <div className="field-description">未入力時は全URL対象</div>
              </div>

              <div className="auto-import-form-field">
                <label>名前パターン（正規表現）:</label>
                <input
                  type="text"
                  value={editingRule.namePattern}
                  onChange={(e) => updateRule({ namePattern: e.target.value })}
                  placeholder="例: 開発|ツール"
                />
                <div className="field-description">未入力時は全名前対象</div>
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

          {/* プレビュー */}
          <div className="auto-import-form-section">
            <Button variant="info" onClick={handlePreview} disabled={isPreviewLoading}>
              {isPreviewLoading ? '読み込み中...' : 'プレビュー'}
            </Button>

            {previewItems !== null && (
              <div className="auto-import-preview">
                <div className="auto-import-preview-header">
                  <span className="auto-import-preview-count">マッチ: {previewItems.length}件</span>
                </div>
                {previewItems.length > 0 ? (
                  <div className="auto-import-preview-list">
                    {previewItems.slice(0, 50).map((item, index) => (
                      <div key={index} className="auto-import-preview-item">
                        <span className="preview-name">{item.displayName}</span>
                        <span className="preview-url">{item.url}</span>
                      </div>
                    ))}
                    {previewItems.length > 50 && (
                      <div
                        style={{
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontSize: 'var(--font-size-xs)',
                          padding: 'var(--spacing-sm)',
                        }}
                      >
                        ...他 {previewItems.length - 50}件
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    条件に一致するブックマークはありません
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="auto-import-modal-footer">
          <Button variant="cancel" onClick={onCancel}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!editingRule.name.trim() || isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookmarkAutoImportRuleModal;
