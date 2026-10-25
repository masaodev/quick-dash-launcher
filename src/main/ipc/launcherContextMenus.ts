/**
 * メインウィンドウ・管理ウィンドウの右クリックメニュー
 * （アイテム・タブ・ウィンドウ検索の行・アイテム管理の行）
 *
 * 画面仕様: docs/screens/context-menu.md
 */
import { ipcMain, Menu, MenuItem } from 'electron';
import type { AppItem, WindowInfo, VirtualDesktopInfo } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { desktopLabel } from '@common/utils/desktopLabel';
import { isLauncherItem, isSetItem } from '@common/types/guards';
import { getDeletableItemId } from '@common/utils/launcherItemDelete';
import { canRunAsAdmin } from '@common/utils/runAsAdmin';

import { rerecordSetPositions } from '../services/launch/setRerecord.js';
import { showAdminWindowWithImportModal } from '../adminWindowManager.js';
import { isReferenceableAppItem } from '../services/workspace/workspaceRefResolver.js';

import {
  buildWorkspaceTargetSubmenu,
  loadWorkspaceTargets,
  type WorkspaceTargetPick,
} from './workspaceGroupPicker.js';
import {
  appendPathMenuItems,
  createMenuItem,
  createMenuItemWithKey,
  createSeparator,
  getValidWindow,
  LAUNCHER_PATH_MENU_CHANNELS,
  type MenuAnchor,
  popupMenu,
  t,
} from './contextMenuShared.js';

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
    async (event, item: AppItem, anchor?: MenuAnchor): Promise<void> => {
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

      // アプリ（exe・.lnk・.bat/.cmd）だけ。Ctrl+Shift+Enter はメインウィンドウのキー処理で受ける
      if (isLauncherItem(item) && canRunAsAdmin(item)) {
        menu.append(
          createMenuItemWithKey(
            t('menu.runAsAdmin'),
            'Ctrl+Shift+Enter',
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_RUN_AS_ADMIN,
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

      // 足す先のグループはその場で選ぶ（未分類は無い。A3-157）
      const { workspaces, groups } = await loadWorkspaceTargets();
      const sendTo = (channel: string) => (pick: WorkspaceTargetPick) =>
        event.sender.send(channel, { item, target: pick });
      const addTo = buildWorkspaceTargetSubmenu(
        t('menu.addToWorkspace'),
        workspaces,
        groups,
        sendTo(IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE)
      );
      if (addTo) menu.append(addTo);
      // 既定の「ワークスペースに追加」は参照。参照できるアイテムにだけ、コピーで足す項目を並べる
      if (isReferenceableAppItem(item)) {
        const addCopyTo = buildWorkspaceTargetSubmenu(
          t('menu.addCopyToWorkspace'),
          workspaces,
          groups,
          sendTo(IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_COPY_TO_WORKSPACE)
        );
        if (addCopyTo) menu.append(addCopyTo);
      }

      if (hasPathMenu) {
        menu.append(createSeparator());
        appendPathMenuItems(menu, event.sender, LAUNCHER_PATH_MENU_CHANNELS, item, {
          hasParentFolder,
          isShortcut,
          keys: {
            copyPath: 'Ctrl+C',
            copyParentPath: 'Ctrl+Shift+C',
            openParentFolder: 'Shift+Enter',
          },
        });
      }

      // 削除は確認してから（確認はメインウィンドウの中に出す）。フォルダ取込で並んだもの・自動取込のものには出さない
      if (getDeletableItemId(item)) {
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            t('menu.delete'),
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_DELETE_ITEM,
            item
          )
        );
      }

      // フォルダ取込で並んだアイテムは消せないので、元の取込の除外フィルタに足す入口を出す
      //（保存はしない。除外フィルタに名前を足した状態で取込の編集画面を開き、見て保存してもらう。A3-158）
      if (isLauncherItem(item) && item.isDirExpanded && item.expandedFromId) {
        menu.append(createSeparator());
        menu.append(
          createMenuItem(
            t('menu.excludeFromDir'),
            event.sender,
            IPC_CHANNELS.EVENT_LAUNCHER_MENU_EXCLUDE_FROM_DIR,
            item
          )
        );
      }

      popupMenu(menu, senderWindow, anchor);
    }
  );
}

/** メインウィンドウの一覧の余白（アイテムの無い所）の右クリックメニュー。➕ と同じ追加の入口を出す */
function setupLauncherBlankContextMenuHandler(): void {
  ipcMain.handle(IPC_CHANNELS.SHOW_LAUNCHER_BLANK_CONTEXT_MENU, async (event): Promise<void> => {
    const senderWindow = getValidWindow(event);
    if (!senderWindow) return;

    const menu = new Menu();
    menu.append(
      createMenuItem(
        t('launcher.registerMenu.quickAdd'),
        event.sender,
        IPC_CHANNELS.EVENT_LAUNCHER_BLANK_MENU_ADD_ITEM
      )
    );
    menu.append(
      createMenuItem(
        t('launcher.registerMenu.addFolderImport'),
        event.sender,
        IPC_CHANNELS.EVENT_LAUNCHER_BLANK_MENU_ADD_FOLDER_IMPORT
      )
    );
    menu.append(
      createMenuItem(
        t('menu.launcherBlank.registerFromClipboard'),
        event.sender,
        IPC_CHANNELS.EVENT_LAUNCHER_BLANK_MENU_REGISTER_FROM_CLIPBOARD
      )
    );
    menu.append(createSeparator());
    menu.append(
      new MenuItem({
        label: t('launcher.registerMenu.addBookmarks'),
        click: () => void showAdminWindowWithImportModal('bookmark'),
      })
    );
    menu.append(
      new MenuItem({
        label: t('launcher.registerMenu.addApps'),
        click: () => void showAdminWindowWithImportModal('app'),
      })
    );

    menu.popup({ window: senderWindow });
  });
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
      isPinned: boolean,
      anchor?: MenuAnchor
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
      // 足す先のグループはその場で選ぶ（未分類は無い。A3-157）
      const { workspaces, groups } = await loadWorkspaceTargets();
      const sendWindow = (includePosition: boolean) => (pick: WorkspaceTargetPick) =>
        event.sender.send(IPC_CHANNELS.EVENT_WINDOW_MENU_ADD_TO_WORKSPACE, {
          windowInfo,
          includePosition,
          target: pick,
        });
      for (const [label, includePosition] of [
        [t('menu.addToWorkspace'), false],
        [t('menu.window.addToWorkspaceWithPosition'), true],
      ] as const) {
        const submenu = buildWorkspaceTargetSubmenu(
          label,
          workspaces,
          groups,
          sendWindow(includePosition)
        );
        if (submenu) menu.append(submenu);
      }
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

      popupMenu(menu, senderWindow, anchor);
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
    async (
      event,
      count: number,
      desktopInfo: VirtualDesktopInfo,
      anchor?: MenuAnchor
    ): Promise<void> => {
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

      popupMenu(menu, senderWindow, anchor);
    }
  );
}

/** メインウィンドウ・管理ウィンドウの右クリックメニューを設定 */
export function setupLauncherContextMenus(): void {
  setupAdminItemContextMenuHandler();
  setupLauncherContextMenuHandler();
  setupLauncherBlankContextMenuHandler();
  setupFileTabContextMenuHandler();
  setupWindowContextMenuHandler();
  setupWindowsContextMenuHandler();
}
