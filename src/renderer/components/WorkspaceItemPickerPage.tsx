/**
 * 画面: グループに追加するアイテム（ワークスペースのグループの右クリック「メインウィンドウのアイテムから選ぶ」）
 * 画面仕様: docs/screens/workspace-window.md#589-グループを右クリックしてアイテムを追加
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AppItem,
  ClipboardItem,
  LauncherItem,
  SetItem,
  WorkspaceGroupView,
  WorkspaceItem,
} from '@common/types';
import { isClipboardItem, isLauncherItem, isSetItem } from '@common/types/guards';

import { logError } from '../utils/debug';
import type { SetCatalogItem } from '../utils/setEditing';

import SetItemPickerModal from './SetItemPickerModal';
import { Button } from './ui';

interface WorkspaceItemPickerPageProps {
  groupId: string;
}

/** 選ぶ画面の 1 行と、追加するときに渡すメインのアイテム */
/** 選べるアイテム（メインウィンドウのアイテム。ウィンドウ検索の結果は来ない） */
type PickableItem = LauncherItem | ClipboardItem | SetItem;

function isPickable(item: AppItem): item is PickableItem {
  return isLauncherItem(item) || isSetItem(item) || isClipboardItem(item);
}

interface PickerEntry {
  row: SetCatalogItem;
  item: PickableItem;
}

/** 追加先の表示（ワークスペース名 › 親グループ › グループ） */
interface Destination {
  group: WorkspaceGroupView;
  workspaceName?: string;
  path: string[];
}

/**
 * 「追加済み」とみなすキー。ワークスペースのアイテムは元のアイテムを指す情報を持たないので、
 * パスを持つアイテムはパスと引数で比べる（種別は追加のときに判定し直すことがあるので比べない）。
 * パスの無いアイテム（セット・クリップボード・パスの無い単一アイテム）は比べない
 */
function contentKey(path: string, args: string | undefined): string | null {
  if (!path) return null;
  return [path.toLowerCase(), args ?? ''].join('\n');
}

function workspaceItemKey(item: WorkspaceItem): string | null {
  return item.type === 'item' ? contentKey(item.path, item.args) : null;
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
  const [destination, setDestination] = useState<Destination | null>(null);
  const [entries, setEntries] = useState<PickerEntry[]>([]);
  const [addedKeys, setAddedKeys] = useState<ReadonlySet<string>>(new Set());
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = window.electronAPI.workspaceAPI;
        const [groups, workspaces, workspaceItems, allItems, settings] = await Promise.all([
          api.loadGroups(),
          api.loadWorkspaces(),
          api.loadItems(),
          window.electronAPI.loadDataFiles('internal'),
          window.electronAPI.getSettings(),
        ]);
        const group = groups.find((g) => g.id === groupId);
        if (cancelled) return;
        if (!group) {
          setNotFound(true);
          return;
        }
        const parent = group.parentGroupId
          ? groups.find((g) => g.id === group.parentGroupId)
          : undefined;
        setDestination({
          group,
          workspaceName: workspaces.find((ws) => ws.id === group.workspaceId)?.displayName,
          path: [...(parent ? [parent.displayName] : []), group.displayName],
        });
        document.title = t('workspace.picker.title', { group: group.displayName });

        const launchers = allItems.filter((item): item is LauncherItem => isLauncherItem(item));
        const icons: Record<string, string> = await window.electronAPI
          .loadCachedIcons(launchers)
          .catch(() => ({}));
        const tabName = (file: string | undefined) =>
          settings.dataFileTabs.find((tab) => file !== undefined && tab.files.includes(file))
            ?.name ??
          file ??
          '';

        const inGroup = new Set(
          workspaceItems
            .filter((item) => item.groupId === groupId)
            .map(workspaceItemKey)
            .filter((key): key is string => key !== null)
        );
        const added = new Set<string>();
        const list: PickerEntry[] = [];
        allItems.forEach((item, index) => {
          if (!isPickable(item)) return;
          // フォルダ取込の展開分は id を持たないので、並び順で一意にする
          const key = item.id ?? `index:${index}`;
          const itemKey = appItemKey(item);
          if (itemKey && inGroup.has(itemKey)) added.add(key);
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
        // 折りたたんでいたら開き、入ったアイテムが見えるようにする
        if (group.collapsed) {
          await window.electronAPI.workspaceAPI.setGroupsCollapsed([group.id], false);
        }
        for (const item of items) {
          await window.electronAPI.workspaceAPI.addItem(item, group.id, group.workspaceId);
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
    [destination, entries, t]
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

  const banner = (
    <div className="register-dest set-picker-dest">
      <span className="register-dest-label">{t('workspace.picker.destination')}</span>
      {[...(destination.workspaceName ? [destination.workspaceName] : []), ...destination.path].map(
        (name, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="register-dest-sep" aria-hidden>
                ›
              </span>
            )}
            <span className="set-picker-dest-name">{name}</span>
          </React.Fragment>
        )
      )}
    </div>
  );

  return (
    <SetItemPickerModal
      asPage
      isOpen
      catalog={catalog}
      addedKeys={addedKeys}
      title={t('workspace.picker.title', { group: destination.group.displayName })}
      banner={banner}
      busy={busy}
      onClose={close}
      onAdd={(rows) => void add(rows)}
    />
  );
};

export default WorkspaceItemPickerPage;
