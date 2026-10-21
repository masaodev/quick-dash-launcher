/**
 * 画面: グループに追加するアイテム（ワークスペースのグループの右クリック「メインウィンドウのアイテムから選ぶ」）
 * 画面仕様: docs/screens/workspace-window.md#589-グループを右クリックしてアイテムを追加
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppItem, ClipboardItem, LauncherItem, SetItem, WorkspaceItem } from '@common/types';
import { isClipboardItem, isLauncherItem, isSetItem } from '@common/types/guards';

import { logError } from '../utils/debug';
import type { SetCatalogItem } from '../utils/setEditing';

import SetItemPickerModal from './SetItemPickerModal';
import WorkspaceDestinationBand, {
  expandDestinationGroup,
  loadWorkspaceDestination,
  type WorkspaceDestination,
} from './WorkspaceDestinationBand';
import { Button } from './ui';

interface WorkspaceItemPickerPageProps {
  groupId: string;
}

/** 選べるアイテム（メインウィンドウのアイテム。ウィンドウ検索の結果は来ない） */
type PickableItem = LauncherItem | ClipboardItem | SetItem;

function isPickable(item: AppItem): item is PickableItem {
  return isLauncherItem(item) || isSetItem(item) || isClipboardItem(item);
}

/** 選ぶ画面の 1 行と、追加するときに渡すメインのアイテム */
interface PickerEntry {
  row: SetCatalogItem;
  item: PickableItem;
}

/**
 * 「追加済み」とみなすキー。参照は指すアイテムの id で比べる（refIds）。コピーは元のアイテムを指す情報を
 * 持たないので、パスを持つアイテムはパスと引数で比べる（種別は追加のときに判定し直すことがあるので比べない）。
 * パスの無いコピー（セット・クリップボード・パスの無い単一アイテム）は比べない
 */
function contentKey(path: string, args: string | undefined): string | null {
  if (!path) return null;
  return [path.toLowerCase(), args ?? ''].join('\n');
}

function workspaceItemKey(item: WorkspaceItem): string | null {
  return item.type === 'item' && !item.ref ? contentKey(item.path, item.args) : null;
}

function appItemKey(item: PickableItem): string | null {
  return isLauncherItem(item) ? contentKey(item.path, item.args) : null;
}

function rowKind(item: PickableItem): string {
  if (isSetItem(item)) return 'set';
  if (isClipboardItem(item)) return 'clipboard';
  return isLauncherItem(item) ? item.type : 'file';
}

/**
 * グループに追加するアイテムを選ぶページ（独立したウィンドウの中身）
 *
 * ワークスペースのレンダラーが window.open で開いた子ウィンドウに描画される。
 * メインウィンドウのアイテム（すべてのタブ）を選び、メインの「ワークスペースに追加」と同じ処理で
 * 追加先のグループに入れる。変更通知でワークスペース側が読み直すので、追加したら閉じるだけでよい。
 */
