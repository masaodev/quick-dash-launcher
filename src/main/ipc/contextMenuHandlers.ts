/**
 * コンテキストメニュー用IPCハンドラー
 * 全てのReactコンテキストメニューをElectronのネイティブメニューに変換
 */
import { ipcMain, BrowserWindow, Menu, MenuItem, IpcMainInvokeEvent, WebContents } from 'electron';
import type {
  AppItem,
  Workspace,
  WorkspaceItem,
  WorkspaceGroup,
  WindowInfo,
  VirtualDesktopInfo,
} from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { isGroupItem, isClipboardItem } from '@common/types/guards';

/** メニューアイテムを作成するヘルパー */
function createMenuItem(
  label: string,
  sender: WebContents,
  channel: string,
  ...args: unknown[]
): MenuItem {
  return new MenuItem({
    label,
    click: () => sender.send(channel, ...args),
  });
}

/** セパレーターを作成 */
function createSeparator(): MenuItem {
  return new MenuItem({ type: 'separator' });
}

/** イベントからウィンドウを取得（無効な場合はnull） */
function getValidWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return null;
  }
  return window;
}

/** AdminItemManagerContextMenu用のネイティブメニューハンドラーを設定 */
function setupAdminItemContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_ADMIN_ITEM_CONTEXT_MENU,
    async (event, selectedCount: number, isSingleLine: boolean): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();
      const countSuffix = isSingleLine ? '' : ` (${selectedCount}行)`;

      menu.append(
        createMenuItem(
          `📋 複製${countSuffix}`,
          event.sender,
          IPC_CHANNELS.EVENT_ADMIN_MENU_DUPLICATE_ITEMS
        )
      );

      if (isSingleLine) {
        menu.append(
          createMenuItem('✏️ 詳細編集', event.sender, IPC_CHANNELS.EVENT_ADMIN_MENU_EDIT_ITEM)
        );
      }

      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          `🗑️ 削除${countSuffix}`,
          event.sender,
          IPC_CHANNELS.EVENT_ADMIN_MENU_DELETE_ITEMS
        )
      );

      menu.popup({ window: senderWindow });
    }
  );
}

/** LauncherContextMenu用のネイティブメニューハンドラーを設定 */
function setupLauncherContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_LAUNCHER_CONTEXT_MENU,
    async (event, item: AppItem): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();
      const isGroupOrClipboard = isGroupItem(item) || isClipboardItem(item);
      const hasParentFolder =
        !isGroupOrClipboard && 'type' in item && item.type !== 'url' && item.type !== 'customUri';
      const isShortcut =
        !isGroupOrClipboard && 'originalPath' in item && item.originalPath !== undefined;
      const hasMemo = 'memo' in item && item.memo && item.memo.trim().length > 0;

      menu.append(
        createMenuItem('✏️ 編集', event.sender, IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM, item)
      );

      if (hasMemo) {
        menu.append(
          createMenuItem(
            '📝 メモを表示',
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_SHOW_MEMO,
            item
          )
        );
      }

      if (!isGroupOrClipboard) {
        menu.append(createSeparator());
      }

      menu.append(
        createMenuItem(
          '⭐ ワークスペースに追加',
          event.sender,
          IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE,
          item
        )
      );

      if (isGroupOrClipboard) {
        menu.popup({ window: senderWindow });
        return;
      }

      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          '📋 パスをコピー',
          event.sender,
          IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH,
          item
        )
      );

      if (hasParentFolder) {
        menu.append(
          createMenuItem(
            '📋 親フォルダーのパスをコピー',
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH,
            item
          )
        );
        menu.append(
          createMenuItem(
            '📂 親フォルダーを開く',
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER,
            item
          )
        );
      }

      if (isShortcut) {
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            '📋 リンク先のパスをコピー',
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH,
            item
          )
        );
        menu.append(
          createMenuItem(
            '📋 リンク先の親フォルダーのパスをコピー',
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH,
            item
          )
        );
        menu.append(
          createMenuItem(
            '📂 リンク先の親フォルダーを開く',
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
            item
          )
        );
      }

      menu.popup({ window: senderWindow });
    }
  );
}

/** ワークスペース移動サブメニューを構築 */
function buildMoveToWorkspaceSubmenu(
  sender: WebContents,
  channel: string,
  targetId: string,
  currentWorkspaceId: string | undefined,
  workspaces: Workspace[]
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
  return new MenuItem({ label: '📁 ワークスペースを移動', submenu });
}

