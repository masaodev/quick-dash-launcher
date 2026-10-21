/**
 * 画面: メインウィンドウと同じアイテムを参照に変える（ワークスペースのタブの右クリック）
 * 画面仕様: docs/screens/workspace-window.md#5811-メインウィンドウと同じアイテムを参照に変える
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceLinkCopiesPreview, WorkspaceLinkCopyEntry } from '@common/types';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { logError } from '../utils/debug';
import { toggleInSet } from '../utils/setUtils';
import '../styles/components/WindowSelectorModal.css';
import '../styles/components/SetEditor.css';

import { Button } from './ui';

interface WorkspaceLinkCopiesPageProps {
  workspaceId: string;
}

/** 候補が 1 件のものだけ変えられる。メモが両方にあって違うものは、メモを失わないよう既定で外す */
function isSelectable(entry: WorkspaceLinkCopyEntry): boolean {
  return entry.candidates.length === 1;
}

function isCheckedByDefault(entry: WorkspaceLinkCopyEntry): boolean {
  return isSelectable(entry) && entry.memo !== 'conflict';
}

/**
 * ワークスペースのコピーのうち、パスと引数が同じメインウィンドウのアイテムがあるものを一覧にし、
 * チェックしたものを参照に変えるページ（独立したウィンドウの中身）
 */
const WorkspaceLinkCopiesPage: React.FC<WorkspaceLinkCopiesPageProps> = ({ workspaceId }) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<WorkspaceLinkCopiesPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.workspaceAPI
      .previewLinkCopies(workspaceId)
      .then((result) => {
        if (cancelled) return;
        if (!result.workspaceName) {
          setNotFound(true);
          return;
        }
        document.title = t('workspace.linkCopies.title');
        setPreview(result);
        setSelected(new Set(result.entries.filter(isCheckedByDefault).map((e) => e.id)));
      })
      .catch((error) => {
        logError('参照に変えるコピーの一覧を読めませんでした:', error);
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, t]);

  const close = useCallback(() => {
    window.close();
  }, []);
  useModalKeyboard({ isOpen: true, modalRef, onClose: close });

  const apply = useCallback(async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const result = await window.electronAPI.workspaceAPI.applyLinkCopies([...selected]);
      if (!result.success) throw new Error('link failed');
      await window.electronAPI.showToastWindow({
        message: t('workspace.linkCopies.done', { count: result.count ?? 0 }),
        type: 'success',
      });
      window.close();
    } catch (error) {
      // 途中まで変えたものは残す（失敗は本体側がエラーのトーストで知らせる）
      logError('コピーを参照に変えられませんでした:', error);
      setBusy(false);
    }
  }, [selected, t]);

  if (notFound) {
    return (
      <div className="set-picker-page set-picker-missing">
        <p>{t('workspace.linkCopies.notFound')}</p>
        <Button variant="secondary" onClick={close}>
          {t('common.close')}
        </Button>
      </div>
    );
  }

  if (!preview) {
    return <div className="set-picker-page" />;
  }

  const renderNotes = (entry: WorkspaceLinkCopyEntry): string[] => {
    if (!isSelectable(entry)) {
      return [t('workspace.linkCopies.ambiguous', { count: entry.candidates.length })];
    }
    const notes: string[] = [];
    if (entry.alias) notes.push(t('workspace.linkCopies.alias', { name: entry.alias }));
    if (entry.memo === 'move') notes.push(t('workspace.linkCopies.memoMove'));
    if (entry.memo === 'conflict') notes.push(t('workspace.linkCopies.memoConflict'));
    if (entry.settingsDiffer) notes.push(t('workspace.linkCopies.settingsDiffer'));
    return notes;
  };

  return (
    <div className="set-picker-page">
      <div
        className="modal-content set-picker-modal set-picker-page-content"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label={t('workspace.linkCopies.title')}
      >
        <div className="workspace-link-banner">
          {t('workspace.linkCopies.banner', { workspace: preview.workspaceName })}
        </div>
        <div className="set-modal-header">
          <h3>{t('workspace.linkCopies.title')}</h3>
          <span className="set-muted">{t('set.picker.selected', { count: selected.size })}</span>
        </div>
        <div className="set-picker-list">
          {preview.entries.length === 0 ? (
            <div className="set-empty">{t('workspace.linkCopies.empty')}</div>
          ) : (
            preview.entries.map((entry) => {
              const selectable = isSelectable(entry);
              const checked = selected.has(entry.id);
              const candidate = entry.candidates[0];
              return (
                <label
                  key={entry.id}
                  className={`set-picker-row workspace-link-row${checked ? ' checked' : ''}${selectable ? '' : ' added'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!selectable}
                    onChange={() => setSelected((prev) => toggleInSet(prev, entry.id))}
                  />
                  <span className="workspace-link-row-body">
                    <span className="set-row-name">
                      {entry.displayName}
                      {selectable && (
                        <span className="set-muted">
                          {' '}
                          {t('workspace.linkCopies.target', { name: candidate.displayName })}
                          {candidate.tabName &&
                            ` ${t('workspace.linkCopies.tab', { tab: candidate.tabName })}`}
                        </span>
                      )}
                    </span>
                    {renderNotes(entry).map((note) => (
                      <span key={note} className="workspace-link-row-note">
                        {note}
                      </span>
                    ))}
                  </span>
                </label>
              );
            })
          )}
        </div>
        {preview.notMatchable > 0 && (
          <div className="workspace-link-footnote">
            {t('workspace.linkCopies.notMatchable', { count: preview.notMatchable })}
          </div>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={selected.size === 0 || busy}
            onClick={() => void apply()}
          >
            {t('workspace.linkCopies.apply', { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceLinkCopiesPage;
