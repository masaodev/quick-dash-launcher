/**
 * コンテキストメニュー用IPCハンドラー
 * 全てのReactコンテキストメニューをElectronのネイティブメニューに変換
 *
 * 画面: 右クリックメニュー
 * 画面仕様: docs/screens/context-menu.md
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
import { desktopLabel } from '@common/utils/desktopLabel';
import { isLauncherItem, isSetItem } from '@common/types/guards';

import { mainI18n } from '../services/mainI18n.js';
import { rerecordSetPositions } from '../services/launch/setRerecord.js';
import { getMainWindow, showMainWindow } from '../windowManager.js';

/** メニューの文言（開くたびに作るので、今の表示言語になる） */
const t = mainI18n.t.bind(mainI18n);

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

/** パス系メニューの送信先チャンネル（ランチャーとワークスペースで共通の並び） */
interface PathMenuChannels {
  copyPath: string;
  copyParentPath: string;
  openParentFolder: string;
  copyShortcutPath: string;
  copyShortcutParentPath: string;
  openShortcutParentFolder: string;
}

/** パスのコピー・親フォルダ・リンク先の各メニュー項目を追加する */
function appendPathMenuItems(
  menu: Menu,
  sender: WebContents,
  channels: PathMenuChannels,
  arg: unknown,
  options: { hasParentFolder: boolean; isShortcut: boolean }
): void {
  menu.append(createMenuItem(t('menu.copyPath'), sender, channels.copyPath, arg));

  if (options.hasParentFolder) {
    menu.append(createMenuItem(t('menu.copyParentPath'), sender, channels.copyParentPath, arg));
    menu.append(createMenuItem(t('menu.openParentFolder'), sender, channels.openParentFolder, arg));
  }

  if (options.isShortcut) {
    menu.append(createSeparator());
    menu.append(createMenuItem(t('menu.copyShortcutPath'), sender, channels.copyShortcutPath, arg));
    menu.append(
      createMenuItem(t('menu.copyShortcutParentPath'), sender, channels.copyShortcutParentPath, arg)
    );
    menu.append(
      createMenuItem(
        t('menu.openShortcutParentFolder'),
        sender,
        channels.openShortcutParentFolder,
        arg
      )
    );
  }
}

const LAUNCHER_PATH_MENU_CHANNELS: PathMenuChannels = {
  copyPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH,
  copyParentPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH,
  openParentFolder: IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER,
  copyShortcutPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH,
  copyShortcutParentPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH,
  openShortcutParentFolder: IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
};

const WORKSPACE_PATH_MENU_CHANNELS: PathMenuChannels = {
  copyPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PATH,
  copyParentPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PARENT_PATH,
  openParentFolder: IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER,
  copyShortcutPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH,
  copyShortcutParentPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH,
  openShortcutParentFolder: IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
};

