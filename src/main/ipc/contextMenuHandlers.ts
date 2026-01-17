/**
 * コンテキストメニュー用IPCハンドラー
 * 全てのReactコンテキストメニューをElectronのネイティブメニューに変換
 */
import { ipcMain, BrowserWindow, Menu, MenuItem } from 'electron';
import type { AppItem, WorkspaceItem, WorkspaceGroup } from '@common/types';
import {
  SHOW_ADMIN_ITEM_CONTEXT_MENU,
  EVENT_ADMIN_MENU_DUPLICATE_ITEMS,
  EVENT_ADMIN_MENU_EDIT_ITEM,
  EVENT_ADMIN_MENU_DELETE_ITEMS,
  SHOW_LAUNCHER_CONTEXT_MENU,
  EVENT_LAUNCHER_MENU_EDIT_ITEM,
  EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE,
  EVENT_LAUNCHER_MENU_COPY_PATH,
  EVENT_LAUNCHER_MENU_COPY_PARENT_PATH,
  EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER,
  EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH,
  EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH,
  EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
  SHOW_WORKSPACE_CONTEXT_MENU,
  EVENT_WORKSPACE_MENU_RENAME_ITEM,
  EVENT_WORKSPACE_MENU_LAUNCH_ITEM,
  EVENT_WORKSPACE_MENU_COPY_PATH,
  EVENT_WORKSPACE_MENU_COPY_PARENT_PATH,
  EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER,
  EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH,
  EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH,
  EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
  EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP,
  EVENT_WORKSPACE_MENU_REMOVE_ITEM,
  SHOW_WORKSPACE_GROUP_CONTEXT_MENU,
  EVENT_WORKSPACE_GROUP_MENU_RENAME,
  EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER,
  EVENT_WORKSPACE_GROUP_MENU_CHANGE_COLOR,
  EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT,
  EVENT_WORKSPACE_GROUP_MENU_ARCHIVE,
  EVENT_WORKSPACE_GROUP_MENU_DELETE,
} from '@common/ipcChannels.js';
import { isGroupItem } from '@common/types/guards.js';

/**
 * AdminItemManagerContextMenu用のネイティブメニューハンドラーを設定
 */
export function setupAdminItemContextMenuHandler(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    SHOW_ADMIN_ITEM_CONTEXT_MENU,
    async (event, selectedCount: number, isSingleLine: boolean): Promise<void> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow || senderWindow.isDestroyed()) {
          return;
        }

        const menu = new Menu();

        // 複製
        menu.append(
          new MenuItem({
            label: isSingleLine ? '📋 複製' : `📋 複製 (${selectedCount}行)`,
            click: () => {
              event.sender.send(EVENT_ADMIN_MENU_DUPLICATE_ITEMS);
            },
          })
        );

        // 詳細編集（単一行のみ）
        if (isSingleLine) {
          menu.append(
            new MenuItem({
              label: '✏️ 詳細編集',
              click: () => {
                event.sender.send(EVENT_ADMIN_MENU_EDIT_ITEM);
              },
            })
          );
        }

        menu.append(new MenuItem({ type: 'separator' }));

        // 削除
        menu.append(
          new MenuItem({
            label: isSingleLine ? '🗑️ 削除' : `🗑️ 削除 (${selectedCount}行)`,
            click: () => {
              event.sender.send(EVENT_ADMIN_MENU_DELETE_ITEMS);
            },
          })
        );

        // メニューを表示
        menu.popup({
          window: senderWindow,
        });
      } catch (error) {
        console.error('Failed to show admin item context menu:', error);
      }
    }
  );
}

/**
 * LauncherContextMenu用のネイティブメニューハンドラーを設定
 */
export function setupLauncherContextMenuHandler(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(SHOW_LAUNCHER_CONTEXT_MENU, async (event, item: AppItem): Promise<void> => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow || senderWindow.isDestroyed()) {
        return;
      }

      const menu = new Menu();
      const isGroup = isGroupItem(item);
      const hasParentFolder =
        !isGroup && 'type' in item && item.type !== 'url' && item.type !== 'customUri';
      const isShortcut = !isGroup && 'originalPath' in item && item.originalPath !== undefined;

      // 編集
      menu.append(
        new MenuItem({
          label: '✏️ 編集',
          click: () => {
            event.sender.send(EVENT_LAUNCHER_MENU_EDIT_ITEM, item);
          },
        })
      );

      // グループ以外は区切り線を追加
      if (!isGroup) {
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // ワークスペースに追加
      menu.append(
        new MenuItem({
          label: '⭐ ワークスペースに追加',
          click: () => {
            event.sender.send(EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE, item);
          },
        })
      );

      // グループの場合はここで終了
      if (isGroup) {
        menu.popup({ window: senderWindow });
        return;
      }

      menu.append(new MenuItem({ type: 'separator' }));

      // パスをコピー
      menu.append(
        new MenuItem({
          label: '📋 パスをコピー',
          click: () => {
            event.sender.send(EVENT_LAUNCHER_MENU_COPY_PATH, item);
          },
        })
      );

      // 親フォルダー関連（URLとcustomURI以外）
      if (hasParentFolder) {
        menu.append(
          new MenuItem({
            label: '📋 親フォルダーのパスをコピー',
            click: () => {
              event.sender.send(EVENT_LAUNCHER_MENU_COPY_PARENT_PATH, item);
            },
          })
        );

        menu.append(
          new MenuItem({
            label: '📂 親フォルダーを開く',
            click: () => {
              event.sender.send(EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER, item);
            },
          })
        );
      }

      // ショートカット関連
      if (isShortcut) {
        menu.append(new MenuItem({ type: 'separator' }));

        menu.append(
          new MenuItem({
            label: '📋 リンク先のパスをコピー',
            click: () => {
              event.sender.send(EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH, item);
            },
          })
        );

        menu.append(
          new MenuItem({
            label: '📋 リンク先の親フォルダーのパスをコピー',
            click: () => {
              event.sender.send(EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH, item);
            },
          })
        );

        menu.append(
          new MenuItem({
            label: '📂 リンク先の親フォルダーを開く',
            click: () => {
              event.sender.send(EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER, item);
            },
          })
        );
      }

      menu.popup({ window: senderWindow });
    } catch (error) {
      console.error('Failed to show launcher context menu:', error);
    }
  });
}

