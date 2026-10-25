/**
 * 画面: ワークスペースウィンドウ
 * 画面仕様: docs/screens/workspace-window.md
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { PinLevel, WorkspaceItem, WorkspaceGroupView } from '@common/types';
import { getAncestorGroupIds, getDescendantGroupIds } from '@common/utils/groupTreeUtils';
import { DETACHED_WINDOW_NAME_PREFIX } from '@common/constants';

import WorkspaceFilterBar from './components/WorkspaceFilterBar';
import WorkspaceGroupedList from './components/WorkspaceGroupedList';
import WorkspaceHeader from './components/WorkspaceHeader';
import PinButton from './components/PinButton';
import WorkspaceTabBar from './components/WorkspaceTabBar';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { useWorkspaceAddNotice } from './hooks/useWorkspaceAddNotice';
import { useFileOperations } from './hooks/useFileOperations';
import { useNativeDragDrop } from './hooks/useNativeDragDrop';
import { useLatestRef } from './hooks/useLatestRef';
import { useToast } from './hooks/useToast';
import { useWorkspaceFilter, type FilterScope } from './hooks/useWorkspaceFilter';
import {
  useWorkspaceActions,
  useWorkspaceAutoFit,
  useWorkspaceData,
  useWorkspaceResize,
} from './hooks/workspace';
import { logError } from './utils/debug';

const RESIZE_DIRECTIONS = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const;

/** 切り離しウィンドウの groupId を window.name または URL クエリから取得する */
function getDetachedGroupIdFromWindow(): string | null {
  if (window.name.startsWith(DETACHED_WINDOW_NAME_PREFIX)) {
    const id = window.name.slice(DETACHED_WINDOW_NAME_PREFIX.length);
    if (id) return id;
  }
  return new URLSearchParams(window.location.search).get('groupId');
}

