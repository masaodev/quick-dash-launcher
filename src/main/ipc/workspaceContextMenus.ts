/**
 * ワークスペース・切り離しウィンドウの右クリックメニュー（アイテム・グループ・タブ）
 *
 * 画面仕様: docs/screens/context-menu.md
 */
import { screen, Menu, MenuItem, WebContents } from 'electron';
import type {
  Workspace,
  WorkspaceBlankMenuKind,
  WorkspaceItem,
  WorkspaceGroup,
} from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { canRunAsAdmin } from '@common/utils/runAsAdmin';

import { openWorkspaceLinkCopies } from '../workspaceLinkWindowManager.js';
import { openWorkspaceItemAsAdmin } from '../services/launch/adminItemLauncher.js';
import {
  closeDetachedGroupWindow,
  createDetachedGroupWindow,
  getGroupIdByWebContentsId,
  hasDetachedGroupWindow,
} from '../detachedGroupWindowManager.js';
import { handleIpc } from '../utils/ipcWrapper';

import {
  appendPathMenuItems,
  createMenuItem,
  createSeparator,
  getValidWindow,
  t,
  WORKSPACE_PATH_MENU_CHANNELS,
} from './contextMenuShared.js';
import {
  buildMoveToMainMenuItem,
  buildRefMenuItems,
  editLinkedMainItem,
} from './workspaceRefMenu.js';
import { buildWorkspaceTargetSubmenu, loadWorkspaceTargets } from './workspaceGroupPicker.js';

/** ワークスペース移動サブメニューを構築 */
function buildMoveToWorkspaceSubmenu(
  sender: WebContents,
  channel: string,
  targetId: string,
  currentWorkspaceId: string | undefined,
  workspaces: Workspace[],
  label: string = t('menu.workspaceItem.moveToWorkspace')
): MenuItem | null {
  const otherWorkspaces = workspaces.filter((ws) => ws.id !== currentWorkspaceId);
  if (otherWorkspaces.length === 0) return null;

  const submenu = new Menu();
  for (const ws of otherWorkspaces) {
    submenu.append(
      new MenuItem({
        label: ws.displayName,
        click: () => sender.send(channel, targetId, ws.id),
      })
    );
  }
  return new MenuItem({ label, submenu });
}

