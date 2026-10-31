/**
 * 画面: ランチャーのアイテムとつなぐ（ワークスペースのタブの右クリック）
 * 画面仕様: docs/screens/workspace-window.md#521-ランチャーのアイテムとつなぐ
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  LauncherItem,
  WorkspaceLinkCopiesPreview,
  WorkspaceLinkCopyEntry,
} from '@common/types';

import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { logError } from '../utils/debug';
import { ITEM_TYPE_ICONS } from '../utils/itemTypeIcons';
import { toggleInSet } from '../utils/setUtils';
import '../styles/components/WindowSelectorModal.css';
import '../styles/components/SetEditor.css';
import '../styles/components/WorkspaceLinkCopies.css';

import { Button } from './ui';

interface WorkspaceLinkCopiesPageProps {
  workspaceId: string;
}

/** 候補が 2 件以上か（行の中でつなぐ先を選んでから変える） */
function isAmbiguous(entry: WorkspaceLinkCopyEntry): boolean {
  return entry.candidates.length > 1;
}

/** 候補が 1 件のものは既定でチェックする（メモが両方にあって違うものは、メモを失わないよう外す） */
function isCheckedByDefault(entry: WorkspaceLinkCopyEntry): boolean {
  return !isAmbiguous(entry) && entry.memo !== 'conflict';
}

/**
 * ワークスペースのコピーのうち、パスと引数が同じランチャーのアイテムがあるものを一覧にし、
 * チェックしたものをランチャーのアイテムとつなぐ（参照に変える）ページ（独立したウィンドウの中身）
 *
 * 「どれとつなぐか選んでください」（候補が 2 件以上）を上に、「そのままつなげます」を下に分けて出す。
 * 行は「ワークスペースの名前 🔗 ランチャーのアイテム」の左右 2 列
 */