/** AdminItemManagerContextMenu用のネイティブメニューハンドラーを設定 */
function setupAdminItemContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_ADMIN_ITEM_CONTEXT_MENU,
    async (event, selectedCount: number, isSingleLine: boolean): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();

      menu.append(
        createMenuItem(
          isSingleLine
            ? t('menu.admin.duplicate')
            : t('menu.admin.duplicateRows', { count: selectedCount }),
          event.sender,
          IPC_CHANNELS.EVENT_ADMIN_MENU_DUPLICATE_ITEMS
        )
      );

      if (isSingleLine) {
        menu.append(
          createMenuItem(
            t('menu.admin.editDetails'),
            event.sender,
            IPC_CHANNELS.EVENT_ADMIN_MENU_EDIT_ITEM
          )
        );
      }

      menu.append(createSeparator());
      menu.append(
        createMenuItem(
          isSingleLine
            ? t('menu.admin.delete')
            : t('menu.admin.deleteRows', { count: selectedCount }),
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
      // パス系の項目はパスを持つアイテムだけ（セット・クリップボード・ウィンドウ操作・パスの無い単一アイテムには出さない）
      const hasPathMenu = isLauncherItem(item) && item.type !== 'windowSwitch';
      const hasParentFolder = hasPathMenu && item.type !== 'url' && item.type !== 'customUri';
      const isShortcut = hasPathMenu && item.originalPath !== undefined;
      const hasMemo = 'memo' in item && item.memo && item.memo.trim().length > 0;

      // F2 はメインウィンドウのキー処理で受けるので、ここでは右端に表示するだけ（登録しない）
      menu.append(
        new MenuItem({
          label: t('menu.edit'),
          accelerator: 'F2',
          registerAccelerator: false,
          click: () => event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM, item),
        })
      );

      if (hasMemo) {
        menu.append(
          createMenuItem(
            t('menu.showNote'),
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_SHOW_MEMO,
            item
          )
        );
      }

      if (hasPathMenu) {
        menu.append(createSeparator());
      }

      // 置き場所のある行を持つセットは、今の画面から位置を取り直せる
      if (isSetItem(item) && item.entries.some((entry) => entry.placement)) {
        menu.append(createSeparator());
        menu.append(
          new MenuItem({
            label: t('set.redo.menu'),
            click: () => void rerecordSetPositions(item),
          })
        );
        menu.append(createSeparator());
      }

      menu.append(
        createMenuItem(
          t('menu.addToWorkspace'),
          event.sender,
          IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE,
          item
        )
      );

      if (!hasPathMenu) {
        menu.popup({ window: senderWindow });
        return;
      }

      menu.append(createSeparator());
      appendPathMenuItems(menu, event.sender, LAUNCHER_PATH_MENU_CHANNELS, item, {
        hasParentFolder,
        isShortcut,
      });

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

/**
 * ワークスペースのアイテムをメインウィンドウに登録する（登録画面はメインウィンドウが子ウィンドウで開く）
 * 登録画面はメインウィンドウを親にして開くので、先にメインウィンドウを出す
 */
async function registerWorkspaceItemToMain(item: WorkspaceItem): Promise<void> {
  await showMainWindow();
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REGISTER_TO_MAIN, item);
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
      // パス系のメニューは通常アイテム（path を持つ）だけに出す（パスの無い単一アイテムには出さない）
      const isLauncher = item.type === 'item' && item.launcherType !== 'windowSwitch';
      const hasParentFolder =
        isLauncher && item.launcherType !== 'url' && item.launcherType !== 'customUri';
      const isShortcut = isLauncher && item.originalPath !== undefined;
      const hasMemo = !!item.memo && item.memo.trim().length > 0;

      // 並びはメインウィンドウの右クリックに合わせる（編集・メモ → 置き場の操作 → パス → 削除）。
      // 起動はクリックでできるので置かない
      menu.append(
        createMenuItem(
          t('menu.edit'),
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_EDIT_ITEM,
          item.id
        )
      );
      menu.append(
        createMenuItem(
          t('menu.workspaceItem.rename'),
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

      const placementItems: MenuItem[] = [];
      if (workspaces && workspaces.length >= 1) {
        const moveSubmenu = buildMoveToWorkspaceSubmenu(
          event.sender,
          IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE,
          item.id,
          item.workspaceId,
          workspaces
        );
        if (moveSubmenu) placementItems.push(moveSubmenu);
      }
      if (item.groupId !== undefined) {
        placementItems.push(
          createMenuItem(
            t('menu.workspaceItem.removeFromGroup'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP,
            item.id
          )
        );
      }
      if (placementItems.length > 0) {
        menu.append(createSeparator());
        placementItems.forEach((menuItem) => menu.append(menuItem));
      }

      // メインウィンドウの「ワークスペースに追加」の逆向き
      menu.append(createSeparator());
      menu.append(
        new MenuItem({
          label: t('menu.workspaceItem.registerToMain'),
          click: () => void registerWorkspaceItemToMain(item),
        })
      );

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

      if (canAddSubgroup) {
        menu.append(
          createMenuItem(
            t('menu.workspaceGroup.addSubgroup'),
            event.sender,
            IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_SUBGROUP,
            group.id
          )
        );
        menu.append(createSeparator());
      }

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
          t('menu.tab.rename'),
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
          t('menu.window.activate'),
          event.sender,
          IPC_CHANNELS.EVENT_WINDOW_MENU_ACTIVATE,
          windowInfo
        )
      );
      menu.append(createSeparator());

      // ワークスペースへの登録（通常アイテムと同じ入口を用意する）。
      // 既定はタイトルとプロセス名でアクティブ化するだけ。位置の記録は明示的に選ばせる
      menu.append(
        createMenuItem(
          t('menu.addToWorkspace'),
          event.sender,
          IPC_CHANNELS.EVENT_WINDOW_MENU_ADD_TO_WORKSPACE,
          { windowInfo, includePosition: false }
        )
      );
      menu.append(
        createMenuItem(
          t('menu.window.addToWorkspaceWithPosition'),
          event.sender,
          IPC_CHANNELS.EVENT_WINDOW_MENU_ADD_TO_WORKSPACE,
          { windowInfo, includePosition: true }
        )
      );
      menu.append(createSeparator());

      const canMoveToDesktop = desktopInfo.supported && desktopInfo.desktopCount > 1;

      if (canMoveToDesktop) {
        const virtualDesktopSubmenu = new Menu();

        for (let i = 1; i <= desktopInfo.desktopCount; i++) {
          const isCurrentDesktop = windowInfo.desktopNumber === i;
          const number = desktopLabel(i, desktopInfo.desktopNames);
          const label = isCurrentDesktop
            ? t('menu.window.currentDesktop', { number })
            : t('menu.window.desktop', { number });

          virtualDesktopSubmenu.append(
            new MenuItem({
              label,
              enabled: !isCurrentDesktop,
              click: () =>
                event.sender.send(
                  IPC_CHANNELS.EVENT_WINDOW_MENU_MOVE_TO_DESKTOP,
                  windowInfo.hwnd,
                  i
                ),
            })
          );
        }

        menu.append(
          new MenuItem({ label: t('menu.window.moveToDesktop'), submenu: virtualDesktopSubmenu })
        );
      } else {
        menu.append(new MenuItem({ label: t('menu.window.moveToDesktop'), enabled: false }));
      }

      if (desktopInfo.supported) {
        menu.append(createSeparator());
        const pinLabel = isPinned
          ? t('menu.window.stopShowingOnAllDesktops')
          : t('menu.window.showOnAllDesktops');
        const pinChannel = isPinned
          ? IPC_CHANNELS.EVENT_WINDOW_MENU_UNPIN
          : IPC_CHANNELS.EVENT_WINDOW_MENU_PIN;
        // Ctrl+P・Ctrl+D はメインウィンドウのキー処理で受けるので、右端に表示するだけ（登録しない）
        menu.append(
          new MenuItem({
            label: pinLabel,
            accelerator: 'Ctrl+P',
            registerAccelerator: false,
            click: () => event.sender.send(pinChannel, windowInfo.hwnd),
          })
        );
      }

      menu.append(createSeparator());
      menu.append(
        new MenuItem({
          label: t('menu.window.close'),
          accelerator: 'Ctrl+D',
          registerAccelerator: false,
          click: () => event.sender.send(IPC_CHANNELS.EVENT_WINDOW_MENU_CLOSE, windowInfo),
        })
      );

      menu.popup({ window: senderWindow });
    }
  );
}

