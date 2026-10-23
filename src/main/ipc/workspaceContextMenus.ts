/**
 * ワークスペース・切り離しウィンドウの右クリックメニュー（アイテム・グループ・タブ）
 *
 * 画面仕様: docs/screens/context-menu.md
 */
import { ipcMain, screen, Menu, MenuItem, WebContents } from 'electron';
import type {
  Workspace,
  WorkspaceBlankMenuKind,
  WorkspaceItem,
  WorkspaceGroup,
} from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { uncategorizedAddTarget } from '@common/utils/workspaceAddTarget';

import { openWorkspaceLinkCopies } from '../workspaceLinkWindowManager.js';
import { openWorkspaceItemPicker } from '../workspaceItemPickerWindowManager.js';
import { openWorkspaceNewItemEditor } from '../workspaceItemEditorWindowManager.js';
import {
  closeDetachedGroupWindow,
  createDetachedGroupWindow,
  getGroupIdByWebContentsId,
  hasDetachedGroupWindow,
} from '../detachedGroupWindowManager.js';

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
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WORKSPACE_CONTEXT_MENU,
    async (
      event,
      item: WorkspaceItem,
      groups: WorkspaceGroup[],
      workspaces: Workspace[]
    ): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();
      // 参照: 解決できたもの（linked）は編集をメインウィンドウで行う。元が見つからないもの（missing）は中身が無い
      const linked = item.ref?.status === 'ok';
      const missing = item.type === 'ref';
      // パス系のメニューは通常アイテム（path を持つ）だけに出す（パスの無い単一アイテムには出さない）
      const isLauncher = item.type === 'item' && item.launcherType !== 'windowSwitch';
      const hasParentFolder =
        isLauncher && item.launcherType !== 'url' && item.launcherType !== 'customUri';
      const isShortcut = isLauncher && item.originalPath !== undefined;
      const hasMemo = !!item.memo && item.memo.trim().length > 0;

      // 並びはメインウィンドウの右クリックに合わせる（編集・メモ → 置き場の操作 → パス → 削除）。
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

      if (workspaces && workspaces.length >= 1) {
        const moveSubmenu = buildMoveToWorkspaceSubmenu(
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE,
          item.id,
          item.workspaceId,
          workspaces
        );
        if (moveSubmenu) {
          menu.append(createSeparator());
          menu.append(moveSubmenu);
        }
      }
      const moveToGroup = buildMoveToGroupSubmenu(event.sender, item, groups ?? []);
      if (moveToGroup) menu.append(moveToGroup);

      // 参照は「コピーにする」「別のアイテムを指す」（コピーを参照にするのは下の「メインウィンドウへ移して参照にする」）
      menu.append(createSeparator());
      buildRefMenuItems(event.sender, item).forEach((menuItem) => menu.append(menuItem));

      // メインウィンドウの「ワークスペースに追加」の逆向き。移したあとワークスペース側は参照になる
      // （参照はもうメインウィンドウにあるので出さない）
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
 * 切り離しの項目を作る。ワークスペースでは一番上のグループだけ「切り離す」（切り離し済みなら「表示」）、
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
  return new MenuItem({
    label: hasDetachedGroupWindow(groupId)
      ? t('menu.workspaceGroup.showDetached')
      : t('menu.workspaceGroup.detach'),
    click: () => {
      // メニューを選んだ位置の近くに出す（ドラッグで切り離すときと同じ）
      const cursor = screen.getCursorScreenPoint();
      void createDetachedGroupWindow(groupId, cursor.x, cursor.y);
    },
  });
}

/** WorkspaceGroupContextMenu用のネイティブメニューハンドラーを設定 */
function setupWorkspaceGroupContextMenuHandler(): void {
  ipcMain.handle(
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
  ipcMain.handle(
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
 * 「➕ アイテムを追加 ▸」（メインウィンドウのアイテムから選ぶ・新しく入力して追加）
 *
 * @param target 追加先（グループの id か、未分類なら uncategorizedAddTarget の値）
 */
function buildAddItemSubmenuItem(sender: WebContents, target: string): MenuItem {
  const submenu = new Menu();
  submenu.append(
    new MenuItem({
      label: t('menu.workspaceGroup.addFromMain'),
      click: () => void openWorkspaceItemPicker(sender, target),
    })
  );
  submenu.append(
    new MenuItem({
      label: t('menu.workspaceGroup.addNew'),
      click: () => void openWorkspaceNewItemEditor(sender, target),
    })
  );
  return new MenuItem({ label: t('menu.workspaceGroup.addItem'), submenu });
}

/**
 * ワークスペースの余白・「未分類」の見出しの右クリックと、ヘッダーの ＋ のメニュー
 *
 * - blank（余白）: グループを追加・アイテムを追加（未分類へ）・貼り付け・すべて展開／折りたたむ
 * - uncategorized（「未分類」の見出し）: アイテムを追加（未分類へ）・グループにまとめる
 * - add（ヘッダーの ＋）: グループを追加・アイテムを追加（未分類へ）・ワークスペースを追加
 */
function setupWorkspaceBlankContextMenuHandler(): void {
  ipcMain.handle(
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
      const addItem = buildAddItemSubmenuItem(sender, uncategorizedAddTarget(workspaceId));

      if (kind === 'uncategorized') {
        menu.append(addItem);
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            t('menu.workspace.groupUncategorized'),
            sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_GROUP_UNCATEGORIZED,
            workspaceId
          )
        );
      } else if (kind === 'add') {
        menu.append(addGroup);
        menu.append(addItem);
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
        menu.append(addItem);
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
