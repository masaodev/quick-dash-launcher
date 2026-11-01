/**
 * 画面: アイテム管理の WSグループの追加・編集
 * 画面仕様: docs/screens/admin-window.md#532-wsグループの追加と編集
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { JsonWsGroupItem, WsGroupArchivedFilter, WsGroupScope } from '@common/types';
import { resolveGroupColorCss } from '@common/groupColors';
import {
  findMissingWsGroupIds,
  isArchivedCandidate,
  listWsGroupCandidates,
  resolveWsGroupTargets,
  type WsGroupCandidate,
} from '@common/utils/wsGroupExpansion';

import { logError } from '../utils/debug';

import { WsGroupIcon } from './WsGroupIcon';
import { Button } from './ui';
import '../styles/components/Modal.css';
import '../styles/components/WsGroupEditModal.css';

/** ダイアログで決める WSグループの中身（id・更新日は呼び出し側が付ける） */
export type WsGroupFields = Pick<
  JsonWsGroupItem,
  'scope' | 'groupIds' | 'archived' | 'options' | 'memo'
>;

/** 「すべてのグループ」のときのアーカイブしたグループの扱い（画面に出す順） */
const ARCHIVED_FILTERS: readonly WsGroupArchivedFilter[] = ['exclude', 'include', 'only'];
const ARCHIVED_FILTER_LABEL_KEYS = {
  exclude: 'itemManager.wsGroup.archivedExclude',
  include: 'itemManager.wsGroup.archivedInclude',
  only: 'itemManager.wsGroup.archivedOnly',
} as const satisfies Record<WsGroupArchivedFilter, string>;

interface WsGroupEditModalProps {
  /** 編集する行（新しく追加するときは undefined） */
  initial?: JsonWsGroupItem;
  onConfirm: (fields: WsGroupFields) => void;
  onCancel: () => void;
}