/** WorkspaceContextMenu用のネイティブメニューハンドラーを設定 */
function setupWorkspaceContextMenuHandler(): void {
  handleIpc(
    IPC_CHANNELS.SHOW_WORKSPACE_CONTEXT_MENU,
    async (
      event,
      item: WorkspaceItem,
      groups: WorkspaceGroup[],
      workspaces?: Workspace[]
    ): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();
      // 参照: 解決できたもの（linked）は編集をランチャーで行う。元が見つからないもの（missing）は中身が無い
      const linked = item.ref?.status === 'ok';
      const missing = item.type === 'ref';
      // パス系のメニューは通常アイテム（path を持つ）だけに出す（パスの無い単一アイテムには出さない）
      const isLauncher = item.type === 'item' && item.launcherType !== 'windowSwitch';
      const hasParentFolder =
        isLauncher && item.launcherType !== 'url' && item.launcherType !== 'customUri';
      const isShortcut = isLauncher && item.originalPath !== undefined;
      const hasMemo = !!item.memo && item.memo.trim().length > 0;

      // 並びはランチャーの右クリックに合わせる（編集・メモ → 置き場の操作 → パス → 削除）。
      // 起動はクリックでできるので置かない
      if (linked) {
        menu.append(
          new MenuItem({
            label: t('menu.workspaceItem.editMain'),
            click: () => void editLinkedMainItem(item),
          })
        );
      } else if (!missing) {
        menu.append(
          createMenuItem(
            t('menu.edit'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_EDIT_ITEM,
            item.id
          )
        );
      }
      menu.append(
        createMenuItem(
          item.ref ? t('menu.workspaceItem.renameAlias') : t('menu.workspaceItem.rename'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_RENAME_ITEM,
          item.id
        )
      );
      if (hasMemo) {
        menu.append(
          createMenuItem(
            t('menu.showNote'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_SHOW_MEMO,
            item.id
          )
        );
      }
      // アプリ（exe・.lnk・.bat/.cmd）だけ。ワークスペースにはキーが無いので、キーは添えない
      if (item.type === 'item' && canRunAsAdmin({ type: item.launcherType, path: item.path })) {
        menu.append(
          new MenuItem({
            label: t('menu.runAsAdmin'),
            click: () => void openWorkspaceItemAsAdmin(item),
          })
        );
      }

      if (workspaces && workspaces.length >= 1) {
        // 移す先のワークスペースのグループをその場で選ぶ（未分類は無い。A3-157）。
        // 画面から届く groups は今のワークスペースの分だけなので、全ワークスペースの分を読み直す
        const targets = await loadWorkspaceTargets();
        const moveSubmenu = buildWorkspaceTargetSubmenu(
          t('menu.workspaceItem.moveToWorkspace'),
          targets.workspaces,
          targets.groups,
          (pick) =>
            event.sender.send(
              IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE,
              item.id,
              pick.workspaceId,
              pick.groupId
            ),
          { excludeWorkspaceId: item.workspaceId }
        );
        if (moveSubmenu) {
          menu.append(createSeparator());
          menu.append(moveSubmenu);
        }
      }
      const moveToGroup = buildMoveToGroupSubmenu(event.sender, item, groups ?? []);
      if (moveToGroup) menu.append(moveToGroup);

      // 参照は「コピーにする」「別のアイテムを指す」（コピーを参照にするのは下の「ランチャーへ移して参照にする」）
      menu.append(createSeparator());
      buildRefMenuItems(event.sender, item).forEach((menuItem) => menu.append(menuItem));

      // ランチャーの「ワークスペースに追加」の逆向き。移したあとワークスペース側は参照になる
      // （参照はもうランチャーにあるので出さない）
      if (!item.ref) {
        menu.append(await buildMoveToMainMenuItem(item));
      }

      if (isLauncher) {
        menu.append(createSeparator());
        appendPathMenuItems(menu, event.sender, WORKSPACE_PATH_MENU_CHANNELS, item.id, {
          hasParentFolder,
          isShortcut,
        });
      }

      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          t('menu.workspaceItem.remove'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_ITEM,
          item.id
        )
      );

      menu.popup({ window: senderWindow });
    }
  );
}

/**
 * 「📁 グループへ移動 ▸」（同じワークスペースのほかのグループ。サブグループは字下げして親の下に並べる）
 *
 * 未分類は移す先に入れない（「グループから外す」は無くした。2026-10-23 本人「未分類はいらない」）。
 * アーカイブの表示中（workspaceId が空）と、ほかにグループが無いときは出さない
 */
function buildMoveToGroupSubmenu(
  sender: WebContents,
  item: WorkspaceItem,
  groups: WorkspaceGroup[]
): MenuItem | null {
  if (!item.workspaceId) return null;
  const inWorkspace = groups.filter((g) => g.workspaceId === item.workspaceId);
  const byOrder = (a: WorkspaceGroup, b: WorkspaceGroup) => a.order - b.order;
  const submenu = new Menu();
  const appendTree = (parentId: string | undefined, depth: number) => {
    for (const group of inWorkspace.filter((g) => g.parentGroupId === parentId).sort(byOrder)) {
      submenu.append(
        new MenuItem({
          label: `${'　'.repeat(depth)}${group.displayName}`,
          enabled: group.id !== item.groupId,
          click: () =>
            sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_GROUP, item.id, group.id),
        })
      );
      appendTree(group.id, depth + 1);
    }
  };
  appendTree(undefined, 0);
  const movable = inWorkspace.some((g) => g.id !== item.groupId);
  return movable ? new MenuItem({ label: t('menu.workspaceItem.moveToGroup'), submenu }) : null;
}

/**
 * 切り離しの項目を作る。ワークスペースでは一番上のグループだけ「切り離す」（切り離し済みなら「閉じる」）、
 * 切り離しウィンドウでは一番上のグループだけ「ワークスペースに戻す」（× と同じ）。
 * サブグループは切り離さない（切り離しウィンドウは一番上のグループから描くので、空になる）
 */