/** WorkspaceContextMenu用のネイティブメニューハンドラーを設定 */
function setupWorkspaceContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WORKSPACE_CONTEXT_MENU,
    async (
      event,
      item: WorkspaceItem,
      _groups: WorkspaceGroup[],
      workspaces: Workspace[]
    ): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();
      const isClipboardType = item.type === 'clipboard';
      const hasParentFolder = item.type !== 'url' && item.type !== 'customUri' && !isClipboardType;
      const isShortcut = item.originalPath !== undefined && !isClipboardType;

      menu.append(
        createMenuItem(
          '✏️ 表示名を変更',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_RENAME_ITEM,
          item.id
        )
      );
      menu.append(
        createMenuItem(
          '▶️ 起動',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_LAUNCH_ITEM,
          item.id
        )
      );
      menu.append(createSeparator());

      if (!isClipboardType) {
        menu.append(
          createMenuItem(
            '📋 パスをコピー',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PATH,
            item.id
          )
        );
      }

      if (hasParentFolder) {
        menu.append(
          createMenuItem(
            '📋 親フォルダーのパスをコピー',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PARENT_PATH,
            item.id
          )
        );
        menu.append(
          createMenuItem(
            '📂 親フォルダーを開く',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER,
            item.id
          )
        );
      }

      if (isShortcut) {
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            '📋 リンク先のパスをコピー',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH,
            item.id
          )
        );
        menu.append(
          createMenuItem(
            '📋 リンク先の親フォルダーのパスをコピー',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH,
            item.id
          )
        );
        menu.append(
          createMenuItem(
            '📂 リンク先の親フォルダーを開く',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
            item.id
          )
        );
      }

      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          '🔧 編集',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_EDIT_ITEM,
          item.id
        )
      );

      // ワークスペース移動サブメニュー
      if (workspaces && workspaces.length >= 1) {
        const moveSubmenu = buildMoveToWorkspaceSubmenu(
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE,
          item.id,
          item.workspaceId,
          workspaces
        );
        if (moveSubmenu) {
          menu.append(moveSubmenu);
        }
      }

      if (item.groupId !== undefined) {
        menu.append(
          createMenuItem(
            '📤 グループから削除',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP,
            item.id
          )
        );
      }

      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          '🗑️ ワークスペースから削除',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_ITEM,
          item.id
        )
      );

      menu.popup({ window: senderWindow });
    }
  );
}

/** WorkspaceGroupContextMenu用のネイティブメニューハンドラーを設定 */
function setupWorkspaceGroupContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WORKSPACE_GROUP_CONTEXT_MENU,
    async (
      event,
      group: WorkspaceGroup,
      canAddSubgroup: boolean,
      workspaces?: Workspace[]
    ): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();

      if (canAddSubgroup) {
        menu.append(
          createMenuItem(
            '📂 サブグループを追加',
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_SUBGROUP,
            group.id
          )
        );
        menu.append(createSeparator());
      }

      menu.append(
        createMenuItem(
          '✏️ グループ名を変更',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_RENAME,
          group.id
        )
      );
      menu.append(
        createMenuItem(
          '🎨 カラーを変更',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER,
          group.id
        )
      );
      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          '📋 テキストでコピー',
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
          '📦 グループをアーカイブ',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ARCHIVE,
          group.id
        )
      );
      menu.append(
        createMenuItem(
          '🗑️ グループを削除',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DELETE,
          group.id
        )
      );

      menu.popup({ window: senderWindow });
    }
  );
}

/** FileTabContextMenu用のネイティブメニューハンドラーを設定 */
function setupFileTabContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_FILE_TAB_CONTEXT_MENU,
    async (event, tabIndex: number): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();

      menu.append(
        createMenuItem(
          '✏️ 名前を変更',
          event.sender,
          IPC_CHANNELS.EVENT_FILE_TAB_MENU_RENAME,
          tabIndex
        )
      );

      menu.popup({ window: senderWindow });
    }
  );
}

/** WindowContextMenu用のネイティブメニューハンドラーを設定 */
function setupWindowContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WINDOW_CONTEXT_MENU,
    async (
      event,
      windowInfo: WindowInfo,
      desktopInfo: VirtualDesktopInfo,
      isPinned: boolean
    ): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();

      menu.append(
        createMenuItem(
          '▶️ アクティブにする',
          event.sender,
          IPC_CHANNELS.EVENT_WINDOW_MENU_ACTIVATE,
          windowInfo
        )
      );
      menu.append(createSeparator());

      const canMoveToDesktop = desktopInfo.supported && desktopInfo.desktopCount > 1;

      if (canMoveToDesktop) {
        const virtualDesktopSubmenu = new Menu();

        for (let i = 1; i <= desktopInfo.desktopCount; i++) {
          const isCurrentDesktop = windowInfo.desktopNumber === i;
          const label = isCurrentDesktop ? `✓ デスクトップ ${i} (現在)` : `🖥️ デスクトップ ${i}`;

          virtualDesktopSubmenu.append(
            new MenuItem({
              label,
              enabled: !isCurrentDesktop,
              click: () =>
                event.sender.send(IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP, windowInfo.hwnd, i),
            })
          );
        }

        menu.append(
          new MenuItem({ label: '🖥️ 仮想デスクトップへの移動', submenu: virtualDesktopSubmenu })
        );
      } else {
        menu.append(new MenuItem({ label: '🖥️ 仮想デスクトップへの移動', enabled: false }));
      }

      if (desktopInfo.supported) {
        menu.append(createSeparator());
        const pinLabel = isPinned ? '📌 固定を解除' : '📌 全デスクトップに固定';
        const pinChannel = isPinned ? IPC_CHANNELS.UNPIN_WINDOW : IPC_CHANNELS.PIN_WINDOW;
        menu.append(createMenuItem(pinLabel, event.sender, pinChannel, windowInfo.hwnd));
      }

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
          '✏️ 名前を変更',
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_TAB_MENU_RENAME,
          workspaceId
        )
      );

      if (canDelete) {
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            '🗑️ 削除',
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

/** 全てのコンテキストメニューハンドラーを設定 */
export function setupContextMenuHandlers(): void {
  setupAdminItemContextMenuHandler();
  setupLauncherContextMenuHandler();
  setupWorkspaceContextMenuHandler();
  setupWorkspaceGroupContextMenuHandler();
  setupWorkspaceTabContextMenuHandler();
  setupFileTabContextMenuHandler();
  setupWindowContextMenuHandler();
}