/** ワークスペースのグループを選んで、ランチャーの一覧と検索に並べる行（WSグループ）を作る・直す */
const WsGroupEditModal: React.FC<WsGroupEditModalProps> = ({ initial, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<WsGroupCandidate[] | null>(null);
  const [scope, setScope] = useState<WsGroupScope>(initial?.scope ?? 'all');
  const [groupIds, setGroupIds] = useState<string[]>(initial?.groupIds ?? []);
  const [archived, setArchived] = useState<WsGroupArchivedFilter>(initial?.archived ?? 'exclude');
  const [prefix, setPrefix] = useState(initial?.options?.prefix ?? '');
  const [suffix, setSuffix] = useState(initial?.options?.suffix ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');

  useEffect(() => {
    let cancelled = false;
    const api = window.electronAPI.workspaceAPI;
    Promise.all([api.loadWorkspaces(), api.loadGroups(), api.loadArchivedGroups()])
      .then(([workspaces, groups, archivedGroups]) => {
        if (!cancelled) setCandidates(listWsGroupCandidates(workspaces, groups, archivedGroups));
      })
      .catch((error) => {
        logError('WSグループの編集でワークスペースのグループを読めませんでした:', error);
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const list = candidates ?? [];
  const missingCount = findMissingWsGroupIds({ scope, groupIds }, list).length;
  const targets = useMemo(
    () => resolveWsGroupTargets({ scope, groupIds, archived }, list),
    [scope, groupIds, archived, list]
  );
  // ワークスペースが 2 つ以上あるときだけ、ワークスペースの名前で区切る。アーカイブしたグループは、
  // ワークスペースによらず最後に「アーカイブ済み」の見出しでまとめる
  const showWorkspaceHeadings =
    new Set(list.filter((c) => !isArchivedCandidate(c)).map((c) => c.workspace?.id)).size > 1;
  const headingOf = (candidate: WsGroupCandidate): string | null => {
    if (isArchivedCandidate(candidate)) return t('itemManager.wsGroup.archivedHeading');
    return showWorkspaceHeadings ? (candidate.workspace?.displayName ?? null) : null;
  };
  // 「すべてのグループ」でチェックを付けて見せるのは、並ぶグループだけ
  const targetIds = new Set(targets.map((c) => c.group.id));
  const canConfirm = candidates !== null && (scope === 'all' || targets.length > 0);

  const toggleGroup = (id: string, checked: boolean) => {
    setGroupIds((current) =>
      checked ? [...current.filter((g) => g !== id), id] : current.filter((g) => g !== id)
    );
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const options = {
      ...(prefix ? { prefix } : {}),
      ...(suffix ? { suffix } : {}),
    };
    onConfirm({
      scope,
      // 選んだグループは、見つかるものだけを残す（消えたグループの id はここで外す。アーカイブしたグループは残す）
      ...(scope === 'selected' ? { groupIds: targets.map((c) => c.group.id) } : {}),
      ...(scope === 'all' && archived !== 'exclude' ? { archived } : {}),
      ...(Object.keys(options).length > 0 ? { options } : {}),
      ...(memo.trim() ? { memo } : {}),
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content ws-group-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="ws-group-modal"
        role="dialog"
        aria-labelledby="ws-group-modal-title"
      >
        <h2 id="ws-group-modal-title">
          {t(initial ? 'itemManager.wsGroup.titleEdit' : 'itemManager.wsGroup.titleAdd')}
        </h2>
        <p className="ws-group-modal-lead">{t('itemManager.wsGroup.lead')}</p>

        <fieldset className="ws-group-modal-field">
          <legend>{t('itemManager.wsGroup.scopeLabel')}</legend>
          <div className="ws-group-modal-radios">
            <label>
              <input
                type="radio"
                name="ws-group-scope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                data-testid="ws-group-scope-all"
              />
              {t('itemManager.wsGroup.scopeAll')}
            </label>
            <label>
              <input
                type="radio"
                name="ws-group-scope"
                checked={scope === 'selected'}
                onChange={() => setScope('selected')}
                data-testid="ws-group-scope-selected"
              />
              {t('itemManager.wsGroup.scopeSelected')}
            </label>
          </div>
          {candidates === null ? (
            <p className="ws-group-modal-note">{t('common.loading')}</p>
          ) : list.length === 0 ? (
            <p className="ws-group-modal-note">{t('itemManager.wsGroup.noGroups')}</p>
          ) : (
            <div
              className={`ws-group-modal-groups${scope === 'all' ? ' is-disabled' : ''}`}
              data-testid="ws-group-list"
            >
              {list.map((candidate, index) => {
                const { group } = candidate;
                const heading = headingOf(candidate);
                const prevHeading = index > 0 ? headingOf(list[index - 1]) : null;
                return (
                  <React.Fragment key={group.id}>
                    {heading !== null && heading !== prevHeading && (
                      <div className="ws-group-modal-workspace">{heading}</div>
                    )}
                    <label className={isArchivedCandidate(candidate) ? 'is-archived' : undefined}>
                      <input
                        type="checkbox"
                        disabled={scope === 'all'}
                        checked={
                          scope === 'all' ? targetIds.has(group.id) : groupIds.includes(group.id)
                        }
                        onChange={(e) => toggleGroup(group.id, e.target.checked)}
                        data-testid={`ws-group-check-${group.id}`}
                      />
                      <span
                        className="ws-group-swatch"
                        style={{ background: resolveGroupColorCss(group.color) }}
                        aria-hidden="true"
                      />
                      {group.displayName}
                    </label>
                  </React.Fragment>
                );
              })}
            </div>
          )}
          {scope === 'all' && list.some(isArchivedCandidate) && (
            <div className="ws-group-modal-archived" data-testid="ws-group-archived">
              <span className="ws-group-modal-label">{t('itemManager.wsGroup.archivedLabel')}</span>
              <div className="ws-group-modal-radios">
                {ARCHIVED_FILTERS.map((filter) => (
                  <label key={filter}>
                    <input
                      type="radio"
                      name="ws-group-archived"
                      checked={archived === filter}
                      onChange={() => setArchived(filter)}
                      data-testid={`ws-group-archived-${filter}`}
                    />
                    {t(ARCHIVED_FILTER_LABEL_KEYS[filter])}
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="ws-group-modal-note">
            {t(
              scope === 'all' ? 'itemManager.wsGroup.allNote' : 'itemManager.wsGroup.selectedNote'
            )}
          </p>
          {scope === 'selected' && missingCount > 0 && (
            <p className="ws-group-modal-warning" data-testid="ws-group-missing">
              {t('itemManager.wsGroup.missing', { count: missingCount })}
            </p>
          )}
        </fieldset>

        <fieldset className="ws-group-modal-field">
          <legend>{t('itemManager.wsGroup.affixLabel')}</legend>
          <div className="ws-group-modal-affix">
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder={t('itemManager.wsGroup.prefixPlaceholder')}
              aria-label={t('itemManager.wsGroup.prefixPlaceholder')}
              data-testid="ws-group-prefix"
            />
            <input
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder={t('itemManager.wsGroup.suffixPlaceholder')}
              aria-label={t('itemManager.wsGroup.suffixPlaceholder')}
              data-testid="ws-group-suffix"
            />
          </div>
        </fieldset>

        <div className="ws-group-modal-field">
          <span className="ws-group-modal-label">{t('itemManager.wsGroup.previewLabel')}</span>
          <ul className="ws-group-modal-preview" data-testid="ws-group-preview">
            {targets.length === 0 ? (
              <li className="ws-group-modal-note">{t('itemManager.wsGroup.previewEmpty')}</li>
            ) : (
              targets.map((candidate) => (
                <li
                  key={candidate.group.id}
                  className={isArchivedCandidate(candidate) ? 'is-archived' : undefined}
                >
                  <WsGroupIcon color={candidate.group.color} />
                  {`${prefix}${candidate.group.displayName}${suffix}`}
                  {isArchivedCandidate(candidate) && (
                    <span className="ws-group-modal-tag">
                      {t('itemManager.wsGroup.archivedTag')}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="ws-group-modal-field">
          <label className="ws-group-modal-label" htmlFor="ws-group-memo">
            {t('itemManager.wsGroup.memoLabel')}
          </label>
          <input
            id="ws-group-memo"
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            data-testid="ws-group-memo"
          />
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
            data-testid="ws-group-confirm"
          >
            {t(initial ? 'itemManager.wsGroup.confirmEdit' : 'itemManager.wsGroup.confirmAdd')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WsGroupEditModal;
