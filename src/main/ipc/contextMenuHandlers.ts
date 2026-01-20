/**
 * コンテキストメニュー用IPCハンドラー
 * 全てのReactコンテキストメニューをElectronのネイティブメニューに変換
 */
import { ipcMain, BrowserWindow, Menu, MenuItem } from 'electron';
import type {
  AppItem,
  WorkspaceItem,
  WorkspaceGroup,
  WindowInfo,
  VirtualDesktopInfo,
} from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { isGroupItem } from '@common/types/guards';

/**
 * AdminItemManagerContextMenu用のネイティブメニューハンドラーを設定
 */
export function setupAdminItemContextMenuHandler(_getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_ADMIN_ITEM_CONTEXT_MENU,
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
              event.sender.send(IPC_CHANNELS.EVENT_ADMIN_MENU_DUPLICATE_ITEMS);
            },
          })
        );

        // 詳細編集（単一行のみ）
        if (isSingleLine) {
          menu.append(
            new MenuItem({
              label: '✏️ 詳細編集',
              click: () => {
                event.sender.send(IPC_CHANNELS.EVENT_ADMIN_MENU_EDIT_ITEM);
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
              event.sender.send(IPC_CHANNELS.EVENT_ADMIN_MENU_DELETE_ITEMS);
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
export function setupLauncherContextMenuHandler(_getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_LAUNCHER_CONTEXT_MENU,
    async (event, item: AppItem): Promise<void> => {
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
              event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM, item);
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
              event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE, item);
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
              event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH, item);
            },
          })
        );

        // 親フォルダー関連（URLとcustomURI以外）
        if (hasParentFolder) {
          menu.append(
            new MenuItem({
              label: '📋 親フォルダーのパスをコピー',
              click: () => {
                event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH, item);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📂 親フォルダーを開く',
              click: () => {
                event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER, item);
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
                event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH, item);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📋 リンク先の親フォルダーのパスをコピー',
              click: () => {
                event.sender.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH, item);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📂 リンク先の親フォルダーを開く',
              click: () => {
                event.sender.send(
                  IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
                  item
                );
              },
            })
          );
        }

        menu.popup({ window: senderWindow });
      } catch (error) {
        console.error('Failed to show launcher context menu:', error);
      }
    }
  );
}

/**
 * WorkspaceContextMenu用のネイティブメニューハンドラーを設定
 */