const WorkspaceLinkCopiesPage: React.FC<WorkspaceLinkCopiesPageProps> = ({ workspaceId }) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<WorkspaceLinkCopiesPreview | null>(null);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 候補が 2 件以上のコピーで選んだつなぐ先（コピーの id → ランチャーのアイテムの id）
  const [choices, setChoices] = useState<Record<string, string>>({});
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
        // アイコンはキャッシュにあるものだけ（無ければ種別の絵文字）。一覧を待たせない
        const iconItems = result.entries.flatMap((e) => (e.iconItem ? [e.iconItem] : []));
        if (iconItems.length === 0) return;
        window.electronAPI
          .loadCachedIcons(iconItems as LauncherItem[])
          .then((loaded) => {
            if (!cancelled) setIcons(loaded);
          })
          .catch(() => {});
      })
      .catch((error) => {
        logError('つなげるアイテムの一覧を読めませんでした:', error);
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
      const chosen = Object.fromEntries(Object.entries(choices).filter(([id]) => selected.has(id)));
      const result = await window.electronAPI.workspaceAPI.applyLinkCopies([...selected], chosen);
      if (!result.success) throw new Error('link failed');
      await window.electronAPI.showToastWindow({
        message: t('workspace.linkCopies.done', { count: result.count ?? 0 }),
        type: 'success',
      });
      window.close();
    } catch (error) {
      // 途中まで変えたものは残す（失敗は本体側がエラーのトーストで知らせる）
      logError('ランチャーのアイテムとつなげませんでした:', error);
      setBusy(false);
    }
  }, [selected, choices, t]);

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

  const needEntries = preview.entries.filter(isAmbiguous);
  const readyEntries = preview.entries.filter((e) => !isAmbiguous(e));
  const unchosen = needEntries.filter((e) => !choices[e.id]).length;

  const choose = (entryId: string, itemId: string) => {
    setChoices((prev) => {
      const next = { ...prev };
      if (itemId) next[entryId] = itemId;
      else delete next[entryId];
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      if (itemId) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  };

  const setAllReady = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of readyEntries) {
        if (on) next.add(e.id);
        else next.delete(e.id);
      }
      return next;
    });
  };

  const renderIcon = (entry: WorkspaceLinkCopyEntry) => {
    const icon = entry.iconItem && icons[entry.iconItem.path];
    return (
      <span className="link-copies-icon" aria-hidden="true">
        {icon ? (
          <img src={icon} alt="" width="18" height="18" />
        ) : (
          (ITEM_TYPE_ICONS[entry.iconItem?.type ?? 'file'] ?? ITEM_TYPE_ICONS.file)
        )}
      </span>
    );
  };

  /** 行の右側の小さな札（タブ・メモ・設定の違い） */
  const renderChips = (entry: WorkspaceLinkCopyEntry) => {
    const tabName = entry.candidates[0]?.tabName;
    return (
      <span className="link-copies-sub">
        {tabName && (
          <span className="link-copies-chip">
            {t('workspace.linkCopies.tab', { tab: tabName })}
          </span>
        )}
        {entry.memo === 'move' && (
          <span className="link-copies-chip">{t('workspace.linkCopies.memoMove')}</span>
        )}
        {entry.memo === 'conflict' && (
          <span className="link-copies-chip warn">{t('workspace.linkCopies.memoConflict')}</span>
        )}
        {entry.settingsDiffer && (
          <span className="link-copies-chip warn">{t('workspace.linkCopies.settingsDiffer')}</span>
        )}
      </span>
    );
  };

  const renderNeedRow = (entry: WorkspaceLinkCopyEntry) => {
    const choice = choices[entry.id] ?? '';
    const checked = selected.has(entry.id);
    // 選ぶ欄がある行は label にしない（label の中の select は、無効なチェックボックスに引きずられる）
    return (
      <div
        key={entry.id}
        className={`link-copies-pair${checked ? ' checked' : ''}${choice ? '' : ' need'}`}
      >
        <input
          type="checkbox"
          aria-label={entry.displayName}
          checked={checked}
          disabled={!choice}
          onChange={() => setSelected((prev) => toggleInSet(prev, entry.id))}
        />
        <span className="link-copies-side">
          <span className="link-copies-name">
            {renderIcon(entry)}
            <span className="link-copies-text">{entry.displayName}</span>
          </span>
          <span className="link-copies-sub">
            {t('workspace.linkCopies.candidates', { count: entry.candidates.length })}
          </span>
        </span>
        <span className="link-copies-link" aria-hidden="true">
          🔗
        </span>
        <span className="link-copies-side">
          <select
            className="link-copies-choice"
            aria-label={t('workspace.linkCopies.chooseLabel', { name: entry.displayName })}
            value={choice}
            onChange={(e) => choose(entry.id, e.target.value)}
          >
            <option value="">{t('workspace.linkCopies.choose')}</option>
            {entry.candidates.map((c) => (
              <option key={c.itemId} value={c.itemId}>
                {c.tabName
                  ? t('workspace.linkCopies.candidateOption', {
                      name: c.displayName,
                      tab: c.tabName,
                    })
                  : c.displayName}
              </option>
            ))}
          </select>
        </span>
      </div>
    );
  };

  const renderReadyRow = (entry: WorkspaceLinkCopyEntry) => {
    const checked = selected.has(entry.id);
    const main = entry.candidates[0];
    return (
      <label key={entry.id} className={`link-copies-pair${checked ? ' checked' : ''}`}>
        <input
          type="checkbox"
          aria-label={entry.displayName}
          checked={checked}
          onChange={() => setSelected((prev) => toggleInSet(prev, entry.id))}
        />
        <span className="link-copies-side">
          <span className="link-copies-name">
            {renderIcon(entry)}
            <span className="link-copies-text">{entry.displayName}</span>
          </span>
          <span className="link-copies-sub">
            {entry.alias ? t('workspace.linkCopies.nameKept') : t('workspace.linkCopies.nameSame')}
          </span>
        </span>
        <span className="link-copies-link" aria-hidden="true">
          🔗
        </span>
        <span className="link-copies-side">
          <span className="link-copies-name main">
            <span className="link-copies-text">{main?.displayName}</span>
          </span>
          {renderChips(entry)}
        </span>
      </label>
    );
  };

  return (
    <div className="set-picker-page">
      <div
        className="modal-content set-picker-modal set-picker-page-content link-copies-page"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-label={t('workspace.linkCopies.title')}
      >
        {preview.entries.length === 0 ? (
          <div className="set-empty">{t('workspace.linkCopies.empty')}</div>
        ) : (
          <>
            <div className="link-copies-hero">
              <div className="link-copies-diagram" aria-hidden="true">
                <span className="link-copies-box">{t('workspace.linkCopies.workspaceSide')}</span>
                <span className="link-copies-chain">🔗</span>
                <span className="link-copies-box">{t('workspace.linkCopies.mainSide')}</span>
              </div>
              <div>
                <h3 className="link-copies-hero-title">
                  {t('workspace.linkCopies.heroTitle', { count: preview.entries.length })}
                </h3>
                <p className="link-copies-hero-body">
                  {t('workspace.linkCopies.heroBody', { workspace: preview.workspaceName })}
                </p>
              </div>
            </div>
            <div className="link-copies-list">
              {needEntries.length > 0 && (
                <section aria-label={t('workspace.linkCopies.needChoice')}>
                  <div className="link-copies-section warn">
                    {t('workspace.linkCopies.needChoice')}
                    <span className="link-copies-count">{needEntries.length}</span>
                  </div>
                  {needEntries.map(renderNeedRow)}
                </section>
              )}
              {readyEntries.length > 0 && (
                <section aria-label={t('workspace.linkCopies.ready')}>
                  <div className="link-copies-section ok">
                    {t('workspace.linkCopies.ready')}
                    <span className="link-copies-count">{readyEntries.length}</span>
                    <span className="link-copies-section-actions">
                      <button type="button" onClick={() => setAllReady(true)}>
                        {t('workspace.linkCopies.selectAll')}
                      </button>
                      <button type="button" onClick={() => setAllReady(false)}>
                        {t('workspace.linkCopies.selectNone')}
                      </button>
                    </span>
                  </div>
                  <div className="link-copies-columns" aria-hidden="true">
                    <span />
                    <span>{t('workspace.linkCopies.workspaceSide')}</span>
                    <span />
                    <span>{t('workspace.linkCopies.mainSide')}</span>
                  </div>
                  {readyEntries.map(renderReadyRow)}
                </section>
              )}
            </div>
          </>
        )}
        {preview.notMatchable > 0 && (
          <details className="link-copies-more">
            <summary>
              {t('workspace.linkCopies.notMatchableSummary', { count: preview.notMatchable })}
            </summary>
            {t('workspace.linkCopies.notMatchableBody')}
          </details>
        )}
        <div className="modal-actions link-copies-actions">
          {unchosen > 0 && (
            <span className="link-copies-status">
              {t('workspace.linkCopies.unchosen', { count: unchosen })}
            </span>
          )}
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