/**
 * ウィンドウ検索で 2 つ以上を選んでいるときの右クリックメニュー
 * 1 つのときのメニューから、まとめてできる操作（固定・移動・閉じる）だけを出す。
 * どのウィンドウに効かせるかはレンダラー側の選択で決める
 */
function setupWindowsContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WINDOWS_CONTEXT_MENU,
    async (event, count: number, desktopInfo: VirtualDesktopInfo): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;

      const menu = new Menu();
      menu.append(new MenuItem({ label: t('menu.window.count', { count }), enabled: false }));
      menu.append(createSeparator());

      if (desktopInfo.supported && desktopInfo.desktopCount > 1) {
        const submenu = new Menu();
        for (let i = 1; i <= desktopInfo.desktopCount; i++) {
          submenu.append(
            createMenuItem(
              t('menu.window.desktop', { number: desktopLabel(i, desktopInfo.desktopNames) }),
              event.sender,
              IPC_CHANNELS.EVENT_WINDOWS_MENU_MOVE_TO_DESKTOP,
              i
            )
          );
        }
        menu.append(new MenuItem({ label: t('menu.window.moveToDesktop'), submenu }));
      } else {
        menu.append(new MenuItem({ label: t('menu.window.moveToDesktop'), enabled: false }));
      }

      if (desktopInfo.supported) {
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            t('menu.window.showOnAllDesktops'),
            event.sender,
            IPC_CHANNELS.EVENT_WINDOWS_MENU_PIN,
            true
          )
        );
        menu.append(
          createMenuItem(
            t('menu.window.stopShowingOnAllDesktops'),
            event.sender,
            IPC_CHANNELS.EVENT_WINDOWS_MENU_PIN,
            false
          )
        );
      }

      menu.append(createSeparator());
      menu.append(
        new MenuItem({
          label: t('menu.window.closeCount', { count }),
          accelerator: 'Ctrl+D',
          registerAccelerator: false,
          click: () => event.sender.send(IPC_CHANNELS.EVENT_WINDOWS_MENU_CLOSE),
        })
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

/** 全てのコンテキストメニューハンドラーを設定 */
export function setupContextMenuHandlers(): void {
  setupAdminItemContextMenuHandler();
  setupLauncherContextMenuHandler();
  setupWorkspaceContextMenuHandler();
  setupWorkspaceGroupContextMenuHandler();
  setupWorkspaceTabContextMenuHandler();
  setupFileTabContextMenuHandler();
  setupWindowContextMenuHandler();
  setupWindowsContextMenuHandler();
}
