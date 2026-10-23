/**
 * 画面: 指すアイテムを選ぶ（ワークスペースの参照の右クリック「別のアイテムを指す」）
 * 画面仕様: docs/screens/workspace-window.md#520-指すアイテムを選ぶ
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppItem, LauncherItem, WorkspaceItem } from '@common/types';
import { isClipboardItem, isLauncherItem, isSetItem } from '@common/types/guards';
import { isReferenceableAppItem, type ReferenceableAppItem } from '@common/utils/workspaceRefs';

import { logError } from '../utils/debug';
import type { SetCatalogItem } from '../utils/setEditing';

import SetItemPickerModal from './SetItemPickerModal';
import { Button } from './ui';

interface WorkspaceLinkPickerPageProps {
  itemId: string;
}

/** 指せるアイテム（id を持つメインウィンドウのアイテム。フォルダ取込で展開したものは除く） */
type LinkableItem = ReferenceableAppItem & { id: string };

function isLinkable(item: AppItem): item is LinkableItem {
  return isReferenceableAppItem(item);
}

function rowKind(item: LinkableItem): SetCatalogItem['kind'] {
  if (isSetItem(item)) return 'set' as SetCatalogItem['kind'];
  if (isClipboardItem(item)) return 'clipboard' as SetCatalogItem['kind'];
  return item.type as SetCatalogItem['kind'];
}

/**
 * ワークスペースのアイテムが指すメインウィンドウのアイテムを 1 つ選ぶページ（独立したウィンドウの中身）
 *
 * パスと引数が同じアイテム（候補）を先に並べる。選ぶと、そのアイテムを指す参照に置き換える
 * （コピーなら参照に変え、参照なら指す先を変える）。変更通知でワークスペース側が読み直すので、選んだら閉じるだけでよい
 */
const WorkspaceLinkPickerPage: React.FC<WorkspaceLinkPickerPageProps> = ({ itemId }) => {
  const { t } = useTranslation();
  const [target, setTarget] = useState<WorkspaceItem | null>(null);
  const [catalog, setCatalog] = useState<SetCatalogItem[]>([]);
  const [hasCandidates, setHasCandidates] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [workspaceItems, allItems, settings, candidates] = await Promise.all([
          window.electronAPI.workspaceAPI.loadItems(),
          window.electronAPI.loadDataFiles('internal'),
          window.electronAPI.getSettings(),
          window.electronAPI.workspaceAPI.findLinkCandidates(itemId),
        ]);
        if (cancelled) return;
        const found = workspaceItems.find((item) => item.id === itemId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setTarget(found);
        document.title = t('workspace.linkPicker.title', { name: found.displayName });

        const launchers = allItems.filter((item): item is LauncherItem => isLauncherItem(item));
        const icons: Record<string, string> = await window.electronAPI
          .loadCachedIcons(launchers)
          .catch(() => ({}));
        const tabName = (file: string | undefined) =>
          settings.dataFileTabs.find((tab) => file !== undefined && tab.files.includes(file))
            ?.name ??
          file ??
          '';
        const candidateIds = new Set(candidates.map((c) => c.itemId));
        const rows: SetCatalogItem[] = allItems.filter(isLinkable).map((item) => ({
          key: item.id,
          id: item.id,
          displayName: item.displayName,
          kind: rowKind(item),
          icon: (isLauncherItem(item) && (icons[item.path] || item.icon)) || undefined,
          groupName: tabName(item.sourceFile),
          sameGroup: candidateIds.has(item.id),
        }));
        if (cancelled) return;
        setHasCandidates(candidateIds.size > 0);
        // 候補（同じパス）を先に。その中は今の並びのまま
        setCatalog([...rows.filter((r) => r.sameGroup), ...rows.filter((r) => !r.sameGroup)]);
      } catch (error) {
        logError('指すアイテムの候補の読み込みに失敗しました:', error);
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, t]);

  // 今の指す先は「追加済み」として選べなくする（選び直しても何も変わらないため）
  const currentKeys = useMemo(() => new Set(target?.ref ? [target.ref.itemId] : []), [target]);

  const close = useCallback(() => {
    window.close();
  }, []);

  const choose = useCallback(
    async (rows: SetCatalogItem[]) => {
      const row = rows[0];
      if (!target || !row?.id) return;
      setBusy(true);
      try {
        const result = await window.electronAPI.workspaceAPI.linkToMain(target.id, row.id);
        if (!result.success) throw new Error('link failed');
        await window.electronAPI.showToastWindow({
          message: target.ref
            ? t('workspace.ref.retargeted', {
                name: result.item?.displayName ?? target.displayName,
              })
            : t('workspace.ref.linked', { name: result.item?.displayName ?? target.displayName }),
          type: 'success',
        });
        window.close();
      } catch (error) {
        // 失敗は本体側がエラーのトーストで知らせる
        logError('参照にできませんでした:', error);
        setBusy(false);
      }
    },
    [target, t]
  );

  if (notFound) {
    return (
      <div className="set-picker-page set-picker-missing">
        <p>{t('workspace.linkPicker.notFound')}</p>
        <Button variant="secondary" onClick={close}>
          {t('common.close')}
        </Button>
      </div>
    );
  }

  if (!target) {
    return <div className="set-picker-page" />;
  }

  return (
    <SetItemPickerModal
      asPage
      isOpen
      single
      // 同じパスのアイテムはタブをまたいで先に並べるので、そのときだけ「すべて」のタブを出す
      allTab={hasCandidates}
      catalog={catalog}
      addedKeys={currentKeys}
      addedLabel={t('workspace.linkPicker.current')}
      title={t('workspace.linkPicker.title', { name: target.displayName })}
      banner={<div className="workspace-link-banner">{t('workspace.linkPicker.banner')}</div>}
      busy={busy}
      onClose={close}
      onAdd={(rows) => void choose(rows)}
      sectionTitles={
        hasCandidates
          ? {
              same: t('workspace.linkPicker.candidates'),
              others: t('workspace.linkPicker.others'),
            }
          : undefined
      }
    />
  );
};

export default WorkspaceLinkPickerPage;