const WorkspaceApp: React.FC = () => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  // ピン留めの段階（このウィンドウ＝ワークスペース本体か切り離しウィンドウのもの）
  const [pinLevel, setPinLevel] = useState<PinLevel>(0);
  const [backgroundTransparent, setBackgroundTransparent] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [archivedGroups, setArchivedGroups] = useState<WorkspaceGroupView[]>([]);
  const [archivedItems, setArchivedItems] = useState<WorkspaceItem[]>([]);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [focusTrigger, setFocusTrigger] = useState(0);
  // 切り離しウィンドウモード判定
  // 通常は window.name（ワークスペースから window.open で開かれた場合）、
  // メインプロセスが直接生成したフォールバック時は URL クエリから groupId を読み取る
  const [detachedGroupId] = useState<string | null>(() => getDetachedGroupIdFromWindow());

  const {
    items,
    groups,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    loadAllDataWithLoading,
    toggleGroupCollapsed,
    setAllGroupsCollapsedLocal,
  } = useWorkspaceData(detachedGroupId);

  // アクティブワークスペースでフィルタリング
  const filteredItems = useMemo(
    () => items.filter((i) => i.workspaceId === activeWorkspaceId),
    [items, activeWorkspaceId]
  );
  const filteredGroups = useMemo(
    () => groups.filter((g) => g.workspaceId === activeWorkspaceId),
    [groups, activeWorkspaceId]
  );

  const actions = useWorkspaceActions(() => {
    loadAllDataWithLoading();
  });

  const { extractFilePaths, addItemsFromFilePaths, addUrlItem } = useFileOperations();
  const { showWarning } = useToast();
  // グループのあるワークスペースでは、足す先のグループを選ばせる（未分類は無い。A3-157）
  const activeWorkspaceHasGroups = groups.some((g) => g.workspaceId === activeWorkspaceId);
  // 貼り付け先は、今のワークスペースで選んだグループだけ（見出しに枠を付けて見せる）。
  // ほかのワークスペースで選んだもの・消えたグループは使わない（以前は選んでいないワークスペースのグループに入った）
  const pasteGroupId =
    activeGroupId && filteredGroups.some((g) => g.id === activeGroupId) ? activeGroupId : undefined;
  useEffect(() => {
    setActiveGroupId(undefined);
  }, [activeWorkspaceId]);
  // 貼り付け先の枠は前面のウィンドウにだけ出す（Ctrl+V が効くのは前面のウィンドウだけ。本体と切り離しウィンドウの
  // 両方に枠が出て、どこに貼り付くか分からなかった。A3-186）。選んだグループは覚えておき、戻ってきたら枠を戻す
  const [isWindowFocused, setIsWindowFocused] = useState(() => document.hasFocus());
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
  // グループの外（余白・タブの並びなど）を左クリックしたら、貼り付け先を外す。外すとグループのあるワークスペースでは
  // Ctrl+V で貼り付けない（グループを選ぶよう知らせる）。ボタン・入力欄・ダイアログ・ウィンドウの縁では外さない
  // （右クリックの「貼り付け」は左クリックを伴わないので、選んだグループに貼れる。A3-186）
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target instanceof Element ? e.target : null;
      if (
        !target ||
        target.closest(
          '.workspace-group, button, a, label, input, textarea, select, [role="dialog"], [role="menu"], .workspace-resize-handle'
        )
      ) {
        return;
      }
      // スクロールバーを掴んだときは外さない（押した所が、要素のスクロールバーを除いた幅・高さより外）
      if (
        target instanceof HTMLElement &&
        (e.offsetX >= target.clientWidth || e.offsetY >= target.clientHeight)
      ) {
        return;
      }
      setActiveGroupId(undefined);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);
  const toggleGroup = async (groupId: string) => {
    const newCollapsed = toggleGroupCollapsed(groupId);
    if (detachedGroupId === null) {
      try {
        // 折りたたみは UI 状態（workspace-ui-state.json）として保存する
        await window.electronAPI.workspaceAPI.setGroupsCollapsed([groupId], newCollapsed);
      } catch (error) {
        logError('Failed to persist group collapsed state:', error);
      }
    }
    // detached モードの場合は useWorkspaceData 内で自動保存される
  };
  // 閉じたグループに足したら開いて見せる
  const announceAdded = useWorkspaceAddNotice(filteredGroups, (id) => void toggleGroup(id));
  useClipboardPaste(
    loadAllDataWithLoading,
    pasteGroupId,
    activeWorkspaceId,
    () => {
      if (pasteGroupId || !activeWorkspaceHasGroups) return true;
      showWarning(t('workspace.chooseGroupToPaste'));
      return false;
    },
    (displayNames) => announceAdded(displayNames, pasteGroupId)
  );
  const loadArchiveData = useCallback(async () => {
    try {
      const [groups, items] = await Promise.all([
        window.electronAPI.workspaceAPI.loadArchivedGroups(),
        window.electronAPI.workspaceAPI.loadArchivedItems(),
      ]);
      // アーカイブ画面の折りたたみはローカル状態だけで持つ（永続化しない）
      setArchivedGroups(groups.map((g) => ({ ...g, collapsed: false })));
      setArchivedItems(items);
    } catch (error) {
      logError('Failed to load archive data:', error);
    }
  }, []);

  useEffect(() => {
    if (!isArchiveMode) return;
    loadArchiveData();
    const cleanup = window.electronAPI.onWorkspaceChanged(() => {
      loadArchiveData();
    });
    return cleanup;
  }, [isArchiveMode, loadArchiveData]);

  // 表示用データ: アーカイブモード時はアーカイブデータを使用
  // workspaceId を空にして、全ワークスペースをコンテキストメニューの移動先候補にする
  // （メイン側は「自分の workspaceId 以外」を候補にするため）
  const displayGroups = useMemo(
    () => (isArchiveMode ? archivedGroups.map((g) => ({ ...g, workspaceId: '' })) : filteredGroups),
    [isArchiveMode, archivedGroups, filteredGroups]
  );
  const displayItems = useMemo(
    () => (isArchiveMode ? archivedItems.map((i) => ({ ...i, workspaceId: '' })) : filteredItems),
    [isArchiveMode, archivedItems, filteredItems]
  );

  const filterResult = useWorkspaceFilter(displayGroups, displayItems, filterText, filterScope);
  const isDetached = detachedGroupId !== null;
  const { handleResize } = useWorkspaceResize(
    isDetached
      ? {
          setBoundsFn: (x, y, w, h) => window.electronAPI.workspaceAPI.setCallerBounds(x, y, w, h),
          minWidth: 100,
          minHeight: 40,
        }
      : undefined
  );
  const { contentRef } = useWorkspaceAutoFit(
    isDetached
      ? (width, height) => window.electronAPI.workspaceAPI.resizeCallerWindow(width, height)
      : undefined,
    isDetached ? 0 : undefined
  );

  useEffect(() => {
    window.electronAPI.pin.get().then(setPinLevel);
    const cleanupPinChanged = window.electronAPI.pin.onChanged(setPinLevel);

    const syncBackgroundTransparent = async () => {
      const settings = await window.electronAPI.getSettings();
      setBackgroundTransparent(settings.workspaceBackgroundTransparent || false);
    };
    syncBackgroundTransparent();

    const cleanup = window.electronAPI.onSettingsChanged(syncBackgroundTransparent);

    return () => {
      cleanup?.();
      cleanupPinChanged();
    };
  }, []);

  // 切り離しウィンドウのタイトルにグループ名を反映する（タスクバー・Alt+Tabでの識別用）
  // グループ名の変更にも追従する
  useEffect(() => {
    if (!isDetached) return;
    const groupName = groups.find((g) => g.id === detachedGroupId)?.displayName;
    if (groupName) document.title = `${groupName} - QuickDashLauncher`;
  }, [isDetached, detachedGroupId, groups]);

  useEffect(() => {
    if (isDetached) return;
    const handleCtrlF = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setIsFilterVisible(true);
        setFocusTrigger((prev) => prev + 1);
      }
    };
    document.addEventListener('keydown', handleCtrlF);
    return () => document.removeEventListener('keydown', handleCtrlF);
  }, [isDetached]);

  /** グループとそのサブグループに含まれるアイテム数・サブグループ数を算出 */
  const getGroupStats = (groupId: string): { itemCount: number; subgroupCount: number } => {
    const descendantIds = getDescendantGroupIds(groupId, displayGroups);
    const allGroupIds = new Set([groupId, ...descendantIds]);
    const itemCount = displayItems.filter(
      (item) => item.groupId && allGroupIds.has(item.groupId)
    ).length;
    return { itemCount, subgroupCount: descendantIds.length };
  };

  const getGroupName = (groupId: string): string =>
    displayGroups.find((g) => g.id === groupId)?.displayName ||
    groups.find((g) => g.id === groupId)?.displayName ||
    '';

  /** 含まれるものの説明（確認の文面用） */
  const describeContents = (itemCount: number, subgroupCount: number): string => {
    const items = t('workspace.groups.contentItems', { count: itemCount });
    return subgroupCount > 0
      ? t('workspace.groups.contentsWithSubgroups', {
          subgroups: t('workspace.groups.contentSubgroups', { count: subgroupCount }),
          items,
        })
      : t('workspace.groups.contents', { items });
  };

  // 確認は独立した子ウィンドウで行う（このウィンドウは動かさない。閉じるまで操作できない）
  const handleDeleteGroup = async (groupId: string) => {
    try {
      const { itemCount, subgroupCount } = getGroupStats(groupId);
      // アーカイブからの削除は元に戻せないので、空でも必ず確認する
      if (!isArchiveMode && itemCount === 0 && subgroupCount === 0) {
        await actions.handleDeleteGroup(groupId);
        return;
      }
      const name = getGroupName(groupId);
      const result = await window.electronAPI.workspaceAPI.openConfirm({
        title: isArchiveMode
          ? t('workspace.groups.deleteFromArchiveTitle')
          : t('workspace.groups.deleteTitle'),
        message: isArchiveMode
          ? `${t('workspace.groups.deleteFromArchiveConfirm', { name })}\n\n${describeContents(itemCount, subgroupCount)}\n${t('workspace.groups.deleteFromArchiveIrreversible')}`
          : `${t('workspace.groups.deleteConfirm', { name })}\n\n${describeContents(itemCount, subgroupCount)}`,
        // 中身ごと消える（未分類へ移す先は無い。A3-157）。件数を目立たせ、残したいときのアーカイブを案内する
        warning: isArchiveMode ? undefined : t('workspace.groups.deleteWithContentsWarning'),
        confirmText: t('workspace.groups.delete'),
        cancelText: t('common.cancel'),
        danger: true,
      });
      if (!result) return;
      if (isArchiveMode) {
        await window.electronAPI.workspaceAPI.deleteArchivedGroup(groupId);
        await loadArchiveData();
      } else {
        await actions.handleDeleteGroup(groupId);
      }
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  const handleArchiveGroup = async (groupId: string): Promise<void> => {
    try {
      const { itemCount, subgroupCount } = getGroupStats(groupId);
      const result = await window.electronAPI.workspaceAPI.openConfirm({
        title: t('workspace.groups.archiveTitle'),
        message: `${t('workspace.groups.archiveConfirm', { name: getGroupName(groupId) })}\n\n${describeContents(itemCount, subgroupCount)}\n${t('workspace.groups.archiveRestorable')}`,
        confirmText: t('workspace.groups.archive'),
        cancelText: t('common.cancel'),
        danger: false,
      });
      if (!result) return;
      await actions.handleArchiveGroup(groupId);
    } catch (error) {
      logError('Failed to archive workspace group:', error);
    }
  };

  const handleClose = () => {
    window.electronAPI.workspaceAPI.hideWindow();
  };

  const setAllGroupsCollapsed = async (collapsed: boolean) => {
    const targetGroups = displayGroups.filter((g) => g.collapsed !== collapsed);
    if (targetGroups.length > 0) {
      // setAllGroupsCollapsedLocal 内で detached 時は専用 API に保存される
      setAllGroupsCollapsedLocal(collapsed);
      if (!isDetached) {
        try {
          await window.electronAPI.workspaceAPI.setGroupsCollapsed(
            targetGroups.map((g) => g.id),
            collapsed
          );
        } catch (error) {
          logError(`Failed to ${collapsed ? 'collapse' : 'expand'} all groups:`, error);
          loadAllDataWithLoading();
        }
      }
    }
  };

  /** グループを追加する（選んでいないタブなら、そのタブに切り替えてから） */
  const addGroupTo = (workspaceId: string) => {
    if (workspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    setIsArchiveMode(false);
    const count = groups.filter((g) => g.workspaceId === workspaceId).length;
    actions.handleAddGroup(count, undefined, workspaceId);
  };

  const addWorkspace = () => {
    actions.handleCreateWorkspace(
      t('workspace.tabs.defaultName', { number: workspaces.length + 1 })
    );
  };

  /** タブの右クリックの「すべて展開／折りたたむ」。選んでいないタブなら、そのタブに切り替えてから */
  const setAllCollapsedIn = async (workspaceId: string, collapsed: boolean) => {
    if (workspaceId === activeWorkspaceId && !isArchiveMode) {
      await setAllGroupsCollapsed(collapsed);
      return;
    }
    setActiveWorkspaceId(workspaceId);
    setIsArchiveMode(false);
    const ids = groups
      .filter((g) => g.workspaceId === workspaceId && g.collapsed !== collapsed)
      .map((g) => g.id);
    try {
      if (ids.length > 0) await window.electronAPI.workspaceAPI.setGroupsCollapsed(ids, collapsed);
    } catch (error) {
      logError(`Failed to ${collapsed ? 'collapse' : 'expand'} all groups:`, error);
    }
    loadAllDataWithLoading();
  };

  /** グループの右クリック「ほかのグループを折りたたむ」: そのグループ（と親）だけを開き、ほかを折りたたむ */
  const collapseOtherGroups = async (groupId: string) => {
    const keep = new Set([groupId, ...getAncestorGroupIds(groupId, displayGroups)]);
    const toCollapse = displayGroups
      .filter((g) => !keep.has(g.id) && !g.collapsed)
      .map((g) => g.id);
    const toExpand = displayGroups.filter((g) => keep.has(g.id) && g.collapsed).map((g) => g.id);
    try {
      if (toCollapse.length > 0) {
        await window.electronAPI.workspaceAPI.setGroupsCollapsed(toCollapse, true);
      }
      if (toExpand.length > 0)
        await window.electronAPI.workspaceAPI.setGroupsCollapsed(toExpand, false);
    } catch (error) {
      logError('Failed to collapse other groups:', error);
    }
    loadAllDataWithLoading();
  };

  // タブ・余白の右クリックと、ヘッダーの ＋ のメニューで選ばれたもの（切り離しウィンドウでは出さない）
  const menuActions = useLatestRef({
    addGroupTo,
    addWorkspace,
    setAllCollapsedIn,
  });
  useEffect(() => {
    if (isDetached) return;
    const cleanups = [
      window.electronAPI.onWorkspaceMenuAddGroup((id) => menuActions.current.addGroupTo(id)),
      window.electronAPI.onWorkspaceMenuAddWorkspace(() => menuActions.current.addWorkspace()),
      window.electronAPI.onWorkspaceMenuSetAllCollapsed(
        (id, collapsed) => void menuActions.current.setAllCollapsedIn(id, collapsed)
      ),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [isDetached, menuActions]);

  const handleNativeFileDrop = async (e: React.DragEvent, groupId?: string) => {
    try {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const filePaths = await extractFilePaths(e.dataTransfer.files);
        const added = await addItemsFromFilePaths(
          filePaths,
          loadAllDataWithLoading,
          groupId,
          activeWorkspaceId
        );
        // 足せたものだけ知らせる（足せなかったものは本体側がエラーのトーストで知らせる）
        announceAdded(
          added.map((item) => item.displayName),
          groupId
        );
      } else if (e.dataTransfer) {
        const urlData =
          e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (urlData) {
          const urls = urlData
            .split('\n')
            .map((url) => url.trim())
            .filter((url) => url && url.startsWith('http'));
          const addedUrls: string[] = [];
          for (const url of urls) {
            if (await addUrlItem(url, () => {}, groupId, activeWorkspaceId)) addedUrls.push(url);
          }
          if (urls.length > 0) {
            loadAllDataWithLoading();
          }
          announceAdded(addedUrls, groupId);
        }
      }
    } catch (error) {
      logError('Failed to add native files to group:', error);
    }
  };

  // グループレベルで処理されなかったドロップのフォールバック（グループ未指定）。
  // グループのあるワークスペースでは、グループの外には足さずに知らせる（未分類は無い。A3-157）
  useNativeDragDrop(async (e) => {
    if (activeWorkspaceHasGroups) {
      showWarning(t('workspace.dropOnGroup'));
      return;
    }
    await handleNativeFileDrop(e);
  });

  const handleDetachGroup = (groupId: string, screenX: number, screenY: number) => {
    window.electronAPI.workspaceAPI.detachGroup(groupId, screenX, screenY);
  };

  const handleCloseDetached = () => {
    if (detachedGroupId) {
      window.electronAPI.workspaceAPI.closeDetachedGroup(detachedGroupId);
    }
  };

  // アイテムの削除（右クリック・カードの ×）は、確認の子ウィンドウで確かめてから消す
  const handleRemoveItem = async (id: string) => {
    try {
      const name = items.find((i) => i.id === id)?.displayName ?? '';
      const result = await window.electronAPI.workspaceAPI.openConfirm({
        title: t('workspace.edit.removeTitle'),
        message: t('workspace.edit.removeConfirm', { name }),
        confirmText: t('workspace.edit.remove'),
        cancelText: t('common.cancel'),
        danger: true,
      });
      if (!result) return;
      await actions.handleRemove(id);
    } catch (error) {
      logError('Failed to confirm workspace item removal:', error);
    }
  };

  // handlers と ui の共通部分（通常モード・切り離しモードで共用）
  const normalHandlers = {
    onLaunch: actions.handleLaunch,
    onRemoveItem: (id: string) => void handleRemoveItem(id),
    onUpdateDisplayName: (id: string, displayName: string) => {
      actions.handleUpdateDisplayName(id, displayName);
      setEditingId(null);
    },
    // 編集は独立した子ウィンドウで開く（このウィンドウのサイズ・位置は変えない）
    onEditItem: (item: WorkspaceItem) => {
      window.electronAPI.workspaceAPI.openItemEditor(item.id).catch((error) => {
        logError('編集ウィンドウを開けませんでした:', error);
      });
    },
    onToggleGroup: toggleGroup,
    onUpdateGroup: actions.handleUpdateGroup,
    onDeleteGroup: handleDeleteGroup,
    onArchiveGroup: handleArchiveGroup,
    onAddSubgroup: actions.handleAddSubgroup,
    onDuplicateItem: actions.handleDuplicateItem,
    onMoveItemToGroup: actions.handleMoveItemToGroup,
    onMoveGroupToParent: actions.handleMoveGroupToParent,
    onReorderMixed: actions.handleReorderMixed,
    onNativeFileDrop: handleNativeFileDrop,
  };

  // noop ハンドラ（アーカイブモードで変更操作を無効化）
  const noop = () => {};
  const noopAsync = async () => {};

  // アーカイブモード用ハンドラ: 起動と折りたたみのみ有効
  const archiveHandlers = {
    onLaunch: actions.handleLaunch,
    onRemoveItem: noop,
    onUpdateDisplayName: noop,
    onEditItem: noop,
    onToggleGroup: (groupId: string) => {
      setArchivedGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g))
      );
    },
    onUpdateGroup: noopAsync,
    onDeleteGroup: handleDeleteGroup,
    onArchiveGroup: noop,
    onAddSubgroup: noopAsync,
    onDuplicateItem: noop,
    onMoveItemToGroup: noopAsync,
    onMoveGroupToParent: noopAsync,
    onReorderMixed: noopAsync,
  };

  const commonHandlers = isArchiveMode ? archiveHandlers : normalHandlers;

  const commonUi = {
    editingItemId: editingId,
    setEditingItemId: setEditingId,
    // 枠を出すのは前面のウィンドウだけ（A3-186）
    activeGroupId: isWindowFocused ? pasteGroupId : undefined,
    setActiveGroupId,
  };

  const resizeHandles = RESIZE_DIRECTIONS.map((direction) => (
    <div
      key={direction}
      className={`workspace-resize-handle ${direction}`}
      onMouseDown={handleResize(direction)}
    />
  ));

  // 切り離しウィンドウモード: 対象グループとその子孫のみ表示
  if (detachedGroupId) {
    const descendantIds = getDescendantGroupIds(detachedGroupId, groups);
    const detachedVisibleGroupIds = new Set([detachedGroupId, ...descendantIds]);

    return (
      <div
        className={`workspace-window detached-group-window ${backgroundTransparent ? 'background-transparent' : ''}`}
      >
        <WorkspaceGroupedList
          contentRef={contentRef}
          data={{ groups, items }}
          handlers={commonHandlers}
          ui={{
            ...commonUi,
            activeWorkspaceId,
            visibleGroupIds: detachedVisibleGroupIds,
            detachedRootGroupId: detachedGroupId,
          }}
        />
        <div className="detached-window-controls">
          <PinButton level={pinLevel} onLevelChange={setPinLevel} className="workspace-pin-btn" />
          <button
            className="action-btn workspace-close-btn"
            onClick={handleCloseDetached}
            title={t('workspace.detached.close')}
            aria-label={t('workspace.detached.closeLabel')}
          >
            ×
          </button>
        </div>
        {resizeHandles}
      </div>
    );
  }

  return (
    <div className={`workspace-window ${backgroundTransparent ? 'background-transparent' : ''}`}>
      <WorkspaceHeader
        isFilterVisible={isFilterVisible}
        onToggleFilter={() => {
          if (isFilterVisible) setFilterText('');
          setIsFilterVisible((prev) => !prev);
        }}
        onExpandAll={() => setAllGroupsCollapsed(false)}
        onCollapseAll={() => setAllGroupsCollapsed(true)}
        onAddMenu={(anchor) =>
          void window.electronAPI.showWorkspaceBlankContextMenu(activeWorkspaceId, 'add', anchor)
        }
        pinLevel={pinLevel}
        onPinLevelChange={setPinLevel}
        onClose={handleClose}
      />
      <WorkspaceTabBar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onTabClick={(id) => {
          setActiveWorkspaceId(id);
          setIsArchiveMode(false);
        }}
        onRenameWorkspace={actions.handleRenameWorkspace}
        onDeleteWorkspace={actions.handleDeleteWorkspace}
        onReorderWorkspaces={actions.handleReorderWorkspaces}
        isArchiveActive={isArchiveMode}
        onArchiveClick={() => setIsArchiveMode(true)}
      />
      {isFilterVisible && (
        <WorkspaceFilterBar
          filterText={filterText}
          onFilterTextChange={setFilterText}
          filterScope={filterScope}
          onFilterScopeChange={setFilterScope}
          onClose={() => {
            setIsFilterVisible(false);
            setFilterText('');
          }}
          focusTrigger={focusTrigger}
        />
      )}
      <WorkspaceGroupedList
        contentRef={contentRef}
        workspaces={workspaces}
        data={{ groups: displayGroups, items: displayItems }}
        handlers={{
          ...commonHandlers,
          onDetachGroup: isArchiveMode ? undefined : handleDetachGroup,
          onBlankContextMenu: isArchiveMode
            ? undefined
            : () =>
                void window.electronAPI.showWorkspaceBlankContextMenu(activeWorkspaceId, 'blank'),
          onAddGroup: isArchiveMode ? undefined : () => addGroupTo(activeWorkspaceId),
          onCollapseOtherGroups: isArchiveMode ? undefined : collapseOtherGroups,
        }}
        ui={{
          ...commonUi,
          isArchiveMode,
          activeWorkspaceId,
          visibleGroupIds: filterResult.visibleGroupIds,
          itemVisibility: filterResult.itemVisibility,
        }}
      />
      {resizeHandles}
    </div>
  );
};

export default WorkspaceApp;