/**
 * WorkspaceContextMenu用のネイティブメニューハンドラーを設定
 */
export function setupWorkspaceContextMenuHandler(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    SHOW_WORKSPACE_CONTEXT_MENU,
    async (event, item: WorkspaceItem, groups: WorkspaceGroup[]): Promise<void> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow || senderWindow.isDestroyed()) {
          return;
        }

        const menu = new Menu();
        const hasGroup = item.groupId !== undefined;
        const hasParentFolder = item.type !== 'url' && item.type !== 'customUri';
        const isShortcut = item.originalPath !== undefined;

        // 表示名を変更
        menu.append(
          new MenuItem({
            label: '✏️ 表示名を変更',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_MENU_RENAME_ITEM, item.id);
            },
          })
        );

        // 起動
        menu.append(
          new MenuItem({
            label: '▶️ 起動',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_MENU_LAUNCH_ITEM, item.id);
            },
          })
        );

        menu.append(new MenuItem({ type: 'separator' }));

        // パスをコピー
        menu.append(
          new MenuItem({
            label: '📋 パスをコピー',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_MENU_COPY_PATH, item.id);
            },
          })
        );

        // 親フォルダー関連（URLとcustomURI以外）
        if (hasParentFolder) {
          menu.append(
            new MenuItem({
              label: '📋 親フォルダーのパスをコピー',
              click: () => {
                event.sender.send(EVENT_WORKSPACE_MENU_COPY_PARENT_PATH, item.id);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📂 親フォルダーを開く',
              click: () => {
                event.sender.send(EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER, item.id);
              },
            })
          );
        }

        // ショートカット関連
        if (isShortcut) {
          menu.append(new MenuItem({ type: 'separator' }));

          menu.append(
            new MenuItem({
              label: '📋 リンク先のパスをコピー',
              click: () => {
                event.sender.send(EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH, item.id);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📋 リンク先の親フォルダーのパスをコピー',
              click: () => {
                event.sender.send(EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH, item.id);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📂 リンク先の親フォルダーを開く',
              click: () => {
                event.sender.send(EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER, item.id);
              },
            })
          );
        }

        menu.append(new MenuItem({ type: 'separator' }));

        // グループから削除（グループに所属している場合のみ）
        if (hasGroup) {
          menu.append(
            new MenuItem({
              label: '📤 グループから削除',
              click: () => {
                event.sender.send(EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP, item.id);
              },
            })
          );

          menu.append(new MenuItem({ type: 'separator' }));
        }

        // ワークスペースから削除
        menu.append(
          new MenuItem({
            label: '🗑️ ワークスペースから削除',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_MENU_REMOVE_ITEM, item.id);
            },
          })
        );

        menu.popup({ window: senderWindow });
      } catch (error) {
        console.error('Failed to show workspace context menu:', error);
      }
    }
  );
}

/**
 * WorkspaceGroupContextMenu用のネイティブメニューハンドラーを設定
 */
export function setupWorkspaceGroupContextMenuHandler(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    SHOW_WORKSPACE_GROUP_CONTEXT_MENU,
    async (event, group: WorkspaceGroup): Promise<void> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow || senderWindow.isDestroyed()) {
          return;
        }

        const menu = new Menu();

        // グループ名を変更
        menu.append(
          new MenuItem({
            label: '✏️ グループ名を変更',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_GROUP_MENU_RENAME, group.id);
            },
          })
        );

        // カラーを変更（Reactカラーピッカーを表示）
        menu.append(
          new MenuItem({
            label: '🎨 カラーを変更',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER, group.id);
            },
          })
        );

        menu.append(new MenuItem({ type: 'separator' }));

        // テキストでコピー
        menu.append(
          new MenuItem({
            label: '📋 テキストでコピー',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT, group.id);
            },
          })
        );

        menu.append(new MenuItem({ type: 'separator' }));

        // グループをアーカイブ
        menu.append(
          new MenuItem({
            label: '📦 グループをアーカイブ',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_GROUP_MENU_ARCHIVE, group.id);
            },
          })
        );

        // グループを削除
        menu.append(
          new MenuItem({
            label: '🗑️ グループを削除',
            click: () => {
              event.sender.send(EVENT_WORKSPACE_GROUP_MENU_DELETE, group.id);
            },
          })
        );

        menu.popup({ window: senderWindow });
      } catch (error) {
        console.error('Failed to show workspace group context menu:', error);
      }
    }
  );
}

/**
 * 全てのコンテキストメニューハンドラーを設定
 */
export function setupContextMenuHandlers(getMainWindow: () => BrowserWindow | null) {
  setupAdminItemContextMenuHandler(getMainWindow);
  setupLauncherContextMenuHandler(getMainWindow);
  setupWorkspaceContextMenuHandler(getMainWindow);
  setupWorkspaceGroupContextMenuHandler(getMainWindow);
}