export function setupWorkspaceContextMenuHandler(_getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WORKSPACE_CONTEXT_MENU,
    async (event, item: WorkspaceItem, _groups: WorkspaceGroup[]): Promise<void> => {
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
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_RENAME_ITEM, item.id);
            },
          })
        );

        // 起動
        menu.append(
          new MenuItem({
            label: '▶️ 起動',
            click: () => {
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_LAUNCH_ITEM, item.id);
            },
          })
        );

        menu.append(new MenuItem({ type: 'separator' }));

        // パスをコピー
        menu.append(
          new MenuItem({
            label: '📋 パスをコピー',
            click: () => {
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PATH, item.id);
            },
          })
        );

        // 親フォルダー関連（URLとcustomURI以外）
        if (hasParentFolder) {
          menu.append(
            new MenuItem({
              label: '📋 親フォルダーのパスをコピー',
              click: () => {
                event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PARENT_PATH, item.id);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📂 親フォルダーを開く',
              click: () => {
                event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER, item.id);
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
                event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH, item.id);
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📋 リンク先の親フォルダーのパスをコピー',
              click: () => {
                event.sender.send(
                  IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH,
                  item.id
                );
              },
            })
          );

          menu.append(
            new MenuItem({
              label: '📂 リンク先の親フォルダーを開く',
              click: () => {
                event.sender.send(
                  IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
                  item.id
                );
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
                event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP, item.id);
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
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_ITEM, item.id);
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
export function setupWorkspaceGroupContextMenuHandler(_getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WORKSPACE_GROUP_CONTEXT_MENU,
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
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_RENAME, group.id);
            },
          })
        );

        // カラーを変更（Reactカラーピッカーを表示）
        menu.append(
          new MenuItem({
            label: '🎨 カラーを変更',
            click: () => {
              event.sender.send(
                IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER,
                group.id
              );
            },
          })
        );

        menu.append(new MenuItem({ type: 'separator' }));

        // テキストでコピー
        menu.append(
          new MenuItem({
            label: '📋 テキストでコピー',
            click: () => {
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT, group.id);
            },
          })
        );

        menu.append(new MenuItem({ type: 'separator' }));

        // グループをアーカイブ
        menu.append(
          new MenuItem({
            label: '📦 グループをアーカイブ',
            click: () => {
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ARCHIVE, group.id);
            },
          })
        );

        // グループを削除
        menu.append(
          new MenuItem({
            label: '🗑️ グループを削除',
            click: () => {
              event.sender.send(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DELETE, group.id);
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
 * WindowContextMenu用のネイティブメニューハンドラーを設定
 */
export function setupWindowContextMenuHandler(_getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_WINDOW_CONTEXT_MENU,
    async (
      event,
      windowInfo: WindowInfo,
      desktopInfo: VirtualDesktopInfo,
      isPinned: boolean
    ): Promise<void> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow || senderWindow.isDestroyed()) {
          return;
        }

        const menu = new Menu();

        // アクティブにする
        menu.append(
          new MenuItem({
            label: '▶️ アクティブにする',
            click: () => {
              event.sender.send(IPC_CHANNELS.EVENT_WINDOW_MENU_ACTIVATE, windowInfo);
            },
          })
        );

        menu.append(new MenuItem({ type: 'separator' }));

        // 仮想デスクトップへの移動（サブメニュー）
        const virtualDesktopSubmenu = new Menu();

        // 仮想デスクトップがサポートされている場合のみサブメニューを有効化
        if (desktopInfo.supported && desktopInfo.desktopCount > 1) {
          // 各デスクトップへの移動メニュー
          for (let i = 1; i <= desktopInfo.desktopCount; i++) {
            const isCurrentDesktop =
              windowInfo.desktopNumber !== undefined && i === windowInfo.desktopNumber;
            const label = isCurrentDesktop ? `✓ デスクトップ ${i} (現在)` : `🖥️ デスクトップ ${i}`;

            virtualDesktopSubmenu.append(
              new MenuItem({
                label,
                enabled: !isCurrentDesktop,
                click: () => {
                  event.sender.send(IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP, windowInfo.hwnd, i);
                },
              })
            );
          }

          menu.append(
            new MenuItem({
              label: '🖥️ 仮想デスクトップへの移動',
              submenu: virtualDesktopSubmenu,
            })
          );
        } else {
          // 仮想デスクトップがサポートされていない場合は無効化
          menu.append(
            new MenuItem({
              label: '🖥️ 仮想デスクトップへの移動',
              enabled: false,
            })
          );
        }

        // 固定/固定解除（仮想デスクトップがサポートされている場合のみ）
        if (desktopInfo.supported) {
          menu.append(new MenuItem({ type: 'separator' }));

          if (isPinned) {
            // 固定解除
            menu.append(
              new MenuItem({
                label: '📌 固定を解除',
                click: () => {
                  event.sender.send(IPC_CHANNELS.UNPIN_WINDOW, windowInfo.hwnd);
                },
              })
            );
          } else {
            // 固定
            menu.append(
              new MenuItem({
                label: '📌 全デスクトップに固定',
                click: () => {
                  event.sender.send(IPC_CHANNELS.PIN_WINDOW, windowInfo.hwnd);
                },
              })
            );
          }
        }

        menu.popup({ window: senderWindow });
      } catch (error) {
        console.error('Failed to show window context menu:', error);
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
  setupWindowContextMenuHandler(getMainWindow);
}