const WorkspaceItemPickerPage: React.FC<WorkspaceItemPickerPageProps> = ({ groupId }) => {
  const { t } = useTranslation();
  const [destination, setDestination] = useState<WorkspaceDestination | null>(null);
  const [entries, setEntries] = useState<PickerEntry[]>([]);
  const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(new Set());
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  // 既定は参照で追加する。チェックするとコピーで追加する
  const [asCopy, setAsCopy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [found, workspaceItems, allItems, settings] = await Promise.all([
          loadWorkspaceDestination(groupId),
          window.electronAPI.workspaceAPI.loadItems(),
          window.electronAPI.loadDataFiles('internal'),
          window.electronAPI.getSettings(),
        ]);
        if (cancelled) return;
        if (!found) {
          setNotFound(true);
          return;
        }
        setDestination(found);
        document.title = t('workspace.picker.title', { group: found.group.displayName });

        const launchers = allItems.filter((item): item is LauncherItem => isLauncherItem(item));
        const icons: Record<string, string> = await window.electronAPI
          .loadCachedIcons(launchers)
          .catch(() => ({}));
        const tabName = (file: string | undefined) =>
          settings.dataFileTabs.find((tab) => file !== undefined && tab.files.includes(file))
            ?.name ??
          file ??
          '';

        const groupItems = workspaceItems.filter((item) => item.groupId === groupId);
        const inGroup = new Set(
          groupItems.map(workspaceItemKey).filter((key): key is string => key !== null)
        );
        const refIds = new Set(groupItems.flatMap((item) => (item.ref ? [item.ref.itemId] : [])));
        const added = new Set<string>();
        const list: PickerEntry[] = [];
        allItems.forEach((item, index) => {
          if (!isPickable(item)) return;
          // フォルダ取込の展開分は id を持たないので、並び順で一意にする
          const key = item.id ?? `index:${index}`;
          const itemKey = appItemKey(item);
          if ((itemKey && inGroup.has(itemKey)) || (item.id && refIds.has(item.id))) added.add(key);
          list.push({
            item,
            row: {
              key,
              displayName: item.displayName,
              kind: rowKind(item) as SetCatalogItem['kind'],
              icon: (isLauncherItem(item) && (icons[item.path] || item.icon)) || undefined,
              groupName: tabName(item.sourceFile),
              sameGroup: false,
            },
          });
        });
        if (cancelled) return;
        setAddedKeys(added);
        setEntries(list);
      } catch (error) {
        logError('グループに追加できるアイテムの読み込みに失敗しました:', error);
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, t]);

  const catalog = useMemo(() => entries.map((entry) => entry.row), [entries]);

  const close = useCallback(() => {
    window.close();
  }, []);

  const add = useCallback(
    async (rows: SetCatalogItem[]) => {
      if (!destination || rows.length === 0) return;
      const byKey = new Map(entries.map((entry) => [entry.row.key, entry.item]));
      const items = rows.flatMap((row) => byKey.get(row.key) ?? []);
      const { group } = destination;
      setBusy(true);
      try {
        await expandDestinationGroup(destination);
        for (const item of items) {
          await window.electronAPI.workspaceAPI.addItem(
            item,
            group.id,
            group.workspaceId,
            asCopy ? { copy: true } : undefined
          );
        }
        const single = items.length === 1 ? items[0] : undefined;
        await window.electronAPI.showToastWindow({
          itemType: 'workspaceAdd',
          displayName: single
            ? single.displayName
            : t('workspace.picker.addedItems', { count: items.length }),
          message: t('workspace.picker.addedToGroup', { group: group.displayName }),
          ...(single && isLauncherItem(single) && { path: single.path }),
          ...(single && 'icon' in single && single.icon && { icon: single.icon }),
        });
        window.close();
      } catch (error) {
        // 途中まで入ったものは残す（失敗は本体側がエラーのトーストで知らせる）
        logError('グループへのアイテムの追加に失敗しました:', error);
        setBusy(false);
      }
    },
    [asCopy, destination, entries, t]
  );

  if (notFound) {
    return (
      <div className="set-picker-page set-picker-missing">
        <p>{t('workspace.picker.groupNotFound')}</p>
        <Button variant="secondary" onClick={close}>
          {t('common.close')}
        </Button>
      </div>
    );
  }

  if (!destination) {
    return <div className="set-picker-page" />;
  }

  return (
    <SetItemPickerModal
      asPage
      isOpen
      catalog={catalog}
      addedKeys={addedKeys}
      title={t('workspace.picker.title', { group: destination.group.displayName })}
      banner={<WorkspaceDestinationBand destination={destination} />}
      busy={busy}
      onClose={close}
      onAdd={(rows) => void add(rows)}
      footerExtra={
        <label>
          <input type="checkbox" checked={asCopy} onChange={(e) => setAsCopy(e.target.checked)} />
          {t('workspace.picker.addAsCopy')}
        </label>
      }
    />
  );
};

export default WorkspaceItemPickerPage;