function buildDetachMenuItem(sender: WebContents, group: WorkspaceGroup): MenuItem | null {
  const groupId = group.id;
  const detachedGroupId = getGroupIdByWebContentsId(sender.id);
  if (detachedGroupId !== undefined) {
    if (detachedGroupId !== groupId) return null;
    return new MenuItem({
      label: t('menu.workspaceGroup.reattach'),
      click: () => closeDetachedGroupWindow(groupId),
    });
  }
  if (group.parentGroupId) return null;
  if (hasDetachedGroupWindow(groupId)) {
    // 前に出す・動かすのは、グループをワークスペースの外へドラッグして行う
    return new MenuItem({
      label: t('menu.workspaceGroup.closeDetached'),
      click: () => closeDetachedGroupWindow(groupId),
    });
  }
  return new MenuItem({
    label: t('menu.workspaceGroup.detach'),
    click: () => {
      // メニューを選んだ位置の近くに出す（ドラッグで切り離すときと同じ）
      const cursor = screen.getCursorScreenPoint();
      void createDetachedGroupWindow(groupId, cursor.x, cursor.y);
    },
  });
}

/** WorkspaceGroupContextMenu用のネイティブメニューハンドラーを設定 */
function setupWorkspaceGroupContextMenuHandler(): void {
  handleIpc(
    IPC_CHANNELS.SHOW_WORKSPACE_GROUP_CONTEXT_MENU,
    async (
      event,
      group: WorkspaceGroup,
      canAddSubgroup: boolean,
      workspaces?: Workspace[],
      isArchived?: boolean
    ): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();

      // アーカイブ済みグループ: 復元（ワークスペースへ）と完全削除だけ
      if (isArchived) {
        menu.append(
          createMenuItem(
            t('menu.workspaceGroup.copyAsText'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT,
            group.id
          )
        );
        const restoreSubmenu = buildMoveToWorkspaceSubmenu(
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_MOVE_TO_WORKSPACE,
          group.id,
          undefined,
          workspaces ?? [],
          t('menu.workspaceGroup.restore')
        );
        if (restoreSubmenu) {
          menu.append(createSeparator());
          menu.append(restoreSubmenu);
        }
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            t('menu.workspaceGroup.deleteFromArchive'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DELETE,
            group.id
          )
        );
        menu.popup({ window: senderWindow });
        return;
      }

      // グループのアイテム（サブグループの中も）を順に開く
      menu.append(
        createMenuItem(
          t('menu.workspaceGroup.openAll'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_OPEN_ALL,
          group.id
        )
      );
      menu.append(createSeparator());

      const detachItem = buildDetachMenuItem(event.sender, group);
      if (detachItem) {
        menu.append(detachItem);
        menu.append(createSeparator());
      }

      // 足す操作（アイテム・サブグループ）を 1 つの組にまとめる
      const addItemSubmenu = new Menu();
      addItemSubmenu.append(
        createMenuItem(
          t('menu.workspaceGroup.addFromMain'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_FROM_MAIN,
          group.id
        )
      );
      addItemSubmenu.append(
        createMenuItem(
          t('menu.workspaceGroup.addNew'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_NEW,
          group.id
        )
      );
      menu.append(
        new MenuItem({ label: t('menu.workspaceGroup.addItem'), submenu: addItemSubmenu })
      );
      if (canAddSubgroup) {
        menu.append(
          createMenuItem(
            t('menu.workspaceGroup.addSubgroup'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_SUBGROUP,
            group.id
          )
        );
      }
      menu.append(createSeparator());

      menu.append(
        createMenuItem(
          t('menu.workspaceGroup.rename'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_RENAME,
          group.id
        )
      );
      menu.append(
        createMenuItem(
          t('menu.workspaceGroup.changeColor'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER,
          group.id
        )
      );
      menu.append(
        createMenuItem(
          t('menu.workspaceGroup.duplicate'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DUPLICATE,
          group.id
        )
      );
      // 切り離しウィンドウにはほかのグループが無いので出さない
      if (getGroupIdByWebContentsId(event.sender.id) === undefined) {
        menu.append(
          createMenuItem(
            t('menu.workspaceGroup.collapseOthers'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_COLLAPSE_OTHERS,
            group.id
          )
        );
      }
      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          t('menu.workspaceGroup.copyAsText'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT,
          group.id
        )
      );

      // ワークスペース移動サブメニュー
      if (workspaces && workspaces.length >= 1) {
        const moveSubmenu = buildMoveToWorkspaceSubmenu(
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_MOVE_TO_WORKSPACE,
          group.id,
          group.workspaceId,
          workspaces
        );
        if (moveSubmenu) {
          menu.append(createSeparator());
          menu.append(moveSubmenu);
        }
      }

      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          t('menu.workspaceGroup.archive'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ARCHIVE,
          group.id
        )
      );
      menu.append(
        createMenuItem(
          t('menu.workspaceGroup.delete'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DELETE,
          group.id
        )
      );

      menu.popup({ window: senderWindow });
    }
  );
}

/** WorkspaceTabContextMenu用のネイティブメニューハンドラーを設定 */
function setupWorkspaceTabContextMenuHandler(): void {
  handleIpc(
    IPC_CHANNELS.SHOW_WORKSPACE_TAB_CONTEXT_MENU,
    async (event, workspaceId: string, canDelete: boolean): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();

      menu.append(
        createMenuItem(
          t('menu.tab.rename'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_TAB_MENU_RENAME,
          workspaceId
        )
      );
      menu.append(
        new MenuItem({
          label: t('menu.tab.linkCopies'),
          click: () => void openWorkspaceLinkCopies(event.sender, workspaceId),
        })
      );

      // このタブに足す・このタブのグループを開閉する（選んでいないタブなら、そのタブに切り替えてから）
      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          t('menu.workspace.addGroup'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_ADD_GROUP,
          workspaceId
        )
      );
      menu.append(
        createMenuItem(
          t('menu.workspace.addWorkspace'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_ADD_WORKSPACE
        )
      );
      menu.append(createSeparator());
      appendCollapseMenuItems(menu, event.sender, workspaceId);

      if (canDelete) {
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            t('menu.tab.delete'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_TAB_MENU_DELETE,
            workspaceId
          )
        );
      }

      menu.popup({ window: senderWindow });
    }
  );
}

/** 「すべて展開」「すべて折りたたむ」を足す */
function appendCollapseMenuItems(menu: Menu, sender: WebContents, workspaceId: string): void {
  menu.append(
    createMenuItem(
      t('menu.workspace.expandAll'),
      sender,
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_SET_ALL_COLLAPSED,
      workspaceId,
      false
    )
  );
  menu.append(
    createMenuItem(
      t('menu.workspace.collapseAll'),
      sender,
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_SET_ALL_COLLAPSED,
      workspaceId,
      true
    )
  );
}

/**
 * ワークスペースの余白・タブの並びの空いた所の右クリックと、ヘッダーの ＋ のメニュー
 *
 * - blank（余白）: グループを追加・貼り付け・すべて展開／折りたたむ
 * - add（ヘッダーの ＋）: グループを追加・ワークスペースを追加
 * - tabBar（タブの並びの空いた所）: ワークスペースを追加
 */
function setupWorkspaceBlankContextMenuHandler(): void {
  handleIpc(
    IPC_CHANNELS.SHOW_WORKSPACE_BLANK_CONTEXT_MENU,
    async (
      event,
      workspaceId: string,
      kind: WorkspaceBlankMenuKind,
      anchor?: { x: number; y: number }
    ): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;
      const sender = event.sender;
      const menu = new Menu();
      const addGroup = createMenuItem(
        t('menu.workspace.addGroup'),
        sender,
        IPC_CHANNELS.EVENT_WORKSPACE_MENU_ADD_GROUP,
        workspaceId
      );
      if (kind === 'tabBar') {
        menu.append(
          createMenuItem(
            t('menu.workspace.addWorkspace'),
            sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_ADD_WORKSPACE
          )
        );
      } else if (kind === 'add') {
        menu.append(addGroup);
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            t('menu.workspace.addWorkspace'),
            sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_ADD_WORKSPACE
          )
        );
      } else {
        menu.append(addGroup);
        // Ctrl+V と同じ（貼り付けのイベントをページに起こし、ページ側の振り分けを通す）
        menu.append(
          new MenuItem({
            label: t('menu.workspace.paste'),
            accelerator: 'Ctrl+V',
            registerAccelerator: false,
            click: () => sender.paste(),
          })
        );
        menu.append(createSeparator());
        appendCollapseMenuItems(menu, sender, workspaceId);
      }

      // ＋ のメニューはボタンの下に出す（右クリックはカーソルの位置）
      menu.popup(
        anchor
          ? { window: senderWindow, x: Math.round(anchor.x), y: Math.round(anchor.y) }
          : { window: senderWindow }
      );
    }
  );
}

/** ワークスペース・切り離しウィンドウの右クリックメニューを設定 */
export function setupWorkspaceContextMenus(): void {
  setupWorkspaceContextMenuHandler();
  setupWorkspaceGroupContextMenuHandler();
  setupWorkspaceTabContextMenuHandler();
  setupWorkspaceBlankContextMenuHandler();
}
